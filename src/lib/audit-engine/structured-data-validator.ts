// ============================================================
// ClearUX Audit Engine — Structured Data Validator
// ============================================================
// Validates JSON-LD structured data extracted from crawled pages
// against schema.org best practices. Generates findings for:
//   - Missing required properties on common types
//   - Invalid/empty values
//   - Missing common types (Organization, WebSite, BreadcrumbList)
//   - Best practice violations
//
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================

import type { HeadTagData } from './crawler'
import type { AnalysisFinding } from './analyzer'

/** Schema.org type definitions with required/recommended properties */
interface SchemaTypeSpec {
  name: string
  required: string[]
  recommended: string[]
  description: string
}

const SCHEMA_TYPES: SchemaTypeSpec[] = [
  {
    name: 'Organization',
    required: ['name', 'url'],
    recommended: ['logo', 'description', 'sameAs', 'contactPoint'],
    description: 'Establishes the business entity for search engines and AI systems',
  },
  {
    name: 'WebSite',
    required: ['name', 'url'],
    recommended: ['description', 'potentialAction'],
    description: 'Enables sitelinks search box and site identity in search results',
  },
  {
    name: 'Product',
    required: ['name'],
    recommended: ['description', 'image', 'offers', 'brand', 'review', 'aggregateRating'],
    description: 'Enables rich product snippets with pricing, availability, and ratings',
  },
  {
    name: 'FAQPage',
    required: ['mainEntity'],
    recommended: [],
    description: 'Enables FAQ rich snippets that expand directly in search results',
  },
  {
    name: 'BreadcrumbList',
    required: ['itemListElement'],
    recommended: [],
    description: 'Helps search engines understand site hierarchy and display breadcrumb trails',
  },
  {
    name: 'Article',
    required: ['headline', 'author'],
    recommended: ['datePublished', 'dateModified', 'image', 'publisher'],
    description: 'Enables article rich snippets with author, date, and thumbnail',
  },
  {
    name: 'LocalBusiness',
    required: ['name', 'address'],
    recommended: ['telephone', 'openingHoursSpecification', 'geo', 'image', 'priceRange'],
    description: 'Critical for local SEO — enables knowledge panel and map listings',
  },
  {
    name: 'SoftwareApplication',
    required: ['name'],
    recommended: ['applicationCategory', 'operatingSystem', 'offers', 'aggregateRating'],
    description: 'Enables software rich snippets with category, platform, and ratings',
  },
]

export interface StructuredDataValidationResult {
  typesFound: string[]
  findings: AnalysisFinding[]
  totalBlocks: number
  validBlocks: number
  invalidBlocks: number
}

/**
 * Validate JSON-LD structured data from crawled pages.
 * Returns findings for missing/invalid structured data.
 */
export function validateStructuredData(
  headTagsByPage: Array<{ url: string; headTags: HeadTagData }>,
): StructuredDataValidationResult {
  const findings: AnalysisFinding[] = []
  const allTypes: string[] = []
  let totalBlocks = 0
  let validBlocks = 0
  let invalidBlocks = 0

  // Collect all JSON-LD blocks across pages
  for (const { url, headTags } of headTagsByPage) {
    for (const block of headTags.jsonLd) {
      totalBlocks++
      const type = resolveType(block)
      if (type) {
        allTypes.push(type)
        const issues = validateBlock(block, type, url)
        if (issues.length > 0) {
          invalidBlocks++
          findings.push(...issues)
        } else {
          validBlocks++
        }
      } else {
        invalidBlocks++
        findings.push({
          severity: 'low',
          title: 'JSON-LD block missing @type property',
          description: `A structured data block on ${url} is missing the required @type property. Without @type, search engines and AI systems cannot interpret the data.`,
          recommendation: 'Add a @type property (e.g., "Organization", "WebSite", "Product") to every JSON-LD block.',
          estimatedImpact: 'Search engines will ignore this structured data block entirely.',
          pageUrl: url,
          categoryIndex: 17, // SEO Structure > Structured Data & Schema
        })
      }
    }
  }

  // Check for commonly expected types on homepage
  const homepageUrl = headTagsByPage[0]?.url || ''
  const uniqueTypes = new Set(allTypes)

  if (!uniqueTypes.has('Organization') && !uniqueTypes.has('LocalBusiness')) {
    findings.push({
      severity: 'medium',
      title: 'No Organization structured data found',
      description: 'The site has no Organization or LocalBusiness JSON-LD. This structured data helps search engines and AI assistants identify your business, display rich knowledge panels, and provide accurate information about your company.',
      recommendation: 'Add an Organization JSON-LD block to your homepage with at minimum: name, url, and logo. Include sameAs links to your social media profiles.',
      estimatedImpact: 'Missing Organization data means search engines have to guess your business identity. AI assistants may provide incomplete or inaccurate information about your company.',
      pageUrl: homepageUrl,
      categoryIndex: 17, // SEO Structure > Structured Data & Schema
    })
  }

  if (!uniqueTypes.has('WebSite')) {
    findings.push({
      severity: 'low',
      title: 'No WebSite structured data found',
      description: 'The site has no WebSite JSON-LD. This enables the sitelinks search box in Google results and establishes your site identity for search engines.',
      recommendation: 'Add a WebSite JSON-LD block to your homepage with name, url, and optionally a SearchAction for the sitelinks search box.',
      estimatedImpact: 'You may miss the sitelinks search box feature in Google results.',
      pageUrl: homepageUrl,
      categoryIndex: 17,
    })
  }

  return {
    typesFound: Array.from(uniqueTypes),
    findings,
    totalBlocks,
    validBlocks,
    invalidBlocks,
  }
}

/** Format validation results as text for analyzer context */
export function formatValidationForAnalysis(result: StructuredDataValidationResult): string {
  const lines: string[] = ['Structured Data Validation:']
  lines.push(`  JSON-LD blocks found: ${result.totalBlocks}`)
  if (result.totalBlocks > 0) {
    lines.push(`  Types: ${result.typesFound.join(', ')}`)
    lines.push(`  Valid: ${result.validBlocks}, Issues: ${result.invalidBlocks}`)
    if (result.findings.length > 0) {
      lines.push(`  Issues found:`)
      for (const f of result.findings.slice(0, 5)) {
        lines.push(`    - ${f.title}`)
      }
    }
  } else {
    lines.push('  No structured data (JSON-LD) found on any crawled page')
  }
  return lines.join('\n')
}

// ── Internal helpers ────────────────────────────────────────

function resolveType(block: Record<string, unknown>): string | null {
  const type = block['@type']
  if (typeof type === 'string') return type
  if (Array.isArray(type) && type.length > 0) return String(type[0])
  return null
}

function validateBlock(
  block: Record<string, unknown>,
  type: string,
  pageUrl: string,
): AnalysisFinding[] {
  const spec = SCHEMA_TYPES.find((s) => s.name === type)
  if (!spec) return [] // Unknown type — no validation rules

  const issues: AnalysisFinding[] = []

  // Check required properties
  for (const prop of spec.required) {
    const value = block[prop]
    if (value === undefined || value === null || value === '') {
      issues.push({
        severity: 'medium',
        title: `${type} structured data missing "${prop}" property`,
        description: `The ${type} JSON-LD on ${pageUrl} is missing the required "${prop}" property. ${spec.description}.`,
        recommendation: `Add the "${prop}" property to your ${type} structured data. This is a required field for ${type} schema.`,
        estimatedImpact: `Without "${prop}", search engines may not display rich results for this ${type} data.`,
        pageUrl,
        categoryIndex: 17,
      })
    }
  }

  // Check for empty/placeholder recommended properties
  for (const prop of spec.recommended) {
    const value = block[prop]
    if (value !== undefined && isPlaceholder(value)) {
      issues.push({
        severity: 'low',
        title: `${type} structured data has placeholder "${prop}"`,
        description: `The ${type} JSON-LD on ${pageUrl} has an empty or placeholder value for "${prop}".`,
        recommendation: `Replace the placeholder "${prop}" value with real content in your ${type} structured data.`,
        estimatedImpact: 'Placeholder values in structured data can trigger manual actions from search engines.',
        pageUrl,
        categoryIndex: 17,
      })
    }
  }

  return issues
}

function isPlaceholder(value: unknown): boolean {
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    return v === '' || v === 'todo' || v === 'placeholder' || v === 'test' || v === 'undefined' || v === 'null'
  }
  return false
}
