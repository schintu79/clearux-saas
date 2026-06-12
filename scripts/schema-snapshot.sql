-- ============================================================
-- Schema snapshot refresh (Plan §0.3)
-- ============================================================
-- Run against the LIVE Supabase DB (SQL editor or MCP execute_sql),
-- then update src/lib/db/schema-snapshot.json with the result —
-- in the SAME commit as the migration that changed the schema.
--
-- Operating standard: migration file + applied live + snapshot
-- refresh = one commit. CI fails if insert contracts reference
-- columns missing from this snapshot.

SELECT json_object_agg(table_name, cols ORDER BY table_name) AS snapshot
FROM (
  SELECT table_name,
         json_build_object(
           'columns', json_agg(column_name ORDER BY ordinal_position),
           'required', json_agg(column_name ORDER BY ordinal_position)
                       FILTER (WHERE is_nullable = 'NO' AND column_default IS NULL)
         ) AS cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('audit_findings','audit_pages','audit_logs','audits','reports',
                       'workspace_ai_interrogations','workspace_ai_interrogation_results',
                       'workspace_ai_question_sets','workspaces','payments','score_snapshots',
                       'finding_evidence','finding_action_history','notifications','profiles')
  GROUP BY table_name
) t;
