// ============================================================
// ClearUX Audit Engine — Screenshot Capture
// Multi-strategy approach for reliable screenshots:
//   1. ScreenshotOne API (if key set) — reliable, supports selectors
//   2. Google PageSpeed API — free, reliable, no element highlight
//   3. /api/screenshot (Puppeteer) — self-hosted fallback
// ============================================================

import { createServiceSupabase } from '@/lib/supabase-server'

/**
 * The base URL for our own API — used to call /api/screenshot.
 */
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

/**
 * Check if a string looks like a valid CSS selector (vs a description like "the hero image").
 * We only want to send actual selectors to ScreenshotOne — not prose.
 */
export function isLikelyCSSSelector(s: string): boolean {
  if (!s || s.length > 100) return false
  // Must start with a tag, class, ID, or attribute selector
  if (!(/^[a-z]/i.test(s) || s.startsWith('.') || s.startsWith('#') || s.startsWith('['))) return false
  // Strong CSS signal — combinators, class/id/attr, or a pseudo like :nth-of-type.
  // Checked FIRST so a real selector containing the <a> anchor tag (e.g.
  // "div > a:nth-of-type(2)") is accepted instead of being mistaken for prose.
  if (/[.#\[\]>+~]|:nth|:not|:first|:last|:focus/.test(s)) return true
  // A simple single tag with no spaces: "nav", "header", "a", "button".
  if (/^[a-z][a-z0-9-]*$/i.test(s)) return true
  // Otherwise it's a multi-word string with no CSS structure — reject if it
  // reads like prose ("the hero section"). 'a' is omitted: it's a valid tag.
  if (/\b(the|an|is|of|for|in|on|this|that|with|and|or)\b/i.test(s)) return false
  return false
}

// ── Strategy 1: ScreenshotOne API (premium, reliable) ─────────

async function captureViaScreenshotOne(
  url: string,
  _selector?: string | null,
  highlightMode: 'crop' | 'highlight' | 'none' = 'none',
): Promise<Buffer | null> {
  const apiKey = process.env.SCREENSHOTONE_API_KEY
  if (!apiKey) {
    console.error('[screenshots] SCREENSHOTONE_API_KEY is NOT set in environment variables')
    return null
  }

  try {
    const params = new URLSearchParams({
      access_key: apiKey,
      url,
      viewport_width: '1280',
      viewport_height: '900',
      format: 'png',
      full_page: 'false',
      delay: '2',           // wait 2s for page to settle
      block_ads: 'true',
      block_cookie_banners: 'true',
      cache: 'false',        // Always capture fresh screenshots for accurate audits
    })

    if (_selector && highlightMode === 'highlight') {
      // Highlight mode: scroll to the element and inject a visual highlight border
      // The page screenshot stays full-width but the element is clearly marked
      params.set('selector_scroll_into_view', _selector)
      params.set('scroll_into_view_adjust_top', '-100') // 100px above so element isn't at the very edge
      // Inject CSS that highlights the element with a dashed red border + subtle background
      const highlightCSS = `${_selector}{outline:3px dashed #EF4444 !important;outline-offset:4px !important;box-shadow:0 0 0 6px rgba(239,68,68,0.15) !important;}`
      params.set('styles', highlightCSS)
    } else if (_selector && highlightMode === 'crop') {
      // Crop mode: crop the screenshot to just the element
      params.set('selector', _selector)
    }

    const requestUrl = `https://api.screenshotone.com/take?${params}`
    console.log(`[screenshots] ScreenshotOne request: ${url} | selector: ${_selector || 'none'} | mode: ${highlightMode}`)

    const res = await fetch(requestUrl, {
      signal: AbortSignal.timeout(15_000), // 15s — must complete within Wave 2 screenshot budget
    })

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'unable to read response body')
      console.error(`[screenshots] ScreenshotOne FAILED: HTTP ${res.status} for ${url}`)
      console.error(`[screenshots] ScreenshotOne response body: ${errorBody.slice(0, 500)}`)
      return null
    }

    const arrayBuf = await res.arrayBuffer()
    const buf = Buffer.from(arrayBuf)
    console.log(`[screenshots] ScreenshotOne OK: ${url} (${(buf.length / 1024).toFixed(0)} KB)`)
    return buf
  } catch (err) {
    console.error(`[screenshots] ScreenshotOne EXCEPTION for ${url}:`, err instanceof Error ? err.message : err)
    return null
  }
}

// ── Strategy 2: Google PageSpeed API (free, reliable) ──────────

async function captureViaPageSpeed(url: string): Promise<Buffer | null> {
  try {
    const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY
    const base = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
    const params = new URLSearchParams({
      url,
      category: 'PERFORMANCE',
      strategy: 'DESKTOP',
    })
    if (apiKey) params.set('key', apiKey)

    const res = await fetch(`${base}?${params}`, {
      signal: AbortSignal.timeout(15_000), // 15s — must fit within Wave 2 screenshot budget
    })

    if (!res.ok) return null

    const data = await res.json()
    const b64 = data?.lighthouseResult?.audits?.['final-screenshot']?.details?.data

    if (b64 && typeof b64 === 'string') {
      const raw = b64.split(',')[1]
      if (raw) return Buffer.from(raw, 'base64')
    }

    return null
  } catch {
    return null
  }
}

// ── Strategy 3: Self-hosted Puppeteer (/api/screenshot) ────────

async function captureViaPuppeteer(
  url: string,
  selector?: string | null,
  label?: string | null,
): Promise<Buffer | null> {
  try {
    const baseUrl = getBaseUrl()
    const body: Record<string, string> = { url }
    if (selector) body.selector = selector
    if (label) body.label = label

    const res = await fetch(`${baseUrl}/api/screenshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-screenshot-key': process.env.SCREENSHOT_INTERNAL_KEY || '',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000), // 15s — must fit within Wave 2 screenshot budget
    })

    if (!res.ok) {
      console.error('[screenshots] Puppeteer API returned', res.status)
      return null
    }

    const data = await res.json()
    if (data.screenshot) {
      return Buffer.from(data.screenshot, 'base64')
    }

    return null
  } catch (err) {
    console.error('[screenshots] Puppeteer capture failed:', err instanceof Error ? err.message : err)
    return null
  }
}

// ── Main capture function (tries all strategies) ───────────────

export async function captureScreenshot(
  url: string,
  selector?: string | null,
  label?: string | null,
  opts?: { elementTargetedOnly?: boolean },
): Promise<Buffer | null> {
  const hasScreenshotOne = !!process.env.SCREENSHOTONE_API_KEY
  const hasPageSpeed = true // always available (public API)
  const hasPuppeteer = !!process.env.SCREENSHOT_INTERNAL_KEY

  // elementTargetedOnly: only return a capture that genuinely targets the
  // element (a real CSS selector successfully highlighted/cropped). Never
  // substitute a plain page-level screenshot — a top-of-page image presented as
  // "visual evidence for this finding" is misleading when the finding is about
  // something further down (or about copy that has no selector at all). If we
  // can't honestly target the element, we return null and the finding shows no
  // visual evidence rather than a wrong one.
  const elementTargetedOnly = !!opts?.elementTargetedOnly
  const hasValidSelector = !!(selector && isLikelyCSSSelector(selector))
  if (elementTargetedOnly && !hasValidSelector) return null

  if (!hasScreenshotOne && !hasPuppeteer) {
    console.warn(`[screenshots] No screenshot API keys configured. Set SCREENSHOTONE_API_KEY (recommended) or SCREENSHOT_INTERNAL_KEY in your environment variables.`)
  }

  // Strategy 1: ScreenshotOne with element highlighting (best quality)
  if (hasScreenshotOne) {
    // If we have a selector, try highlight mode first (scrolls to element + red border)
    // then fall back to plain screenshot if the selector fails
    if (hasValidSelector) {
      const s1h = await captureViaScreenshotOne(url, selector!, 'highlight')
      if (s1h) {
        console.log(`[screenshots] ScreenshotOne highlight success: ${url} (${selector})`)
        return s1h
      }
      console.warn(`[screenshots] ScreenshotOne highlight failed for selector "${selector}"${elementTargetedOnly ? ' — no plain fallback (element-targeted only)' : ', falling back to plain'}`)
      if (elementTargetedOnly) return null
    }

    // Plain page screenshot (no selector or selector failed) — never for element-targeted requests
    if (!elementTargetedOnly) {
      const s1 = await captureViaScreenshotOne(url, null, 'none')
      if (s1) {
        console.log(`[screenshots] ScreenshotOne success: ${url}`)
        return s1
      }
      console.warn(`[screenshots] ScreenshotOne failed for: ${url}`)
    }
  }

  // Strategy 2: PageSpeed API (free, page-level only) — cannot target an element
  if (hasPageSpeed && !elementTargetedOnly) {
    const s2 = await captureViaPageSpeed(url)
    if (s2) {
      console.log(`[screenshots] PageSpeed success: ${url}`)
      return s2
    }
    console.warn(`[screenshots] PageSpeed failed for: ${url}`)
  }

  // Strategy 3: Self-hosted Puppeteer (crops to the selector when present)
  if (hasPuppeteer) {
    const s3 = await captureViaPuppeteer(url, selector, label)
    if (s3) {
      console.log(`[screenshots] Puppeteer success: ${url}`)
      return s3
    }
    console.warn(`[screenshots] Puppeteer failed for: ${url}`)
  }

  console.error(`[screenshots] ALL strategies failed for: ${url} | ScreenshotOne: ${hasScreenshotOne ? 'configured' : 'MISSING'} | Puppeteer: ${hasPuppeteer ? 'configured' : 'MISSING'}`)
  return null
}

// ── Upload to Supabase Storage ─────────────────────────────────

export async function uploadScreenshot(
  auditId: string,
  filename: string,
  buffer: Buffer,
): Promise<string | null> {
  try {
    const db = createServiceSupabase()
    const path = `${auditId}/${filename}`

    console.log(`[screenshots] Uploading to Supabase: audit-screenshots/${path} (${(buffer.length / 1024).toFixed(0)} KB)`)

    const { error } = await db.storage
      .from('audit-screenshots')
      .upload(path, buffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (error) {
      if (error.message?.includes('not found') || error.message?.includes('Bucket')) {
        console.error(`[screenshots] BUCKET MISSING: The 'audit-screenshots' storage bucket does not exist in Supabase. Run this SQL:\n  INSERT INTO storage.buckets (id, name, public) VALUES ('audit-screenshots', 'audit-screenshots', true) ON CONFLICT (id) DO NOTHING;`)
      } else {
        console.error(`[screenshots] Upload FAILED for ${path}: ${error.message}`)
      }
      return null
    }

    const { data: urlData } = db.storage
      .from('audit-screenshots')
      .getPublicUrl(path)

    const publicUrl = urlData?.publicUrl || null
    console.log(`[screenshots] Upload OK: ${publicUrl}`)
    return publicUrl
  } catch (err) {
    console.error('[screenshots] Upload EXCEPTION:', err instanceof Error ? err.message : err)
    return null
  }
}

// ── Orchestrate screenshots for an entire audit ────────────────

/** Severity levels important enough to ever warrant a screenshot. */
const SCREENSHOT_SEVERITIES = new Set(['high', 'critical'])

/** Detection sources that are instrument-measured (verified), not LLM interpretation. */
const VERIFIED_SOURCES = new Set([
  'axe', 'wcag_checker', 'responsive_checker', 'pagespeed', 'pagespeed_api',
  'lighthouse', 'structured_data_checker', 'link_checker', 'security_checker',
])

/** A finding is "verified" when an instrument measured it (deterministic), not the LLM. */
function isVerifiedFinding(f: { confidenceLevel?: string | null; detectionSource?: string | null }): boolean {
  if (f.confidenceLevel === 'deterministic') return true
  return !!(f.detectionSource && VERIFIED_SOURCES.has(f.detectionSource))
}

export async function captureAuditScreenshots(
  findings: Array<{
    id: string
    title: string
    severity: string
    targetElement?: string | null
    pageUrl?: string | null
    confidenceLevel?: string | null
    detectionSource?: string | null
  }>,
  fallbackUrl: string,
  auditId: string,
  maxFindingScreenshots: number = 10,
): Promise<{
  pageScreenshots: Map<string, string>
  findingScreenshots: Map<string, string>
}> {
  const pageScreenshots = new Map<string, string>()
  const findingScreenshots = new Map<string, string>()

  // ── Policy (set by the operator, 2026-06-17): screenshots are expensive, so
  // we only ever pay for "extremely important + verified" evidence and otherwise
  // REUSE an image we already have:
  //   • New (paid) element capture ONLY for VERIFIED high/critical findings that
  //     carry a real CSS selector.
  //   • Page-level capture ONLY for pages that have a qualifying high/critical
  //     finding (no blanket page pass).
  //   • Other high/critical findings reuse that page's screenshot (free).
  //   • Medium/low findings get nothing, EXCEPT a verified medium finding may
  //     reuse an element shot already taken for the same URL+selector.
  // Reuse caches dedupe so the same image is used N times, never re-shot.
  const elementCache = new Map<string, string>() // key: `${url}\n${selector}` → public URL

  const isImportant = (f: { severity: string }) => SCREENSHOT_SEVERITIES.has((f.severity || '').toLowerCase())
  const canShootElement = (f: typeof findings[number]) =>
    isImportant(f) && isVerifiedFinding(f) && !!(f.targetElement && isLikelyCSSSelector(f.targetElement))

  // 1. Page-level screenshots ONLY for pages that have a qualifying high/critical
  //    finding — reused across every finding on that page.
  const pagesNeedingShot = new Set<string>()
  for (const f of findings) {
    if (isImportant(f)) pagesNeedingShot.add(f.pageUrl || fallbackUrl)
  }

  // 2. Capture those page-level screenshots IN PARALLEL (deduped by URL)
  console.log(`[screenshots] Capturing ${pagesNeedingShot.size} page screenshots (pages with high/critical findings)`)
  await Promise.all(
    [...pagesNeedingShot].map(async (url) => {
      try {
        const buf = await captureScreenshot(url)
        if (buf) {
          const safeName = url.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60)
          const publicUrl = await uploadScreenshot(auditId, `page-${safeName}.png`, buf)
          if (publicUrl) {
            pageScreenshots.set(url, publicUrl)
          }
        }
      } catch (err) {
        console.error(`[screenshots] Page capture failed for ${url}:`, err instanceof Error ? err.message : err)
      }
    })
  )

  // 3. Capture finding-specific screenshots
  const hasAdvancedCapture = !!(process.env.SCREENSHOTONE_API_KEY || process.env.SCREENSHOT_INTERNAL_KEY)

  const elKey = (url: string, selector: string) => `${url}\n${selector}`

  // ── PASS A — SHOOT (paid) element captures. Only VERIFIED high/critical
  // findings with a real selector. Deduped by URL+selector so a defect that
  // appears on N findings is shot ONCE, then reused. Capped at the budget.
  const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const seenShoot = new Set<string>()
  const toShoot: typeof findings = []
  for (const f of [...findings].sort((a, b) => (severityRank[a.severity] ?? 4) - (severityRank[b.severity] ?? 4))) {
    if (!hasAdvancedCapture || !canShootElement(f)) continue
    const key = elKey(f.pageUrl || fallbackUrl, f.targetElement as string)
    if (seenShoot.has(key)) continue // same element already queued — will reuse
    seenShoot.add(key)
    toShoot.push(f)
    if (toShoot.length >= maxFindingScreenshots) break
  }

  console.log(`[screenshots] Shooting ${toShoot.length} element screenshots (verified high/critical, deduped)`)
  const SCREENSHOT_CONCURRENCY = 3
  for (let i = 0; i < toShoot.length; i += SCREENSHOT_CONCURRENCY) {
    const batch = toShoot.slice(i, i + SCREENSHOT_CONCURRENCY)
    await Promise.all(
      batch.map(async (finding) => {
        try {
          const pageUrl = finding.pageUrl || fallbackUrl
          const selector = finding.targetElement as string
          const buf = await captureScreenshot(
            pageUrl,
            selector,
            `${finding.severity.toUpperCase()}: ${finding.title}`,
            { elementTargetedOnly: true },
          )
          if (buf) {
            const publicUrl = await uploadScreenshot(auditId, `finding-${finding.id}.png`, buf)
            if (publicUrl) {
              elementCache.set(elKey(pageUrl, selector), publicUrl)
              findingScreenshots.set(finding.id, publicUrl)
            }
          }
        } catch (err) {
          console.error(`[screenshots] Finding capture failed for ${finding.id}:`, err instanceof Error ? err.message : err)
        }
      })
    )
  }

  // ── PASS B — REUSE (free). Assign an already-captured image to the remaining
  // findings; never shoot. No image of the right thing → no screenshot.
  for (const finding of findings) {
    if (findingScreenshots.has(finding.id)) continue
    const url = finding.pageUrl || fallbackUrl
    const sev = (finding.severity || '').toLowerCase()
    const hasSel = !!(finding.targetElement && isLikelyCSSSelector(finding.targetElement))

    // Exact element image already shot (for a verified finding) → reuse it for
    // any high/critical finding, or for a verified medium finding.
    if (hasSel) {
      const cached = elementCache.get(elKey(url, finding.targetElement as string))
      if (cached && (SCREENSHOT_SEVERITIES.has(sev) || (sev === 'medium' && isVerifiedFinding(finding)))) {
        findingScreenshots.set(finding.id, cached)
        continue
      }
    }

    // Otherwise a high/critical finding reuses that page's screenshot (free).
    // Medium/low get nothing.
    if (SCREENSHOT_SEVERITIES.has(sev)) {
      const pageShot = pageScreenshots.get(url)
      if (pageShot) findingScreenshots.set(finding.id, pageShot)
    }
  }

  return { pageScreenshots, findingScreenshots }
}
