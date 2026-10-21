import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Vercel sits behind a reverse proxy. Trusting its first proxy hop makes req.ip
// usable for rate limiting instead of treating every visitor as the platform.
app.set('trust proxy', 1);

// Security Headers
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).origin : '';
const apiBase = process.env.VITE_API_BASE_URL ? new URL(process.env.VITE_API_BASE_URL).origin : '';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for numerous inline event handlers (onclick, onmouseover)
        "https://www.googletagmanager.com" // Required for GA4 (injected via cookieConsent.js)
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for inline styles used heavily across components
        "https://fonts.googleapis.com" // Required for Google Fonts
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com", // Google Fonts
        "data:" // In-case of data URI fonts/icons
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://images.unsplash.com", // Used in AdminDashboard demo placeholders
        supabaseHost // Supabase Storage images
      ].filter(Boolean),
      connectSrc: [
        "'self'",
        "https://www.google-analytics.com",
        "https://analytics.google.com",
        "https://stats.g.doubleclick.net",
        supabaseHost, // Supabase API and Auth
        apiBase // External API base if configured
      ].filter(Boolean),
      mediaSrc: [
        "'self'",
        supabaseHost // Media potentially loaded from Supabase
      ].filter(Boolean),
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"], // Prevents clickjacking
      frameSrc: [
        "'self'",
        "https://www.google.com", // Google Maps iframe
        "https://www.youtube.com" // Allowed for potential video embeds
      ]
    }
  },
  crossOriginEmbedderPolicy: false // Disabled for cross-origin resources (Supabase, Maps)
}));

// CORS Configuration
// ─────────────────────────────────────────────────────────────
// In production, CORS_ORIGIN MUST be set to your production domain(s).
// Comma-separated for multiple origins: https://a.com,https://b.com
// If CORS_ORIGIN is missing in production, the server refuses to start
// rather than silently serving with broken/blocked API access.
// In development, localhost origins are allowed automatically.
// Vercel sets NODE_ENV itself. APP_ENV keeps local server configuration out of
// Vite's .env processing, which rejects user-defined NODE_ENV values.
const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';

if (isProduction && !process.env.CORS_ORIGIN) {
  console.error('[FATAL] CORS_ORIGIN environment variable is required in production.');
  console.error('[FATAL] Set CORS_ORIGIN=https://your-domain.com in your .env or hosting environment.');
  process.exit(1);
}

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow server-to-server requests (no origin header) in development only
    if (!origin && !isProduction) {
      return callback(null, true);
    }
    if (origin && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Return false (not an Error) so cors sends a clean 403 instead of
    // propagating an unhandled error to Express 5's error handler as a 500.
    callback(null, false);
  },
  credentials: true
}));

// ─────────────────────────────────────────────────────────────────────────────
// Persistent Rate Limiter — Supabase backed (works across serverless instances)
// Industry-standard approach used by companies like Vercel, Linear, Resend.
// Falls back gracefully if DB is unreachable — never blocks legitimate users.
// Requires: rate_limits table (see rate-limits-migration.sql)
// ─────────────────────────────────────────────────────────────────────────────
const _rl = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX       = 3;         // max submissions per window

async function isRateLimited(ip, endpoint = 'contact') {
  try {
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

    const { data: existing } = await _rl
      .from('rate_limits')
      .select('count, window_start')
      .eq('ip', ip)
      .eq('endpoint', endpoint)
      .maybeSingle();

    // No record or window expired — fresh start
    if (!existing || existing.window_start < windowStart) {
      await _rl.from('rate_limits').upsert(
        { ip, endpoint, count: 1, window_start: new Date().toISOString() },
        { onConflict: 'ip,endpoint' }
      );
      return false;
    }

    // Within window — check count
    if (existing.count >= RATE_LIMIT_MAX) return true;

    // Increment count
    await _rl
      .from('rate_limits')
      .update({ count: existing.count + 1 })
      .eq('ip', ip)
      .eq('endpoint', endpoint);

    return false;
  } catch (err) {
    // Never block legitimate users due to a DB error
    console.error('[RateLimit] DB check failed, allowing request:', err.message);
    return false;
  }
}

// Factory: returns a middleware scoped to an explicitly-named endpoint bucket.
// Fixes the bug where req.path inside a mounted sub-router resolves to '/'
// (i.e. the relative path), causing all endpoints to share the same 'global' bucket.
function makeRateLimitMiddleware(endpointName) {
  return async function rateLimitMiddleware(req, res, next) {
    if (req.method === 'POST') {
      const ip = req.ip || req.socket?.remoteAddress || 'unknown';
      const limited = await isRateLimited(ip, endpointName);
      if (limited) {
        return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
      }
    }
    next();
  };
}

app.use(express.json());
import eventsRoutes from './eventsRoutes.js';
app.use('/api/events/:id/register', makeRateLimitMiddleware('event-registration'));
app.use('/api/events', eventsRoutes);

import donationRoutes from './donationRoutes.js';
app.use('/api/donations', makeRateLimitMiddleware('donations'), donationRoutes);


import contactRoutes from './contactRoutes.js';
import visitorRoutes from './visitorRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import galleryRoutes from './galleryRoutes.js';
import sermonRoutes from './sermonRoutes.js';
import adminUserRoutes from './adminUserRoutes.js';
import siteSettingsRoutes from './siteSettingsRoutes.js';

// Apply rate limiting middleware to the specific post endpoint inside contactRoutes
app.use('/api/contact', makeRateLimitMiddleware('contact'), contactRoutes);

app.use('/api/visitor', makeRateLimitMiddleware('visitor'), visitorRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/sermons', sermonRoutes);
app.use('/api/admin-users', adminUserRoutes);
app.use('/api/settings', siteSettingsRoutes);

import ministriesRoutes from './ministriesRoutes.js';
app.use('/api/ministries', ministriesRoutes);

import campusRoutes from './campusRoutes.js';
app.use('/api/campus', campusRoutes);

import mediaRoutes from './mediaRoutes.js';
app.use('/api/media', mediaRoutes);

import auditLogRoutes from './auditLogRoutes.js';
app.use('/api/audit-logs', auditLogRoutes);

import leadershipRoutes from './leadershipRoutes.js';
app.use('/api/leadership', leadershipRoutes);

import posterRoutes from './posterRoutes.js';
app.use('/api/event-posters', posterRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  
  // Any request that doesn't match an API route or static file gets sent to index.html (client-side routing)
  // Note: app.get('*') is not valid in Express 5 (path-to-regexp v8); use app.use() instead.
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    } else {
      res.status(404).json({ error: 'API route not found' });
    }
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
