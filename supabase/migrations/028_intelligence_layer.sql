-- ============================================================
-- Phase 4: Intelligence Layer
-- Multi-model AI benchmarking, industry index, predictions
-- ============================================================

-- Multi-model probe results — one row per model per audit
CREATE TABLE IF NOT EXISTS multi_model_probes (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id      uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  model_id      text NOT NULL,             -- 'claude' | 'gpt4o' | 'gemini'
  model_label   text NOT NULL,             -- 'Claude' | 'GPT-4o' | 'Gemini'
  accuracy_score integer NOT NULL DEFAULT 0, -- 0-100
  accurate_count integer NOT NULL DEFAULT 0,
  partial_count  integer NOT NULL DEFAULT 0,
  inaccurate_count integer NOT NULL DEFAULT 0,
  hallucinated_count integer NOT NULL DEFAULT 0,
  no_data_count  integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  results_json   jsonb DEFAULT '[]'::jsonb, -- full ModelProbeResult[] array
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_multi_model_probes_audit
  ON multi_model_probes(audit_id);

-- Industry benchmarks — cached aggregates, refreshed periodically
CREATE TABLE IF NOT EXISTS industry_benchmarks (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  industry      text NOT NULL,
  sample_size   integer NOT NULL DEFAULT 0,
  avg_score     integer NOT NULL DEFAULT 0,
  median_score  integer NOT NULL DEFAULT 0,
  p90_score     integer NOT NULL DEFAULT 0,
  p10_score     integer NOT NULL DEFAULT 0,
  distribution  jsonb DEFAULT '{}'::jsonb,
  computed_at   timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_industry_benchmarks_industry
  ON industry_benchmarks(industry);

-- Predictive recommendations — cached per audit
CREATE TABLE IF NOT EXISTS predictive_recommendations (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id        uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  action          text NOT NULL,
  predicted_impact integer NOT NULL DEFAULT 0,
  confidence      text NOT NULL DEFAULT 'medium',
  data_points     integer NOT NULL DEFAULT 0,
  avg_improvement integer NOT NULL DEFAULT 0,
  category        text NOT NULL,
  evidence        text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_predictive_recs_audit
  ON predictive_recommendations(audit_id);

-- Add model_benchmarks summary to reports table
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS model_benchmarks jsonb DEFAULT NULL;

-- Add detected_industry to audits for cohort analysis
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS detected_industry text DEFAULT NULL;

-- RLS policies for new tables
ALTER TABLE multi_model_probes ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictive_recommendations ENABLE ROW LEVEL SECURITY;

-- Users can read their own multi-model probes
CREATE POLICY "Users read own multi_model_probes"
  ON multi_model_probes FOR SELECT
  USING (audit_id IN (SELECT id FROM audits WHERE user_id = auth.uid()));

-- Service role can insert multi-model probes
CREATE POLICY "Service inserts multi_model_probes"
  ON multi_model_probes FOR INSERT
  WITH CHECK (true);

-- Industry benchmarks are readable by all authenticated users
CREATE POLICY "Authenticated users read industry_benchmarks"
  ON industry_benchmarks FOR SELECT
  USING (auth.role() = 'authenticated');

-- Service role can manage industry benchmarks
CREATE POLICY "Service manages industry_benchmarks"
  ON industry_benchmarks FOR ALL
  USING (true)
  WITH CHECK (true);

-- Users can read their own predictive recommendations
CREATE POLICY "Users read own predictive_recommendations"
  ON predictive_recommendations FOR SELECT
  USING (audit_id IN (SELECT id FROM audits WHERE user_id = auth.uid()));

-- Service role can insert predictive recommendations
CREATE POLICY "Service inserts predictive_recommendations"
  ON predictive_recommendations FOR INSERT
  WITH CHECK (true);
