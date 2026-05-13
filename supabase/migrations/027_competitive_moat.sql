-- ============================================================
-- Phase 3: Competitive Moat tables
-- ============================================================

-- AI citation tracking: which content gets cited by AI
CREATE TABLE IF NOT EXISTS ai_citations (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id      uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  page_url      text NOT NULL,
  cited_text    text NOT NULL,
  ai_context    text NOT NULL,           -- the AI answer that cited this text
  citation_type text CHECK (citation_type IN ('direct_quote', 'paraphrase', 'reference', 'ignored')) DEFAULT 'reference',
  model_used    text NOT NULL DEFAULT 'claude-haiku',
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_citations_audit ON ai_citations(audit_id);

-- Fix playbooks: generated code snippets per audit
CREATE TABLE IF NOT EXISTS fix_playbooks (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id      uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  playbook_type text NOT NULL CHECK (playbook_type IN ('json_ld', 'meta_tags', 'llms_txt', 'robots_txt', 'structured_data')),
  title         text NOT NULL,
  description   text,
  code_snippet  text NOT NULL,
  language      text NOT NULL DEFAULT 'html',
  priority      integer DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_fix_playbooks_audit ON fix_playbooks(audit_id);

-- Add AI visibility score to score-trend (stored on reports, already there as ai_discoverability_score)
-- Add competitor AI probe scores to competitor_benchmarks
ALTER TABLE competitor_benchmarks
  ADD COLUMN IF NOT EXISTS ai_visibility_score integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS llm_probe_accuracy  integer DEFAULT NULL;

-- Re-audit diff: store previous audit reference on audits for easy diff lookup
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS previous_audit_id uuid REFERENCES audits(id) ON DELETE SET NULL DEFAULT NULL;
