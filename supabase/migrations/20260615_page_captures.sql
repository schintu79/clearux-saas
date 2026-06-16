-- ============================================================
-- Capture→Analyze→Compose, Phase 1: immutable PageCapture artifact
-- See docs/AUDIT_PIPELINE_ARCHITECTURE.md §3.
-- ============================================================
-- The durable, versioned "what the page actually was" record. Written in
-- SHADOW MODE (behind FEATURE_CAPTURE_SHADOW, paid audits only) ALONGSIDE the
-- current pipeline — nothing reads it yet, so this is purely additive and
-- cannot affect existing audits.
--
-- Discipline (per architecture doc):
--   • RAW evidence (rendered HTML, screenshots, axe-raw) lives in OBJECT
--     STORAGE; this table holds only the blob KEYS + normalized, queryable
--     fields. Blob keys are nullable in Phase 1 (populated when upload lands).
--   • Interpretation (FAQ/pricing/section classification) is NOT stored here —
--     it is a derived layer keyed to capture_version, recomputable.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.page_captures (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id                 uuid NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  workspace_id             uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id                  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  page_url                 text NOT NULL,

  -- lifecycle
  page_status              text NOT NULL DEFAULT 'complete',  -- pending | partial | complete | failed
  http_status              int,

  -- versioning (every capture declares its shape + the renderer that made it)
  capture_schema_version   text NOT NULL DEFAULT 'v1',
  capture_renderer_version text,
  fetch_strategy           text,

  -- RAW evidence (object storage keys; nullable until blob upload lands)
  rendered_html_key        text,
  screenshot_keys          text[],
  axe_raw_key              text,

  -- normalized deterministic structure (queryable — safe in Postgres)
  title                    text,
  h1                       text,
  headings                 jsonb,
  links                    jsonb,
  form_presence            jsonb,
  lang                     text,
  meta                     jsonb,
  dom_facts                jsonb,
  extracted_text           text,
  viewport_results         jsonb,

  captured_at              timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_captures_audit ON public.page_captures (audit_id);
CREATE INDEX IF NOT EXISTS idx_page_captures_workspace ON public.page_captures (workspace_id, captured_at DESC);

-- RLS — written by the pipeline via service role (bypasses RLS); owners may read.
ALTER TABLE public.page_captures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "page_captures_select_own" ON public.page_captures;
CREATE POLICY "page_captures_select_own" ON public.page_captures
  FOR SELECT USING (auth.uid() = user_id);
