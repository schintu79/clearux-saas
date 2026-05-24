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
