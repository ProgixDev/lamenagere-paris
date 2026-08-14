-- ============================================================================
-- Iteration 34: a catalogue of what's in the storage bucket.
--
-- Until now the admin media library was a live listing of storage.objects. That
-- works for "show me the last 200 files" and nothing else: there is no row to
-- hang a folder, a label, or a content hash off, so the bucket has drifted to
-- 772 files / 421 MB of which 122 MB are byte-identical duplicates and 256 MB
-- are referenced by nothing at all.
--
-- The duplicates are a UX symptom. Accessory art (config blocks) is meant to be
-- reused across products, but the picker offers no way to find an existing
-- image, so the manager re-uploads the same PNG every time — 20 distinct
-- accessory images are referenced 364 times.
--
-- This table is the index that fixes both halves:
--   * sha256 lets an upload recognise bytes we already store and reuse them
--     instead of writing another copy;
--   * folder/label/auto_tags give the library something to organise and search
--     by, since 656 of 706 product filenames are camera-roll numbers.
--
-- Folders are deliberately a COLUMN, not a storage path. Reorganising the
-- library must never rewrite an object path, because every product, category,
-- carousel slide and config block stores the public URL verbatim — a move that
-- touched storage would break live content. Here a move is an UPDATE.
--
-- Deletes are soft (deleted_at). Bytes are only purged by a separate explicit
-- action, so an accidental delete in the admin is always recoverable.
-- ============================================================================

CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Physical location. `path` includes the top-level folder prefix
  -- ("products/1785..._x.jpg") and is unique per bucket.
  bucket text NOT NULL,
  path text NOT NULL,

  -- Logical organisation, independent of `path`.
  folder text NOT NULL DEFAULT 'Non classé',
  label text,

  -- What the asset is for. Drives which picker surfaces it: 'accessory' art is
  -- meant to be reused, 'product' photos are usually one-shot.
  kind text NOT NULL DEFAULT 'product'
    CHECK (kind IN ('product', 'accessory', 'category', 'carousel', 'popup', 'message', 'quote', 'other')),

  -- Content hash of the stored bytes, for dedupe on upload.
  sha256 text,

  size bigint,
  mime text,
  width integer,
  height integer,

  -- Derived from whatever references the asset (category/product names), so
  -- search has something to match on when the filename is "1000447529.jpg".
  auto_tags text[] NOT NULL DEFAULT '{}',

  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT media_assets_bucket_path_key UNIQUE (bucket, path)
);

CREATE INDEX IF NOT EXISTS idx_media_assets_folder ON media_assets (folder) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_assets_kind ON media_assets (kind) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_assets_created ON media_assets (created_at DESC);

-- Dedupe lookup. Partial: a soft-deleted row must not hand its bytes back to a
-- new upload, or "delete then re-upload" would silently return the dead asset.
CREATE INDEX IF NOT EXISTS idx_media_assets_sha256 ON media_assets (sha256) WHERE deleted_at IS NULL AND sha256 IS NOT NULL;

-- Search over the admin-facing text: the label the manager typed, falling back
-- to the original filename. Kept separate from auto_tags because
-- array_to_string is only STABLE, and an index expression must be IMMUTABLE.
CREATE INDEX IF NOT EXISTS idx_media_assets_search ON media_assets
  USING gin (to_tsvector('simple', coalesce(label, '') || ' ' || path));

-- Tag search uses array containment (auto_tags @> ARRAY['Cuisines']) rather
-- than full text, which is both exact and index-friendly.
CREATE INDEX IF NOT EXISTS idx_media_assets_tags ON media_assets USING gin (auto_tags);

CREATE TRIGGER trg_media_assets_updated
  BEFORE UPDATE ON media_assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Admin-only catalogue: the app never reads it, and every write goes through
-- the server's service-role client. No public policy on purpose.
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Backfill helper.
--
-- PostgREST only exposes the `public` schema, so the service-role client cannot
-- select storage.objects directly. This wraps the one listing the backfill
-- script needs. Revoked from anon/authenticated: the service role calls it.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION media_backfill_objects()
RETURNS TABLE (name text, bucket_id text, size bigint, mime text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = storage, public
AS $$
  SELECT o.name,
         o.bucket_id,
         (o.metadata->>'size')::bigint,
         o.metadata->>'mimetype'
  FROM storage.objects o
  ORDER BY o.created_at;
$$;

REVOKE ALL ON FUNCTION media_backfill_objects() FROM anon, authenticated;
