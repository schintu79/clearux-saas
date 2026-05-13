// ============================================================
// ClearUX Audit Engine — AI Citation Audit
// ============================================================
// Asks AI to describe the site and cite sources. Then maps the
// AI's citations back to crawled pages to show which content
// gets cited vs. which gets ignored.
//
// PROPRIETARY — do not distribute outside the ClearUX codebase.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'

/* ── Types ──────────────────────────────────────────────────── */

export interface CitationResult {
  /** The key claim from the AI response */
  claim: string
  /** URL cited by the AI (if any) */
  citedUrl: string | null
  /** The specific text/content being referenced */
  citedText: string
  /** How the content was used */
  citationType: 'direct_quote' | 'paraphrase' | 'reference' | 'ignored'
}

export interface CitationAuditResult {
  /** All citations found */
  citations: CitationResult[]
  /** Pages that were cited */
  citedPages: string[]
  /** Pages that were NOT cited (content ignored by AI) */
  ignoredPages: string[]
  /** Overall citability score: 0-100 */
  citabilityScore: number
  /** Summary of what AI cites vs ignores */
  summary: string
}

/* ── Engine ─────────────────────────────────────────────────── */

let _anthropic: Anthropic | null = null
function getClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      timeout: 30_000,
    })
  }
  return _anthropic
}

/**
 * Run citation audit: ask AI about the domain with instructions to cite sources,
 * then analyze which content gets cited vs. ignored.
 */
export async function runCitationAudit(
  domain: string,
  pages: Array<{ url: string; title: string | null; contentSnippet: string }>,
  timeoutMs = 25_000,
): Promise<CitationAuditResult> {
  const client = getClient()

  // Build page context for the AI
  const pageContext = pages.slice(0, 10).map((p, i) =>
    `[Page ${i + 1}] URL: ${p.url}\nTitle: ${p.title || '(none)'}\nContent: ${p.contentSnippet.slice(0, 500)}`
  ).join('\n\n')

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `You are analyzing a website for AI citability. Given the pages below, write a comprehensive description of ${domain} as if you were an AI assistant answering a user's question about this company/site.

For EACH claim you make, cite the specific page URL and the text you're referencing.

PAGES:
${pageContext}

Now respond with JSON only:
{
  "description": "Your comprehensive description of the site",
  "citations": [
    {
      "claim": "The key claim you're making",
      "citedUrl": "URL of the page you're citing (or null if from general knowledge)",
      "citedText": "The specific text/content you're referencing",
      "citationType": "direct_quote | paraphrase | reference"
    }
  ],
  "ignoredContent": [
    {
      "pageUrl": "URL of page whose content was NOT useful for describing the site",
      "reason": "Why this content wasn't cited (too generic, duplicate, irrelevant, poorly structured)"
    }
  ]
}

Rules:
- Include 5-10 citations
- Be honest about what content is actually useful vs. ignored
- "citedText" must be actual content from the page, not made up
- Include at least 2 items in "ignoredContent" if any pages have weak content`,
    }],
  })

  const text = resp.content[0]?.type === 'text' ? resp.content[0].text : ''
  const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()

  try {
    const parsed = JSON.parse(jsonStr)
    const citations: CitationResult[] = (parsed.citations || []).map((c: any) => ({
      claim: c.claim || '',
      citedUrl: c.citedUrl || null,
      citedText: c.citedText || '',
      citationType: c.citationType || 'reference',
    }))

    // Determine cited vs ignored pages
    const citedUrls = new Set(citations.map(c => c.citedUrl).filter(Boolean) as string[])
    const allUrls = pages.map(p => p.url)
    const ignoredUrls = allUrls.filter(u => !citedUrls.has(u))

    // Add explicit ignored content from AI response
    const ignoredContent = parsed.ignoredContent || []
    for (const ic of ignoredContent) {
      if (ic.pageUrl && !citedUrls.has(ic.pageUrl)) {
        citations.push({
          claim: ic.reason || 'Content not useful for AI description',
          citedUrl: ic.pageUrl,
          citedText: '',
          citationType: 'ignored',
        })
      }
    }

    // Citability score: % of pages that get cited
    const citabilityScore = allUrls.length > 0
      ? Math.round((citedUrls.size / allUrls.length) * 100)
      : 0

    const summary = `AI cited content from ${citedUrls.size} of ${allUrls.length} pages. ` +
      `${ignoredUrls.length} page(s) had content that was not useful for AI to cite.`

    return {
      citations,
      citedPages: [...citedUrls],
      ignoredPages: ignoredUrls,
      citabilityScore,
      summary,
    }
  } catch {
    return {
      citations: [],
      citedPages: [],
      ignoredPages: pages.map(p => p.url),
      citabilityScore: 0,
      summary: 'Citation audit could not be completed.',
    }
  }
}
