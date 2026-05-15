-- ============================================================
-- ClearUX migration 030 — api_keys
--
-- Scaffolds Personal Access Tokens for machine-to-machine clients
-- (WordPress plugin, CI runners, integrations). The HTTP layer
-- still falls back to cookie sessions when no Authorization
-- header is present, so this migration is additive and safe to
-- ship before the plugin exists.
--
-- Threat model:
--   * Raw key never persisted. Only a SHA-256 hash is stored.
--   * The raw key is shown to the user exactly once, at creation
--     time, in the dashboard.
--   * Keys carry a scope JSON blob so future scopes (read-only,
--     audits.run, audits.read) can be added without a migration.
--   * Revocation is a flag, not a delete — preserves audit trail.
-- ============================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  -- SHA-256 hex digest of the raw key. The raw key is the form
  -- "cux_<32-byte base64url>"; we hash the entire string.
  key_hash      TEXT NOT NULL UNIQUE,
  -- First 8 chars of the raw key (after the "cux_" prefix) for
  -- display only. Insufficient to authenticate; safe to surface.
  key_prefix    TEXT NOT NULL,
  scopes        JSONB NOT NULL DEFAULT '["audits:read","audits:run"]'::jsonb,
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id    ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash   ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active     ON api_keys(user_id) WHERE revoked_at IS NULL;

-- RLS — users can manage only their own keys. The service role
-- client (used by the API-key resolver) bypasses RLS and can
-- look up any key by hash.
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own api keys"   ON api_keys;
DROP POLICY IF EXISTS "Users can insert own api keys" ON api_keys;
DROP POLICY IF EXISTS "Users can update own api keys" ON api_keys;
DROP POLICY IF EXISTS "Users can delete own api keys" ON api_keys;

CREATE POLICY "Users can view own api keys"
  ON api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api keys"
  ON api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api keys"
  ON api_keys FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own api keys"
  ON api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- Touch updated_at on any row update.
CREATE OR REPLACE FUNCTION touch_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_api_keys_touch ON api_keys;
CREATE TRIGGER trg_api_keys_touch
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION touch_api_keys_updated_at();
