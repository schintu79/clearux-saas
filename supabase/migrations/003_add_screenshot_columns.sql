-- ============================================================
-- ClearUX — Add screenshot and target_element columns
-- These columns are required by the audit engine but were missing
-- from the initial schema, causing screenshots to silently fail.
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Screenshot URL on audit_pages (stores the full-page screenshot)
ALTER TABLE audit_pages ADD COLUMN IF NOT EXISTS screenshot_url TEXT;

-- 2. Screenshot URL on audit_findings (stores per-finding highlighted screenshots)
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS screenshot_url TEXT;

-- 3. Target element on audit_findings (CSS selector or element description for highlighting)
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS target_element TEXT;

-- 4. Estimated impact on audit_findings (expected improvement from fixing)
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS estimated_impact TEXT;

-- 5. Create the audit-screenshots storage bucket if it doesn't exist
-- (Run this separately if your Supabase doesn't support it in migrations)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('audit-screenshots', 'audit-screenshots', true) ON CONFLICT (id) DO NOTHING;
