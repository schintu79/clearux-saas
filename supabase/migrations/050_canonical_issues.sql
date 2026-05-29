-- 050: Canonical Issue Families & Re-Audit Reconciliation
-- Implements the Fixpath Audit Bible: stable issue identity, reconciliation-first
-- re-audits, lifecycle tracking, and explainable scoring.
--
-- New tables:
--   issue_families        — canonical issue definitions across audits
--   issue_findings        — links audit_findings to their canonical issue family
--   finding_evidence      — normalized evidence for findings
--   issue_lifecycle_events — audit history / state change log
--   score_snapshots       — per-category + overall scoring breakdown per audit
--
-- Additions to existing tables:
--   audit_findings: + issue_family_id, status_in_audit, score_impact, scope_json
--   audits: + audit_run_type, trigger_source, coverage_summary_json, score_version

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. ISSUE FAMILIES — canonical issue definitions
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS issue_families (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  category_key          text NOT NULL,
  issue_key             text NOT NULL,  -- stable canonical key: category.family.scope
  issue_type            text NOT NULL DEFAULT 'verified_issue'
    CHECK (issue_type IN ('verified_issue', 'meaningful_weakness', 'recommendation', 'nice_to_have')),
  title_canonical       text NOT NULL,
  description_canonical text,
  default_severity      text NOT NULL DEFAULT 'medium'
    CHECK (default_severity IN ('critical', 'high', 'medium', 'low')),
  score_weight          numeric(5,3) DEFAULT 1.0,
  matching_strategy     text DEFAULT 'canonical_key',  -- canonical_key | semantic | evidence
  scope_signature       text,  -- homepage, sitewide, pricing-template, page:/path
  current_lifecycle_state text NOT NULL DEFAULT 'open'
    CHECK (current_lifecycle_state IN ('open', 'improved', 'resolved', 'regressed', 'merged', 'invalidated', 'archived')),
  -- Fix console integration
  fix_status            text DEFAULT 'none'
    CHECK (fix_status IN ('none', 'suggested', 'approved', 'implemented', 'pending_verification', 'validated_fixed')),
  fix_source            text,  -- user, ai_console, manual, cms_push
  fix_updated_at        timestamptz,
  -- Audit linkage
  first_seen_audit_id   uuid REFERENCES audits(id) ON DELETE SET NULL,
  last_seen_audit_id    uuid REFERENCES audits(id) ON DELETE SET NULL,
  times_seen            integer DEFAULT 1,
  -- Timestamps
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Canonical key must be unique per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_issue_families_workspace_key
  ON issue_families (workspace_id, issue_key);

CREATE INDEX IF NOT EXISTS idx_issue_families_workspace_state
  ON issue_families (workspace_id, current_lifecycle_state)
  WHERE current_lifecycle_state IN ('open', 'improved', 'regressed');

CREATE INDEX IF NOT EXISTS idx_issue_families_category
  ON issue_families (workspace_id, category_key);

CREATE INDEX IF NOT EXISTS idx_issue_families_last_audit
  ON issue_families (last_seen_audit_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_issue_family_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_issue_family_updated ON issue_families;
CREATE TRIGGER trg_issue_family_updated
  BEFORE UPDATE ON issue_families
  FOR EACH ROW EXECUTE FUNCTION update_issue_family_timestamp();


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. FINDING EVIDENCE — normalized evidence for findings
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS finding_evidence (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_finding_id    uuid NOT NULL REFERENCES audit_findings(id) ON DELETE CASCADE,
  evidence_type       text NOT NULL
    CHECK (evidence_type IN ('page', 'dom_signal', 'crawl_signal', 'content_pattern', 'screenshot', 'metric', 'ai_probe')),
  page_url            text,
  selector_or_location text,
  raw_value           text,
  normalized_value    text,
  snapshot_json       jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finding_evidence_finding
  ON finding_evidence (audit_finding_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. ISSUE LIFECYCLE EVENTS — state change log
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS issue_lifecycle_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_family_id   uuid NOT NULL REFERENCES issue_families(id) ON DELETE CASCADE,
  audit_id          uuid REFERENCES audits(id) ON DELETE SET NULL,
  event_type        text NOT NULL
    CHECK (event_type IN ('detected', 'matched', 'improved', 'fixed', 'regressed', 'merged', 'invalidated', 'reopened', 'user_confirmed_fix', 'severity_changed')),
  old_state         text,
  new_state         text,
  reason            text,
  metadata_json     jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_issue
  ON issue_lifecycle_events (issue_family_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_audit
  ON issue_lifecycle_events (audit_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. SCORE SNAPSHOTS — per-category scoring breakdown
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS score_snapshots (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id                uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  workspace_id            uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  category_key            text,  -- NULL = overall score
  raw_score               numeric(6,2),
  adjusted_score          numeric(6,2),
  active_issue_count      integer DEFAULT 0,
  weighted_issue_total    numeric(8,3) DEFAULT 0,
  resolved_issue_credit   numeric(8,3) DEFAULT 0,
  recommendation_penalty  numeric(8,3) DEFAULT 0,
  calculation_json        jsonb,  -- full breakdown for explainability
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_snapshots_audit
  ON score_snapshots (audit_id);

CREATE INDEX IF NOT EXISTS idx_score_snapshots_workspace_category
  ON score_snapshots (workspace_id, category_key, created_at DESC);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. EXTEND EXISTING audit_findings TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

-- Link findings to canonical issue families
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS issue_family_id uuid REFERENCES issue_families(id) ON DELETE SET NULL;

-- Reconciliation status (system-determined, separate from user-driven 'status')
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS status_in_audit text DEFAULT 'new'
    CHECK (status_in_audit IN ('new', 'still_present', 'improved', 'fixed', 'regressed', 'duplicate', 'superseded', 'invalidated'));

-- Computed score penalty for this finding
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS score_impact numeric(8,3) DEFAULT 0;

-- Scope and template data
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS scope_json jsonb;

-- Page count affected (for scope multiplier)
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS page_count_affected integer DEFAULT 1;

-- Confidence as numeric (0-1) for scoring calculations
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS confidence_score numeric(4,3) DEFAULT 1.0;

-- Business relevance (0.75-1.5)
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS business_relevance numeric(4,3) DEFAULT 1.0;

CREATE INDEX IF NOT EXISTS idx_findings_issue_family
  ON audit_findings (issue_family_id)
  WHERE issue_family_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_findings_status_in_audit
  ON audit_findings (audit_id, status_in_audit);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. EXTEND EXISTING audits TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

-- Audit run type classification
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS audit_run_type text DEFAULT 'first_audit'
    CHECK (audit_run_type IN ('first_audit', 'reaudit', 'deep_audit', 'post_fix_verification'));

-- What triggered this audit
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS trigger_source text DEFAULT 'manual'
    CHECK (trigger_source IN ('manual', 'scheduled', 'post_fix', 'api', 'webhook'));

-- Coverage data from the reconciliation
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS coverage_summary_json jsonb;

-- Scoring model version used
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS score_version text DEFAULT 'v1';

-- Reconciliation summary stored on the audit
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS reconciliation_summary jsonb;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE issue_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE finding_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_snapshots ENABLE ROW LEVEL SECURITY;

-- issue_families: access via workspace ownership
CREATE POLICY "Users can read own issue families"
  ON issue_families FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = issue_families.workspace_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own issue families"
  ON issue_families FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = issue_families.workspace_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own issue families"
  ON issue_families FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = issue_families.workspace_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "Service role full access to issue families"
  ON issue_families FOR ALL
  USING (auth.role() = 'service_role');

-- finding_evidence: access via audit finding ownership
CREATE POLICY "Users can read own finding evidence"
  ON finding_evidence FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM audit_findings af
    JOIN audits a ON a.id = af.audit_id
    WHERE af.id = finding_evidence.audit_finding_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Service role full access to finding evidence"
  ON finding_evidence FOR ALL
  USING (auth.role() = 'service_role');

-- issue_lifecycle_events: access via issue family → workspace ownership
CREATE POLICY "Users can read own lifecycle events"
  ON issue_lifecycle_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM issue_families isf
    JOIN workspaces w ON w.id = isf.workspace_id
    WHERE isf.id = issue_lifecycle_events.issue_family_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "Service role full access to lifecycle events"
  ON issue_lifecycle_events FOR ALL
  USING (auth.role() = 'service_role');

-- score_snapshots: access via workspace ownership
CREATE POLICY "Users can read own score snapshots"
  ON score_snapshots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = score_snapshots.workspace_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "Service role full access to score snapshots"
  ON score_snapshots FOR ALL
  USING (auth.role() = 'service_role');
