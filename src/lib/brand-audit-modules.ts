// ============================================================
// ClearUX — Brand Identity Audit Module Definitions
// Categories for analyzing uploaded brand materials (PDF, DOCX,
// images, etc.) against professional brand standards.
// ============================================================

export interface BrandAuditCategory {
  slug: string
  name: string
  description: string
  /** What the AI should look for when analyzing this category */
  analysisPrompt: string
  /** Weight toward the overall brand score (all weights should sum to 1) */
  weight: number
  /** Sort order in reports and UI */
  sortOrder: number
}

export const BRAND_AUDIT_CATEGORIES: BrandAuditCategory[] = [
  {
    slug: 'visual_consistency',
    name: 'Visual Consistency',
    description:
      'Color palette cohesion, typography consistency, logo usage, imagery style, and overall visual harmony across all brand materials.',
    analysisPrompt:
      'Analyze the brand materials for visual consistency. Look at: color palette usage across documents, typography choices and whether they are used consistently, logo placement and sizing rules, imagery style and tone, spacing and layout patterns, and overall visual harmony. Flag any inconsistencies between documents.',
    weight: 0.20,
    sortOrder: 0,
  },
  {
    slug: 'tone_of_voice',
    name: 'Tone of Voice & Messaging',
    description:
      'Writing style consistency, brand voice clarity, messaging alignment, and whether the tone matches the intended audience.',
    analysisPrompt:
      'Analyze the brand\'s tone of voice and messaging. Evaluate: consistency of writing style across materials, clarity of brand voice (formal vs casual, technical vs accessible), whether messaging aligns with stated brand values, audience-appropriateness of language, use of jargon or buzzwords, and emotional resonance of key messages.',
    weight: 0.18,
    sortOrder: 1,
  },
  {
    slug: 'professionalism',
    name: 'Professionalism & Polish',
    description:
      'Document quality, grammar, spelling, formatting consistency, and overall production value of brand materials.',
    analysisPrompt:
      'Evaluate the professionalism and polish of the brand materials. Check for: grammar and spelling errors, formatting consistency (margins, alignment, spacing), document quality and production value, consistency of headers/footers/page numbering, image resolution and quality, and overall attention to detail. Each error should be flagged with its location.',
    weight: 0.14,
    sortOrder: 2,
  },
  {
    slug: 'value_proposition',
    name: 'Value Proposition Strength',
    description:
      'Clarity and persuasiveness of the brand\'s value proposition, unique selling points, and differentiation from competitors.',
    analysisPrompt:
      'Analyze the strength of the brand\'s value proposition. Evaluate: clarity of the core value proposition, how well unique selling points are articulated, differentiation from generic or competitor messaging, whether benefits are clearly tied to customer needs, consistency of value messaging across materials, and the presence of proof points or evidence supporting claims.',
    weight: 0.18,
    sortOrder: 3,
  },
  {
    slug: 'structure_organization',
    name: 'Structure & Organization',
    description:
      'Information architecture within brand documents, logical flow, section hierarchy, and ease of navigation.',
    analysisPrompt:
      'Analyze the structure and organization of the brand materials. Look at: logical flow of information, section hierarchy and heading structure, ease of finding key information, use of tables of contents or navigation aids, consistent section ordering across documents, and whether the most important information is prominently placed.',
    weight: 0.14,
    sortOrder: 4,
  },
  {
    slug: 'wording_quality',
    name: 'Wording Quality',
    description:
      'Precision and impact of word choices, headline effectiveness, call-to-action clarity, and overall copywriting quality.',
    analysisPrompt:
      'Analyze the wording quality across all brand materials. Evaluate: precision and impact of word choices, headline and subheading effectiveness, call-to-action clarity and persuasiveness, avoidance of cliches and filler words, sentence structure variety and readability, and overall copywriting quality. Provide specific examples of weak wording with suggested improvements.',
    weight: 0.16,
    sortOrder: 5,
  },
]

/** All category slugs for a complete brand audit */
export const BRAND_AUDIT_CATEGORY_SLUGS = BRAND_AUDIT_CATEGORIES.map((c) => c.slug)

/** Get a brand audit category by slug */
export function getBrandCategory(slug: string): BrandAuditCategory | undefined {
  return BRAND_AUDIT_CATEGORIES.find((c) => c.slug === slug)
}

/** Calculate weighted overall score from individual category scores */
export function calculateBrandScore(
  categoryScores: Record<string, number>
): number {
  let totalWeight = 0
  let weightedSum = 0

  for (const cat of BRAND_AUDIT_CATEGORIES) {
    const score = categoryScores[cat.slug]
    if (score != null) {
      weightedSum += score * cat.weight
      totalWeight += cat.weight
    }
  }

  if (totalWeight === 0) return 0
  return Math.round(weightedSum / totalWeight)
}
