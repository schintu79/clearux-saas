-- ============================================================
-- Phase 2: AI X-Ray Engine tables
-- ============================================================

-- LLM probe results: what AI models say about the audited site
CREATE TABLE IF NOT EXISTS llm_probe_results (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id      uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  question      text NOT NULL,
  answer        text NOT NULL,
  accuracy      text CHECK (accuracy IN ('accurate', 'partial', 'inaccurate', 'hallucinated', 'no_data')),
  accuracy_note text,
  cited_url     text,
  model_used    text NOT NULL DEFAULT 'claude-haiku',
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_llm_probe_audit ON llm_probe_results(audit_id);

-- Per-page AI readability data (structured extraction scores)
ALTER TABLE audit_pages
  ADD COLUMN IF NOT EXISTS ai_readability jsonb DEFAULT NULL;

-- AI vs Human interpretation on findings (populated for critical/high severity)
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS ai_interpretation text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS human_interpretation text DEFAULT NULL;

-- AI visibility score breakdown on reports
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS ai_visibility_breakdown jsonb DEFAULT NULL;
