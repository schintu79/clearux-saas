-- ============================================================
-- Competitor Benchmarks — Manual editing support
--
-- Adds optional metadata fields so users can add competitors
-- manually (without auto-scoring), and a `source` discriminator
-- so the UI can show whether an entry was auto-detected or
-- user-added.
-- ============================================================

ALTER TABLE competitor_benchmarks
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS note     TEXT,
  ADD COLUMN IF NOT EXISTS source   TEXT NOT NULL DEFAULT 'auto';

-- A manual entry may not have a score yet. Existing rows are
-- 'auto' (scored), new manual rows default to source='manual'
-- and may carry score=0 until a re-scan runs.
COMMENT ON COLUMN competitor_benchmarks.source IS
  'Origin of this competitor row: ''auto'' (auto-detected and scored) or ''manual'' (user-added).';
