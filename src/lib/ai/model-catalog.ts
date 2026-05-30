// ============================================================
// Fixpath AI Gateway — Model Catalog
// ============================================================
// The top AI search engines and chat assistants that shape how
// brands appear across AI-powered discovery.  Every model here
// powers a consumer product people use daily to search, compare,
// and evaluate brands.
//
// Claude stays on the direct Anthropic SDK (prompt caching).
// All others route through OpenRouter.
// ============================================================

export interface AIModelDef {
  slug: string           // OpenRouter model ID e.g. 'openai/gpt-4o-mini'
  displayName: string    // Consumer-facing name e.g. 'ChatGPT'
  provider: string       // 'openai' | 'google' | 'perplexity' | 'xai' | 'meta' | 'deepseek'
  shortId: string        // Our internal ID for display e.g. 'chatgpt', 'gemini', 'grok'
  /** The consumer product this model powers */
  productName: string
  supportsTools: boolean
  supportsStructuredOutput: boolean
  supportsVision: boolean
  defaultEnabled: boolean
  priorityOrder: number  // Lower = higher priority
  features: {
    competitors: boolean
    voice: boolean
    answers: boolean
    reports: boolean
  }
}

/** Default catalog — the top AI search engines and assistants */
export const DEFAULT_MODEL_CATALOG: AIModelDef[] = [
  {
    slug: 'openai/gpt-4o-mini',
    displayName: 'ChatGPT',
    provider: 'openai',
    shortId: 'chatgpt',
    productName: 'ChatGPT Search',
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    defaultEnabled: true,
    priorityOrder: 1,
    features: { competitors: true, voice: true, answers: true, reports: true },
  },
  {
    slug: 'google/gemini-2.5-flash',
    displayName: 'Gemini',
    provider: 'google',
    shortId: 'gemini',
    productName: 'Google AI Overviews',
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    defaultEnabled: true,
    priorityOrder: 2,
    features: { competitors: true, voice: true, answers: true, reports: true },
  },
  {
    slug: 'perplexity/sonar',
    displayName: 'Perplexity',
    provider: 'perplexity',
    shortId: 'perplexity',
    productName: 'Perplexity Search',
    supportsTools: false,
    supportsStructuredOutput: false,
    supportsVision: false,
    defaultEnabled: true,
    priorityOrder: 3,
    features: { competitors: true, voice: true, answers: true, reports: true },
  },
  {
    slug: 'x-ai/grok-4.3',
    displayName: 'Grok',
    provider: 'xai',
    shortId: 'grok',
    productName: 'Grok on X',
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    defaultEnabled: true,
    priorityOrder: 4,
    features: { competitors: true, voice: true, answers: true, reports: true },
  },
  {
    slug: 'meta-llama/llama-4-scout-17b-16e-instruct',
    displayName: 'Meta AI',
    provider: 'meta',
    shortId: 'meta',
    productName: 'Meta AI on WhatsApp, Instagram & Facebook',
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    defaultEnabled: true,
    priorityOrder: 5,
    features: { competitors: true, voice: true, answers: true, reports: true },
  },
  {
    slug: 'deepseek/deepseek-chat-v3-0324',
    displayName: 'DeepSeek',
    provider: 'deepseek',
    shortId: 'deepseek',
    productName: 'DeepSeek Search',
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    defaultEnabled: true,
    priorityOrder: 6,
    features: { competitors: true, voice: true, answers: true, reports: true },
  },
]

export function getDefaultCatalog(): AIModelDef[] {
  return DEFAULT_MODEL_CATALOG
}

export function findModelBySlug(slug: string): AIModelDef | undefined {
  return DEFAULT_MODEL_CATALOG.find((m) => m.slug === slug)
}

export function findModelByShortId(shortId: string): AIModelDef | undefined {
  return DEFAULT_MODEL_CATALOG.find((m) => m.shortId === shortId)
}

/**
 * Given a list of enabled model slugs and a feature key, return the
 * matching model definitions sorted by priority.
 */
export function getEnabledModelsForFeature(
  enabledSlugs: string[],
  feature: keyof AIModelDef['features'],
): AIModelDef[] {
  const enabled = new Set(enabledSlugs)
  return DEFAULT_MODEL_CATALOG
    .filter((m) => enabled.has(m.slug) && m.features[feature])
    .sort((a, b) => a.priorityOrder - b.priorityOrder)
}
