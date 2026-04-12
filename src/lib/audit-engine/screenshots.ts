// ============================================================
// ClearUX Audit Engine — Screenshot Capture
// Uses a dedicated /api/screenshot endpoint so each capture
// runs in its own serverless invocation with fresh memory.
// ============================================================

import { createServiceSupabase } from '@/lib/supabase-server'

/**
 * The base URL for our own API — used to call /api/screenshot.
 * In production: NEXT_PUBLIC_SITE_URL or VERCEL_URL.
 * In dev: localhost:3000.
 */
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

/**
 * Call our /api/screenshot endpoint to capture a screenshot.
 * Each call spins up its own serverless function with 60s timeout.
 */
export async function captureScreenshot(
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
      signal: AbortSignal.timeout(55_000), // slightly less than the endpoint's 60s
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      console.error('[screenshots] API returned', res.status, errData)
      return null
    }

    const data = await res.json()
    if (data.screenshot) {
      return Buffer.from(data.screenshot, 'base64')
    }

    return null
  } catch (err) {
    console.error(
      '[screenshots] Capture failed:',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

/**
 * Fallback: Google PageSpeed API for page overview screenshot.
 * Free, reliable, but only gives a generic page screenshot (no element highlight).
 */
export async function capturePageScreenshotFallback(
  url: string,
): Promise<Buffer | null> {
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
      signal: AbortSignal.timeout(25_000),
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

/**
 * Upload a screenshot buffer to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
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
    console.error(
      '[screenshots] Upload exception:',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

/**
 * Capture screenshots for an audit:
 * 1. Page overview for each unique URL
 * 2. Highlighted element screenshots for top findings
 */
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
  pageScreenshots: Map<string, string> // url → public URL
  findingScreenshots: Map<string, string> // findingId → public URL
}> {
  const pageScreenshots = new Map<string, string>()
  const findingScreenshots = new Map<string, string>()

  // 1. Collect unique page URLs
  const uniqueUrls = new Set<string>()
  uniqueUrls.add(fallbackUrl) // always capture the main page
  for (const f of findings) {
    if (f.pageUrl) uniqueUrls.add(f.pageUrl)
  }

  // 2. Capture page-level screenshots (no highlight)
  for (const url of uniqueUrls) {
    try {
      console.log(`[screenshots] Capturing page: ${url}`)
      let buf = await captureScreenshot(url)

      // Fallback to PageSpeed API if Puppeteer fails
      if (!buf) {
        console.log(`[screenshots] Puppeteer failed for ${url}, trying PageSpeed API...`)
        buf = await capturePageScreenshotFallback(url)
      }

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

  return { pageScreenshots, findingScreenshots }
}
