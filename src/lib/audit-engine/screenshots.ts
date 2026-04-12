// ============================================================
// ClearUX Audit Engine — Screenshot Capture
// Strategy: Google PageSpeed API for page overview (serverless-safe)
// Finding-specific visuals are rendered client-side via FindingVisual
// ============================================================

import { createServiceSupabase } from '@/lib/supabase-server'

/**
 * Capture a page screenshot via Google PageSpeed Insights API.
 * This is free, reliable, and works in any serverless environment.
 */
export async function capturePageScreenshot(
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

    if (!res.ok) {
      console.error('[screenshots] PageSpeed API HTTP', res.status)
      return null
    }

    const data = await res.json()
    const b64 =
      data?.lighthouseResult?.audits?.['final-screenshot']?.details?.data

    if (b64 && typeof b64 === 'string') {
      const raw = b64.split(',')[1]
      if (raw) {
        console.log('[screenshots] Captured via Google PageSpeed API')
        return Buffer.from(raw, 'base64')
      }
    }

    // Also try the thumbnail screenshot
    const thumb =
      data?.lighthouseResult?.audits?.['screenshot-thumbnails']?.details?.items
    if (Array.isArray(thumb) && thumb.length > 0) {
      const last = thumb[thumb.length - 1]
      if (last?.data && typeof last.data === 'string') {
        const raw = last.data.split(',')[1]
        if (raw) {
          console.log('[screenshots] Captured thumbnail via PageSpeed API')
          return Buffer.from(raw, 'base64')
        }
      }
    }

    console.warn('[screenshots] No screenshot found in PageSpeed response')
    return null
  } catch (err) {
    console.error(
      '[screenshots] PageSpeed API error:',
      err instanceof Error ? err.message : err,
    )
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
 * Capture & upload only the page overview screenshot.
 * Finding-specific visuals are now handled client-side via <FindingVisual />.
 */
export async function captureAuditScreenshots(
  pageUrl: string,
): Promise<{ pageScreenshotUrl: string | null }> {
  // We no longer try Puppeteer — it's unreliable on Vercel serverless.
  // PageSpeed API gives us a reliable page overview image.
  return { pageScreenshotUrl: null }
}
