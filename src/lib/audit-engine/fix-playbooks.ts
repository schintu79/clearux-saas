// ============================================================
// ClearUX Audit Engine — Fix Playbooks Generator
// ============================================================
// Generates ready-to-use code snippets (JSON-LD, meta tags,
// llms.txt, etc.) customized for the audited site based on
// crawled data and audit findings.
//
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================

import type { HeadTagData } from './crawler'

/* ── Types ──────────────────────────────────────────────────── */

export interface PlaybookSnippet {
  type: 'json_ld' | 'meta_tags' | 'llms_txt' | 'robots_txt' | 'structured_data'
  title: string
  description: string
  code: string
  language: string
  priority: number // 1 = highest
}

export interface PlaybookInput {
  domain: string
  siteName: string | null
  siteDescription: string | null
  pages: Array<{
    url: string
    title: string | null
    metaDescription: string | null
  }>
  headTags: HeadTagData | null
  hasStructuredData: boolean
  structuredDataTypes: string[]
  hasLlmsTxt: boolean
  hasRobotsTxt: boolean
  hasAiPlugin: boolean
}

/* ── Generators ────────────────────────────────────────────── */

function generateOrganizationJsonLd(input: PlaybookInput): PlaybookSnippet | null {
  if (input.structuredDataTypes.includes('Organization')) return null

  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: input.siteName || input.domain,
    url: `https://${input.domain}`,
    description: input.siteDescription || `${input.siteName || input.domain} - official website`,
    logo: `https://${input.domain}/logo.png`,
    sameAs: [],
  }

  return {
    type: 'json_ld',
    title: 'Organization JSON-LD',
    description: 'Helps AI understand who you are. Add this to your homepage <head>.',
    code: `<script type="application/ld+json">\n${JSON.stringify(org, null, 2)}\n</script>`,
    language: 'html',
    priority: 1,
  }
}

function generateWebSiteJsonLd(input: PlaybookInput): PlaybookSnippet | null {
  if (input.structuredDataTypes.includes('WebSite')) return null

  const site = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: input.siteName || input.domain,
    url: `https://${input.domain}`,
    description: input.siteDescription || '',
    potentialAction: {
      '@type': 'SearchAction',
      target: `https://${input.domain}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }

  return {
    type: 'json_ld',
    title: 'WebSite JSON-LD with search action',
    description: 'Enables sitelinks search box in AI and search results.',
    code: `<script type="application/ld+json">\n${JSON.stringify(site, null, 2)}\n</script>`,
    language: 'html',
    priority: 2,
  }
}

function generateBreadcrumbJsonLd(input: PlaybookInput): PlaybookSnippet | null {
  if (input.structuredDataTypes.includes('BreadcrumbList')) return null
  if (input.pages.length < 3) return null

  const items = input.pages.slice(0, 4).map((p, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: p.title || p.url,
    item: p.url,
  }))

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }

  return {
    type: 'json_ld',
    title: 'BreadcrumbList JSON-LD',
    description: 'Helps AI and search engines understand your site hierarchy. Add to each page.',
    code: `<!-- Customize per page -->\n<script type="application/ld+json">\n${JSON.stringify(breadcrumb, null, 2)}\n</script>`,
    language: 'html',
    priority: 3,
  }
}

function generateMetaTags(input: PlaybookInput): PlaybookSnippet | null {
  const headTags = input.headTags
  const missing: string[] = []

  if (!headTags?.ogTags?.['og:title']) missing.push('og:title')
  if (!headTags?.ogTags?.['og:description']) missing.push('og:description')
  if (!headTags?.ogTags?.['og:image']) missing.push('og:image')
  if (!headTags?.ogTags?.['og:type']) missing.push('og:type')
  if (!headTags?.twitterTags?.['twitter:card']) missing.push('twitter:card')
  if (!headTags?.canonical) missing.push('canonical')

  if (missing.length === 0) return null

  const tags: string[] = []
  if (missing.includes('og:title'))
    tags.push(`<meta property="og:title" content="${input.siteName || input.domain}" />`)
  if (missing.includes('og:description'))
    tags.push(`<meta property="og:description" content="${input.siteDescription || 'Your site description here'}" />`)
  if (missing.includes('og:image'))
    tags.push(`<meta property="og:image" content="https://${input.domain}/og-image.png" />`)
  if (missing.includes('og:type'))
    tags.push('<meta property="og:type" content="website" />')
  if (missing.includes('twitter:card'))
    tags.push('<meta name="twitter:card" content="summary_large_image" />')
  if (missing.includes('canonical'))
    tags.push(`<link rel="canonical" href="https://${input.domain}/" />`)

  return {
    type: 'meta_tags',
    title: `Add missing meta tags (${missing.length} found)`,
    description: `Your pages are missing ${missing.join(', ')}. These help AI and social platforms understand and display your content.`,
    code: `<!-- Add to your <head> section -->\n${tags.join('\n')}`,
    language: 'html',
    priority: 1,
  }
}

function generateLlmsTxt(input: PlaybookInput): PlaybookSnippet | null {
  if (input.hasLlmsTxt) return null

  const pageList = input.pages.slice(0, 10).map(p =>
    `- [${p.title || 'Untitled'}](${p.url}): ${p.metaDescription || 'No description'}`
  ).join('\n')

  const content = `# ${input.siteName || input.domain}

> ${input.siteDescription || `${input.siteName || input.domain} official website`}

## Key Pages

${pageList}

## About

${input.siteName || input.domain} is accessible at https://${input.domain}

## Contact

For more information, visit https://${input.domain}/contact
`

  return {
    type: 'llms_txt',
    title: 'Create llms.txt file',
    description: 'A machine-readable summary of your site for AI crawlers. Place at the root of your domain (/llms.txt).',
    code: content,
    language: 'markdown',
    priority: 1,
  }
}

function generateRobotsTxtAiFriendly(input: PlaybookInput): PlaybookSnippet | null {
  if (!input.hasRobotsTxt) {
    return {
      type: 'robots_txt',
      title: 'Create AI-friendly robots.txt',
      description: 'Your site has no robots.txt. This file tells AI crawlers what they can access.',
      code: `# Allow all well-behaved crawlers
User-agent: *
Allow: /

# AI crawlers — explicitly welcome
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

# Sitemap
Sitemap: https://${input.domain}/sitemap.xml
`,
      language: 'text',
      priority: 2,
    }
  }
  return null
}

/* ── Main generator ────────────────────────────────────────── */

export function generateFixPlaybooks(input: PlaybookInput): PlaybookSnippet[] {
  const snippets: (PlaybookSnippet | null)[] = [
    generateMetaTags(input),
    generateOrganizationJsonLd(input),
    generateWebSiteJsonLd(input),
    generateBreadcrumbJsonLd(input),
    generateLlmsTxt(input),
    generateRobotsTxtAiFriendly(input),
  ]

  return snippets
    .filter((s): s is PlaybookSnippet => s !== null)
    .sort((a, b) => a.priority - b.priority)
}
