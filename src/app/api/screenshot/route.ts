// ============================================================
// ClearUX — Screenshot API Endpoint
// Takes a URL + optional CSS selector, returns a screenshot
// with the target element highlighted (red dashed border).
// Runs as its own serverless function with dedicated memory.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60 // 60s timeout — plenty for one screenshot
export const dynamic = 'force-dynamic'

/**
 * POST /api/screenshot
 * Body: { url: string, selector?: string, label?: string }
 * Returns: { screenshot: string (base64), width: number, height: number }
 */
export async function POST(req: NextRequest) {
  try {
    const { url, selector, label } = await req.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate internal calls only (basic check)
    const authHeader = req.headers.get('x-screenshot-key')
    if (authHeader !== process.env.SCREENSHOT_INTERNAL_KEY && process.env.SCREENSHOT_INTERNAL_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const screenshot = await captureScreenshot(url, selector || null, label || null)

    if (!screenshot) {
      return NextResponse.json({ error: 'Failed to capture screenshot' }, { status: 500 })
    }

    return NextResponse.json({
      screenshot: screenshot.toString('base64'),
      contentType: 'image/png',
    })
  } catch (err) {
    console.error('[screenshot-api] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

async function captureScreenshot(
  url: string,
  selector: string | null,
  label: string | null,
): Promise<Buffer | null> {
  let browser = null

  try {
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteer = (await import('puppeteer-core')).default

    // Configure chromium for serverless
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chr = chromium as any
    if ('setHeadlessMode' in chromium) chr.setHeadlessMode = true
    if ('setGraphicsMode' in chromium) chr.setGraphicsMode = false

    const executablePath = await chromium.executablePath()

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
      defaultViewport: { width: 1280, height: 900 },
      executablePath,
      headless: true,
    })

    const page = await browser.newPage()

    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    )

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30_000,
    })

    // Wait for content to settle
    await new Promise((r) => setTimeout(r, 2000))

    // If a selector is provided, try to highlight it
    if (selector) {
      const found = await page.evaluate(
        (sel: string, lbl: string | null) => {
          try {
            let el: Element | null = null

            // Strategy 1: Direct CSS selector
            el = document.querySelector(sel)

            // Strategy 2: Partial text match on common elements
            if (!el && sel.length > 3) {
              const candidates = document.querySelectorAll(
                'h1, h2, h3, h4, h5, h6, p, button, a, nav, header, footer, section, form, input, img, div[class], main, aside',
              )
              for (const candidate of candidates) {
                const text = (candidate as HTMLElement).innerText || ''
                if (text.toLowerCase().includes(sel.toLowerCase())) {
                  el = candidate
                  break
                }
              }
            }

            // Strategy 3: Try aria-label or alt attribute match
            if (!el && sel.length > 3) {
              const allEls = document.querySelectorAll('[aria-label], [alt], [title]')
              for (const candidate of allEls) {
                const ariaLabel = candidate.getAttribute('aria-label') || ''
                const alt = candidate.getAttribute('alt') || ''
                const title = candidate.getAttribute('title') || ''
                const combined = `${ariaLabel} ${alt} ${title}`.toLowerCase()
                if (combined.includes(sel.toLowerCase())) {
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
              top: ${rect.top - 6}px;
              left: ${rect.left - 6}px;
              width: ${rect.width + 12}px;
              height: ${rect.height + 12}px;
              border: 3px dashed #DC2626;
              border-radius: 6px;
              background: rgba(220, 38, 38, 0.06);
              pointer-events: none;
              z-index: 99999;
              box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.12), 0 0 20px rgba(220, 38, 38, 0.08);
            `
            document.body.appendChild(overlay)

            // Add label badge
            if (lbl) {
              const badge = document.createElement('div')
              badge.style.cssText = `
                position: fixed;
                top: ${Math.max(4, rect.top - 34)}px;
                left: ${Math.max(4, rect.left - 6)}px;
                background: #DC2626;
                color: white;
                font-size: 11px;
                font-weight: 500;
                font-family: system-ui, -apple-system, sans-serif;
                padding: 3px 10px;
                border-radius: 4px;
                pointer-events: none;
                z-index: 100000;
                white-space: nowrap;
                max-width: 400px;
                overflow: hidden;
                text-overflow: ellipsis;
                box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
              `
              badge.textContent = lbl
              document.body.appendChild(badge)
            }

            return true
          } catch {
            return false
          }
        },
        selector,
        label,
      )

      // Small pause to render the overlay
      if (found) {
        await new Promise((r) => setTimeout(r, 300))
      }
    }

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
    })

    return Buffer.from(screenshot)
  } catch (err) {
    console.error('[screenshot-api] Capture error:', err instanceof Error ? err.message : err)
    return null
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch {
        // ignore close errors
      }
    }
  }
}
