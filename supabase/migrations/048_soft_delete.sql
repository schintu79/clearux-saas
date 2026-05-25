-- 048: Soft-delete support for audits and brand_identities
-- Adds deleted_at column + partial index for efficient filtering.

ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE brand_identities
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Partial index: queries that filter deleted_at IS NULL stay fast.
CREATE INDEX IF NOT EXISTS idx_audits_not_deleted
  ON audits (user_id, completed_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_brand_identities_not_deleted
  ON brand_identities (user_id)
  WHERE deleted_at IS NULL;
