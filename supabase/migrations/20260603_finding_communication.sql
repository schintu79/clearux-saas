-- ============================================================
-- Migration: Add communication JSONB column to audit_findings
-- Dual-layer issue communication model:
--   - Plain-language layer (site owners, marketers)
--   - Technical layer (developers)
-- ============================================================

ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS communication JSONB DEFAULT NULL;

-- Index for querying findings that have/lack communication data
CREATE INDEX IF NOT EXISTS idx_audit_findings_has_communication
  ON audit_findings ((communication IS NOT NULL))
  WHERE communication IS NOT NULL;

COMMENT ON COLUMN audit_findings.communication IS
  'Dual-layer communication: {title_plain, what_found, why_matters, technical_note, fix_plain, fix_technical}';
