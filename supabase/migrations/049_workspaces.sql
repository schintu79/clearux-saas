-- 049: Workspace-based architecture
-- Introduces first-class workspaces to replace dropdown brand/site switching.
-- Each workspace = one brand/site context. All operational data scoped by workspace_id.

-- ── 1. Create workspaces table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspaces (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  slug          text NOT NULL,
  primary_domain text,                -- e.g. "clearux.ai"
  brand_name    text,
  workspace_type text NOT NULL DEFAULT 'website'
    CHECK (workspace_type IN ('website', 'brand', 'website_and_brand')),
  status        text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  active_audit_id          uuid,      -- current/latest audit
  active_brand_identity_id uuid,      -- linked brand DNA
  settings_json jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  archived_at   timestamptz
);

-- Slug must be unique per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_user_slug
  ON workspaces (user_id, slug);

CREATE INDEX IF NOT EXISTS idx_workspaces_user_active
  ON workspaces (user_id, status, created_at DESC)
  WHERE status = 'active';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_workspace_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workspace_updated ON workspaces;
CREATE TRIGGER trg_workspace_updated
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_workspace_timestamp();

-- RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own workspaces"
  ON workspaces FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workspaces"
  ON workspaces FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own workspaces"
  ON workspaces FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypass
CREATE POLICY "Service role full access to workspaces"
  ON workspaces FOR ALL
  USING (auth.role() = 'service_role');


-- ── 2. Add workspace_id to core tables ──────────────────────────────────────

ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

ALTER TABLE brand_identities
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

ALTER TABLE competitor_benchmarks
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

ALTER TABLE scheduled_audits
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

ALTER TABLE ftp_connections
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

ALTER TABLE site_notes
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

-- Indexes for workspace-scoped queries
CREATE INDEX IF NOT EXISTS idx_audits_workspace
  ON audits (workspace_id, completed_at DESC)
  WHERE workspace_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_brand_identities_workspace
  ON brand_identities (workspace_id)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_competitor_benchmarks_workspace
  ON competitor_benchmarks (workspace_id)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_audits_workspace
  ON scheduled_audits (workspace_id)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ftp_connections_workspace
  ON ftp_connections (workspace_id)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_site_notes_workspace
  ON site_notes (workspace_id)
  WHERE workspace_id IS NOT NULL;


-- ── 3. Backfill: create one workspace per distinct site/brand ───────────────

-- Helper function to generate URL-safe slugs
CREATE OR REPLACE FUNCTION generate_workspace_slug(domain_name text)
RETURNS text AS $$
BEGIN
  RETURN lower(regexp_replace(
    regexp_replace(domain_name, '[^a-zA-Z0-9-]', '-', 'g'),
    '-+', '-', 'g'
  ));
END;
$$ LANGUAGE plpgsql;

-- 3a. Create workspaces from brand_identities that have website_url
INSERT INTO workspaces (user_id, name, slug, primary_domain, brand_name, workspace_type, active_brand_identity_id)
SELECT DISTINCT ON (bi.user_id, host)
  bi.user_id,
  COALESCE(bi.name, host),
  generate_workspace_slug(host) || '-' || substring(gen_random_uuid()::text, 1, 4),
  host,
  bi.name,
  'website_and_brand',
  bi.id
FROM brand_identities bi
CROSS JOIN LATERAL (
  SELECT regexp_replace(
    regexp_replace(bi.website_url, '^https?://(www\.)?', ''),
    '/.*$', ''
  ) AS host
) h
WHERE bi.website_url IS NOT NULL
  AND bi.user_id IS NOT NULL
  AND bi.deleted_at IS NULL
  AND h.host != ''
ON CONFLICT DO NOTHING;

-- 3b. Create workspaces from audits that don't have a brand_identity
-- (standalone website audits)
INSERT INTO workspaces (user_id, name, slug, primary_domain, workspace_type)
SELECT DISTINCT ON (a.user_id, host)
  a.user_id,
  host,
  generate_workspace_slug(host) || '-' || substring(gen_random_uuid()::text, 1, 4),
  host,
  'website'
FROM audits a
CROSS JOIN LATERAL (
  SELECT regexp_replace(
    regexp_replace(a.product_url, '^https?://(www\.)?', ''),
    '/.*$', ''
  ) AS host
) h
WHERE a.product_url IS NOT NULL
  AND a.user_id IS NOT NULL
  AND a.deleted_at IS NULL
  AND a.brand_identity_id IS NULL
  AND h.host != ''
  AND NOT EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.user_id = a.user_id AND w.primary_domain = h.host
  )
ON CONFLICT DO NOTHING;

-- 3c. Create workspaces from brand_identities WITHOUT website_url
-- (pure brand identity workspaces)
INSERT INTO workspaces (user_id, name, slug, brand_name, workspace_type, active_brand_identity_id)
SELECT
  bi.user_id,
  bi.name,
  generate_workspace_slug(COALESCE(bi.name, 'brand')) || '-' || substring(gen_random_uuid()::text, 1, 4),
  bi.name,
  'brand',
  bi.id
FROM brand_identities bi
WHERE bi.website_url IS NULL
  AND bi.user_id IS NOT NULL
  AND bi.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.user_id = bi.user_id AND w.active_brand_identity_id = bi.id
  )
ON CONFLICT DO NOTHING;


-- ── 4. Backfill workspace_id on existing records ────────────────────────────

-- 4a. brand_identities → match by workspace's active_brand_identity_id
UPDATE brand_identities bi
SET workspace_id = w.id
FROM workspaces w
WHERE w.active_brand_identity_id = bi.id
  AND bi.workspace_id IS NULL;

-- 4b. brand_identities → match by domain
UPDATE brand_identities bi
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = bi.user_id
  AND w.primary_domain IS NOT NULL
  AND bi.website_url IS NOT NULL
  AND w.primary_domain = regexp_replace(
    regexp_replace(bi.website_url, '^https?://(www\.)?', ''),
    '/.*$', ''
  )
  AND bi.workspace_id IS NULL;

-- 4c. audits → match by brand_identity's workspace
UPDATE audits a
SET workspace_id = bi.workspace_id
FROM brand_identities bi
WHERE a.brand_identity_id = bi.id
  AND bi.workspace_id IS NOT NULL
  AND a.workspace_id IS NULL;

-- 4d. audits → match by domain to workspace
UPDATE audits a
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = a.user_id
  AND w.primary_domain IS NOT NULL
  AND a.product_url IS NOT NULL
  AND w.primary_domain = regexp_replace(
    regexp_replace(a.product_url, '^https?://(www\.)?', ''),
    '/.*$', ''
  )
  AND a.workspace_id IS NULL;

-- 4e. competitor_benchmarks → match by domain
UPDATE competitor_benchmarks cb
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = cb.user_id
  AND w.primary_domain IS NOT NULL
  AND cb.domain IS NOT NULL
  AND w.primary_domain = cb.domain
  AND cb.workspace_id IS NULL;

-- 4f. scheduled_audits → match by domain
UPDATE scheduled_audits sa
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = sa.user_id
  AND w.primary_domain IS NOT NULL
  AND sa.product_url IS NOT NULL
  AND w.primary_domain = regexp_replace(
    regexp_replace(sa.product_url, '^https?://(www\.)?', ''),
    '/.*$', ''
  )
  AND sa.workspace_id IS NULL;

-- 4g. ftp_connections → match via brand_identity
UPDATE ftp_connections fc
SET workspace_id = bi.workspace_id
FROM brand_identities bi
WHERE fc.brand_identity_id = bi.id
  AND bi.workspace_id IS NOT NULL
  AND fc.workspace_id IS NULL;

-- 4h. site_notes → match by domain
UPDATE site_notes sn
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = sn.user_id
  AND w.primary_domain IS NOT NULL
  AND sn.domain IS NOT NULL
  AND w.primary_domain = sn.domain
  AND sn.workspace_id IS NULL;

-- 4i. Set active_audit_id on workspaces to their latest completed audit
UPDATE workspaces w
SET active_audit_id = sub.id
FROM (
  SELECT DISTINCT ON (workspace_id) id, workspace_id
  FROM audits
  WHERE workspace_id IS NOT NULL
    AND status = 'completed'
    AND deleted_at IS NULL
  ORDER BY workspace_id, completed_at DESC NULLS LAST
) sub
WHERE sub.workspace_id = w.id;

-- Clean up helper function
DROP FUNCTION IF EXISTS generate_workspace_slug(text);
