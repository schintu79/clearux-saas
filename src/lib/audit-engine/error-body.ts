// ============================================================
// Capture completeness (Stage 1) — upstream/proxy error-body detection
// ============================================================
// A fetch can return HTTP 200 while the BODY is a proxy/gateway error (envoy
// "upstream connect error", "no healthy upstream", 502/503/504 stubs). We were
// storing that 95-char error string as a page's content and feeding it to the
// analyzer, which then "reported" the site as broken — a false finding sourced
// from a non-page.
//
// Rule (general, site-agnostic): an error-body is NOT page content. Detect it
// and mark the page failed so it never reaches analysis.
//
// Pure + fully unit-tested. Used by the crawler (reject at fetch) AND the
// capture layer (defense-in-depth net).
// ============================================================

/** Envoy/proxy signatures unambiguous enough to flag at any length. */
const STRONG_SIGNATURES = [
  /upstream connect error/i,
  /no healthy upstream/i,
  /upstream request timeout/i,
]

/** Gateway/proxy signatures that only indicate an error when the body is SHORT
 *  (a long real article may legitimately mention "bad gateway"). */
const WEAK_SIGNATURES = [
  /disconnect\/reset before headers/i,
  /reset reason:\s*(connection termination|connection failure|protocol error|overflow|remote\s+(connection|reset))/i,
  /\b50[234]\b[^0-9]{0,20}(bad gateway|service (temporarily )?unavailable|gateway time-?out)/i,
  /\bbad gateway\b/i,
  /\bgateway time-?out\b/i,
  /service (temporarily )?unavailable/i,
]

/** Proxy/gateway error bodies are tiny; real pages are not. */
const MAX_ERROR_BODY_LEN = 800

/**
 * True when `text` looks like a proxy/upstream/gateway ERROR BODY rather than
 * real page content. Conservative: strong envoy signatures flag at any length;
 * generic gateway phrases flag only on a short body, so a long legitimate page
 * that merely mentions "bad gateway" is never misclassified.
 */
export function isUpstreamErrorBody(text: string | null | undefined): boolean {
  if (!text) return false
  const t = text.trim()
  if (t.length === 0) return false
  if (STRONG_SIGNATURES.some((re) => re.test(t))) return true
  if (t.length <= MAX_ERROR_BODY_LEN && WEAK_SIGNATURES.some((re) => re.test(t))) return true
  return false
}
