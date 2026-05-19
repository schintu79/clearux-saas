-- ============================================================
-- Migration 038: Add finding_type and fix_type to audit_findings
-- Separates fixable issues from strategic observations.
-- ============================================================

-- Add finding_type column: 'fixable' or 'strategic'
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS finding_type text DEFAULT 'fixable';

-- Add fix_type column: deployment mechanism for fixable findings
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS fix_type text DEFAULT NULL;

-- Index for filtering by finding_type (Fix page vs Strategic section)
CREATE INDEX IF NOT EXISTS idx_audit_findings_finding_type
  ON audit_findings (audit_id, finding_type);

-- Backfill: mark all existing findings as 'fixable' (safe default)
UPDATE audit_findings
  SET finding_type = 'fixable'
  WHERE finding_type IS NULL;
