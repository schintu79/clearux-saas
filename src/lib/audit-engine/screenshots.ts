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

// ── Strategy 1: ScreenshotOne API (premium, reliable) ─────────

async function captureViaScreenshotOne(
  url: string,
  _selector?: string | null,
): Promise<Buffer | null> {
  const apiKey = process.env.SCREENSHOTONE_API_KEY
  if (!apiKey) return null

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
      cache: 'true',
      cache_ttl: '86400',   // 24h cache
    })

    // ScreenshotOne supports element selectors for cropping
    if (_selector) {
      params.set('selector', _selector)
    }

    const res = await fetch(`https://api.screenshotone.com/take?${params}`, {
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      console.error('[screenshots] ScreenshotOne returned', res.status)
      return null
    }

    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  } catch (err) {
    console.error('[screenshots] ScreenshotOne error:', err instanceof Error ? err.message : err)
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
      signal: AbortSignal.timeout(30_000),
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
      signal: AbortSignal.timeout(55_000),
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
  // Strategy 1: ScreenshotOne (best quality, paid)
  const s1 = await captureViaScreenshotOne(url, selector)
  if (s1) {
    console.log(`[screenshots] ScreenshotOne success: ${url}`)
    return s1
  }

  // Strategy 2: PageSpeed API (free, page-level only)
  const s2 = await captureViaPageSpeed(url)
  if (s2) {
    console.log(`[screenshots] PageSpeed success: ${url}`)
    return s2
  }

  // Strategy 3: Self-hosted Puppeteer (fallback)
  const s3 = await captureViaPuppeteer(url, selector, label)
  if (s3) {
    console.log(`[screenshots] Puppeteer success: ${url}`)
    return s3
  }

  console.error(`[screenshots] All strategies failed for: ${url}`)
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

    const { error } = await db.storage
      .from('audit-screenshots')
      .upload(path, buffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (error) {
      console.error('[screenshots] Upload error:', error.message)
      return null
    }

    const { data: urlData } = db.storage
      .from('audit-screenshots')
      .getPublicUrl(path)

    return urlData?.publicUrl || null
  } catch (err) {
    console.error('[screenshots] Upload exception:', err instanceof Error ? err.message : err)
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

  // 2. Capture page-level screenshots (no element highlight)
  for (const url of uniqueUrls) {
    try {
      console.log(`[screenshots] Capturing page: ${url}`)
      const buf = await captureScreenshot(url)

      if (buf) {
        const safeName = url.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60)
        const publicUrl = await uploadScreenshot(auditId, `page-${safeName}.png`, buf)
        if (publicUrl) {
          pageScreenshots.set(url, publicUrl)
          console.log(`[screenshots] Page screenshot uploaded: ${url}`)
        }
      }
    } catch (err) {
      console.error(`[screenshots] Page capture failed for ${url}:`, err instanceof Error ? err.message : err)
    }
  }

  // 3. Capture finding-specific screenshots with element highlight
  //    Only if ScreenshotOne or Puppeteer is available (PageSpeed can't highlight)
  const hasAdvancedCapture = !!(process.env.SCREENSHOTONE_API_KEY || process.env.SCREENSHOT_INTERNAL_KEY)

  if (hasAdvancedCapture) {
    const prioritized = [...findings]
      .filter((f) => f.targetElement)
      .sort((a, b) => {
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
        return (order[a.severity] ?? 4) - (order[b.severity] ?? 4)
      })
      .slice(0, maxFindingScreenshots)

    for (const finding of prioritized) {
      if (!finding.targetElement) continue

      try {
        const pageUrl = finding.pageUrl || fallbackUrl
        const sevLabel = finding.severity.toUpperCase()
        const label = `${sevLabel}: ${finding.title}`

        console.log(`[screenshots] Capturing finding: ${finding.id} (${finding.targetElement})`)
        const buf = await captureScreenshot(pageUrl, finding.targetElement, label)

        if (buf) {
          const publicUrl = await uploadScreenshot(auditId, `finding-${finding.id}.png`, buf)
          if (publicUrl) {
            findingScreenshots.set(finding.id, publicUrl)
            console.log(`[screenshots] Finding screenshot uploaded: ${finding.id}`)
          }
        }
      } catch (err) {
        console.error(`[screenshots] Finding capture failed for ${finding.id}:`, err instanceof Error ? err.message : err)
      }
    }
  } else {
    console.log('[screenshots] No advanced capture available — skipping finding-level screenshots')
  }

  return { pageScreenshots, findingScreenshots }
}
