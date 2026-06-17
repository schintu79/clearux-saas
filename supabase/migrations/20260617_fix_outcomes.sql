-- ============================================================
-- Phase 3 — Fix-outcomes dataset (the "we proved it" moat)
-- See docs/FIX_OUTCOMES_ARCHITECTURE.md
-- ============================================================
-- One row per verification attempt of one finding. When a user marks a
-- DETERMINISTIC finding fixed, a background job re-runs the matching instrument
-- on that one page and records gone-or-not with before/after evidence. Latest
-- row per finding is authoritative for display. Append-only (attempt history).

CREATE TABLE IF NOT EXISTS public.fix_outcomes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id           uuid REFERENCES public.audit_findings(id) ON DELETE CASCADE,
  audit_id             uuid REFERENCES public.audits(id) ON DELETE CASCADE,
  workspace_id         uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  issue_family_id      uuid,                       -- link to the fix-history spine when present
  page_url             text NOT NULL,
  detection_source     text,                       -- instrument used (axe | wcag_checker | …)
  outcome              text NOT NULL,              -- verified_fixed | not_fixed | inconclusive
  severity_before      text,
  evidence_before      text,
  evidence_after       text,
  marked_fixed_at      timestamptz,
  verified_at          timestamptz NOT NULL DEFAULT now(),
  time_to_fix_seconds  bigint,                     -- verified_at − finding.created_at
  recheck_method       text NOT NULL DEFAULT 'single_page_instrument',
  recheck_meta         jsonb,                      -- raw re-check detail (http status, rule id, count)
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fix_outcomes_finding   ON public.fix_outcomes (finding_id);
CREATE INDEX IF NOT EXISTS idx_fix_outcomes_workspace ON public.fix_outcomes (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fix_outcomes_outcome   ON public.fix_outcomes (outcome);

ALTER TABLE public.fix_outcomes ENABLE ROW LEVEL SECURITY;

-- Reads are owner-scoped (mirrors coverage_limitation_decisions). Writes are
-- performed by the service-role verification job, which bypasses RLS; the
-- Impact API enforces workspace access explicitly, same as /api/audits.
DROP POLICY IF EXISTS "fix_outcomes_select_own" ON public.fix_outcomes;
CREATE POLICY "fix_outcomes_select_own" ON public.fix_outcomes
  FOR SELECT USING (auth.uid() = user_id);

-- Additive display field: set when an outcome is verified_fixed so the finding
-- card can show the "Verified fixed" badge without joining fix_outcomes.
-- Nullable, no default change to existing rows — no behavioral impact.
ALTER TABLE public.audit_findings
  ADD COLUMN IF NOT EXISTS verified_fixed_at timestamptz;
