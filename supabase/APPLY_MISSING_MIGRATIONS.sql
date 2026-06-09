-- ============================================================
-- 037 — Add site_host to FTP connections for site-scoped connections
-- Connections can be scoped to either a brand_identity_id OR a site_host.
-- This lets users save FTP connections when they have a website selected
-- in the sidebar (not just a brand identity).
-- ============================================================

alter table public.ftp_connections
  add column if not exists site_host text;

create index if not exists idx_ftp_connections_site_host
  on public.ftp_connections(site_host);
-- ============================================================
-- Migration 038: Add finding_type and fix_type to audit_findings
-- Separates fixable issues from strategic observations.
-- ============================================================

-- Add finding_type column: 'fixable' or 'strategic'
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS finding_type text DEFAULT 'fixable';

-- Add fix_type column: deployment mechanism for fixable findings
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS fix_type text DEFAULT NULL;

-- Index for filtering by finding_type (Fix page vs Strategic section)
CREATE INDEX IF NOT EXISTS idx_audit_findings_finding_type
  ON audit_findings (audit_id, finding_type);

-- Backfill: mark all existing findings as 'fixable' (safe default)
UPDATE audit_findings
  SET finding_type = 'fixable'
  WHERE finding_type IS NULL;
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
-- Fix 2 Phase 1: Evidence contract for findings precision
-- Adds confidence_level and detection_source to standardize evidence quality

ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS confidence_level text NOT NULL DEFAULT 'heuristic',
  ADD COLUMN IF NOT EXISTS detection_source text NOT NULL DEFAULT 'analyzer';

-- Validate allowed values
ALTER TABLE audit_findings
  ADD CONSTRAINT chk_confidence_level
    CHECK (confidence_level IN ('deterministic', 'heuristic', 'interpretive'));

ALTER TABLE audit_findings
  ADD CONSTRAINT chk_detection_source
    CHECK (detection_source IN (
      'analyzer',           -- LLM-analyzed findings from crawled HTML
      'deep_analyzer',      -- Deep mode LLM analysis
      'wcag_checker',       -- WCAG 2.1 AA accessibility checks
      'responsive_checker', -- Multi-viewport layout checks
      'structured_data',    -- JSON-LD / schema validator
      'head_tag',           -- Head tag extraction checks
      'crawler',            -- Direct crawler observations
      'gap_fill',           -- Findings inherited from previous audit
      'brand_analyzer'      -- Brand identity LLM analysis
    ));

COMMENT ON COLUMN audit_findings.confidence_level IS 'How certain the detection is: deterministic (measurable), heuristic (rule-based), interpretive (AI judgment)';
COMMENT ON COLUMN audit_findings.detection_source IS 'Which pipeline stage produced this finding';
-- ============================================================
-- Migration 041: Crawl Summary & Audit Transparency
-- ============================================================
-- Adds crawl summary payload and timing fields to audits table.
-- Adds per-page crawl tracking to audit_pages table.
-- Supports Fix 4 — Crawl quality and audit transparency.

-- ── Crawl summary on audits ────────────────────────────────
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS crawl_summary jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS crawl_started_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS crawl_completed_at timestamptz DEFAULT NULL;

-- ── Per-page crawl metadata on audit_pages ─────────────────
ALTER TABLE audit_pages
  ADD COLUMN IF NOT EXISTS crawl_status text DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS skip_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS canonical_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_duplicate boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS page_type text DEFAULT 'content',
  ADD COLUMN IF NOT EXISTS fetch_strategy text DEFAULT NULL;
-- ============================================================
-- 042: Performance data — page-level and site-level
-- ============================================================
-- Adds performance_data jsonb to audit_pages for per-page
-- performance metrics, and performance_summary jsonb to audits
-- for site-level aggregation. Also adds owner_team to findings.
-- ============================================================

-- Page-level performance data (LCP estimate, page weight, scripts, images, third-party, CLS)
ALTER TABLE audit_pages
  ADD COLUMN IF NOT EXISTS performance_data jsonb DEFAULT NULL;

-- Site-level performance summary (aggregated from page-level data)
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS performance_summary jsonb DEFAULT NULL;

-- Finding owner team — who should fix this issue
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'owner_team') THEN
    CREATE TYPE owner_team AS ENUM ('engineering', 'marketing', 'product', 'design');
  END IF;
END$$;

-- Add owner_team to findings (nullable — only set on performance findings)
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS owner_team text DEFAULT NULL;

-- Add performance_metric_type to findings for filtering performance-related findings
ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS performance_metric_type text DEFAULT NULL;

-- Index for querying performance findings
CREATE INDEX IF NOT EXISTS idx_findings_performance_metric
  ON audit_findings (performance_metric_type)
  WHERE performance_metric_type IS NOT NULL;
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
-- Add PageSpeed Insights data fields to audits table
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS speed_data jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS speed_tested_at timestamptz DEFAULT NULL;

-- Index for quick lookups of audits with speed data
CREATE INDEX IF NOT EXISTS idx_audits_speed_tested_at ON audits (speed_tested_at)
  WHERE speed_tested_at IS NOT NULL;
-- Brand Intelligence Tier 1: sentiment + per-model attribution
-- Adds sentiment analysis data to multi_model_probes and a summary to reports

-- Sentiment data on each probe result (per-model sentiment themes)
ALTER TABLE multi_model_probes
  ADD COLUMN IF NOT EXISTS sentiment_score integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sentiment_themes jsonb DEFAULT NULL;

-- Aggregate brand intelligence summary on reports
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS brand_intelligence jsonb DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN multi_model_probes.sentiment_score IS 'Overall sentiment 0-100 for this model responses (50 = neutral, 100 = very positive)';
COMMENT ON COLUMN multi_model_probes.sentiment_themes IS 'Array of {theme, polarity, count} extracted from model responses';
COMMENT ON COLUMN reports.brand_intelligence IS 'Aggregate Brand Intelligence summary: {score, aiVisibility, placementScore, sentiment, shareOfVoice, perModelSentiment, themes}';
-- Tier 1 completion: add missing columns for brand intelligence
-- Fixes silent failures where code writes to non-existent columns

-- 1. placement_score on multi_model_probes (code already writes this but column was missing)
ALTER TABLE multi_model_probes
  ADD COLUMN IF NOT EXISTS placement_score numeric DEFAULT NULL;

COMMENT ON COLUMN multi_model_probes.placement_score IS 'Average brand placement position in AI response (1=top mention, 5=buried). Null if brand not mentioned.';

-- 2. brand_name on audits (used by brand intelligence extraction)
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS brand_name text DEFAULT NULL;

COMMENT ON COLUMN audits.brand_name IS 'Brand name for this audit — extracted from site or provided by user. Used for AI probe queries.';

-- 3. sentiment_data JSONB on audits (stores BrandIntelligenceSummary for quick access)
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS sentiment_data jsonb DEFAULT NULL;

COMMENT ON COLUMN audits.sentiment_data IS 'Full BrandIntelligenceSummary stored on the audit for quick access: {score, aiVisibility, placementScore, overallSentiment, shareOfVoice, perModel, positiveThemes, negativeThemes, issueCount, computedAt}';

-- 4. share_of_voice on multi_model_probes (per-model content share)
ALTER TABLE multi_model_probes
  ADD COLUMN IF NOT EXISTS share_of_voice numeric DEFAULT NULL;

COMMENT ON COLUMN multi_model_probes.share_of_voice IS 'Percentage of AI response content dedicated to this brand vs competitors (0-100)';
-- Tier 2: Human Perception Intelligence tables
-- Stores review data, Reddit mentions, web mentions, prompt library, snapshots, and content gaps

-- ─── Review aggregation ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid REFERENCES audits(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL, -- 'g2', 'capterra', 'trustpilot', 'google_places', 'app_store', 'product_hunt'
  brand_domain text NOT NULL,
  aggregate_score numeric, -- normalized 0-5
  review_count integer DEFAULT 0,
  sentiment_positive integer DEFAULT 0, -- count of positive reviews
  sentiment_neutral integer DEFAULT 0,
  sentiment_negative integer DEFAULT 0,
  top_positive_themes jsonb DEFAULT '[]', -- [{theme, count}]
  top_negative_themes jsonb DEFAULT '[]',
  recent_reviews jsonb DEFAULT '[]', -- last 10 reviews [{title, body, rating, date, author, platform_url}]
  raw_data jsonb DEFAULT NULL, -- full API response for debugging
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_reviews_audit ON brand_reviews(audit_id);
CREATE INDEX IF NOT EXISTS idx_brand_reviews_domain ON brand_reviews(brand_domain);

-- ��── Reddit mentions ────────────��───────────────────────────────────
CREATE TABLE IF NOT EXISTS reddit_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid REFERENCES audits(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  brand_domain text NOT NULL,
  subreddit text NOT NULL,
  post_title text NOT NULL,
  post_url text NOT NULL,
  post_body text,
  score integer DEFAULT 0, -- upvotes
  num_comments integer DEFAULT 0,
  sentiment text DEFAULT 'neutral', -- 'positive', 'negative', 'neutral'
  sentiment_score integer DEFAULT 50, -- 0-100
  themes jsonb DEFAULT '[]', -- [{theme, polarity}]
  author text,
  posted_at timestamptz,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reddit_mentions_audit ON reddit_mentions(audit_id);
CREATE INDEX IF NOT EXISTS idx_reddit_mentions_domain ON reddit_mentions(brand_domain);

-- ─── Web mentions (news, blogs, press) ──────────────────────────────
CREATE TABLE IF NOT EXISTS web_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid REFERENCES audits(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  brand_domain text NOT NULL,
  source_url text NOT NULL,
  source_domain text NOT NULL,
  title text NOT NULL,
  snippet text,
  sentiment text DEFAULT 'neutral', -- 'positive', 'negative', 'neutral'
  sentiment_score integer DEFAULT 50,
  themes jsonb DEFAULT '[]',
  domain_authority integer, -- estimated authority 0-100
  published_at timestamptz,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_mentions_audit ON web_mentions(audit_id);
CREATE INDEX IF NOT EXISTS idx_web_mentions_domain ON web_mentions(brand_domain);

-- ─── Prompt library ────────────────────���────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL, -- 'saas', 'ecommerce', 'agency', 'fintech', etc.
  prompt_text text NOT NULL,
  prompt_type text DEFAULT 'non_branded', -- 'branded', 'non_branded'
  intent text, -- 'purchase', 'comparison', 'research', 'recommendation'
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_library_category ON prompt_library(category);

-- ─── Prompt execution results ──────────���────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid REFERENCES audits(id) ON DELETE CASCADE NOT NULL,
  prompt_id uuid REFERENCES prompt_library(id) ON DELETE SET NULL,
  brand_domain text NOT NULL,
  model_id text NOT NULL,
  prompt_text text NOT NULL,
  response_text text NOT NULL,
  brand_mentioned boolean DEFAULT false,
  placement integer, -- 1-5
  sentiment_score integer, -- 0-100
  share_of_voice numeric, -- 0-100
  competitors_mentioned jsonb DEFAULT '[]', -- [{name, placement}]
  executed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_results_audit ON prompt_results(audit_id);

-- ─── Intelligence snapshots (for trend tracking) ────────────────────
CREATE TABLE IF NOT EXISTS intelligence_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  brand_domain text NOT NULL,
  audit_id uuid REFERENCES audits(id) ON DELETE SET NULL,
  -- Metrics at this point in time
  bi_score integer, -- composite brand intelligence score
  ai_visibility integer, -- % of models mentioning brand
  placement_score numeric,
  overall_sentiment integer,
  share_of_voice numeric,
  review_score numeric, -- aggregate review score
  web_mention_count integer,
  reddit_mention_count integer,
  positive_theme_count integer,
  negative_theme_count integer,
  -- Full data blob for detailed comparison
  full_data jsonb DEFAULT NULL,
  snapshot_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_brand ON intelligence_snapshots(brand_domain, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_user ON intelligence_snapshots(user_id);

-- ��── Content gaps (generated briefs for invisible prompts) ──────────
CREATE TABLE IF NOT EXISTS content_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid REFERENCES audits(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  brand_domain text NOT NULL,
  prompt_text text NOT NULL, -- the prompt where brand is invisible
  prompt_category text,
  -- Generated content brief
  recommended_topic text NOT NULL,
  recommended_format text, -- 'blog_post', 'case_study', 'comparison_page', 'faq', 'data_report'
  recommended_angle text,
  target_word_count integer,
  key_points jsonb DEFAULT '[]', -- [{point}]
  target_keywords jsonb DEFAULT '[]',
  estimated_impact text, -- 'high', 'medium', 'low'
  status text DEFAULT 'open', -- 'open', 'in_progress', 'published', 'dismissed'
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_gaps_audit ON content_gaps(audit_id);
CREATE INDEX IF NOT EXISTS idx_content_gaps_domain ON content_gaps(brand_domain);

-- ─── Human perception aggregate on audits ───────────────────────────
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS human_perception_data jsonb DEFAULT NULL;

COMMENT ON COLUMN audits.human_perception_data IS 'Aggregate human perception summary: {reviewScore, reviewCount, webMentionCount, redditMentionCount, socialSentiment, topPositiveThemes, topNegativeThemes, fetchedAt}';

-- ─── Seed prompt library with initial non-branded prompts ───────────
INSERT INTO prompt_library (category, prompt_text, prompt_type, intent) VALUES
  ('saas', 'What are the best project management tools for small teams?', 'non_branded', 'recommendation'),
  ('saas', 'Compare the top CRM platforms for startups', 'non_branded', 'comparison'),
  ('saas', 'What tools do you recommend for website analytics?', 'non_branded', 'recommendation'),
  ('saas', 'Best email marketing platforms for e-commerce', 'non_branded', 'recommendation'),
  ('saas', 'What are the top design tools for UI/UX designers?', 'non_branded', 'recommendation'),
  ('saas', 'Recommend a good invoicing tool for freelancers', 'non_branded', 'recommendation'),
  ('saas', 'What is the best tool for A/B testing websites?', 'non_branded', 'research'),
  ('saas', 'Top customer support platforms compared', 'non_branded', 'comparison'),
  ('saas', 'What tools help with SEO optimization?', 'non_branded', 'recommendation'),
  ('saas', 'Best platforms for building online courses', 'non_branded', 'recommendation'),
  ('ecommerce', 'What are the best platforms to sell products online?', 'non_branded', 'recommendation'),
  ('ecommerce', 'Compare Shopify alternatives for small businesses', 'non_branded', 'comparison'),
  ('ecommerce', 'Best tools for managing inventory across multiple channels', 'non_branded', 'recommendation'),
  ('ecommerce', 'What payment processors do you recommend for online stores?', 'non_branded', 'recommendation'),
  ('ecommerce', 'Top platforms for dropshipping businesses', 'non_branded', 'recommendation'),
  ('agency', 'What are the best tools for managing a digital agency?', 'non_branded', 'recommendation'),
  ('agency', 'Compare client reporting tools for marketing agencies', 'non_branded', 'comparison'),
  ('agency', 'Best white-label platforms for agencies', 'non_branded', 'recommendation'),
  ('agency', 'What tools do agencies use for project collaboration?', 'non_branded', 'recommendation'),
  ('agency', 'Top proposal and contract tools for service businesses', 'non_branded', 'recommendation'),
  ('fintech', 'What are the best personal finance apps?', 'non_branded', 'recommendation'),
  ('fintech', 'Compare budgeting tools for small businesses', 'non_branded', 'comparison'),
  ('fintech', 'Best platforms for crypto portfolio tracking', 'non_branded', 'recommendation'),
  ('fintech', 'What tools help with tax preparation for freelancers?', 'non_branded', 'recommendation'),
  ('fintech', 'Top investment platforms for beginners', 'non_branded', 'recommendation')
ON CONFLICT DO NOTHING;
-- 048: Soft-delete support for audits and brand_identities
-- Adds deleted_at column + partial index for efficient filtering.

ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE brand_identities
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Partial index: queries that filter deleted_at IS NULL stay fast.
CREATE INDEX IF NOT EXISTS idx_audits_not_deleted
  ON audits (user_id, completed_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_brand_identities_not_deleted
  ON brand_identities (user_id)
  WHERE deleted_at IS NULL;
-- 049: Workspace-based architecture
-- Introduces first-class workspaces to replace dropdown brand/site switching.
-- Each workspace = one brand/site context. All operational data scoped by workspace_id.

-- ── 1. Create workspaces table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspaces (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  slug          text NOT NULL,
  primary_domain text,                -- e.g. "clearux.ai"
  brand_name    text,
  workspace_type text NOT NULL DEFAULT 'website'
    CHECK (workspace_type IN ('website', 'brand', 'website_and_brand')),
  status        text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  active_audit_id          uuid,      -- current/latest audit
  active_brand_identity_id uuid,      -- linked brand DNA
  settings_json jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  archived_at   timestamptz
);

-- Slug must be unique per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_user_slug
  ON workspaces (user_id, slug);

CREATE INDEX IF NOT EXISTS idx_workspaces_user_active
  ON workspaces (user_id, status, created_at DESC)
  WHERE status = 'active';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_workspace_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workspace_updated ON workspaces;
CREATE TRIGGER trg_workspace_updated
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_workspace_timestamp();

-- RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own workspaces"
  ON workspaces FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workspaces"
  ON workspaces FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own workspaces"
  ON workspaces FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypass
CREATE POLICY "Service role full access to workspaces"
  ON workspaces FOR ALL
  USING (auth.role() = 'service_role');


-- ── 2. Add workspace_id to core tables ──────────────────────────────────────

ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

ALTER TABLE brand_identities
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

ALTER TABLE competitor_benchmarks
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

ALTER TABLE scheduled_audits
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

ALTER TABLE ftp_connections
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

ALTER TABLE site_notes
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

-- Indexes for workspace-scoped queries
CREATE INDEX IF NOT EXISTS idx_audits_workspace
  ON audits (workspace_id, completed_at DESC)
  WHERE workspace_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_brand_identities_workspace
  ON brand_identities (workspace_id)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_competitor_benchmarks_workspace
  ON competitor_benchmarks (workspace_id)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_audits_workspace
  ON scheduled_audits (workspace_id)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ftp_connections_workspace
  ON ftp_connections (workspace_id)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_site_notes_workspace
  ON site_notes (workspace_id)
  WHERE workspace_id IS NOT NULL;


-- ── 3. Backfill: create one workspace per distinct site/brand ───────────────

-- Helper function to generate URL-safe slugs
CREATE OR REPLACE FUNCTION generate_workspace_slug(domain_name text)
RETURNS text AS $$
BEGIN
  RETURN lower(regexp_replace(
    regexp_replace(domain_name, '[^a-zA-Z0-9-]', '-', 'g'),
    '-+', '-', 'g'
  ));
END;
$$ LANGUAGE plpgsql;

-- 3a. Create workspaces from brand_identities that have website_url
INSERT INTO workspaces (user_id, name, slug, primary_domain, brand_name, workspace_type, active_brand_identity_id)
SELECT DISTINCT ON (bi.user_id, host)
  bi.user_id,
  COALESCE(bi.name, host),
  generate_workspace_slug(host) || '-' || substring(gen_random_uuid()::text, 1, 4),
  host,
  bi.name,
  'website_and_brand',
  bi.id
FROM brand_identities bi
CROSS JOIN LATERAL (
  SELECT regexp_replace(
    regexp_replace(bi.website_url, '^https?://(www\.)?', ''),
    '/.*$', ''
  ) AS host
) h
WHERE bi.website_url IS NOT NULL
  AND bi.user_id IS NOT NULL
  AND bi.deleted_at IS NULL
  AND h.host != ''
ON CONFLICT DO NOTHING;

-- 3b. Create workspaces from audits that don't have a brand_identity
-- (standalone website audits)
INSERT INTO workspaces (user_id, name, slug, primary_domain, workspace_type)
SELECT DISTINCT ON (a.user_id, host)
  a.user_id,
  host,
  generate_workspace_slug(host) || '-' || substring(gen_random_uuid()::text, 1, 4),
  host,
  'website'
FROM audits a
CROSS JOIN LATERAL (
  SELECT regexp_replace(
    regexp_replace(a.product_url, '^https?://(www\.)?', ''),
    '/.*$', ''
  ) AS host
) h
WHERE a.product_url IS NOT NULL
  AND a.user_id IS NOT NULL
  AND a.deleted_at IS NULL
  AND a.brand_identity_id IS NULL
  AND h.host != ''
  AND NOT EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.user_id = a.user_id AND w.primary_domain = h.host
  )
ON CONFLICT DO NOTHING;

-- 3c. Create workspaces from brand_identities WITHOUT website_url
-- (pure brand identity workspaces)
INSERT INTO workspaces (user_id, name, slug, brand_name, workspace_type, active_brand_identity_id)
SELECT
  bi.user_id,
  bi.name,
  generate_workspace_slug(COALESCE(bi.name, 'brand')) || '-' || substring(gen_random_uuid()::text, 1, 4),
  bi.name,
  'brand',
  bi.id
FROM brand_identities bi
WHERE bi.website_url IS NULL
  AND bi.user_id IS NOT NULL
  AND bi.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.user_id = bi.user_id AND w.active_brand_identity_id = bi.id
  )
ON CONFLICT DO NOTHING;


-- ── 4. Backfill workspace_id on existing records ────────────────────────────

-- 4a. brand_identities → match by workspace's active_brand_identity_id
UPDATE brand_identities bi
SET workspace_id = w.id
FROM workspaces w
WHERE w.active_brand_identity_id = bi.id
  AND bi.workspace_id IS NULL;

-- 4b. brand_identities → match by domain
UPDATE brand_identities bi
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = bi.user_id
  AND w.primary_domain IS NOT NULL
  AND bi.website_url IS NOT NULL
  AND w.primary_domain = regexp_replace(
    regexp_replace(bi.website_url, '^https?://(www\.)?', ''),
    '/.*$', ''
  )
  AND bi.workspace_id IS NULL;

-- 4c. audits → match by brand_identity's workspace
UPDATE audits a
SET workspace_id = bi.workspace_id
FROM brand_identities bi
WHERE a.brand_identity_id = bi.id
  AND bi.workspace_id IS NOT NULL
  AND a.workspace_id IS NULL;

-- 4d. audits → match by domain to workspace
UPDATE audits a
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = a.user_id
  AND w.primary_domain IS NOT NULL
  AND a.product_url IS NOT NULL
  AND w.primary_domain = regexp_replace(
    regexp_replace(a.product_url, '^https?://(www\.)?', ''),
    '/.*$', ''
  )
  AND a.workspace_id IS NULL;

-- 4e. competitor_benchmarks → match by domain
UPDATE competitor_benchmarks cb
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = cb.user_id
  AND w.primary_domain IS NOT NULL
  AND cb.domain IS NOT NULL
  AND w.primary_domain = cb.domain
  AND cb.workspace_id IS NULL;

-- 4f. scheduled_audits → match by domain
UPDATE scheduled_audits sa
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = sa.user_id
  AND w.primary_domain IS NOT NULL
  AND sa.product_url IS NOT NULL
  AND w.primary_domain = regexp_replace(
    regexp_replace(sa.product_url, '^https?://(www\.)?', ''),
    '/.*$', ''
  )
  AND sa.workspace_id IS NULL;

-- 4g. ftp_connections → match via brand_identity
UPDATE ftp_connections fc
SET workspace_id = bi.workspace_id
FROM brand_identities bi
WHERE fc.brand_identity_id = bi.id
  AND bi.workspace_id IS NOT NULL
  AND fc.workspace_id IS NULL;

-- 4h. site_notes → match by domain
UPDATE site_notes sn
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = sn.user_id
  AND w.primary_domain IS NOT NULL
  AND sn.domain IS NOT NULL
  AND w.primary_domain = sn.domain
  AND sn.workspace_id IS NULL;

-- 4i. Set active_audit_id on workspaces to their latest completed audit
UPDATE workspaces w
SET active_audit_id = sub.id
FROM (
  SELECT DISTINCT ON (workspace_id) id, workspace_id
  FROM audits
  WHERE workspace_id IS NOT NULL
    AND status = 'completed'
    AND deleted_at IS NULL
  ORDER BY workspace_id, completed_at DESC NULLS LAST
) sub
WHERE sub.workspace_id = w.id;

-- Clean up helper function
DROP FUNCTION IF EXISTS generate_workspace_slug(text);
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
-- 051: Add tag column to brand_identity_files
-- The tag column is used by the analyze-files route to classify uploaded
-- files (e.g. 'Brand guide', 'Logo', 'Icon', 'Voice', 'Colours', 'Messaging')
-- and by the GET list route's embedded select. Without this column the
-- PostgREST embedded resource query fails, breaking file visibility.

ALTER TABLE brand_identity_files
  ADD COLUMN IF NOT EXISTS tag TEXT DEFAULT NULL;
-- Pipeline v1: Add pipeline_version column and new status values
-- Also add index on audit_logs for efficient polling

-- Add pipeline_version to audits
ALTER TABLE audits ADD COLUMN IF NOT EXISTS pipeline_version text DEFAULT NULL;

-- Add index for fetching recent audit_logs by audit_id (used by activity feed polling)
CREATE INDEX IF NOT EXISTS idx_audit_logs_audit_id_created ON audit_logs (audit_id, created_at DESC);

-- Add index for detecting stale audits
CREATE INDEX IF NOT EXISTS idx_audits_status_updated ON audits (status, updated_at) WHERE status IN ('payment_received', 'crawling', 'analysing', 'generating_report');
-- ============================================================
-- Migration: Audit usage tracking — billing period + deep audit quota
--
-- Adds billing period boundaries and deep-audit entitlement to
-- profiles so usage can be derived from audit records rather than
-- fragile decrement-counters.
-- ============================================================

-- Billing period boundaries (set by Stripe webhook on subscription
-- activation and renewal). NULL for users without a subscription.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS billing_period_start timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS billing_period_end   timestamptz DEFAULT NULL;

-- Deep-audit monthly entitlement (mirrors audits_per_month for re-audits).
-- Set by Stripe webhook from pricing.ts plan config.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deep_audits_per_month integer NOT NULL DEFAULT 0;

-- Index to speed up the canonical usage query:
-- "count audits for this user in the current billing period"
CREATE INDEX IF NOT EXISTS idx_audits_user_created
  ON audits (user_id, created_at DESC);

-- Index on workspace_id + created_at for "is this the first audit
-- for this workspace?" checks during billing classification.
CREATE INDEX IF NOT EXISTS idx_audits_workspace_created
  ON audits (workspace_id, created_at)
  WHERE workspace_id IS NOT NULL;
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
-- ============================================================
-- Migration: Add communication JSONB column to audit_findings
-- Dual-layer issue communication model:
--   - Plain-language layer (site owners, marketers)
--   - Technical layer (developers)
-- ============================================================

ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS communication JSONB DEFAULT NULL;

-- Index for querying findings that have/lack communication data
CREATE INDEX IF NOT EXISTS idx_audit_findings_has_communication
  ON audit_findings ((communication IS NOT NULL))
  WHERE communication IS NOT NULL;

COMMENT ON COLUMN audit_findings.communication IS
  'Dual-layer communication: {title_plain, what_found, why_matters, technical_note, fix_plain, fix_technical}';
-- ============================================================
-- Fix AI interrogation question ID types
-- ============================================================
-- The static question library uses short string IDs (e.g. 'df-001',
-- 'gd-002') instead of UUIDs. The original migration defined these
-- columns as uuid / uuid[], which causes insert failures.
--
-- This migration:
--   1. Drops the FK constraint on workspace_ai_interrogations.question_id
--   2. Changes question_id from uuid to text (nullable)
--   3. Changes question_ids in workspace_ai_question_sets from uuid[] to text[]
--   4. Changes followup_question_ids in ai_question_library from uuid[] to text[]
--   5. Changes ai_question_library.id from uuid to text (to match library IDs)
-- ============================================================

-- 1. Drop FK constraint on workspace_ai_interrogations.question_id
ALTER TABLE workspace_ai_interrogations
  DROP CONSTRAINT IF EXISTS workspace_ai_interrogations_question_id_fkey;

-- 2. Change question_id column type to text
ALTER TABLE workspace_ai_interrogations
  ALTER COLUMN question_id TYPE text USING question_id::text;

-- 3. Change question_ids in workspace_ai_question_sets to text[]
ALTER TABLE workspace_ai_question_sets
  ALTER COLUMN question_ids TYPE text[] USING question_ids::text[];

-- 4. Change followup_question_ids in ai_question_library to text[]
ALTER TABLE ai_question_library
  ALTER COLUMN followup_question_ids TYPE text[] USING followup_question_ids::text[];

-- 5. Change ai_question_library PK to text
ALTER TABLE ai_question_library
  ALTER COLUMN id TYPE text USING id::text;
-- ============================================================
-- 20260608_orphan_cleanup.sql
--
-- Cleans up records with NULL workspace_id left over after
-- migration 049_workspaces.sql. The product spec requires ALL
-- live queries to be workspace-scoped, so NULL workspace_id
-- records can pollute results.
--
-- This migration is IDEMPOTENT: safe to re-run. Each step uses
-- WHERE workspace_id IS NULL guards so already-assigned rows
-- are never touched.
--
-- Steps:
--   1. Re-run domain-based backfill (same logic as 049 section 4)
--      to catch records created between 049 and now.
--   2. Auto-create workspaces for users who have orphaned audits
--      but zero workspaces, using their most common audit domain.
--   3. Soft-delete (or hard-delete for security-sensitive tables)
--      any remaining orphans that still have workspace_id = NULL.
-- ============================================================

BEGIN;


-- ================================================================
-- SECTION 1: Re-run domain-based backfill (idempotent)
-- Identical logic to 049 section 4 — catches any records that
-- were created after 049 ran but before workspaces were enforced.
-- ================================================================

-- 1a. brand_identities -> match by workspace's active_brand_identity_id
UPDATE brand_identities bi
SET workspace_id = w.id
FROM workspaces w
WHERE w.active_brand_identity_id = bi.id
  AND bi.workspace_id IS NULL;

-- 1b. brand_identities -> match by domain
UPDATE brand_identities bi
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = bi.user_id
  AND w.primary_domain IS NOT NULL
  AND bi.website_url IS NOT NULL
  AND w.primary_domain = regexp_replace(
    regexp_replace(bi.website_url, '^https?://(www\.)?', ''),
    '/.*$', ''
  )
  AND bi.workspace_id IS NULL;

-- 1c. audits -> match by brand_identity's workspace
UPDATE audits a
SET workspace_id = bi.workspace_id
FROM brand_identities bi
WHERE a.brand_identity_id = bi.id
  AND bi.workspace_id IS NOT NULL
  AND a.workspace_id IS NULL;

-- 1d. audits -> match by domain to workspace
UPDATE audits a
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = a.user_id
  AND w.primary_domain IS NOT NULL
  AND a.product_url IS NOT NULL
  AND w.primary_domain = regexp_replace(
    regexp_replace(a.product_url, '^https?://(www\.)?', ''),
    '/.*$', ''
  )
  AND a.workspace_id IS NULL;

-- 1e. competitor_benchmarks -> match by domain
UPDATE competitor_benchmarks cb
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = cb.user_id
  AND w.primary_domain IS NOT NULL
  AND cb.domain IS NOT NULL
  AND w.primary_domain = cb.domain
  AND cb.workspace_id IS NULL;

-- 1f. scheduled_audits -> match by domain
UPDATE scheduled_audits sa
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = sa.user_id
  AND w.primary_domain IS NOT NULL
  AND sa.product_url IS NOT NULL
  AND w.primary_domain = regexp_replace(
    regexp_replace(sa.product_url, '^https?://(www\.)?', ''),
    '/.*$', ''
  )
  AND sa.workspace_id IS NULL;

-- 1g. ftp_connections -> match via brand_identity
UPDATE ftp_connections fc
SET workspace_id = bi.workspace_id
FROM brand_identities bi
WHERE fc.brand_identity_id = bi.id
  AND bi.workspace_id IS NOT NULL
  AND fc.workspace_id IS NULL;

-- 1h. site_notes -> match by domain
UPDATE site_notes sn
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = sn.user_id
  AND w.primary_domain IS NOT NULL
  AND sn.domain IS NOT NULL
  AND w.primary_domain = sn.domain
  AND sn.workspace_id IS NULL;


-- ================================================================
-- SECTION 2: Auto-create workspaces for users with orphaned audits
-- who have NO workspace at all.
--
-- For each such user we:
--   a) Find their most common audit domain
--   b) Create a workspace with that domain
--   c) Assign all their orphaned records to it
-- ================================================================

-- Temporary helper function for slug generation (same as 049)
CREATE OR REPLACE FUNCTION _orphan_cleanup_slug(domain_name text)
RETURNS text AS $$
BEGIN
  RETURN lower(regexp_replace(
    regexp_replace(domain_name, '[^a-zA-Z0-9-]', '-', 'g'),
    '-+', '-', 'g'
  ));
END;
$$ LANGUAGE plpgsql;

-- 2a. Create one workspace per workspace-less user, using their
--     most common audit domain.
INSERT INTO workspaces (user_id, name, slug, primary_domain, workspace_type)
SELECT
  orphan.user_id,
  orphan.top_domain,
  _orphan_cleanup_slug(orphan.top_domain) || '-' || substring(gen_random_uuid()::text, 1, 4),
  orphan.top_domain,
  'website'
FROM (
  -- For each user with no workspace, find the domain that appears
  -- most often across their orphaned audits.
  SELECT DISTINCT ON (a.user_id)
    a.user_id,
    regexp_replace(
      regexp_replace(a.product_url, '^https?://(www\.)?', ''),
      '/.*$', ''
    ) AS top_domain,
    count(*) AS cnt
  FROM audits a
  WHERE a.workspace_id IS NULL
    AND a.deleted_at IS NULL
    AND a.product_url IS NOT NULL
    AND a.user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM workspaces w WHERE w.user_id = a.user_id
    )
  GROUP BY a.user_id,
    regexp_replace(
      regexp_replace(a.product_url, '^https?://(www\.)?', ''),
      '/.*$', ''
    )
  ORDER BY a.user_id, cnt DESC
) orphan
WHERE orphan.top_domain != ''
ON CONFLICT DO NOTHING;

-- 2b. Now assign orphaned audits for those users to their new workspace
UPDATE audits a
SET workspace_id = w.id
FROM workspaces w
WHERE w.user_id = a.user_id
  AND w.primary_domain IS NOT NULL
  AND a.product_url IS NOT NULL
  AND w.primary_domain = regexp_replace(
    regexp_replace(a.product_url, '^https?://(www\.)?', ''),
    '/.*$', ''
  )
  AND a.workspace_id IS NULL;

-- 2c. Also try to assign any remaining orphaned audits for those
--     users (different domains) to whatever workspace the user now has.
--     Pick the first workspace by created_at if multiple exist.
UPDATE audits a
SET workspace_id = sub.wid
FROM (
  SELECT DISTINCT ON (w.user_id) w.user_id, w.id AS wid
  FROM workspaces w
  WHERE w.status = 'active'
  ORDER BY w.user_id, w.created_at ASC
) sub
WHERE sub.user_id = a.user_id
  AND a.workspace_id IS NULL
  AND a.deleted_at IS NULL;

-- 2d. Assign remaining orphaned brand_identities via same fallback
UPDATE brand_identities bi
SET workspace_id = sub.wid
FROM (
  SELECT DISTINCT ON (w.user_id) w.user_id, w.id AS wid
  FROM workspaces w
  WHERE w.status = 'active'
  ORDER BY w.user_id, w.created_at ASC
) sub
WHERE sub.user_id = bi.user_id
  AND bi.workspace_id IS NULL
  AND bi.deleted_at IS NULL;

-- 2e. Assign remaining orphaned competitor_benchmarks
UPDATE competitor_benchmarks cb
SET workspace_id = sub.wid
FROM (
  SELECT DISTINCT ON (w.user_id) w.user_id, w.id AS wid
  FROM workspaces w
  WHERE w.status = 'active'
  ORDER BY w.user_id, w.created_at ASC
) sub
WHERE sub.user_id = cb.user_id
  AND cb.workspace_id IS NULL;

-- 2f. Assign remaining orphaned scheduled_audits
UPDATE scheduled_audits sa
SET workspace_id = sub.wid
FROM (
  SELECT DISTINCT ON (w.user_id) w.user_id, w.id AS wid
  FROM workspaces w
  WHERE w.status = 'active'
  ORDER BY w.user_id, w.created_at ASC
) sub
WHERE sub.user_id = sa.user_id
  AND sa.workspace_id IS NULL;

-- 2g. Assign remaining orphaned ftp_connections
UPDATE ftp_connections fc
SET workspace_id = sub.wid
FROM (
  SELECT DISTINCT ON (w.user_id) w.user_id, w.id AS wid
  FROM workspaces w
  WHERE w.status = 'active'
  ORDER BY w.user_id, w.created_at ASC
) sub
WHERE sub.user_id = fc.user_id
  AND fc.workspace_id IS NULL;

-- 2h. Assign remaining orphaned site_notes
UPDATE site_notes sn
SET workspace_id = sub.wid
FROM (
  SELECT DISTINCT ON (w.user_id) w.user_id, w.id AS wid
  FROM workspaces w
  WHERE w.status = 'active'
  ORDER BY w.user_id, w.created_at ASC
) sub
WHERE sub.user_id = sn.user_id
  AND sn.workspace_id IS NULL;


-- ================================================================
-- SECTION 3: Soft-delete / hard-delete remaining orphans
-- After sections 1 and 2, any record still with workspace_id=NULL
-- either belongs to a deleted user or truly cannot be matched.
-- ================================================================

-- 3a. audits: soft-delete
UPDATE audits
SET deleted_at = now()
WHERE workspace_id IS NULL
  AND deleted_at IS NULL;

-- 3b. brand_identities: soft-delete
UPDATE brand_identities
SET deleted_at = now()
WHERE workspace_id IS NULL
  AND deleted_at IS NULL;

-- 3c. scheduled_audits: deactivate
UPDATE scheduled_audits
SET is_active = false
WHERE workspace_id IS NULL;

-- 3d. site_notes: deactivate
UPDATE site_notes
SET is_active = false
WHERE workspace_id IS NULL;

-- 3e. ftp_connections: HARD DELETE (security — encrypted passwords)
DELETE FROM ftp_connections
WHERE workspace_id IS NULL;

-- 3f. competitor_benchmarks: HARD DELETE
DELETE FROM competitor_benchmarks
WHERE workspace_id IS NULL;


-- ================================================================
-- Cleanup
-- ================================================================

DROP FUNCTION IF EXISTS _orphan_cleanup_slug(text);

COMMIT;
-- ============================================================
-- Quota Model — Separate active inventory from monthly usage
-- ============================================================
--
-- Adds admin-overridable quota columns to profiles.
-- NULL = use plan default from pricing.ts.
-- Numeric value = per-user admin override.
-- These columns are ONLY read by audit-usage.ts / workspace
-- creation route to resolve effective limits.
-- ============================================================

-- ── Active inventory caps ───────────────────────────────────
-- Controls how many items can be live at once.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS max_active_workspaces INT DEFAULT NULL;

COMMENT ON COLUMN profiles.max_active_workspaces IS
  'Admin override: max active workspaces. NULL = use plan default.';

-- ── Monthly creation / usage caps ───────────────────────────
-- Controls how many items can be CREATED per billing cycle.
-- Deleting an item does NOT refund the creation slot.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS workspace_creations_per_cycle INT DEFAULT NULL;

COMMENT ON COLUMN profiles.workspace_creations_per_cycle IS
  'Admin override: max workspace creations per billing cycle. NULL = use plan default.';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS reaudits_per_cycle INT DEFAULT NULL;

COMMENT ON COLUMN profiles.reaudits_per_cycle IS
  'Admin override: max re-audits per billing cycle. NULL = use plan default (audits_per_month).';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deep_audits_per_cycle INT DEFAULT NULL;

COMMENT ON COLUMN profiles.deep_audits_per_cycle IS
  'Admin override: max deep audits per billing cycle. NULL = use plan default (deep_audits_per_month).';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS brand_ai_requests_per_cycle INT DEFAULT NULL;

COMMENT ON COLUMN profiles.brand_ai_requests_per_cycle IS
  'Admin override: max brand AI / interrogation requests per billing cycle. NULL = use plan default (ai_checks_per_month).';
-- ============================================================
-- Migration: Free membership columns on profiles
--
-- Adds free_membership flag and expiry date so admins can grant
-- free access to specific users without requiring a Stripe sub.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS free_membership boolean NOT NULL DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS free_membership_expiry timestamptz DEFAULT NULL;

COMMENT ON COLUMN profiles.free_membership IS
  'True when an admin has granted free access (bypasses Stripe subscription).';

COMMENT ON COLUMN profiles.free_membership_expiry IS
  'When the free membership expires. NULL = never expires.';
