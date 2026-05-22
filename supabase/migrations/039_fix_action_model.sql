-- ============================================================
-- Migration 039: Fix Action Model
--
-- Adds action model fields to audit_findings and creates
-- the finding_action_history table for tracking the full
-- fix lifecycle (review → approve → deploy → verify).
-- ============================================================

-- ── New columns on audit_findings ─────────────────────────

-- Action mode the user selected for this finding
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS action_mode text;

-- Normalized fix payload (JSON blob from the capability map)
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS fix_payload jsonb;

-- Patch format: text | html | json | meta | schema
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS fix_format text;

-- Whether the patch content is user-editable
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS is_editable boolean DEFAULT false;

-- Whether the finding can be deployed via the surgical fix engine
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS is_deployable boolean DEFAULT false;

-- Whether the user must explicitly approve before deploy
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS approval_required boolean DEFAULT true;

-- Fix lifecycle status (replaces the simpler 'status' for fix tracking)
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS fix_status text DEFAULT 'unreviewed';

-- Deployable fix type key (meta_title, schema_jsonld, etc.)
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS deployable_type text;

-- Default owner team for this fix
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS default_owner text DEFAULT 'self';


-- ── Finding action history table ──────────────────────────

CREATE TABLE IF NOT EXISTS finding_action_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id  uuid NOT NULL REFERENCES audit_findings(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      text NOT NULL,          -- 'self_fix' | 'team_handoff' | 'defer' | 'fixed' | 'approve' | 'deploy' | 'reject'
  from_status text,                   -- previous fix_status
  to_status   text NOT NULL,          -- new fix_status
  note        text,                   -- optional user note
  metadata    jsonb,                  -- extra context (deploy result, diff, etc.)
  created_at  timestamptz DEFAULT now()
);

-- Index for fast lookup by finding
CREATE INDEX IF NOT EXISTS idx_action_history_finding
  ON finding_action_history(finding_id, created_at DESC);

-- Index for user activity feed
CREATE INDEX IF NOT EXISTS idx_action_history_user
  ON finding_action_history(user_id, created_at DESC);


-- ── RLS policies ──────────────────────────────────────────

ALTER TABLE finding_action_history ENABLE ROW LEVEL SECURITY;

-- Users can read action history for findings they own (via audit ownership)
CREATE POLICY "Users can read own action history"
  ON finding_action_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM audit_findings af
      JOIN audits a ON a.id = af.audit_id
      WHERE af.id = finding_action_history.finding_id
        AND a.user_id = auth.uid()
    )
  );

-- Users can insert action history for their own findings
CREATE POLICY "Users can insert own action history"
  ON finding_action_history
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM audit_findings af
      JOIN audits a ON a.id = af.audit_id
      WHERE af.id = finding_action_history.finding_id
        AND a.user_id = auth.uid()
    )
  );
