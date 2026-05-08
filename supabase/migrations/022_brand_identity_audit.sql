-- ============================================================
-- 022: Brand Identity Audit support
-- Adds audit_type discriminator, makes product_url nullable,
-- adds version tracking for brand files, creates snapshot
-- table to track which files were analyzed per audit.
-- ============================================================

-- 1. Add audit_type column — defaults to 'website' so existing audits are unaffected
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS audit_type TEXT NOT NULL DEFAULT 'website';

-- 2. Make product_url nullable for brand identity audits (no URL to audit)
ALTER TABLE audits
  ALTER COLUMN product_url DROP NOT NULL;

-- 3. Add version tracking to brand_identity_files
ALTER TABLE brand_identity_files
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE brand_identity_files
  ADD COLUMN IF NOT EXISTS replaces_file_id UUID REFERENCES brand_identity_files(id) ON DELETE SET NULL;

-- 4. Snapshot table: tracks which brand files were part of each audit run
CREATE TABLE IF NOT EXISTS brand_audit_file_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id          UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  brand_file_id     UUID NOT NULL REFERENCES brand_identity_files(id) ON DELETE CASCADE,
  file_name         TEXT NOT NULL,
  file_url          TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_audit_snapshots_audit
  ON brand_audit_file_snapshots(audit_id);

-- 5. RLS policies for brand_audit_file_snapshots
ALTER TABLE brand_audit_file_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit snapshots"
  ON brand_audit_file_snapshots
  FOR SELECT
  USING (
    audit_id IN (
      SELECT id FROM audits WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage snapshots"
  ON brand_audit_file_snapshots
  FOR ALL
  USING (true)
  WITH CHECK (true);
