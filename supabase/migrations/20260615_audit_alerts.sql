-- Phase 2 #2 — Regression alerts store (per-user/workspace).
-- The existing `notifications` table is a global/admin announcement table
-- (no user/workspace scoping), so monitoring regressions need their own home.
-- Inserted by the monitoring pipeline via service role; read via RLS by owner.

CREATE TABLE IF NOT EXISTS public.audit_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  audit_id uuid REFERENCES public.audits(id) ON DELETE CASCADE,
  product_url text,
  type text NOT NULL,        -- score_drop | new_critical | new_high | ai_answer_flip
  level text NOT NULL,       -- critical | warning
  title text NOT NULL,
  body text NOT NULL,
  meta jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_alerts_user ON public.audit_alerts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_workspace ON public.audit_alerts (workspace_id, created_at DESC);

ALTER TABLE public.audit_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_alerts_select_own" ON public.audit_alerts;
CREATE POLICY "audit_alerts_select_own" ON public.audit_alerts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "audit_alerts_update_own" ON public.audit_alerts;
CREATE POLICY "audit_alerts_update_own" ON public.audit_alerts
  FOR UPDATE USING (auth.uid() = user_id);
