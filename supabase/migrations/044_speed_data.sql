-- Add PageSpeed Insights data fields to audits table
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS speed_data jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS speed_tested_at timestamptz DEFAULT NULL;

-- Index for quick lookups of audits with speed data
CREATE INDEX IF NOT EXISTS idx_audits_speed_tested_at ON audits (speed_tested_at)
  WHERE speed_tested_at IS NOT NULL;
