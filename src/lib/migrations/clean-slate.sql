-- ============================================================
-- CLEAN SLATE: Delete all brands, sites, audits & test data
-- Preserves: auth.users, profiles, ai_model_catalog, prompt_library, payments
-- Run in Supabase SQL Editor
-- Uses TRUNCATE ... CASCADE to handle FK constraints automatically
-- and IF EXISTS to skip tables that haven't been created yet
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  -- All content tables in safe deletion order (children before parents).
  -- Tables that don't exist yet are silently skipped.
  FOREACH t IN ARRAY ARRAY[
    -- Deepest children / audit sub-tables
    'finding_action_history',
    'finding_patterns',
    'fix_playbooks',
    'ai_citations',
    'audit_findings',
    'audit_pages',
    'audit_logs',
    'reports',
    'brand_audit_file_snapshots',
    -- AI / probe results
    'multi_model_probes',
    'llm_probe_results',
    'prompt_results',
    -- Human perception
    'brand_reviews',
    'reddit_mentions',
    'web_mentions',
    'content_gaps',
    -- Intelligence & competitors
    'intelligence_snapshots',
    'competitor_benchmarks',
    'predictive_recommendations',
    -- Quality stats & rules
    'global_quality_stats',
    'rule_changelog',
    -- Notifications
    'notification_reads',
    'notifications',
    'admin_logs',
    -- Site-level data
    'site_notes',
    'scheduled_audits',
    -- FTP
    'ftp_deploy_log',
    'ftp_connections',
    -- Brand identity files (before brand_identities)
    'brand_identity_files',
    -- Core records
    'audits',
    'brand_identities',
    'workspaces'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('TRUNCATE TABLE public.%I CASCADE', t);
      RAISE NOTICE 'Truncated: %', t;
    ELSE
      RAISE NOTICE 'Skipped (does not exist): %', t;
    END IF;
  END LOOP;
END $$;

-- Verify clean state (only checks tables that exist)
SELECT 'audits' as tbl, count(*) FROM audits
UNION ALL SELECT 'audit_findings', count(*) FROM audit_findings
UNION ALL SELECT 'brand_identities', count(*) FROM brand_identities
UNION ALL SELECT 'workspaces', count(*) FROM workspaces;
