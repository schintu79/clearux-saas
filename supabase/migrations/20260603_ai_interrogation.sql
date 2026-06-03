-- ============================================================
-- Migration: AI Interrogation System
--
-- Replaces the static 3-question LLM probe with a productized,
-- category-aware, region-aware interrogation feature.
--
-- New tables:
--   ai_question_library          — canonical reusable questions
--   workspace_ai_question_sets   — per-workspace ranked shortlists
--   workspace_ai_interrogations  — execution events
--   workspace_ai_interrogation_results — per-model results
--
-- Workspace enrichment:
--   category, subcategory, region, country, language on workspaces
--
-- Usage tracking:
--   ai_checks_per_month on profiles + plan-derived limits
-- ============================================================

-- ── Workspace enrichment ─────────────────────────────────────
-- Add category/region signals directly to workspaces so the
-- interrogation shortlist generator can rank questions properly.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS category        text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subcategory     text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS region          text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS country         text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS city            text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS language        text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS audience_type   text DEFAULT NULL;

-- ── AI check entitlement on profiles ─────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_checks_per_month integer NOT NULL DEFAULT 0;

-- ── Canonical question library ───────────────────────────────
-- Durable, reusable questions organized by family, category,
-- region, and audience. Shared across all workspaces.

CREATE TABLE IF NOT EXISTS ai_question_library (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text       text NOT NULL,
  question_family     text NOT NULL,        -- e.g. 'trust_credibility', 'differentiation'
  category            text DEFAULT NULL,     -- e.g. 'hospitality', 'saas', 'healthcare'
  subcategory         text DEFAULT NULL,     -- e.g. 'hotel', 'clinic', 'restaurant'
  region              text DEFAULT NULL,     -- e.g. 'europe', 'north_america', 'asia'
  language            text DEFAULT 'en',
  audience_type       text DEFAULT NULL,     -- e.g. 'consumer', 'b2b', 'enterprise'
  intent_tags         text[] DEFAULT '{}',   -- e.g. {'booking', 'comparison', 'trust'}
  priority_score      integer DEFAULT 50,    -- 0-100, higher = more relevant
  is_active           boolean DEFAULT true,
  followup_question_ids uuid[] DEFAULT '{}',
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aql_family ON ai_question_library (question_family);
CREATE INDEX IF NOT EXISTS idx_aql_category ON ai_question_library (category);
CREATE INDEX IF NOT EXISTS idx_aql_active ON ai_question_library (is_active) WHERE is_active = true;

-- ── Workspace AI question sets ───────────────────────────────
-- The ranked shortlist generated for each workspace. Refreshed
-- weekly or on material context changes.

CREATE TABLE IF NOT EXISTS workspace_ai_question_sets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  generated_at        timestamptz DEFAULT now(),
  valid_until         timestamptz NOT NULL,
  category_snapshot   text DEFAULT NULL,
  region_snapshot     text DEFAULT NULL,
  language_snapshot   text DEFAULT 'en',
  source_context      jsonb DEFAULT '{}',     -- workspace signals used for ranking
  question_ids        uuid[] NOT NULL,         -- ordered by relevance
  ranking_metadata    jsonb DEFAULT '{}',      -- scoring details per question
  version             integer DEFAULT 1,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waqs_workspace ON workspace_ai_question_sets (workspace_id);
CREATE INDEX IF NOT EXISTS idx_waqs_valid ON workspace_ai_question_sets (valid_until);

-- ── Workspace AI interrogations ──────────────────────────────
-- One row per question execution event.

CREATE TABLE IF NOT EXISTS workspace_ai_interrogations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id                 uuid NOT NULL REFERENCES auth.users(id),
  question_id             uuid REFERENCES ai_question_library(id),
  question_text_snapshot  text NOT NULL,
  question_family         text NOT NULL,
  selected_models         text[] NOT NULL,      -- model slugs
  status                  text NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed | partial
  started_at              timestamptz DEFAULT now(),
  completed_at            timestamptz DEFAULT NULL,
  usage_units_consumed    integer DEFAULT 1,
  token_input_total       integer DEFAULT 0,
  token_output_total      integer DEFAULT 0,
  estimated_cost_cents    integer DEFAULT 0,
  source_question_set_id  uuid REFERENCES workspace_ai_question_sets(id),
  is_followup             boolean DEFAULT false,
  parent_interrogation_id uuid REFERENCES workspace_ai_interrogations(id),
  created_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wai_workspace ON workspace_ai_interrogations (workspace_id);
CREATE INDEX IF NOT EXISTS idx_wai_user ON workspace_ai_interrogations (user_id);
CREATE INDEX IF NOT EXISTS idx_wai_status ON workspace_ai_interrogations (status);
CREATE INDEX IF NOT EXISTS idx_wai_created ON workspace_ai_interrogations (workspace_id, created_at DESC);

-- ── Workspace AI interrogation results ───────────────────────
-- One row per model response within an interrogation.

CREATE TABLE IF NOT EXISTS workspace_ai_interrogation_results (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interrogation_id    uuid NOT NULL REFERENCES workspace_ai_interrogations(id) ON DELETE CASCADE,
  model_slug          text NOT NULL,
  model_label         text NOT NULL,
  provider            text NOT NULL,
  response_text       text DEFAULT NULL,
  response_summary    text DEFAULT NULL,
  themes              text[] DEFAULT '{}',
  latency_ms          integer DEFAULT NULL,
  token_input         integer DEFAULT 0,
  token_output        integer DEFAULT 0,
  estimated_cost_cents integer DEFAULT 0,
  status              text NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed | timeout
  error_message       text DEFAULT NULL,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wair_interrogation ON workspace_ai_interrogation_results (interrogation_id);
CREATE INDEX IF NOT EXISTS idx_wair_model ON workspace_ai_interrogation_results (model_slug);

-- ── Usage index for period-scoped counting ───────────────────
CREATE INDEX IF NOT EXISTS idx_wai_usage
  ON workspace_ai_interrogations (workspace_id, user_id, created_at)
  WHERE status IN ('completed', 'partial');
