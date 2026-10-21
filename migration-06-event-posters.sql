-- =============================================================================
-- Centenary Baptist Church — Event Posters
--
-- Run this once in the Supabase SQL Editor for the project used by the live
-- site.  It creates the durable data model used by /api/event-posters and a
-- private Storage bucket.  The Express API, using the server-only service-role
-- key after it verifies an administrator's JWT, is the only writer.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.event_posters (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title             TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
    category          TEXT CHECK (category IS NULL OR char_length(category) <= 120),
    description       TEXT CHECK (description IS NULL OR char_length(description) <= 2000),

    -- One of image_url (for a trusted static/external image) or storage_path
    -- (for a file in the private event-posters bucket) must be present.
    image_url         TEXT,
    storage_path      TEXT,

    event_date        DATE,
    event_end_date    DATE,
    start_time        TIME,
    venue             TEXT CHECK (venue IS NULL OR char_length(venue) <= 300),
    contact_info      TEXT CHECK (contact_info IS NULL OR char_length(contact_info) <= 300),

    status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published', 'unpublished')),
    display_order     INTEGER NOT NULL DEFAULT 100
                      CHECK (display_order BETWEEN 1 AND 100000),

    -- Internal review information is deliberately not returned by public APIs.
    date_needs_review BOOLEAN NOT NULL DEFAULT false,
    admin_note        TEXT CHECK (admin_note IS NULL OR char_length(admin_note) <= 1000),

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CONSTRAINT event_posters_has_image
      CHECK (
        NULLIF(btrim(COALESCE(image_url, '')), '') IS NOT NULL
        OR NULLIF(btrim(COALESCE(storage_path, '')), '') IS NOT NULL
      ),
    CONSTRAINT event_posters_end_date_not_before_start
      CHECK (event_end_date IS NULL OR event_date IS NULL OR event_end_date >= event_date)
);

-- Make repeated updates use a database timestamp, rather than a browser clock.
CREATE OR REPLACE FUNCTION public.set_event_posters_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_posters_set_updated_at ON public.event_posters;
CREATE TRIGGER event_posters_set_updated_at
BEFORE UPDATE ON public.event_posters
FOR EACH ROW EXECUTE FUNCTION public.set_event_posters_updated_at();

-- Deterministic ordering for the public carousel and the admin list.
CREATE INDEX IF NOT EXISTS event_posters_public_order_idx
  ON public.event_posters (display_order ASC, event_date ASC NULLS LAST, created_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS event_posters_admin_order_idx
  ON public.event_posters (display_order ASC, created_at DESC);

-- RLS protects direct Supabase REST calls as a second line of defence.  The
-- API server uses a service-role key only after requireAuth + requireAdmin has
-- run, so there are intentionally no client-side write policies.
ALTER TABLE public.event_posters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published event posters" ON public.event_posters;
CREATE POLICY "Public can read published event posters"
ON public.event_posters
FOR SELECT
TO anon, authenticated
USING (
  status = 'published'
  AND (
    NULLIF(btrim(COALESCE(image_url, '')), '') IS NOT NULL
    OR NULLIF(btrim(COALESCE(storage_path, '')), '') IS NOT NULL
  )
);

-- Private bucket: public page requests receive short-lived signed URLs from
-- the API only for published records.  Do not add anon INSERT/UPDATE/DELETE
-- policies; uploads and cleanup are performed by the authenticated API.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-posters',
  'event-posters',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Remove any accidental permissive policies left over from an earlier setup.
DROP POLICY IF EXISTS "Public can view event poster files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload event poster files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update event poster files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete event poster files" ON storage.objects;

-- Seed the supplied original artwork. These use site-static paths, so they do
-- not need to be copied into Storage. Fixed UUIDs make the migration idempotent.
INSERT INTO public.event_posters (
  id, title, category, description, image_url,
  event_date, event_end_date, start_time,
  status, display_order, date_needs_review, admin_note
)
VALUES
  (
    '9a2dcac1-e032-4ea2-b8d5-775218000001',
    'Youth Harvest Sunday',
    'Baptist Youth Fellowship',
    'Youth Harvest Sunday 2026.',
    '/images/posters/poster-3.jpeg',
    DATE '2026-10-18', NULL, NULL,
    'published', 1, false, NULL
  ),
  (
    '9a2dcac1-e032-4ea2-b8d5-775218000002',
    'Day of Prayer',
    'Prayer Committee',
    'A day of prayer for the church family.',
    '/images/posters/poster-1.jpeg',
    DATE '2026-10-31', NULL, TIME '10:00',
    'published', 2, true,
    'Verify the date against the artwork before publishing future notices: the source poster contains a weekday/date discrepancy.'
  ),
  (
    '9a2dcac1-e032-4ea2-b8d5-775218000003',
    'Candlelight Service Choir Auditions',
    'Choir & Music Ministry',
    'Candlelight Service choir auditions.',
    '/images/posters/poster-2.jpeg',
    DATE '2026-10-17', DATE '2026-10-18', NULL,
    'published', 3, false, NULL
  )
ON CONFLICT (id) DO NOTHING;

-- Verification query (safe to run after the migration):
-- SELECT id, title, status, display_order, image_url, storage_path
-- FROM public.event_posters
-- ORDER BY display_order, created_at;
