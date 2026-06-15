/**
 * Page content-change detection for carry-forward safety.
 *
 * WHY (2026-06-15, Stefano's "stale findings" catch):
 * Baseline re-audits copy previous findings VERBATIM (title/description/page_url)
 * with no check that the page still says what the finding claims. If the site
 * changed since the last audit, a carried finding can quote text that no longer
 * exists (an old H1, a removed section). Carry-forward must be gated on whether
 * the page's content actually changed.
 *
 * These pure helpers produce a stable per-page signature and compare two pages.
 * Used to decide: carry the finding (page unchanged) vs. let it be re-derived /
 * dropped (page changed).
 *
 * Pure functions only — fully unit-tested.
 */

export interface PageContentFacts {
  h1?: string | null
  title?: string | null
  metaDescription?: string | null
  /** Approximate length of the page's main text content. */
  contentLength?: number | null
}

/** Normalize a heading/title/meta for comparison: lowercase, alphanumerics, single spaces. */
function norm(s: string | null | undefined): string {
  if (!s) return ''
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Bucket content length so trivial wording churn doesn't read as "changed". */
export function contentLengthBucket(len: number | null | undefined): number {
  if (!len || len <= 0) return 0
  // 10% buckets (log-ish): two lengths in the same bucket are "about the same size".
  return Math.round(Math.log2(len) * 4)
}

/** Stable signature of a page's identity-bearing content. */
export function contentSignature(p: PageContentFacts): string {
  return [
    norm(p.h1),
    norm(p.title),
    norm(p.metaDescription),
    contentLengthBucket(p.contentLength),
  ].join('|')
}

/**
 * True when two crawls of the same page differ materially: the H1, title, or
 * meta description changed, OR the content size moved more than one bucket.
 *
 * Conservative: if we lack enough signal on EITHER side (both sides essentially
 * empty), returns false (cannot prove a change → don't disturb carry-forward).
 */
export function pageContentChanged(
  previous: PageContentFacts | null | undefined,
  current: PageContentFacts | null | undefined,
): boolean {
  if (!previous || !current) return false
  const sigPrev = contentSignature(previous)
  const sigCurr = contentSignature(current)
  if (sigPrev === sigCurr) return false
  // Both empty/unknown → can't judge.
  if (sigPrev === '||0' && sigCurr === '||0') return false
  // A change in any identity field (H1/title/meta) is material on its own.
  if (norm(previous.h1) !== norm(current.h1)) return true
  if (norm(previous.title) !== norm(current.title)) return true
  if (norm(previous.metaDescription) !== norm(current.metaDescription)) return true
  // Otherwise only content size changed: require >1 bucket of movement.
  return Math.abs(contentLengthBucket(previous.contentLength) - contentLengthBucket(current.contentLength)) > 1
}
