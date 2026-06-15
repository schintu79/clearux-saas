// ============================================================
// Trust-engine tests — analysis content budget (completeness fix)
// ============================================================
// Regression guard for the "AI not reading the full information" bug:
// analyzeCategory used to hard-slice the model's view with
// `pageContent.substring(0, 6000)`. Because a large preamble (site map,
// WCAG/responsive/DOM-facts summaries, previous-findings baseline) is
// prepended upstream, the 6 000-char window was spent on boilerplate and
// real page bodies were dropped. These tests pin the new budgeting
// behavior in `buildAnalysisContent` and the symmetric contradiction check.

import { buildAnalysisContent, splitBudgetedContent, MAX_ANALYSIS_CHARS, contradictsContent } from '../analyzer'

/** Build a realistic preamble of `n` chars (no "URL: " marker — like a site map). */
function makePreamble(n: number): string {
  // "SITE MAP" style boilerplate; deliberately contains no page-body marker.
  const unit = 'SITE MAP — page summary preview line. '
  let s = 'SITE MAP — What exists across ALL crawled pages\n'
  while (s.length < n) s += unit
  return s.slice(0, n)
}

/** Build `pages` page-body blocks; the LAST one embeds `marker` in its Content. */
function makePageBodies(pages: number, marker: string): string {
  const blocks: string[] = []
  for (let i = 0; i < pages; i++) {
    const isLast = i === pages - 1
    const filler = `Body text for page ${i}. `.repeat(40)
    const content = isLast ? `${filler} ${marker}` : filler
    blocks.push(
      `URL: https://example.com/page-${i}\n` +
        `Title: Page ${i}\n` +
        `H1: Heading ${i}\n` +
        `Meta Description: meta ${i}\n` +
        `Content: ${content}`,
    )
  }
  return blocks.join('\n---\n')
}

describe('buildAnalysisContent — budget + page-body guarantee', () => {
  const LATE_MARKER = 'UNIQUE_LATE_BODY_MARKER_ZZZ'

  test('returns content unchanged when within budget', () => {
    const small = 'URL: https://example.com/\nContent: short body'
    expect(buildAnalysisContent(small)).toBe(small)
  })

  test('a marker in a late page body beyond the OLD 6000 cutoff is included', () => {
    // Preamble alone exceeds the old 6 000-char cap → old code dropped ALL bodies.
    const preamble = makePreamble(9_000)
    const bodies = makePageBodies(8, LATE_MARKER)
    const full = `${preamble}\n\n${bodies}`

    // Sanity: the marker sits well past char 6000 in the original string.
    expect(full.indexOf(LATE_MARKER)).toBeGreaterThan(6_000)

    const out = buildAnalysisContent(full)
    expect(out).toContain(LATE_MARKER) // would FAIL under the old substring(0,6000)
  })

  test('output never exceeds the declared budget', () => {
    const preamble = makePreamble(30_000)
    const bodies = makePageBodies(30, LATE_MARKER)
    const full = `${preamble}\n\n${bodies}`
    const out = buildAnalysisContent(full)
    expect(out.length).toBeLessThanOrEqual(MAX_ANALYSIS_CHARS)
  })

  test('page bodies are not starved by an oversized preamble', () => {
    const preamble = makePreamble(MAX_ANALYSIS_CHARS * 2) // preamble alone > budget
    const bodies = makePageBodies(10, LATE_MARKER)
    const full = `${preamble}\n\n${bodies}`
    const out = buildAnalysisContent(full)
    // At least one real page-body marker must survive.
    expect(out).toContain('URL: https://example.com/page-0')
    // Reserved fraction honored: a meaningful slice of budget is page bodies.
    const bodyPortion = out.slice(out.indexOf('URL: '))
    expect(bodyPortion.length).toBeGreaterThanOrEqual(Math.floor(MAX_ANALYSIS_CHARS * 0.5))
  })

  test('falls back to head slice when no page-body marker is present', () => {
    const blob = 'X'.repeat(MAX_ANALYSIS_CHARS + 5_000)
    const out = buildAnalysisContent(blob)
    expect(out.length).toBe(MAX_ANALYSIS_CHARS)
    expect(out).toBe(blob.slice(0, MAX_ANALYSIS_CHARS))
  })

  test('respects an explicit smaller budget argument', () => {
    const preamble = makePreamble(5_000)
    const bodies = makePageBodies(6, LATE_MARKER)
    const full = `${preamble}\n\n${bodies}`
    const out = buildAnalysisContent(full, 4_000)
    expect(out.length).toBeLessThanOrEqual(4_000)
  })
})

describe('contradiction net symmetry — judges the budgeted content', () => {
  // The model sees buildAnalysisContent(full); the contradiction net must judge
  // the SAME text. This proves the asymmetry class is closed: evidence that only
  // exists past the budget (i.e. the model never saw it) must NOT retroactively
  // drop a finding for "contradicting" content.
  const TESTIMONIAL_EVIDENCE =
    'QIN TESTIMONIALS\n"Tommy cleared up topics I was concerned about." — Muhannad S.'

  test('finding survives when contradicting evidence lives ONLY beyond the budget', () => {
    // A finding claiming testimonials are missing.
    const finding = {
      title: 'No customer testimonials on the site',
      description: 'The site has no testimonials or social proof anywhere.',
    }

    // Push the real testimonial evidence far past the budget so the model never
    // saw it. Preamble is pure filler with no testimonial text; enough filler
    // page bodies precede the testimonial block to push it beyond the body budget.
    const preamble = makePreamble(MAX_ANALYSIS_CHARS)
    const bodies =
      makePageBodies(40, 'ordinary body text') + '\n---\n' +
      `URL: https://example.com/late\nContent: ${TESTIMONIAL_EVIDENCE}`
    const full = `${preamble}\n\n${bodies}`

    const budgeted = buildAnalysisContent(full)
    // Precondition: the budgeted content really did fill up (truncation happened)
    // and the evidence is outside what the model received.
    expect(budgeted.length).toBe(MAX_ANALYSIS_CHARS)
    expect(budgeted).not.toContain('Muhannad S.')

    // Symmetric check (budgeted) — must NOT drop the finding.
    expect(contradictsContent(finding, budgeted)).toBe(false)
    // Asymmetric check (full original) — WOULD have dropped it (documents the old bug).
    expect(contradictsContent(finding, full)).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════
// raseedinvest.com refinement — stale baseline must not become evidence,
// and current page section context must not be starved/ignored.
// ════════════════════════════════════════════════════════════════

describe('splitBudgetedContent — separates reference context from current evidence', () => {
  /** A re-audit preamble: site map + PREVIOUS FINDINGS that quote a STALE headline. */
  const STALE_HEADLINE = 'Trade 14,000+ US Stocks & ETFs — Built for the GCC'
  const NEW_HEADLINE = 'Start Trading US Stocks from Just $1 — No Hidden Fees'

  function makeReauditPreamble(): string {
    return (
      'SITE MAP — What exists across ALL crawled pages\n' +
      '  [1] https://raseedinvest.com/en — homepage preview...\n' +
      '  [2] https://raseedinvest.com/en/pricing — pricing preview...\n\n' +
      `PREVIOUS FINDINGS (2 total):\n` +
      `  [OPEN] "Homepage headline ${STALE_HEADLINE} doesn't lead with fees" (high)\n` +
      `  [OPEN] "Pricing headline doesn't explain fees" (medium)\n\n` +
      'RULES FOR RE-AUDIT:\n- [OPEN] findings: re-report if still present.\n'
    )
  }

  test('a stale headline present ONLY in PREVIOUS FINDINGS lands in preamble, not page bodies', () => {
    // Current homepage now uses the NEW headline; the stale one is gone from the live page.
    const currentBody =
      `URL: https://raseedinvest.com/en\n` +
      `Title: Raseed\nH1: ${NEW_HEADLINE}\n` +
      `Meta Description: Invest from $1\n` +
      `Content: ${NEW_HEADLINE}. Zero commission. $1 minimum. No hidden fees.`
    const full = `${makeReauditPreamble()}\n\n${currentBody}`

    const { preamble, pageBodies } = splitBudgetedContent(full)

    // The stale headline exists ONLY in the reference context (previous findings)...
    expect(preamble).toContain(STALE_HEADLINE)
    // ...and is NOT in the current evidence region.
    expect(pageBodies).not.toContain(STALE_HEADLINE)
    // The current headline IS in the evidence region.
    expect(pageBodies).toContain(NEW_HEADLINE)
  })

  test('the prompt labels the current evidence region ahead of the reference context', () => {
    const currentBody =
      `URL: https://raseedinvest.com/en\nH1: ${NEW_HEADLINE}\nContent: ${NEW_HEADLINE}.`
    const full = `${makeReauditPreamble()}\n\n${currentBody}`
    const { preamble, pageBodies, hasPageBodies } = splitBudgetedContent(full)

    expect(hasPageBodies).toBe(true)
    // Reconstruct the labeled block the same way analyzeCategory does, to assert ordering.
    const evidenceLabel = 'CURRENT PAGE CONTENT'
    const contextLabel = 'REFERENCE CONTEXT'
    const block =
      `${evidenceLabel}...\n---\n${pageBodies}\n---\n` +
      (preamble.trim() ? `${contextLabel}...\n---\n${preamble}\n---\n` : '')
    expect(block.indexOf(evidenceLabel)).toBeLessThan(block.indexOf(contextLabel))
    // The stale headline only appears AFTER the reference-context label.
    expect(block.indexOf(STALE_HEADLINE)).toBeGreaterThan(block.indexOf(contextLabel))
  })

  test('brand-style content (no URL: marker) is treated as evidence, not stale context', () => {
    const brand = '[Brand file: guide.pdf]\nOur brand voice is bold and concise.'
    const { preamble, pageBodies, hasPageBodies } = splitBudgetedContent(brand)
    expect(hasPageBodies).toBe(false)
    expect(preamble).toBe('')
    expect(pageBodies).toBe(brand)
  })
})

describe('section context is not starved — pricing/FAQ body siblings survive', () => {
  test('pricing H1 plus the fee boxes beneath it are all in the current evidence region', () => {
    // The classic false positive: model reads only the H1 and misses the fee detail below.
    const pricingBody =
      `URL: https://raseedinvest.com/en/pricing\n` +
      `Title: Pricing\nH1: Trade smarter. Pay less.\n` +
      `Meta Description: Transparent pricing\n` +
      `Content: Trade smarter. Pay less. ` +
      `Commission: $0 on US stocks & ETFs. ` +
      `FX fee: 0.5% per conversion. ` +
      `Max fee cap: $3 per trade. No hidden charges.`
    // Large re-audit preamble that would have eaten the old 6 000-char budget.
    const preambleBig = 'SITE MAP — page preview line. '.repeat(400)
    const full = `${preambleBig}\n\n${pricingBody}`

    const { pageBodies } = splitBudgetedContent(full)
    // The heading AND its explanatory siblings must both reach the model.
    expect(pageBodies).toContain('Trade smarter. Pay less.')
    expect(pageBodies).toContain('Commission: $0')
    expect(pageBodies).toContain('FX fee: 0.5%')
    expect(pageBodies).toContain('Max fee cap: $3')
  })

  test('FAQ title plus its detailed answers are all in the current evidence region', () => {
    const faqBody =
      `URL: https://raseedinvest.com/en/support\n` +
      `Title: Support\nH1: Frequently Asked Questions\n` +
      `Content: Frequently Asked Questions. ` +
      `Q: How do I open an account? A: Tap Sign Up, enter your Emirates ID, upload proof of address, and verification completes in 1-2 business days. ` +
      `Q: What are the fees? A: $0 commission on US stocks; 0.5% FX; $3 max cap.`
    const preambleBig = 'SITE MAP — page preview line. '.repeat(400)
    const full = `${preambleBig}\n\n${faqBody}`

    const { pageBodies } = splitBudgetedContent(full)
    expect(pageBodies).toContain('Frequently Asked Questions')
    // The actionable answer text (not just the title) must survive budgeting.
    expect(pageBodies).toContain('upload proof of address')
    expect(pageBodies).toContain('verification completes in 1-2 business days')
  })
})
