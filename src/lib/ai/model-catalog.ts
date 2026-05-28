// ============================================================
// Fixpath AI Gateway — Model Catalog
// ============================================================
// Local allowed model catalog with capability metadata.
// Models are identified by their OpenRouter slug.
// ============================================================

export interface AIModelDef {
  slug: string           // OpenRouter model ID e.g. 'openai/gpt-4o-mini'
  displayName: string    // e.g. 'GPT-4o Mini'
  provider: string       // 'openai' | 'google' | 'anthropic' | 'perplexity' | 'meta' | 'mistral'
  shortId: string        // Our internal ID for display e.g. 'gpt4o', 'gemini', 'perplexity', 'llama', 'mistral'
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

/** Default catalog — these are the models we support out of the box */
export const DEFAULT_MODEL_CATALOG: AIModelDef[] = [
  {
    slug: 'openai/gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'openai',
    shortId: 'gpt4o',
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    defaultEnabled: true,
    priorityOrder: 1,
    features: { competitors: true, voice: true, answers: true, reports: true },
  },
  {
    slug: 'google/gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'google',
    shortId: 'gemini',
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsVision: true,
    defaultEnabled: true,
    priorityOrder: 2,
    features: { competitors: true, voice: true, answers: true, reports: true },
  },
  {
    slug: 'perplexity/sonar',
    displayName: 'Perplexity Sonar',
    provider: 'perplexity',
    shortId: 'perplexity',
    supportsTools: false,
    supportsStructuredOutput: false,
    supportsVision: false,
    defaultEnabled: true,
    priorityOrder: 3,
    features: { competitors: true, voice: true, answers: true, reports: false },
  },
  {
    slug: 'meta-llama/llama-3.3-70b-instruct',
    displayName: 'Llama 3.3 70B',
    provider: 'meta',
    shortId: 'llama',
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    defaultEnabled: false,
    priorityOrder: 4,
    features: { competitors: true, voice: true, answers: true, reports: true },
  },
  {
    slug: 'mistralai/mistral-small-3.1-24b-instruct',
    displayName: 'Mistral Small 3.1',
    provider: 'mistral',
    shortId: 'mistral',
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsVision: false,
    defaultEnabled: false,
    priorityOrder: 5,
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
