-- Add category_index to audit_findings for explicit category assignment
-- Kills the keyword-matching inference that caused miscategorization
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS category_index smallint;

-- Index for filtering findings by category
CREATE INDEX IF NOT EXISTS idx_findings_category
  ON audit_findings (audit_id, category_index);
