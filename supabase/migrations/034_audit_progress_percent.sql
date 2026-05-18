-- ============================================================
-- Migration 034: Real-time audit progress percentage
-- ============================================================

ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS progress_percent integer DEFAULT 0;

COMMENT ON COLUMN audits.progress_percent IS 'Real-time progress percentage (0-100) updated during pipeline execution';
