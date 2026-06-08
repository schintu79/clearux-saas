-- ============================================================
-- 20260608_orphan_cleanup.sql
--
-- Cleans up records with NULL workspace_id left over after
-- migration 049_workspaces.sql. The product spec requires ALL
-- live queries to be workspace-scoped, so NULL workspace_id
-- records can pollute results.
--
-- This migration is IDEMPOTENT: safe to re-run. Each step uses
-- WHERE workspace_id IS NULL guards so already-assigned rows
-- are never touched.
--
-- Steps:
--   1. Re-run domain-based backfill (same logic as 049 section 4)
--      to catch records created between 049 and now.
--   2. Auto-create workspaces for users who have orphaned audits
--      but zero workspaces, using their most common audit domain.
--   3. Soft-delete (or hard-delete for security-sensitive tables)
--      any remaining orphans that still have workspace_id = NULL.
-- ============================================================

BEGIN;


-- ================================================================
-- SECTION 1: Re-run domain-based backfill (idempotent)
-- Identical logic to 049 section 4 — catches any records that
-- were created after 049 ran but before workspaces were enforced.
-- ================================================================

-- 1a. brand_identities -> match by workspace's active_brand_identity_id
UPDATE brand_identities bi
SET workspace_id = w.id
FROM workspaces w
WHERE w.active_brand_identity_id = bi.id
  AND bi.workspace_id IS NULL;

-- 1b. brand_identities -> match by domain
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

-- 1c. audits -> match by brand_identity's workspace
UPDATE audits a
SET workspace_id = bi.workspace_id
FROM brand_identities bi
WHERE a.brand_identity_id = bi.id
  AND bi.workspace_id IS NOT NULL
  AND a.workspace_id IS NULL;

-- 1d. audits -> match by domain to workspace
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

-- 1e. competitor_benchmarks -> match by domain
UPDATE competitor_benchmarks cb
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = cb.user_id
  AND w.primary_domain IS NOT NULL
  AND cb.domain IS NOT NULL
  AND w.primary_domain = cb.domain
  AND cb.workspace_id IS NULL;

-- 1f. scheduled_audits -> match by domain
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

-- 1g. ftp_connections -> match via brand_identity
UPDATE ftp_connections fc
SET workspace_id = bi.workspace_id
FROM brand_identities bi
WHERE fc.brand_identity_id = bi.id
  AND bi.workspace_id IS NOT NULL
  AND fc.workspace_id IS NULL;

-- 1h. site_notes -> match by domain
UPDATE site_notes sn
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = sn.user_id
  AND w.primary_domain IS NOT NULL
  AND sn.domain IS NOT NULL
  AND w.primary_domain = sn.domain
  AND sn.workspace_id IS NULL;


-- ================================================================
-- SECTION 2: Auto-create workspaces for users with orphaned audits
-- who have NO workspace at all.
--
-- For each such user we:
--   a) Find their most common audit domain
--   b) Create a workspace with that domain
--   c) Assign all their orphaned records to it
-- ================================================================

-- Temporary helper function for slug generation (same as 049)
CREATE OR REPLACE FUNCTION _orphan_cleanup_slug(domain_name text)
RETURNS text AS $$
BEGIN
  RETURN lower(regexp_replace(
    regexp_replace(domain_name, '[^a-zA-Z0-9-]', '-', 'g'),
    '-+', '-', 'g'
  ));
END;
$$ LANGUAGE plpgsql;

-- 2a. Create one workspace per workspace-less user, using their
--     most common audit domain.
INSERT INTO workspaces (user_id, name, slug, primary_domain, workspace_type)
SELECT
  orphan.user_id,
  orphan.top_domain,
  _orphan_cleanup_slug(orphan.top_domain) || '-' || substring(gen_random_uuid()::text, 1, 4),
  orphan.top_domain,
  'website'
FROM (
  -- For each user with no workspace, find the domain that appears
  -- most often across their orphaned audits.
  SELECT DISTINCT ON (a.user_id)
    a.user_id,
    regexp_replace(
      regexp_replace(a.product_url, '^https?://(www\.)?', ''),
      '/.*$', ''
    ) AS top_domain,
    count(*) AS cnt
  FROM audits a
  WHERE a.workspace_id IS NULL
    AND a.deleted_at IS NULL
    AND a.product_url IS NOT NULL
    AND a.user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM workspaces w WHERE w.user_id = a.user_id
    )
  GROUP BY a.user_id,
    regexp_replace(
      regexp_replace(a.product_url, '^https?://(www\.)?', ''),
      '/.*$', ''
    )
  ORDER BY a.user_id, cnt DESC
) orphan
WHERE orphan.top_domain != ''
ON CONFLICT DO NOTHING;

-- 2b. Now assign orphaned audits for those users to their new workspace
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

-- 2c. Also try to assign any remaining orphaned audits for those
--     users (different domains) to whatever workspace the user now has.
--     Pick the first workspace by created_at if multiple exist.
UPDATE audits a
SET workspace_id = sub.wid
FROM (
  SELECT DISTINCT ON (w.user_id) w.user_id, w.id AS wid
  FROM workspaces w
  WHERE w.status = 'active'
  ORDER BY w.user_id, w.created_at ASC
) sub
WHERE sub.user_id = a.user_id
  AND a.workspace_id IS NULL
  AND a.deleted_at IS NULL;

-- 2d. Assign remaining orphaned brand_identities via same fallback
UPDATE brand_identities bi
SET workspace_id = sub.wid
FROM (
  SELECT DISTINCT ON (w.user_id) w.user_id, w.id AS wid
  FROM workspaces w
  WHERE w.status = 'active'
  ORDER BY w.user_id, w.created_at ASC
) sub
WHERE sub.user_id = bi.user_id
  AND bi.workspace_id IS NULL
  AND bi.deleted_at IS NULL;

-- 2e. Assign remaining orphaned competitor_benchmarks
UPDATE competitor_benchmarks cb
SET workspace_id = sub.wid
FROM (
  SELECT DISTINCT ON (w.user_id) w.user_id, w.id AS wid
  FROM workspaces w
  WHERE w.status = 'active'
  ORDER BY w.user_id, w.created_at ASC
) sub
WHERE sub.user_id = cb.user_id
  AND cb.workspace_id IS NULL;

-- 2f. Assign remaining orphaned scheduled_audits
UPDATE scheduled_audits sa
SET workspace_id = sub.wid
FROM (
  SELECT DISTINCT ON (w.user_id) w.user_id, w.id AS wid
  FROM workspaces w
  WHERE w.status = 'active'
  ORDER BY w.user_id, w.created_at ASC
) sub
WHERE sub.user_id = sa.user_id
  AND sa.workspace_id IS NULL;

-- 2g. Assign remaining orphaned ftp_connections
UPDATE ftp_connections fc
SET workspace_id = sub.wid
FROM (
  SELECT DISTINCT ON (w.user_id) w.user_id, w.id AS wid
  FROM workspaces w
  WHERE w.status = 'active'
  ORDER BY w.user_id, w.created_at ASC
) sub
WHERE sub.user_id = fc.user_id
  AND fc.workspace_id IS NULL;

-- 2h. Assign remaining orphaned site_notes
UPDATE site_notes sn
SET workspace_id = sub.wid
FROM (
  SELECT DISTINCT ON (w.user_id) w.user_id, w.id AS wid
  FROM workspaces w
  WHERE w.status = 'active'
  ORDER BY w.user_id, w.created_at ASC
) sub
WHERE sub.user_id = sn.user_id
  AND sn.workspace_id IS NULL;


-- ================================================================
-- SECTION 3: Soft-delete / hard-delete remaining orphans
-- After sections 1 and 2, any record still with workspace_id=NULL
-- either belongs to a deleted user or truly cannot be matched.
-- ================================================================

-- 3a. audits: soft-delete
UPDATE audits
SET deleted_at = now()
WHERE workspace_id IS NULL
  AND deleted_at IS NULL;

-- 3b. brand_identities: soft-delete
UPDATE brand_identities
SET deleted_at = now()
WHERE workspace_id IS NULL
  AND deleted_at IS NULL;

-- 3c. scheduled_audits: deactivate
UPDATE scheduled_audits
SET is_active = false
WHERE workspace_id IS NULL;

-- 3d. site_notes: deactivate
UPDATE site_notes
SET is_active = false
WHERE workspace_id IS NULL;

-- 3e. ftp_connections: HARD DELETE (security — encrypted passwords)
DELETE FROM ftp_connections
WHERE workspace_id IS NULL;

-- 3f. competitor_benchmarks: HARD DELETE
DELETE FROM competitor_benchmarks
WHERE workspace_id IS NULL;


-- ================================================================
-- Cleanup
-- ================================================================

DROP FUNCTION IF EXISTS _orphan_cleanup_slug(text);

COMMIT;
