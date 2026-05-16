-- ============================================================
-- 031: Brand DNA fields
--
-- Phase 1 capture surface from the product bible: brand name (already
-- present as `name`), website URL, brand promise/positioning (already
-- present as `description`), tone of voice keywords, brand voice
-- description, primary colour palette, and logo URL.
--
-- All columns are additive and nullable so existing brand_identities
-- rows continue to work. UI treats unfilled fields as empty and
-- prompts the user to capture them.
-- ============================================================

ALTER TABLE brand_identities
  ADD COLUMN IF NOT EXISTS website_url    TEXT,
  ADD COLUMN IF NOT EXISTS brand_voice    TEXT,
  ADD COLUMN IF NOT EXISTS tone_keywords  TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS primary_colors TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS logo_url       TEXT;

-- Note: no constraints added beyond defaults. tone_keywords and
-- primary_colors are TEXT[] so callers can store keyword tags and
-- hex strings (e.g. '#0A84FF') directly without an extra join table.
