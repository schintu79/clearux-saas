-- Add selected_pillars column to audits table
-- NULL = full audit (all 4 pillars), array of indices = partial audit
-- e.g. [0,2] = Foundation + Inclusive Design
ALTER TABLE audits ADD COLUMN IF NOT EXISTS selected_pillars JSONB DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN audits.selected_pillars IS 'JSON array of pillar indices (0-3) to audit. NULL = all pillars (full audit).';
