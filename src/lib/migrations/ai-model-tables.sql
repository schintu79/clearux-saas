-- ============================================================
-- Fixpath — AI Model Catalog & Settings Tables
-- ============================================================

-- AI Model Catalog — master list of available models
CREATE TABLE IF NOT EXISTS ai_model_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  short_id TEXT NOT NULL,
  supports_tools BOOLEAN DEFAULT false,
  supports_structured_output BOOLEAN DEFAULT false,
  supports_vision BOOLEAN DEFAULT false,
  default_enabled BOOLEAN DEFAULT true,
  priority_order INTEGER DEFAULT 100,
  features JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User-level AI model settings
CREATE TABLE IF NOT EXISTS ai_model_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  model_slug TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  use_for_competitors BOOLEAN DEFAULT true,
  use_for_voice BOOLEAN DEFAULT true,
  use_for_answers BOOLEAN DEFAULT true,
  use_for_reports BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, workspace_id, model_slug)
);

-- Seed the catalog with default models
INSERT INTO ai_model_catalog (slug, display_name, provider, short_id, supports_tools, supports_structured_output, supports_vision, default_enabled, priority_order, features)
VALUES
  ('openai/gpt-4o-mini', 'GPT-4o Mini', 'openai', 'gpt4o', true, true, true, true, 1, '{"competitors":true,"voice":true,"answers":true,"reports":true}'),
  ('google/gemini-2.5-flash', 'Gemini 2.5 Flash', 'google', 'gemini', true, true, true, true, 2, '{"competitors":true,"voice":true,"answers":true,"reports":true}'),
  ('perplexity/sonar', 'Perplexity Sonar', 'perplexity', 'perplexity', false, false, false, true, 3, '{"competitors":true,"voice":true,"answers":true,"reports":false}'),
  ('meta-llama/llama-3.3-70b-instruct', 'Llama 3.3 70B', 'meta', 'llama', true, true, false, false, 4, '{"competitors":true,"voice":true,"answers":true,"reports":true}'),
  ('mistralai/mistral-small-3.1-24b-instruct', 'Mistral Small 3.1', 'mistral', 'mistral', true, true, false, false, 5, '{"competitors":true,"voice":true,"answers":true,"reports":true}')
ON CONFLICT (slug) DO NOTHING;
