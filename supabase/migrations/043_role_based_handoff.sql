-- ============================================================
-- 043: Role-based handoff — multi-role ownership and handoff
-- ============================================================
-- Adds owner_roles (text[]) for multi-role finding ownership,
-- primary_owner_role for the lead stakeholder, handoff_ready
-- flag, and handoff_payload for export packages.
-- Also adds role_summaries jsonb to audits for pre-computed
-- role-based summaries.
-- ============================================================

-- Multi-role ownership: which stakeholder roles should see this finding
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS owner_roles text[] DEFAULT '{}';

-- Primary owner: the single most relevant stakeholder
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS primary_owner_role text DEFAULT NULL;

-- Handoff readiness: whether this finding has a complete handoff package
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS handoff_ready boolean DEFAULT false;

-- Handoff payload: structured export data for team handoff
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS handoff_payload jsonb DEFAULT NULL;

-- Site-level role summaries: pre-computed summaries per role
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS role_summaries jsonb DEFAULT NULL;

-- Index for filtering findings by role
CREATE INDEX IF NOT EXISTS idx_findings_owner_roles
  ON audit_findings USING GIN (owner_roles);

-- Index for primary owner filtering
CREATE INDEX IF NOT EXISTS idx_findings_primary_owner
  ON audit_findings (primary_owner_role)
  WHERE primary_owner_role IS NOT NULL;
