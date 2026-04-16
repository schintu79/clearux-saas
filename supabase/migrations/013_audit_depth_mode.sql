-- ============================================================
-- Migration 013: Add depth_mode to audits
-- Supports "Dig Deeper" feature — re-audits only check baseline
-- findings by default; users can explicitly request deeper analysis.
-- ============================================================

-- Add depth_mode column with default 'standard'
-- 'standard' = re-audits only verify previous findings (baseline mode)
-- 'deep'     = find new issues (first audit or explicit "Dig Deeper")
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS depth_mode text NOT NULL DEFAULT 'standard';

-- Add check constraint
ALTER TABLE audits
  ADD CONSTRAINT audits_depth_mode_check
  CHECK (depth_mode IN ('standard', 'deep'));

-- Comment for documentation
COMMENT ON COLUMN audits.depth_mode IS 'Audit depth: standard = only check baseline findings on re-audit; deep = find new issues';
