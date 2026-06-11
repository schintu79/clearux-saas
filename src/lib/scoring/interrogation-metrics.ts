// ============================================================
// Interrogation-derived brand metrics — SINGLE SOURCE OF TRUTH
// ============================================================
// Accuracy / Visibility / Sentiment computed from saved AI
// interrogation answers. Used by BOTH the Brand Intelligence page
// and the Overview BrandIntelligenceCard — the formulas live here
// once so the two surfaces can never disagree (the recurring
// failure mode of 2026-06-10/11: same metric, two formulas, two
// numbers on screen).
//
// Client-safe: no SDK imports, pure functions.

export interface InterrogationAnswer {
  /** Engine grade: 'Accurate' | 'Partial' | 'Inaccurate' | null */
  accuracy: string | null
  responseText: string | null
}

/** Accurate = 1, Partial = 0.5, everything else = 0. Null when ungraded. */
export function interrogationAccuracy(answers: InterrogationAnswer[]): number | null {
  let pts = 0, n = 0
  for (const a of answers) {
    const g = (a.accuracy || '').toLowerCase()
    if (!g) continue
    n++
    if (g.startsWith('accur')) pts += 1
    else if (g.startsWith('part')) pts += 0.5
  }
  return n === 0 ? null : Math.round((pts / n) * 100)
}

/** Build brand-identity tokens for visibility matching. */
export function brandTokensFor(brandName?: string | null, domain?: string | null): string[] {
  const brand = (brandName || '').toLowerCase()
  const dom = (domain || '').toLowerCase().replace(/^www\./, '')
  return [brand, dom, dom.split('.')[0]].filter((t) => t && t.length >= 3)
}

const UNKNOWN_RE = /\b(i (don'?t|do not) have (any |specific )?(information|details|data)|not familiar with|couldn'?t find (any )?information|no (publicly )?available information|unable to (find|locate|verify) (any )?information)\b/i

/** Share of answers where the model demonstrably knows the brand. */
export function interrogationVisibility(
  answers: InterrogationAnswer[],
  brandTokens: string[],
): number | null {
  if (brandTokens.length === 0) return null
  let known = 0, total = 0
  for (const a of answers) {
    if (!a.responseText || a.responseText.length < 30) continue
    total++
    const text = a.responseText.toLowerCase()
    const mentionsBrand = brandTokens.some((t) => text.includes(t))
    if (mentionsBrand && !UNKNOWN_RE.test(a.responseText)) known++
  }
  return total === 0 ? null : Math.round((known / total) * 100)
}

const POSITIVE = /\b(legitimate|trusted|trustworthy|reliable|reputable|regulated|licensed|well[- ]regarded|recommended|positive reviews?|safe to use|credible|established)\b/gi
const NEGATIVE = /\b(scam|fraud|caution|warning|red flags?|avoid|complaints?|risky|not recommended|concerns?|suspicious|unverified claims|misleading)\b/gi

/** Reassurance vs warning tone. Null below 3 marker hits — no invented tone. */
export function interrogationSentiment(answers: InterrogationAnswer[]): number | null {
  let pos = 0, neg = 0
  for (const a of answers) {
    if (!a.responseText) continue
    pos += (a.responseText.match(POSITIVE) || []).length
    neg += (a.responseText.match(NEGATIVE) || []).length
  }
  if (pos + neg < 3) return null
  return Math.round((pos / (pos + neg)) * 100)
}
