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
function isLikelyCSSSelector(s: string): boolean {
  if (!s || s.length > 100) return false
  // Must start with a tag, class, ID, or attribute selector
  if (/^[a-z]/i.test(s) || s.startsWith('.') || s.startsWith('#') || s.startsWith('[')) {
    // Should NOT contain spaces that suggest prose (e.g., "the hero section")
    // But allow spaces in valid selectors like "nav > ul > li"
    if (/\b(the|a|an|is|of|for|in|on|this|that|with|and|or)\b/i.test(s)) return false
    // Should look like CSS: contains dots, hashes, brackets, combinators, or is a simple tag
    if (/^[a-z][a-z0-9-]*$/i.test(s)) return true // simple tag like "nav", "header", "footer"
    if (/[.#\[\]>+~:]/.test(s)) return true // has CSS selector characters
    return false
  }
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
): Promise<Buffer | null> {
  const hasScreenshotOne = !!process.env.SCREENSHOTONE_API_KEY
  const hasPageSpeed = true // always available (public API)
  const hasPuppeteer = !!process.env.SCREENSHOT_INTERNAL_KEY

  if (!hasScreenshotOne && !hasPuppeteer) {
    console.warn(`[screenshots] No screenshot API keys configured. Set SCREENSHOTONE_API_KEY (recommended) or SCREENSHOT_INTERNAL_KEY in your environment variables.`)
  }

  // Strategy 1: ScreenshotOne with element highlighting (best quality)
  if (hasScreenshotOne) {
    // If we have a selector, try highlight mode first (scrolls to element + red border)
    // then fall back to plain screenshot if the selector fails
    if (selector && isLikelyCSSSelector(selector)) {
      const s1h = await captureViaScreenshotOne(url, selector, 'highlight')
      if (s1h) {
        console.log(`[screenshots] ScreenshotOne highlight success: ${url} (${selector})`)
        return s1h
      }
      console.warn(`[screenshots] ScreenshotOne highlight failed for selector "${selector}", falling back to plain`)
    }

    // Plain page screenshot (no selector or selector failed)
    const s1 = await captureViaScreenshotOne(url, null, 'none')
    if (s1) {
      console.log(`[screenshots] ScreenshotOne success: ${url}`)
      return s1
    }
    console.warn(`[screenshots] ScreenshotOne failed for: ${url}`)
  }

  // Strategy 2: PageSpeed API (free, page-level only)
  if (hasPageSpeed) {
    const s2 = await captureViaPageSpeed(url)
    if (s2) {
      console.log(`[screenshots] PageSpeed success: ${url}`)
      return s2
    }
    console.warn(`[screenshots] PageSpeed failed for: ${url}`)
  }

  // Strategy 3: Self-hosted Puppeteer (fallback)
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

export async function captureAuditScreenshots(
  findings: Array<{
    id: string
    title: string
    severity: string
    targetElement?: string | null
    pageUrl?: string | null
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

  // 1. Collect unique page URLs
  const uniqueUrls = new Set<string>()
  uniqueUrls.add(fallbackUrl)
  for (const f of findings) {
    if (f.pageUrl) uniqueUrls.add(f.pageUrl)
  }

  // 2. Capture page-level screenshots IN PARALLEL (all at once)
  console.log(`[screenshots] Capturing ${uniqueUrls.size} page screenshots in parallel`)
  await Promise.all(
    [...uniqueUrls].map(async (url) => {
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
  //    With ScreenshotOne/Puppeteer: use element highlighting for targeted captures
  //    Without: fall back to page-level screenshots so findings still have visuals
  const hasAdvancedCapture = !!(process.env.SCREENSHOTONE_API_KEY || process.env.SCREENSHOT_INTERNAL_KEY)

  // Severity first — high/critical findings must keep their screenshots.
  // Within the same severity, prefer selector-bearing findings (axe and the
  // other deterministic checks) so the limited element-highlighted captures
  // go to the findings that can actually be highlighted.
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const prioritized = [...findings]
    .sort((a, b) => {
      const sev = (order[a.severity] ?? 4) - (order[b.severity] ?? 4)
      if (sev !== 0) return sev
      const aSel = a.targetElement ? 0 : 1
      const bSel = b.targetElement ? 0 : 1
      return aSel - bSel
    })
    .slice(0, maxFindingScreenshots)

  // Process finding screenshots in parallel batches of 3 (avoid API hammering)
  console.log(`[screenshots] Capturing ${prioritized.length} finding screenshots (batches of 3)`)
  const SCREENSHOT_CONCURRENCY = 3
  for (let i = 0; i < prioritized.length; i += SCREENSHOT_CONCURRENCY) {
    const batch = prioritized.slice(i, i + SCREENSHOT_CONCURRENCY)
    await Promise.all(
      batch.map(async (finding) => {
        try {
          const pageUrl = finding.pageUrl || fallbackUrl

          if (hasAdvancedCapture && finding.targetElement) {
            const buf = await captureScreenshot(pageUrl, finding.targetElement, `${finding.severity.toUpperCase()}: ${finding.title}`)
            if (buf) {
              const publicUrl = await uploadScreenshot(auditId, `finding-${finding.id}.png`, buf)
              if (publicUrl) {
                findingScreenshots.set(finding.id, publicUrl)
                return
              }
            }
          }

          // Fallback: link to existing page screenshot
          const pageScreenshot = pageScreenshots.get(pageUrl)
          if (pageScreenshot) {
            findingScreenshots.set(finding.id, pageScreenshot)
          }
        } catch (err) {
          console.error(`[screenshots] Finding capture failed for ${finding.id}:`, err instanceof Error ? err.message : err)
        }
      })
    )
  }

  return { pageScreenshots, findingScreenshots }
}
