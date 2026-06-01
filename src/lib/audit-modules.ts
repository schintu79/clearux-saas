// ============================================================
// ClearUX — Audit Module Definitions
// Slug-based module system replacing the old pillar index system.
// Used across: new-audit page, audit detail, report generation.
// ============================================================

export interface AuditModule {
  slug: string
  name: string
  description: string
  /** Old pillar index for backward compat (null for new modules) */
  legacyPillarIndex: number | null
  /** Requires a brand identity to be selected */
  requiresBrandIdentity: boolean
  /** Always included in "Complete Audit" */
  includedInComplete: boolean
}

export const AUDIT_MODULES: AuditModule[] = [
  {
    slug: 'foundation',
    name: 'Foundation',
    description: 'Visual design, messaging clarity, navigation structure, and content quality.',
    legacyPillarIndex: 0,
    requiresBrandIdentity: false,
    includedInComplete: true,
  },
  {
    slug: 'human_experience',
    name: 'Human Experience',
    description: 'Conversion flow, trust signals, ethical patterns, and behavioural psychology.',
    legacyPillarIndex: 1,
    requiresBrandIdentity: false,
    includedInComplete: true,
  },
  {
    slug: 'inclusive_design',
    name: 'Inclusive Design',
    description: 'Accessibility compliance, cognitive load, digital wellbeing, and mobile experience.',
    legacyPillarIndex: 2,
    requiresBrandIdentity: false,
    includedInComplete: true,
  },
  {
    slug: 'future_readiness',
    name: 'Future Readiness',
    description: 'Performance optimisation, AI discoverability, agent readiness, and internationalisation.',
    legacyPillarIndex: 3,
    requiresBrandIdentity: false,
    includedInComplete: true,
  },
  {
    slug: 'accessibility_readiness',
    name: 'Accessibility Readiness',
    description: 'WCAG compliance, keyboard access, screen reader support, and EAA readiness signals.',
    legacyPillarIndex: null,
    requiresBrandIdentity: false,
    includedInComplete: true,
  },
  {
    slug: 'design_consistency',
    name: 'Design Consistency',
    description: 'Checks whether your site uses a consistent visual system across pages and components.',
    legacyPillarIndex: null,
    requiresBrandIdentity: false,
    includedInComplete: true,
  },
  {
    slug: 'seo_structure',
    name: 'SEO Structure & Rules',
    description: 'Heading hierarchy, meta tags, structured data, canonical URLs, and crawlability.',
    legacyPillarIndex: null,
    requiresBrandIdentity: false,
    includedInComplete: true,
  },
]

/** All module slugs that make up a "Complete Audit" */
export const COMPLETE_AUDIT_SLUGS = AUDIT_MODULES
  .filter((m) => m.includedInComplete)
  .map((m) => m.slug)

/** Convert old pillar indices to new module slugs */
export function pillarIndicesToModuleSlugs(indices: number[]): string[] {
  return AUDIT_MODULES
    .filter((m) => m.legacyPillarIndex !== null && indices.includes(m.legacyPillarIndex))
    .map((m) => m.slug)
}

/** Convert new module slugs to old pillar indices (for backward compat) */
export function moduleSlugsToLegacyPillars(slugs: string[]): number[] {
  return AUDIT_MODULES
    .filter((m) => slugs.includes(m.slug) && m.legacyPillarIndex !== null)
    .map((m) => m.legacyPillarIndex as number)
}

/** Get a module by slug */
export function getModule(slug: string): AuditModule | undefined {
  return AUDIT_MODULES.find((m) => m.slug === slug)
}
