// ============================================================
// ClearUX Audit Engine — Screenshot Capture
// Strategy: Try puppeteer-core first, fall back to free API
// ============================================================

import type { AuditFinding } from '@/types/database'
import { createServiceSupabase } from '@/lib/supabase-server'

// ── Puppeteer approach (works on Lambda / Vercel Pro) ────────

async function launchBrowser() {
  const chromium = (await import('@sparticuz/chromium')).default
  const puppeteer = (await import('puppeteer-core')).default

  if (typeof (chromium as any).setHeadlessMode === 'function') {
    ;(chromium as any).setHeadlessMode('shell')
  }
  if (typeof (chromium as any).setGraphicsMode === 'function') {
    ;(chromium as any).setGraphicsMode(false)
  }

  const executablePath = await chromium.executablePath()

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1280, height: 900 },
    executablePath,
    headless: true,
  })

  return browser
}

// ── Fallback: Free screenshot API ────────────────────────────

async function captureViaApi(url: string): Promise<Buffer | null> {
  // Try multiple free screenshot APIs as fallback
  const apis = [
    // Google PageSpeed Insights screenshot (free, reliable)
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=PERFORMANCE&strategy=DESKTOP`,
    // screenshotone.com free tier
    `https://api.screenshotone.com/take?url=${encodeURIComponent(url)}&viewport_width=1280&viewport_height=900&format=png&block_ads=true&delay=2&timeout=15`,
  ]

  // Try Google PageSpeed first — it returns a base64 screenshot
  try {
    const psRes = await fetch(apis[0], { signal: AbortSignal.timeout(20_000) })
    if (psRes.ok) {
      const data = await psRes.json()
      const b64 = data?.lighthouseResult?.audits?.['final-screenshot']?.details?.data
      if (b64 && typeof b64 === 'string') {
        // Format: "data:image/jpeg;base64,..."
        const raw = b64.split(',')[1]
        if (raw) {
          console.log('[screenshots] Captured via Google PageSpeed API')
          return Buffer.from(raw, 'base64')
        }
      }
    }
  } catch (err) {
    console.error('[screenshots] Google PageSpeed API failed:', err instanceof Error ? err.message : err)
  }

  return null
}

/**
 * Capture a full-page screenshot of a URL.
 * Tries puppeteer first, falls back to free API.
 */
export async function capturePageScreenshot(
  url: string,
  options?: { timeout?: number },
): Promise<Buffer> {
  // Strategy 1: Puppeteer (best quality, but may fail on serverless)
  try {
    const browser = await launchBrowser()
    try {
      const page = await browser.newPage()
      await page.setViewport({ width: 1280, height: 900 })
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: options?.timeout ?? 30_000,
      })
      await new Promise((r) => setTimeout(r, 1500))
      const screenshot = await page.screenshot({ type: 'png', fullPage: false })
      console.log('[screenshots] Captured via Puppeteer')
      return Buffer.from(screenshot)
    } finally {
      await browser.close()
    }
  } catch (err) {
    console.error('[screenshots] Puppeteer failed, trying API fallback:', err instanceof Error ? err.message : err)
  }

  // Strategy 2: Free API fallback
  const apiBuf = await captureViaApi(url)
  if (apiBuf) return apiBuf

  throw new Error('All screenshot methods failed')
}

/**
 * Capture a screenshot with a specific element highlighted.
 * Draws a red dashed border + translucent overlay around the target element.
 */
export async function captureHighlightedScreenshot(
  url: string,
  targetSelector: string,
  options?: { timeout?: number; label?: string },
): Promise<Buffer | null> {
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: options?.timeout ?? 30_000,
    })

    // Wait for content to settle
    await new Promise((r) => setTimeout(r, 1500))

    // Try to find and highlight the element
    const found = await page.evaluate(
      (selector: string, label: string) => {
        try {
          // Try multiple strategies to find the element
          let el: Element | null = null

          // 1. Direct CSS selector
          el = document.querySelector(selector)

          // 2. If not found, try partial text match on common elements
          if (!el && selector.length > 3) {
            const allElements = document.querySelectorAll(
              'h1, h2, h3, h4, p, button, a, nav, header, footer, section, form, input, img, div[class]',
            )
            for (const candidate of allElements) {
              const text = (candidate as HTMLElement).innerText || ''
              if (text.toLowerCase().includes(selector.toLowerCase())) {
                el = candidate
                break
              }
            }
          }

          if (!el) return false

          // Scroll element into view
          el.scrollIntoView({ block: 'center', behavior: 'instant' })

          // Create highlight overlay
          const rect = el.getBoundingClientRect()
          const overlay = document.createElement('div')
          overlay.id = 'clearux-highlight'
          overlay.style.cssText = `
            position: fixed;
            top: ${rect.top - 4}px;
            left: ${rect.left - 4}px;
            width: ${rect.width + 8}px;
            height: ${rect.height + 8}px;
            border: 3px dashed #DC2626;
            border-radius: 4px;
            background: rgba(220, 38, 38, 0.08);
            pointer-events: none;
            z-index: 99999;
            box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.15);
          `
          document.body.appendChild(overlay)

          // Add label badge if provided
          if (label) {
            const badge = document.createElement('div')
            badge.style.cssText = `
              position: fixed;
              top: ${Math.max(0, rect.top - 30)}px;
              left: ${rect.left - 4}px;
              background: #DC2626;
              color: white;
              font-size: 11px;
              font-weight: 700;
              font-family: system-ui, -apple-system, sans-serif;
              padding: 2px 8px;
              border-radius: 3px;
              pointer-events: none;
              z-index: 100000;
              white-space: nowrap;
            `
            badge.textContent = label
            document.body.appendChild(badge)
          }

          return true
        } catch {
          return false
        }
      },
      targetSelector,
      options?.label || '',
    )

    if (!found) {
      // Element not found — still take a plain screenshot
      await browser.close()
      return null
    }

    // Brief pause to let the overlay render
    await new Promise((r) => setTimeout(r, 200))

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
    })

    return Buffer.from(screenshot)
  } finally {
    await browser.close()
  }
}

/**
 * Capture screenshots for the main page and top findings.
 * Returns a map of finding_id → screenshot buffer, plus a page screenshot.
 */
export async function captureAuditScreenshots(
  pageUrl: string,
  findings: Array<{ id: string; title: string; severity: string; targetElement?: string | null }>,
  maxScreenshots: number = 6,
): Promise<{
  pageScreenshot: Buffer | null
  findingScreenshots: Map<string, Buffer>
}> {
  const findingScreenshots = new Map<string, Buffer>()
  let pageScreenshot: Buffer | null = null

  try {
    // 1. Capture main page screenshot
    pageScreenshot = await capturePageScreenshot(pageUrl, { timeout: 25_000 })
  } catch (err) {
    console.error('[screenshots] Failed to capture page screenshot:', err instanceof Error ? err.message : err)
  }

  // 2. Capture finding-specific screenshots (prioritize critical/high)
  const prioritized = [...findings]
    .filter((f) => f.targetElement)
    .sort((a, b) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4)
    })
    .slice(0, maxScreenshots)

  for (const finding of prioritized) {
    if (!finding.targetElement) continue

    try {
      const sevLabel = finding.severity.toUpperCase()
      const buf = await captureHighlightedScreenshot(pageUrl, finding.targetElement, {
        timeout: 20_000,
        label: `${sevLabel}: ${finding.title}`,
      })

      if (buf) {
        findingScreenshots.set(finding.id, buf)
      }
    } catch (err) {
      console.error(`[screenshots] Failed to capture screenshot for finding ${finding.id}:`, err instanceof Error ? err.message : err)
    }
  }

  return { pageScreenshot, findingScreenshots }
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
    console.error('[screenshots] Upload exception:', err instanceof Error ? err.message : err)
    return null
  }
}
