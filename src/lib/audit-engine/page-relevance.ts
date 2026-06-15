/**
 * Page-relevance helpers.
 *
 * WHY (2026-06-15, Stefano):
 *  1. The browser/WCAG/domFacts pass is budget-limited (first N crawled URLs).
 *     Form/auth pages (signup, login, contact…) were never in the first N, so
 *     the page where "missing label" findings actually matter was never
 *     DOM-snapshotted — gates ran blind there. `prioritizePagesForChecks` pulls
 *     genuine input pages into the budget.
 *  2. axe/wcag fire "Labels or Instructions" on ANY unlabeled input — including
 *     decorative/search/newsletter fields on content pages. `isLikelyInputPage`
 *     marks the pages where label/instruction findings are genuinely relevant.
 *
 * Pure functions only — fully unit-tested.
 */

/** Path segments that indicate a genuine user-entry page (the user must type real data). */
const INPUT_PAGE_PATTERNS: RegExp[] = [
  /sign[\s_-]?up/i,
  /sign[\s_-]?in/i,
  /log[\s_-]?in/i,
  /register/i,
  /\bregistration\b/i,
  /\bcreate[\s_-]?account\b/i,
  /\bonboard/i,
  /\bkyc\b/i,
  /\bcontact\b/i,
  /\bcheckout\b/i,
  /\bcart\b/i,
  /\bapply\b/i,
  /\bapplication\b/i,
  /\bsubscribe\b/i,
  /\bbooking?\b/i,
  /\breserve\b/i,
  /\bquote\b/i,
  /\bget[\s_-]?started\b/i,
  /\bdemo\b/i,
  /\bopen[\s_-]?account\b/i,
  /\bpayment\b/i,
  /\bbilling\b/i,
  /\bforgot[\s_-]?password\b/i,
  /\breset[\s_-]?password\b/i,
  /\bverify\b/i,
  /\bsettings?\b/i,
  /\baccount\b/i,
]

/**
 * True when the URL's path looks like a genuine user-input page. Decorative
 * search/newsletter inputs on content pages (home, pricing, blog, about) return
 * false, so label/instruction findings there can be treated as noise.
 */
export function isLikelyInputPage(url: string | null | undefined): boolean {
  if (!url) return false
  let pathname: string
  try {
    pathname = new URL(url).pathname
  } catch {
    pathname = String(url)
  }
  // Strip a leading locale segment (/en, /ar, /en-US) so /en/signup still matches.
  const path = pathname.replace(/^\/[a-z]{2}(-[a-z]{2})?(?=\/|$)/i, '') || '/'
  return INPUT_PAGE_PATTERNS.some((re) => re.test(path))
}

/** Approximate path depth (number of non-empty segments) — used to find the homepage. */
function pathDepth(url: string): number {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).length
  } catch {
    return 99
  }
}

/**
 * Homepage = the site root ("/") OR a bare locale root ("/en", "/ar", "/en-US").
 * Locale-prefixed sites (e.g. raseedinvest.com/en) have no depth-0 page, so the
 * locale root must count as the homepage.
 */
export function isHomepageLike(url: string | null | undefined): boolean {
  if (!url) return false
  let segments: string[]
  try {
    segments = new URL(url).pathname.split('/').filter(Boolean)
  } catch {
    return false
  }
  if (segments.length === 0) return true
  if (segments.length === 1 && /^[a-z]{2}(-[a-z]{2})?$/i.test(segments[0])) return true
  return false
}

/**
 * Choose which crawled pages get the (expensive, budget-limited) browser/WCAG/
 * domFacts pass. Guarantees genuine input pages are included even when they
 * weren't in the first N by crawl order — otherwise the gates can never verify
 * label/form claims against the page they're about.
 *
 * Priority: homepage(s) first (shallowest paths), then input/auth pages, then
 * remaining pages in crawl order. De-duplicated, capped at `budget`.
 */
export function prioritizePagesForChecks(urls: string[], budget: number): string[] {
  if (budget <= 0) return []
  const seen = new Set<string>()
  const uniq = urls.filter((u) => {
    if (seen.has(u)) return false
    seen.add(u)
    return true
  })

  const homepages = uniq
    .filter((u) => isHomepageLike(u))
    .sort((a, b) => a.length - b.length)
  const inputPages = uniq.filter((u) => !isHomepageLike(u) && isLikelyInputPage(u))
  const rest = uniq.filter((u) => !isHomepageLike(u) && !isLikelyInputPage(u))

  const ordered: string[] = []
  const push = (u: string) => {
    if (ordered.length < budget && !ordered.includes(u)) ordered.push(u)
  }
  homepages.forEach(push)
  inputPages.forEach(push)
  rest.forEach(push)
  return ordered.slice(0, budget)
}
