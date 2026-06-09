-- ============================================================
-- FIXPATH LIVE DB SCHEMA DIAGNOSTIC
-- Run this in Supabase SQL Editor to inspect actual state
-- ============================================================

-- ─── 1. Migration history — what Supabase thinks was applied ────────
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- ─── 2. Tables that SHOULD exist (from migrations 037-051+) ────────
SELECT table_name,
  CASE
    WHEN table_name = 'workspaces' THEN '049_workspaces.sql'
    WHEN table_name = 'issue_families' THEN '050_canonical_issues.sql'
    WHEN table_name = 'finding_evidence' THEN '050_canonical_issues.sql'
    WHEN table_name = 'issue_lifecycle_events' THEN '050_canonical_issues.sql'
    WHEN table_name = 'score_snapshots' THEN '050_canonical_issues.sql'
    WHEN table_name = 'brand_reviews' THEN '047_human_perception_tier2.sql'
    WHEN table_name = 'brand_reddit_mentions' THEN '047_human_perception_tier2.sql'
    WHEN table_name = 'brand_web_mentions' THEN '047_human_perception_tier2.sql'
    WHEN table_name = 'brand_intelligence_snapshots' THEN '047_human_perception_tier2.sql'
    WHEN table_name = 'brand_content_gaps' THEN '047_human_perception_tier2.sql'
    WHEN table_name = 'brand_prompt_library' THEN '047_human_perception_tier2.sql'
    WHEN table_name = 'ai_question_library' THEN '20260603_ai_interrogation.sql'
    WHEN table_name = 'workspace_ai_question_sets' THEN '20260603_ai_interrogation.sql'
    WHEN table_name = 'workspace_ai_interrogations' THEN '20260603_ai_interrogation.sql'
    WHEN table_name = 'workspace_ai_interrogation_results' THEN '20260603_ai_interrogation.sql'
    WHEN table_name = 'finding_action_history' THEN '039_fix_action_model.sql'
    ELSE 'unknown'
  END AS created_by_migration
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'workspaces', 'issue_families', 'finding_evidence',
    'issue_lifecycle_events', 'score_snapshots',
    'brand_reviews', 'brand_reddit_mentions', 'brand_web_mentions',
    'brand_intelligence_snapshots', 'brand_content_gaps', 'brand_prompt_library',
    'ai_question_library', 'workspace_ai_question_sets',
    'workspace_ai_interrogations', 'workspace_ai_interrogation_results',
    'finding_action_history'
  )
ORDER BY table_name;

-- ─── 3. ALL public tables (complete inventory) ──────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- ─── 4. audits table — every column currently defined ───────────────
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'audits'
ORDER BY ordinal_position;

-- ─── 5. audit_findings — every column currently defined ─────────────
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'audit_findings'
ORDER BY ordinal_position;

-- ─── 6. brand_identities — every column currently defined ───────────
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'brand_identities'
ORDER BY ordinal_position;

-- ─── 7. profiles — every column currently defined ───────────────────
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- ─── 8. workspaces — every column (if table exists) ─────────────────
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'workspaces'
ORDER BY ordinal_position;

-- ─── 9. ftp_connections — every column ──────────────────────────────
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ftp_connections'
ORDER BY ordinal_position;

-- ─── 10. multi_model_probes — every column ──────────────────────────
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'multi_model_probes'
ORDER BY ordinal_position;

-- ─── 11. brand_identity_files — every column ────────────────────────
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'brand_identity_files'
ORDER BY ordinal_position;

-- ─── 12. All FUNCTIONS in public schema (detect overwritten ones) ───
SELECT routine_name, routine_type, created AS created_at
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- ─── 13. All TRIGGERS on workspace-related tables ───────────────────
SELECT trigger_name, event_object_table, action_timing, event_manipulation,
       action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('audits', 'workspaces', 'brand_identities', 'profiles')
ORDER BY event_object_table, trigger_name;

-- ─── 14. All RLS POLICIES on critical tables ────────────────────────
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('audits', 'workspaces', 'brand_identities', 'profiles',
                     'issue_families', 'finding_evidence', 'score_snapshots',
                     'audit_findings', 'reports')
ORDER BY tablename, policyname;

-- ─── 15. All INDEXES on audits and workspaces ───────────────────────
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('audits', 'workspaces', 'brand_identities',
                     'audit_findings', 'issue_families')
ORDER BY tablename, indexname;

-- ─── 16. Foreign keys on audits table ───────────────────────────────
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'audits'
  AND tc.table_schema = 'public';

-- ─── 17. CRITICAL CHECK: Do workspace_id and deleted_at exist? ──────
SELECT
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema='public' AND table_name='audits' AND column_name='workspace_id')
  AS audits_has_workspace_id,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema='public' AND table_name='audits' AND column_name='deleted_at')
  AS audits_has_deleted_at,
  (SELECT count(*) FROM information_schema.tables
   WHERE table_schema='public' AND table_name='workspaces')
  AS workspaces_table_exists,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema='public' AND table_name='brand_identities' AND column_name='workspace_id')
  AS brand_identities_has_workspace_id,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema='public' AND table_name='brand_identities' AND column_name='deleted_at')
  AS brand_identities_has_deleted_at;

-- ─── 18. LIVE DATA: Recent audits sample ────────────────────────────
SELECT id, status, product_url, plan, created_at, completed_at
FROM audits
ORDER BY created_at DESC
LIMIT 10;

-- ─── 19. CHECK: Any views that might override table access? ─────────
SELECT table_name AS view_name, view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- ─── 20. CHECK: RLS enabled status on critical tables ───────────────
SELECT relname AS table_name, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('audits', 'workspaces', 'brand_identities', 'profiles',
                   'audit_findings', 'reports', 'issue_families')
ORDER BY relname;
