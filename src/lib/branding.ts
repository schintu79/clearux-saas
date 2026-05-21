/**
 * Central product naming and glossary constants for Fixpath.ai.
 *
 * Use these constants in any user-facing copy so a future rename or label
 * tweak only needs to happen in one place. Historical names (ClearUX.ai) are
 * preserved in repo name, env vars, database tables, migrations, and internal
 * comments where renaming would be risky.
 */

export const PRODUCT_NAME = 'Fixpath' as const
export const PRODUCT_NAME_LONG = 'Fixpath.ai' as const
export const PRODUCT_DOMAIN = 'fixpath.ai' as const
export const LEGACY_PRODUCT_NAME = 'ClearUX' as const
export const LEGACY_PRODUCT_NAME_LONG = 'ClearUX.ai' as const

/**
 * Customer-facing score label. Use this in all dashboards, reports, shared
 * pages, and marketing surfaces instead of "ClearUX Score" or "Fixpath Score".
 */
export const SCORE_LABEL = 'Website Health Score' as const
export const SCORE_LABEL_SHORT = 'Website Health' as const

export const TAGLINE = 'Find the issue. Follow the fix path. Track improvement.' as const
export const HERO_HEADLINE = 'Find the issues hurting your site. Follow the path to fix them.' as const
export const HERO_SUBHEAD =
  'Fixpath.ai audits your brand, website, and AI-facing presence, then turns every issue into a clear fix path your team can act on.' as const

export const META_TITLE_DEFAULT = 'Fixpath: AI Brand & UX Audits in Minutes' as const
export const META_TITLE_TEMPLATE = '%s | Fixpath' as const
export const META_DESCRIPTION =
  'Fixpath.ai finds what is hurting your website and brand perception, then gives you the clearest path to fix it and track improvement.' as const

/**
 * Workflow vocabulary (Find / Fix / Track).
 */
export const WORKFLOW_FIND = 'Find' as const
export const WORKFLOW_FIX = 'Fix' as const
export const WORKFLOW_TRACK = 'Track' as const
