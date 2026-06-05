// ============================================================
// Fixpath — Pre-flight Crawl Check
// Lightweight check that runs BEFORE the full crawl to detect
// blocked, unreachable, or inaccessible domains within seconds.
// ============================================================

/* ── CrawlStatus enum ─────────────────────────────────────── */

export type CrawlStatus =
  | 'accessible'        // proceed with audit
  | 'crawl-blocked'     // robots.txt or bot protection detected
  | 'http-error'        // 4xx or 5xx response
  | 'unreachable'       // DNS failure, timeout, or no response
  | 'partial'           // some content accessible, some blocked (edge case)

export interface PreflightResult {
  status: CrawlStatus
  /** Human-readable reason for non-accessible status */
  reason: string | null
  /** HTTP status code if one was received */
  httpStatus: number | null
  /** Time taken for the preflight check in ms */
  durationMs: number
}

/* ── Bot-block detection patterns ─────────────────────────── */

const BOT_BLOCK_MARKERS = [
  // Cloudflare
  /just a moment/i,
  /checking your browser/i,
  /cloudflare/i,
  /ray id/i,
  /challenge-platform/i,
  /_cf_chl_opt/i,
  // Generic bot walls
  /access denied/i,
  /blocked.*request/i,
  /automated.*requests.*not.*allowed/i,
  /bot.*detected/i,
  /captcha/i,
  /please verify you are human/i,
  /are you a robot/i,
  /ddos protection/i,
  /security check/i,
  // Specific providers
  /sucuri.*website.*firewall/i,
  /incapsula/i,
  /imperva/i,
  /distil.*networks/i,
  /datadome/i,
  /perimeterx/i,
  /akamai.*bot.*manager/i,
]

/* ── robots.txt check ─────────────────────────────────────── */

async function checkRobotsTxt(domain: string): Promise<{ blocked: boolean; reason: string | null }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(`https://${domain}/robots.txt`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Fixpath-Crawler/1.0 (+https://fixpath.co)' },
      redirect: 'follow',
    })
    clearTimeout(timeout)

    if (!res.ok) {
      // No robots.txt or error — not blocked
      return { blocked: false, reason: null }
    }

    const text = await res.text()

    // Check for universal disallow (Disallow: / for all user agents)
    const lines = text.split('\n').map(l => l.trim())
    let inAllAgents = false

    for (const line of lines) {
      if (/^user-agent:\s*\*/i.test(line)) {
        inAllAgents = true
      } else if (/^user-agent:/i.test(line)) {
        inAllAgents = false
      } else if (inAllAgents && /^disallow:\s*\/\s*$/i.test(line)) {
        return { blocked: true, reason: 'robots.txt disallows all crawling (Disallow: /)' }
      }
    }

    return { blocked: false, reason: null }
  } catch {
    // Timeout or network error checking robots.txt — not a block signal
    return { blocked: false, reason: null }
  }
}

/* ── HTTP response + bot detection check ──────────────────── */

async function checkHttpAccess(url: string): Promise<{
  status: CrawlStatus
  reason: string | null
  httpStatus: number | null
}> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Fixpath-Crawler/1.0; +https://fixpath.co)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    })
    clearTimeout(timeout)

    const httpStatus = res.status

    // Clear HTTP errors
    if (httpStatus === 403 || httpStatus === 429 || httpStatus === 503) {
      // Parse Retry-After header if present (RFC 7231 §7.1.3)
      const retryAfter = res.headers.get('retry-after')
      let retryInfo = ''
      if (retryAfter) {
        const retrySeconds = parseInt(retryAfter, 10)
        if (!isNaN(retrySeconds)) {
          retryInfo = ` (Retry-After: ${retrySeconds}s)`
        } else {
          // HTTP-date format
          const retryDate = new Date(retryAfter)
          if (!isNaN(retryDate.getTime())) {
            const waitMs = retryDate.getTime() - Date.now()
            retryInfo = ` (Retry-After: ${Math.max(0, Math.round(waitMs / 1000))}s)`
          }
        }
      }
      return {
        status: 'crawl-blocked',
        reason: `HTTP ${httpStatus} — server is blocking automated requests${retryInfo}`,
        httpStatus,
      }
    }

    if (httpStatus === 404) {
      return {
        status: 'unreachable',
        reason: 'Page not found (HTTP 404) — the URL may be incorrect',
        httpStatus,
      }
    }

    if (httpStatus >= 400 && httpStatus < 600) {
      return {
        status: 'http-error',
        reason: `HTTP ${httpStatus} error response`,
        httpStatus,
      }
    }

    // Check response body for bot-detection markers
    // Only read first 10KB to keep it fast
    const reader = res.body?.getReader()
    if (!reader) {
      return { status: 'accessible', reason: null, httpStatus }
    }

    let bodyText = ''
    const decoder = new TextDecoder()
    let bytesRead = 0
    const maxBytes = 10240 // 10KB

    while (bytesRead < maxBytes) {
      const { done, value } = await reader.read()
      if (done) break
      bodyText += decoder.decode(value, { stream: true })
      bytesRead += value.length
    }
    reader.cancel()

    // Check for bot-block markers in the response body
    for (const pattern of BOT_BLOCK_MARKERS) {
      if (pattern.test(bodyText)) {
        return {
          status: 'crawl-blocked',
          reason: `Bot protection detected (matched: ${pattern.source.slice(0, 40)})`,
          httpStatus,
        }
      }
    }

    // Check for suspiciously short responses that indicate a block page
    const cleanText = bodyText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    if (cleanText.length < 100 && httpStatus === 200) {
      // Very short page might be a challenge page — but could also be a minimal site
      // Don't flag as blocked, just note it
      return { status: 'accessible', reason: null, httpStatus }
    }

    return { status: 'accessible', reason: null, httpStatus }
  } catch (err) {
    // Determine if it's a timeout, DNS failure, or other network issue
    const errMsg = err instanceof Error ? err.message : String(err)

    if (errMsg.includes('abort') || errMsg.includes('timeout')) {
      return {
        status: 'unreachable',
        reason: 'Request timed out after 5 seconds — site may be down or very slow',
        httpStatus: null,
      }
    }

    if (errMsg.includes('ENOTFOUND') || errMsg.includes('getaddrinfo')) {
      return {
        status: 'unreachable',
        reason: 'Domain not found (DNS lookup failed) — the URL may be incorrect',
        httpStatus: null,
      }
    }

    if (errMsg.includes('ECONNREFUSED') || errMsg.includes('ECONNRESET')) {
      return {
        status: 'unreachable',
        reason: 'Connection refused — the server is not accepting connections',
        httpStatus: null,
      }
    }

    return {
      status: 'unreachable',
      reason: `Network error: ${errMsg.slice(0, 100)}`,
      httpStatus: null,
    }
  }
}

/* ── Main preflight function ──────────────────────────────── */

/**
 * Run a lightweight pre-flight crawl check on a URL.
 * Completes within 3-5 seconds. Checks:
 * 1. robots.txt for universal disallow
 * 2. HTTP response code
 * 3. Bot detection markers in response body
 *
 * Returns a CrawlStatus indicating whether the full audit should proceed.
 */
export async function runCrawlPreflight(url: string): Promise<PreflightResult> {
  const start = Date.now()

  // Normalize URL
  let normalizedUrl = url.trim()
  if (!normalizedUrl.startsWith('http')) {
    normalizedUrl = `https://${normalizedUrl}`
  }

  let domain: string
  try {
    domain = new URL(normalizedUrl).hostname
  } catch {
    return {
      status: 'unreachable',
      reason: 'Invalid URL format — could not parse the domain',
      httpStatus: null,
      durationMs: Date.now() - start,
    }
  }

  // Run robots.txt check and HTTP check in parallel for speed
  const [robotsResult, httpResult] = await Promise.all([
    checkRobotsTxt(domain),
    checkHttpAccess(normalizedUrl),
  ])

  const durationMs = Date.now() - start

  // If HTTP check found it unreachable or blocked, that takes priority
  if (httpResult.status !== 'accessible') {
    return {
      status: httpResult.status,
      reason: httpResult.reason,
      httpStatus: httpResult.httpStatus,
      durationMs,
    }
  }

  // If robots.txt blocks all crawling, flag it
  if (robotsResult.blocked) {
    return {
      status: 'crawl-blocked',
      reason: robotsResult.reason,
      httpStatus: httpResult.httpStatus,
      durationMs,
    }
  }

  // All clear
  return {
    status: 'accessible',
    reason: null,
    httpStatus: httpResult.httpStatus,
    durationMs,
  }
}
