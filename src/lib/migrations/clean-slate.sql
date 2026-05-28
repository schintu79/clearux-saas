-- ============================================================
-- CLEAN SLATE: Delete all brands, sites, audits & test data
-- Preserves: auth.users, profiles, ai_model_catalog, prompt_library, payments
-- Run in Supabase SQL Editor
-- ============================================================

BEGIN;

-- 1. Deepest children first (depend on audit_findings or audits)
DELETE FROM finding_action_history;
DELETE FROM finding_patterns;
DELETE FROM fix_playbooks;
DELETE FROM ai_citations;

-- 2. Audit child tables
DELETE FROM audit_findings;
DELETE FROM audit_pages;
DELETE FROM audit_logs;
DELETE FROM reports;
DELETE FROM brand_audit_file_snapshots;

-- 3. AI / probe results
DELETE FROM multi_model_probes;
DELETE FROM llm_probe_results;
DELETE FROM prompt_results;

-- 4. Human perception data
DELETE FROM brand_reviews;
DELETE FROM reddit_mentions;
DELETE FROM web_mentions;
DELETE FROM content_gaps;

-- 5. Intelligence & competitor data
DELETE FROM intelligence_snapshots;
DELETE FROM competitor_benchmarks;
DELETE FROM predictive_recommendations;

-- 6. Quality stats & rules
DELETE FROM global_quality_stats;
DELETE FROM rule_changelog;

-- 7. Notifications
DELETE FROM notification_reads;
DELETE FROM notifications;
DELETE FROM admin_logs;

-- 8. Site-level data
DELETE FROM site_notes;
DELETE FROM scheduled_audits;

-- 9. FTP
DELETE FROM ftp_deploy_log;
DELETE FROM ftp_connections;

-- 10. Brand identity files (before brand_identities)
DELETE FROM brand_identity_files;

-- 11. Audits themselves
DELETE FROM audits;

-- 12. Brand identities
DELETE FROM brand_identities;

-- 13. Workspaces
DELETE FROM workspaces;

-- 14. User-level settings (optional — uncomment if you want to reset these too)
-- DELETE FROM ai_model_settings;
-- DELETE FROM white_label_settings;
-- DELETE FROM api_keys;

COMMIT;

-- Verify clean state
SELECT 'audits' as tbl, count(*) FROM audits
UNION ALL SELECT 'audit_findings', count(*) FROM audit_findings
UNION ALL SELECT 'brand_identities', count(*) FROM brand_identities
UNION ALL SELECT 'workspaces', count(*) FROM workspaces
UNION ALL SELECT 'multi_model_probes', count(*) FROM multi_model_probes
UNION ALL SELECT 'reports', count(*) FROM reports;
