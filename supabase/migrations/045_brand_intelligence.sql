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
