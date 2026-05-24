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
