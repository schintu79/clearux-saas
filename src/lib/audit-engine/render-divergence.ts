/**
 * Render-divergence detection.
 *
 * WHY THIS EXISTS (2026-06-15, Stefano's "stale page" catch):
 * The crawler's `direct` strategy fetches raw HTTP HTML with no JavaScript
 * executed. For client-hydrated / stale-SSR sites (e.g. raseedinvest.com), the
 * raw HTML is a COMPLETE but OUTDATED build — its <h1> still reads the old
 * headline ("Trade 14,000+ US Stocks & ETFs — Built for the GCC") while the
 * page real users and Google see, after hydration, reads something else
 * ("The First GCC Platform for Stocks, Options & Crypto"). The analyzer was
 * reasoning over the stale raw HTML, so every content finding judged a page the
 * world never sees.
 *
 * These helpers give a PRECISE, low-false-positive divergence signal: compare
 * the raw-HTML heading against the rendered (JS-executed) heading. When they
 * materially differ, the static HTML is stale/hydrated and the rendered content
 * is authoritative. When they agree (every ordinary static site), we change
 * nothing — no regression.
 *
 * Pure functions only — no IO, fully unit-tested.
 */

/** Extract the first level-1 ("# ") heading from Jina/Firecrawl markdown. */
export function extractMarkdownH1(markdown: string | null | undefined): string | null {
  if (!markdown) return null
  const lines = markdown.split(/\r?\n/)
  let inFence = false
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip fenced code blocks so a "# comment" inside code isn't mistaken for a heading.
    if (/^```/.test(trimmed)) { inFence = !inFence; continue }
    if (inFence) continue
    // Single '#' followed by space = H1 (not '##'+).
    const m = trimmed.match(/^#\s+(.+?)\s*#*\s*$/)
    if (m && m[1].trim()) return m[1].trim()
  }
  return null
}

/** Normalize a heading for comparison: lowercase, keep alphanumerics, collapse whitespace. */
export function normalizeHeading(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenSet(s: string): Set<string> {
  return new Set(normalizeHeading(s).split(' ').filter(Boolean))
}

/** Jaccard similarity (0..1) between two headings' token sets. */
export function headingSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const ta = tokenSet(a || '')
  const tb = tokenSet(b || '')
  if (ta.size === 0 && tb.size === 0) return 1
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  const union = ta.size + tb.size - inter
  return union === 0 ? 1 : inter / union
}

/**
 * Threshold below which two headings are considered "materially different".
 * 0.6 tolerates minor wording changes ("Acme" vs "Acme Inc.") while catching a
 * genuinely different headline (raseed's old vs rendered H1 score ~0.31).
 */
export const HEADING_DIVERGENCE_THRESHOLD = 0.6

/**
 * True when both headings are present AND materially different — the signal
 * that the raw-HTML page is stale relative to the rendered page.
 *
 * Conservative by design: if either heading is missing we return false (cannot
 * confirm divergence → do not override the default acquisition).
 */
export function headingsMateriallyDiffer(
  rawHeading: string | null | undefined,
  renderedHeading: string | null | undefined,
): boolean {
  if (!rawHeading || !renderedHeading) return false
  if (normalizeHeading(rawHeading) === normalizeHeading(renderedHeading)) return false
  return headingSimilarity(rawHeading, renderedHeading) < HEADING_DIVERGENCE_THRESHOLD
}

/**
 * Heuristic: does this raw HTML come from a client-hydrated framework (Next.js,
 * React, Nuxt, etc.)? Such pages can serve a COMPLETE but STALE static build,
 * so when we can't get a rendered acquisition we should escalate to a real
 * browser render rather than trust the raw HTML. Site-agnostic markers only.
 */
export function looksClientHydrated(html: string | null | undefined): boolean {
  if (!html) return false
  return (
    /__NEXT_DATA__|self\.__next_f|id=["']__next["']/.test(html) || // Next.js
    /data-reactroot|id=["']root["'][^>]*>\s*<\/div>/.test(html) ||  // React (incl. empty root shell)
    /__NUXT__|id=["']__nuxt["']/.test(html) ||                      // Nuxt
    /ng-version=|<app-root/.test(html) ||                            // Angular
    /data-sveltekit/.test(html)                                      // SvelteKit
  )
}

/** Min rendered-content length before the absence check is trusted (avoid thin/blocked pages). */
const MIN_RENDERED_LEN_FOR_ABSENCE = 200

/**
 * Independent divergence signal that does NOT require a rendered H1: the raw
 * page's heading, as a contiguous normalized phrase, does not appear anywhere in
 * the rendered content. If a real current heading were on the page, the rendered
 * text would contain it. Its absence means the raw <h1> is stale.
 *
 * Conservative: requires a non-trivial raw heading (≥3 tokens) and substantial
 * rendered content, so a short/blocked rendered result can't trigger a false
 * "stale" verdict.
 */
export function rawHeadingAbsentFromRendered(
  rawHeading: string | null | undefined,
  renderedContent: string | null | undefined,
): boolean {
  const rawNorm = normalizeHeading(rawHeading)
  const rawTokens = rawNorm.split(' ').filter(Boolean)
  if (rawTokens.length < 3) return false // too short to judge reliably
  if (!renderedContent || renderedContent.length < MIN_RENDERED_LEN_FOR_ABSENCE) return false
  const renderedNorm = normalizeHeading(renderedContent)
  return !renderedNorm.includes(rawNorm)
}

/**
 * Single decision: should the rendered (JS-executed) acquisition be trusted over
 * the raw-HTTP one for this page? True when EITHER signal fires:
 *  - the raw and rendered H1s are materially different, or
 *  - the raw H1 is entirely absent from the rendered content.
 */
export function shouldPreferRendered(args: {
  rawH1: string | null | undefined
  renderedH1: string | null | undefined
  renderedContent: string | null | undefined
}): boolean {
  return (
    headingsMateriallyDiffer(args.rawH1, args.renderedH1) ||
    rawHeadingAbsentFromRendered(args.rawH1, args.renderedContent)
  )
}
