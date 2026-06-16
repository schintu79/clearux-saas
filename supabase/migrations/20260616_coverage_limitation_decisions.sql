-- ============================================================
-- Coverage limitations — workspace decision memory
-- See docs/AUDIT_PIPELINE_ARCHITECTURE.md (capture-derived limitations).
-- ============================================================
-- When a user inspects a coverage limitation (e.g. a page that returned an
-- upstream error) and decides to DISMISS or PROMOTE it, that decision is
-- remembered PER WORKSPACE so the same limitation does not re-surface on a
-- deeper/future audit. One decision per (workspace, page_url, reason).

CREATE TABLE IF NOT EXISTS public.coverage_limitation_decisions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  audit_id     uuid REFERENCES public.audits(id) ON DELETE SET NULL,
  page_url     text NOT NULL,
  reason       text NOT NULL,                 -- upstream_error | unreachable | partial_capture | thin_content
  decision     text NOT NULL,                 -- dismissed | promoted
  finding_id   uuid REFERENCES public.audit_findings(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Workspace memory: one decision per page+reason within a workspace.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cov_lim_decision
  ON public.coverage_limitation_decisions (workspace_id, page_url, reason);

ALTER TABLE public.coverage_limitation_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cov_lim_select_own" ON public.coverage_limitation_decisions;
CREATE POLICY "cov_lim_select_own" ON public.coverage_limitation_decisions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cov_lim_insert_own" ON public.coverage_limitation_decisions;
CREATE POLICY "cov_lim_insert_own" ON public.coverage_limitation_decisions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cov_lim_update_own" ON public.coverage_limitation_decisions;
CREATE POLICY "cov_lim_update_own" ON public.coverage_limitation_decisions
  FOR UPDATE USING (auth.uid() = user_id);
