-- ============================================================
-- Competitor Benchmarks — stores benchmark comparison data
-- per domain per user, so it persists across page loads.
-- ============================================================

CREATE TABLE IF NOT EXISTS competitor_benchmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain      TEXT NOT NULL,               -- the user's audited domain (normalized, no www)
  competitor_domain TEXT NOT NULL,          -- competitor domain
  competitor_name   TEXT,                   -- display name
  overall_score     INTEGER NOT NULL DEFAULT 0,
  pillar_scores     JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{name, score}]
  industry          TEXT,                   -- detected industry
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups: get all competitors for a user+domain
CREATE INDEX IF NOT EXISTS idx_comp_bench_user_domain
  ON competitor_benchmarks(user_id, domain);

-- RLS
ALTER TABLE competitor_benchmarks ENABLE ROW LEVEL SECURITY;

-- Users can only see their own benchmarks
CREATE POLICY "Users can view own benchmarks"
  ON competitor_benchmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own benchmarks"
  ON competitor_benchmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own benchmarks"
  ON competitor_benchmarks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own benchmarks"
  ON competitor_benchmarks FOR DELETE
  USING (auth.uid() = user_id);
