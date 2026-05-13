// ============================================================
// ClearUX Audit Engine — Page-Level AI Readability
// ============================================================
// For each crawled page, calculates what AI can extract vs.
// what it misses, producing a green/amber/red readability map.
//
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================

import type { AIPageReadability } from '@/types/database'
import type { HeadTagData } from './crawler'

interface PageData {
  url: string
  title: string | null
  h1: string | null
  metaDescription: string | null
  contentText: string | null
  headTags: HeadTagData | null
}

/**
 * Calculate AI readability for a single page.
 * Returns what AI can extract, what it misses, and a traffic-light status.
 */
export function calculatePageReadability(page: PageData): AIPageReadability {
  const extractable: string[] = []
  const missing: string[] = []
  const structuredDataTypes: string[] = []

  // Basic page metadata
  if (page.title) extractable.push('Page title')
  else missing.push('Page title')

  if (page.h1) extractable.push('H1 heading')
  else missing.push('H1 heading')

  if (page.metaDescription) extractable.push('Meta description')
  else missing.push('Meta description')

  if (page.contentText && page.contentText.length > 100) {
    extractable.push('Main content text')
  } else {
    missing.push('Substantial text content (page may be image/JS-heavy)')
  }

  // Head tag analysis
  let headTagScore = 0
  if (page.headTags) {
    const ht = page.headTags

    if (ht.canonical) { extractable.push('Canonical URL'); headTagScore += 15 }
    else missing.push('Canonical URL')

    if (ht.lang) { extractable.push(`Language declaration (${ht.lang})`); headTagScore += 10 }
    else missing.push('Language declaration (lang attribute)')

    // OG tags
    const ogKeys = Object.keys(ht.ogTags)
    if (ogKeys.includes('og:title')) { extractable.push('Open Graph title'); headTagScore += 10 }
    else missing.push('Open Graph title (og:title)')

    if (ogKeys.includes('og:description')) { extractable.push('Open Graph description'); headTagScore += 10 }
    else missing.push('Open Graph description (og:description)')

    if (ogKeys.includes('og:image')) { extractable.push('Open Graph image'); headTagScore += 10 }
    else missing.push('Open Graph image (og:image)')

    if (ogKeys.includes('og:type')) { extractable.push('Open Graph type'); headTagScore += 5 }

    // Twitter
    if (Object.keys(ht.twitterTags).length > 0) {
      extractable.push('Twitter card tags')
      headTagScore += 10
    } else {
      missing.push('Twitter card tags')
    }

    // Viewport
    if (ht.viewport) { extractable.push('Viewport meta (mobile-ready)'); headTagScore += 10 }
    else missing.push('Viewport meta tag')

    // Hreflang
    if (ht.hreflang.length > 0) {
      extractable.push(`Hreflang tags (${ht.hreflang.length} languages)`)
      headTagScore += 10
    }

    // JSON-LD
    if (ht.jsonLd.length > 0) {
      headTagScore += 10
      for (const block of ht.jsonLd) {
        const type = block['@type']
        if (typeof type === 'string') {
          structuredDataTypes.push(type)
          extractable.push(`Structured data: ${type}`)
        }
      }
    } else {
      missing.push('JSON-LD structured data')
    }

    // Robots meta
    if (ht.robotsMeta) {
      if (ht.robotsMeta.includes('noindex')) {
        missing.push('Page is set to noindex (AI crawlers may skip)')
      } else {
        extractable.push('Page allows indexing')
      }
    }
  } else {
    // No head tags at all
    missing.push('Head tag data (could not extract)')
    headTagScore = 0
  }

  // Content extractability score
  const contentLength = page.contentText?.length || 0
  let contentScore = 0
  if (contentLength > 2000) contentScore = 100
  else if (contentLength > 1000) contentScore = 80
  else if (contentLength > 500) contentScore = 60
  else if (contentLength > 100) contentScore = 40
  else contentScore = 10

  // Boost for having title + description + content (the basics)
  if (page.title && page.metaDescription && contentLength > 200) contentScore = Math.min(100, contentScore + 10)

  // Overall score
  const overallScore = Math.round(headTagScore * 0.4 + contentScore * 0.6)

  // Traffic light
  let status: 'green' | 'amber' | 'red'
  if (overallScore >= 70) status = 'green'
  else if (overallScore >= 40) status = 'amber'
  else status = 'red'

  return {
    extractable,
    missing,
    structuredDataTypes,
    headTagScore: Math.min(100, headTagScore),
    contentScore,
    overallScore,
    status,
  }
}

/**
 * Calculate AI readability for all crawled pages.
 */
export function calculateAllPageReadability(
  pages: PageData[],
): Array<{ url: string; readability: AIPageReadability }> {
  return pages.map((page) => ({
    url: page.url,
    readability: calculatePageReadability(page),
  }))
}
