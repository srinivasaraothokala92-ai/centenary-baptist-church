import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { supabase } from './supabaseClient.js';
import { logAudit } from './logAudit.js';
import { requireAuth, requireAdmin } from './authMiddleware.js';

const router = express.Router();

// This bucket is intentionally private. The API returns short-lived signed
// URLs only after it has filtered public records to `published`.
const POSTER_BUCKET = 'event-posters';
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const signedUrlTtlFromEnv = Number.parseInt(process.env.EVENT_POSTER_SIGNED_URL_TTL || '3600', 10);
const SIGNED_URL_TTL_SECONDS = Number.isInteger(signedUrlTtlFromEnv)
  ? Math.min(Math.max(signedUrlTtlFromEnv, 60), 86_400)
  : 3600;

const MIME_TO_EXTENSION = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
    fields: 5,
    fieldSize: 8 * 1024
  }
});

class ValidationError extends Error {}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function firstProvided(body, keys) {
  for (const key of keys) {
    if (hasOwn(body, key)) return { found: true, value: body[key] };
  }
  return { found: false, value: undefined };
}

function cleanText(value, field, maxLength, { required = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (required) throw new ValidationError(`${field} is required.`);
    return null;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be text.`);
  }

  const cleaned = value.replace(/\r\n/g, '\n').trim();
  if (!cleaned) {
    if (required) throw new ValidationError(`${field} is required.`);
    return null;
  }
  if (cleaned.length > maxLength) {
    throw new ValidationError(`${field} must be ${maxLength} characters or fewer.`);
  }
  // Poster metadata is plain text. Rejecting markup prevents a saved title or
  // description from becoming stored XSS in an implementation that accidentally
  // uses innerHTML to render CMS content.
  if (/[<>\u0000]/.test(cleaned)) {
    throw new ValidationError(`${field} must not contain HTML or control characters.`);
  }
  return cleaned;
}

function cleanDate(value, field) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`${field} must be a valid YYYY-MM-DD date.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ValidationError(`${field} must be a valid calendar date.`);
  }
  return value;
}

function cleanTime(value, field) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) {
    throw new ValidationError(`${field} must be a valid 24-hour time.`);
  }
  return value;
}

function cleanDisplayOrder(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > 100000) {
    throw new ValidationError('displayOrder must be a whole number between 1 and 100000.');
  }
  return number;
}

function cleanStatus(value) {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !['draft', 'published', 'unpublished'].includes(value)) {
    throw new ValidationError('status must be draft, published, or unpublished.');
  }
  return value;
}

function cleanBoolean(value, field) {
  if (typeof value !== 'boolean') throw new ValidationError(`${field} must be true or false.`);
  return value;
}

function cleanImageUrl(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new ValidationError('imageUrl must be a URL or a site-relative path.');
  const url = value.trim();
  if (!url || url.length > 2048 || /[\u0000\r\n]/.test(url)) {
    throw new ValidationError('imageUrl is invalid.');
  }

  // Site-static originals, such as /images/posters/poster-1.jpeg, are valid.
  if (url.startsWith('/')) {
    if (url.startsWith('//') || url.includes('\\')) {
      throw new ValidationError('imageUrl is invalid.');
    }
    return url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new ValidationError('imageUrl must use HTTP or HTTPS.');
    }
    return parsed.toString();
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError('imageUrl is invalid.');
  }
}

function cleanStoragePath(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new ValidationError('storagePath is invalid.');
  const path = value.trim();
  // Only accept paths generated by this route. This prevents an admin client
  // from making a poster reference an unrelated object in the bucket.
  if (
    path.length > 512 ||
    path.includes('..') ||
    !/^posters\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(?:jpg|jpeg|png|webp)$/i.test(path)
  ) {
    throw new ValidationError('storagePath is invalid.');
  }
  return path;
}

function hasImage(imageUrl, storagePath) {
  return Boolean((typeof imageUrl === 'string' && imageUrl.trim()) || (typeof storagePath === 'string' && storagePath.trim()));
}

function parsePosterPayload(body, { creating = false } = {}) {
  if (!isObject(body)) throw new ValidationError('A JSON poster object is required.');

  const payload = {};
  const title = firstProvided(body, ['title']);
  if (title.found) payload.title = cleanText(title.value, 'title', 160, { required: true });
  if (creating && !title.found) throw new ValidationError('title is required.');

  const category = firstProvided(body, ['category']);
  if (category.found) payload.category = cleanText(category.value, 'category', 120);

  // `subtitle` is accepted only for backwards compatibility with the previous
  // local JSON poster editor. New clients should use `description`.
  const description = firstProvided(body, ['description', 'subtitle']);
  if (description.found) payload.description = cleanText(description.value, 'description', 2000);

  const eventDate = firstProvided(body, ['eventDate', 'event_date']);
  if (eventDate.found) payload.event_date = cleanDate(eventDate.value, 'eventDate');

  const eventEndDate = firstProvided(body, ['eventEndDate', 'event_end_date']);
  if (eventEndDate.found) payload.event_end_date = cleanDate(eventEndDate.value, 'eventEndDate');

  const startTime = firstProvided(body, ['startTime', 'start_time']);
  if (startTime.found) payload.start_time = cleanTime(startTime.value, 'startTime');

  const venue = firstProvided(body, ['venue']);
  if (venue.found) payload.venue = cleanText(venue.value, 'venue', 300);

  const contactInfo = firstProvided(body, ['contactInfo', 'contact_info']);
  if (contactInfo.found) payload.contact_info = cleanText(contactInfo.value, 'contactInfo', 300);

  const status = firstProvided(body, ['status']);
  const active = firstProvided(body, ['active']);
  if (status.found) {
    payload.status = cleanStatus(status.value);
  } else if (active.found) {
    payload.status = cleanBoolean(active.value, 'active') ? 'published' : 'unpublished';
  }

  const displayOrder = firstProvided(body, ['displayOrder', 'display_order', 'order']);
  if (displayOrder.found) payload.display_order = cleanDisplayOrder(displayOrder.value);

  const dateNeedsReview = firstProvided(body, ['dateNeedsReview', 'date_needs_review']);
  if (dateNeedsReview.found) payload.date_needs_review = cleanBoolean(dateNeedsReview.value, 'dateNeedsReview');

  const adminNote = firstProvided(body, ['adminNote', 'admin_note']);
  if (adminNote.found) payload.admin_note = cleanText(adminNote.value, 'adminNote', 1000);

  const imageUrl = firstProvided(body, ['imageUrl', 'image_url', 'image']);
  const storagePath = firstProvided(body, ['storagePath', 'storage_path']);
  const parsedStoragePath = storagePath.found ? cleanStoragePath(storagePath.value) : undefined;
  const parsedImageUrl = imageUrl.found ? cleanImageUrl(imageUrl.value) : undefined;

  if (storagePath.found) payload.storage_path = parsedStoragePath;
  if (imageUrl.found) payload.image_url = parsedImageUrl;

  // A private-bucket image is authoritative. Never save a temporary signed URL
  // from the upload response into the database.
  if (parsedStoragePath) {
    payload.storage_path = parsedStoragePath;
    payload.image_url = null;
  } else if (imageUrl.found) {
    // Supplying a normal URL replaces any previously associated bucket object.
    payload.storage_path = null;
  }

  return payload;
}

function finalValue(existing, changes, key) {
  return hasOwn(changes, key) ? changes[key] : existing?.[key];
}

function validateFinalPoster(existing, changes) {
  const finalImageUrl = finalValue(existing, changes, 'image_url');
  const finalStoragePath = finalValue(existing, changes, 'storage_path');
  if (!hasImage(finalImageUrl, finalStoragePath)) {
    throw new ValidationError('A poster image is required.');
  }

  const eventDate = finalValue(existing, changes, 'event_date');
  const eventEndDate = finalValue(existing, changes, 'event_end_date');
  if (eventDate && eventEndDate && eventEndDate < eventDate) {
    throw new ValidationError('eventEndDate cannot be before eventDate.');
  }
}

function isValidUuid(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function requireValidPosterId(id) {
  if (!isValidUuid(id)) throw new ValidationError('Invalid poster id.');
}

function detectImageMime(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'image/png';
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'image/webp';
  return null;
}

function optionalAdminForList(req, res, next) {
  // No token means a public read. A provided token must be a real, active admin
  // token before it is allowed to expand the result to drafts/unpublished rows.
  if (!req.headers.authorization) {
    req.posterAdminRead = false;
    return next();
  }
  return requireAuth(req, res, () => requireAdmin(req, res, () => {
    req.posterAdminRead = true;
    next();
  }));
}

async function getPoster(id) {
  const { data, error } = await supabase
    .from('event_posters')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function createSignedPosterUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(POSTER_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw error || new Error('Could not create a signed poster image URL.');
  }
  return data.signedUrl;
}

async function presentPoster(row, { includeAdminFields = false } = {}) {
  if (!row) return null;

  let imageUrl = row.image_url || null;
  if (row.storage_path) {
    try {
      imageUrl = await createSignedPosterUrl(row.storage_path);
    } catch (error) {
      console.error(`[event-posters] Could not sign image for ${row.id}:`, error.message);
      return null;
    }
  }
  if (!hasImage(imageUrl, null)) return null;

  const poster = {
    id: String(row.id),
    title: row.title,
    category: row.category || null,
    description: row.description || null,
    imageUrl,
    eventDate: row.event_date || null,
    eventEndDate: row.event_end_date || null,
    startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
    venue: row.venue || null,
    contactInfo: row.contact_info || null,
    status: row.status,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // Temporary compatibility aliases for the older poster components. New
    // callers should use the camelCase fields above.
    image: imageUrl,
    subtitle: row.description || '',
    active: row.status === 'published',
    order: row.display_order
  };

  if (includeAdminFields) {
    poster.storagePath = row.storage_path || null;
    poster.dateNeedsReview = Boolean(row.date_needs_review);
    poster.adminNote = row.admin_note || null;
    poster.createdBy = row.created_by || null;
    poster.updatedBy = row.updated_by || null;
  }

  return poster;
}

async function presentPosters(rows, options) {
  const results = await Promise.all(rows.map((row) => presentPoster(row, options)));
  return results.filter(Boolean);
}

async function nextDisplayOrder() {
  const { data, error } = await supabase
    .from('event_posters')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1);
  if (error) throw error;
  const highest = data?.[0]?.display_order || 0;
  return Math.min(highest + 1, 100000);
}

async function removeStorageObjectIfUnreferenced(storagePath) {
  if (!storagePath) return { removed: false, stillReferenced: false };
  const { data: references, error: referenceError } = await supabase
    .from('event_posters')
    .select('id')
    .eq('storage_path', storagePath)
    .limit(1);
  if (referenceError) throw referenceError;
  if (references?.length) return { removed: false, stillReferenced: true };

  const { error: removeError } = await supabase.storage
    .from(POSTER_BUCKET)
    .remove([storagePath]);
  if (removeError) throw removeError;
  return { removed: true, stillReferenced: false };
}

function logUnexpected(label, error) {
  console.error(`[event-posters] ${label}:`, error?.message || error);
}

// GET /api/event-posters
// Public callers receive published records only. A valid admin Bearer token
// receives all publication states for the CMS list.
router.get('/', optionalAdminForList, async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), req.posterAdminRead ? 200 : 100)
      : (req.posterAdminRead ? 200 : 100);

    let query = supabase
      .from('event_posters')
      .select('*')
      .order('display_order', { ascending: true })
      .order('event_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!req.posterAdminRead) query = query.eq('status', 'published');

    const { data, error } = await query;
    if (error) throw error;

    const posters = await presentPosters(data || [], { includeAdminFields: Boolean(req.posterAdminRead) });
    // Do not let shared caches serve a Bearer-authenticated list to a public
    // caller. Public records may be briefly cached; signed image URLs are short-lived.
    res.set('Vary', 'Authorization');
    res.set('Cache-Control', req.posterAdminRead ? 'private, no-store' : 'public, max-age=60');
    res.json(posters);
  } catch (error) {
    logUnexpected('Failed to fetch posters', error);
    const isMissingTable = error?.code === '42P01' || error?.message?.includes('schema cache');
    if (isMissingTable && !req.posterAdminRead) {
      res.set('Vary', 'Authorization');
      res.set('Cache-Control', 'public, max-age=60');
      return res.json([]);
    }
    if (isMissingTable && req.posterAdminRead) {
      return res.status(503).json({
        error: 'Database table public.event_posters is missing. Please run migration-06-event-posters.sql in the Supabase SQL Editor.'
      });
    }
    res.status(500).json({ error: 'Failed to fetch event posters.' });
  }
});

// POST /api/event-posters/upload
// Upload a new original image before creating/updating its metadata record.
router.post('/upload', requireAuth, requireAdmin, (req, res) => {
  upload.single('file')(req, res, async (uploadError) => {
    if (uploadError) {
      if (uploadError.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Poster image is too large. Maximum size is 8 MB.' });
      }
      return res.status(400).json({ error: 'Invalid poster upload. Upload one JPEG, PNG, or WebP image.' });
    }

    try {
      if (!req.file) return res.status(400).json({ error: 'Poster image file is required.' });

      const detectedMime = detectImageMime(req.file.buffer);
      const declaredMime = String(req.file.mimetype || '').toLowerCase();
      if (!detectedMime || detectedMime !== declaredMime || !MIME_TO_EXTENSION[detectedMime]) {
        return res.status(400).json({ error: 'Invalid poster image. Only real JPEG, PNG, and WebP files are allowed.' });
      }

      const now = new Date();
      const storagePath = `posters/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${MIME_TO_EXTENSION[detectedMime]}`;
      const { error: storageError } = await supabase.storage
        .from(POSTER_BUCKET)
        .upload(storagePath, req.file.buffer, {
          contentType: detectedMime,
          cacheControl: '31536000',
          upsert: false
        });

      if (storageError) {
        logUnexpected('Poster upload failed', storageError);
        return res.status(500).json({ error: 'Failed to upload poster image.' });
      }

      let previewUrl;
      try {
        previewUrl = await createSignedPosterUrl(storagePath);
      } catch (signingError) {
        // Do not leave an orphan if Storage accepted the file but URL signing
        // failed immediately afterwards.
        await supabase.storage.from(POSTER_BUCKET).remove([storagePath]);
        throw signingError;
      }

      await logAudit({
        action: 'uploaded',
        entityType: 'event_poster',
        entityId: storagePath,
        entityName: req.file.originalname,
        userEmail: req.user.email,
        ip: req.ip
      });

      // imageUrl is a short-lived preview; persist storagePath when creating
      // the poster record. `url` remains for clients using the existing upload
      // route response shape.
      res.status(201).json({
        storagePath,
        imageUrl: previewUrl,
        previewUrl,
        url: previewUrl,
        expiresIn: SIGNED_URL_TTL_SECONDS
      });
    } catch (error) {
      logUnexpected('Poster image upload error', error);
      res.status(500).json({ error: 'Failed to upload poster image.' });
    }
  });
});

// PUT /api/event-posters/reorder
router.put('/reorder', requireAuth, requireAdmin, async (req, res) => {
  try {
    const orderedIds = req.body?.orderedIds;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0 || orderedIds.length > 200) {
      throw new ValidationError('orderedIds must be a non-empty array of poster IDs.');
    }
    if (new Set(orderedIds).size !== orderedIds.length || orderedIds.some((id) => !isValidUuid(id))) {
      throw new ValidationError('orderedIds must contain unique valid poster IDs.');
    }

    const { data: current, error: currentError } = await supabase
      .from('event_posters')
      .select('id, title');
    if (currentError) throw currentError;

    const currentIds = new Set((current || []).map((poster) => String(poster.id)));
    if (currentIds.size !== orderedIds.length || orderedIds.some((id) => !currentIds.has(id))) {
      throw new ValidationError('The reorder list must include every current poster exactly once. Refresh and try again.');
    }

    await Promise.all(orderedIds.map(async (id, index) => {
      const { error } = await supabase
        .from('event_posters')
        .update({ display_order: index + 1, updated_by: req.user.id })
        .eq('id', id);
      if (error) throw error;
    }));

    await logAudit({
      action: 'reordered',
      entityType: 'event_poster',
      entityName: 'Event posters',
      userEmail: req.user.email,
      ip: req.ip,
      details: { orderedIds }
    });

    const { data, error } = await supabase
      .from('event_posters')
      .select('*')
      .order('display_order', { ascending: true })
      .order('event_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw error;

    res.json(await presentPosters(data || [], { includeAdminFields: true }));
  } catch (error) {
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    logUnexpected('Failed to reorder posters', error);
    res.status(500).json({ error: 'Failed to reorder event posters.' });
  }
});

// POST /api/event-posters/:id/publish
router.post('/:id/publish', requireAuth, requireAdmin, async (req, res) => {
  try {
    requireValidPosterId(req.params.id);
    const { data, error } = await supabase
      .from('event_posters')
      .update({ status: 'published', updated_by: req.user.id })
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Poster not found.' });

    await logAudit({ action: 'published', entityType: 'event_poster', entityId: data.id, entityName: data.title, userEmail: req.user.email, ip: req.ip });
    const poster = await presentPoster(data, { includeAdminFields: true });
    if (!poster) throw new Error('Poster image could not be resolved.');
    res.json(poster);
  } catch (error) {
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    logUnexpected('Failed to publish poster', error);
    res.status(500).json({ error: 'Failed to publish event poster.' });
  }
});

// POST /api/event-posters/:id/unpublish
router.post('/:id/unpublish', requireAuth, requireAdmin, async (req, res) => {
  try {
    requireValidPosterId(req.params.id);
    const { data, error } = await supabase
      .from('event_posters')
      .update({ status: 'unpublished', updated_by: req.user.id })
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Poster not found.' });

    await logAudit({ action: 'unpublished', entityType: 'event_poster', entityId: data.id, entityName: data.title, userEmail: req.user.email, ip: req.ip });
    const poster = await presentPoster(data, { includeAdminFields: true });
    if (!poster) throw new Error('Poster image could not be resolved.');
    res.json(poster);
  } catch (error) {
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    logUnexpected('Failed to unpublish poster', error);
    res.status(500).json({ error: 'Failed to unpublish event poster.' });
  }
});

// POST /api/event-posters
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const poster = parsePosterPayload(req.body, { creating: true });
    validateFinalPoster(null, poster);
    if (poster.display_order === undefined) poster.display_order = await nextDisplayOrder();
    if (poster.status === undefined) poster.status = 'draft';
    poster.created_by = req.user.id;
    poster.updated_by = req.user.id;

    const { data, error } = await supabase
      .from('event_posters')
      .insert([poster])
      .select('*')
      .single();
    if (error) throw error;

    await logAudit({ action: 'created', entityType: 'event_poster', entityId: data.id, entityName: data.title, userEmail: req.user.email, ip: req.ip });
    const response = await presentPoster(data, { includeAdminFields: true });
    if (!response) throw new Error('Poster image could not be resolved.');
    res.status(201).json(response);
  } catch (error) {
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    logUnexpected('Failed to create poster', error);
    res.status(500).json({ error: 'Failed to create event poster.' });
  }
});

// PUT /api/event-posters/:id
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    requireValidPosterId(req.params.id);
    const existing = await getPoster(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Poster not found.' });

    const changes = parsePosterPayload(req.body);
    if (Object.keys(changes).length === 0) throw new ValidationError('At least one editable poster field is required.');
    validateFinalPoster(existing, changes);
    changes.updated_by = req.user.id;

    const { data, error } = await supabase
      .from('event_posters')
      .update(changes)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;

    let imageCleanupPending = false;
    if (existing.storage_path && existing.storage_path !== data.storage_path) {
      try {
        await removeStorageObjectIfUnreferenced(existing.storage_path);
      } catch (cleanupError) {
        imageCleanupPending = true;
        logUnexpected(`Could not remove replaced poster image ${existing.storage_path}`, cleanupError);
        await logAudit({
          action: 'storage_cleanup_failed',
          entityType: 'event_poster',
          entityId: data.id,
          entityName: data.title,
          userEmail: req.user.email,
          ip: req.ip,
          details: { storagePath: existing.storage_path, operation: 'replace' }
        });
      }
    }

    await logAudit({ action: 'updated', entityType: 'event_poster', entityId: data.id, entityName: data.title, userEmail: req.user.email, ip: req.ip });
    const response = await presentPoster(data, { includeAdminFields: true });
    if (!response) throw new Error('Poster image could not be resolved.');
    res.json({ ...response, imageCleanupPending });
  } catch (error) {
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    logUnexpected('Failed to update poster', error);
    res.status(500).json({ error: 'Failed to update event poster.' });
  }
});

// DELETE /api/event-posters/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    requireValidPosterId(req.params.id);
    const existing = await getPoster(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Poster not found.' });

    const { error } = await supabase
      .from('event_posters')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;

    let imageCleanupPending = false;
    if (existing.storage_path) {
      try {
        await removeStorageObjectIfUnreferenced(existing.storage_path);
      } catch (cleanupError) {
        imageCleanupPending = true;
        logUnexpected(`Could not remove deleted poster image ${existing.storage_path}`, cleanupError);
        await logAudit({
          action: 'storage_cleanup_failed',
          entityType: 'event_poster',
          entityId: existing.id,
          entityName: existing.title,
          userEmail: req.user.email,
          ip: req.ip,
          details: { storagePath: existing.storage_path, operation: 'delete' }
        });
      }
    }

    await logAudit({ action: 'deleted', entityType: 'event_poster', entityId: existing.id, entityName: existing.title, userEmail: req.user.email, ip: req.ip });
    res.json({ success: true, imageCleanupPending });
  } catch (error) {
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    logUnexpected('Failed to delete poster', error);
    res.status(500).json({ error: 'Failed to delete event poster.' });
  }
});

export default router;
