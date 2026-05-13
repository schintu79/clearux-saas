-- ============================================================
-- Fix missing RLS policies for Phase 2/3 tables
-- These tables were created without RLS, causing client-side
-- queries to return empty results.
-- ============================================================

-- Enable RLS on all three tables
ALTER TABLE llm_probe_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fix_playbooks ENABLE ROW LEVEL SECURITY;

-- Users can read their own LLM probe results
CREATE POLICY "Users read own llm_probe_results"
  ON llm_probe_results FOR SELECT
  USING (audit_id IN (SELECT id FROM audits WHERE user_id = auth.uid()));

-- Service role can insert LLM probe results
CREATE POLICY "Service inserts llm_probe_results"
  ON llm_probe_results FOR INSERT
  WITH CHECK (true);

-- Users can read their own AI citations
CREATE POLICY "Users read own ai_citations"
  ON ai_citations FOR SELECT
  USING (audit_id IN (SELECT id FROM audits WHERE user_id = auth.uid()));

-- Service role can insert AI citations
CREATE POLICY "Service inserts ai_citations"
  ON ai_citations FOR INSERT
  WITH CHECK (true);

-- Users can read their own fix playbooks
CREATE POLICY "Users read own fix_playbooks"
  ON fix_playbooks FOR SELECT
  USING (audit_id IN (SELECT id FROM audits WHERE user_id = auth.uid()));

-- Service role can insert fix playbooks
CREATE POLICY "Service inserts fix_playbooks"
  ON fix_playbooks FOR INSERT
  WITH CHECK (true);
