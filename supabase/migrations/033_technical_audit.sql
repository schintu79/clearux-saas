-- ============================================================
-- Migration 033: Technical Audit Data on Audit Pages
-- Adds deterministic technical health check results per page
-- ============================================================

-- Store technical audit results as JSONB on each crawled page
ALTER TABLE audit_pages
  ADD COLUMN IF NOT EXISTS technical_audit jsonb DEFAULT NULL;

-- Ensure load_time_ms column exists (may already exist on some deployments)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_pages' AND column_name = 'load_time_ms'
  ) THEN
    ALTER TABLE audit_pages ADD COLUMN load_time_ms integer DEFAULT NULL;
  END IF;
END $$;

-- Index for querying pages that have technical audits
CREATE INDEX IF NOT EXISTS idx_audit_pages_technical_audit
  ON audit_pages (audit_id)
  WHERE technical_audit IS NOT NULL;

COMMENT ON COLUMN audit_pages.technical_audit IS 'Deterministic technical health check results (performance, images, headings, accessibility, links) — no LLM, pure DOM analysis';
