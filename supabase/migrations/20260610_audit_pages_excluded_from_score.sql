-- ============================================================
-- Per-page exclude toggle for AI readability scoring
-- ============================================================
-- Excluded pages stay visible in the Pages tab but drop out of
-- the overall AI readability average (e.g. dashboard/auth pages
-- that AI legitimately cannot read and should not penalize the
-- site's score). Applied to live DB via MCP on 2026-06-10.

ALTER TABLE audit_pages ADD COLUMN IF NOT EXISTS excluded_from_score BOOLEAN NOT NULL DEFAULT false;
