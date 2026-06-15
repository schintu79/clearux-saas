// ============================================================
// Shared headless-browser launcher (Plan §0.6, D4)
// ============================================================
// Until 2026-06-12 three copies of this logic lived in
// responsive-checker.ts, wcag-checker.ts and browser-renderer.ts —
// and every copy swallowed the real launch error with a bare catch,
// so production reported "No Chromium/Chrome binary found" for months
// while the actual failure (chromium binaries missing from the Vercel
// function bundle — output file tracing never shipped
// @sparticuz/chromium/bin) stayed invisible. Meanwhile the screenshot
// step "worked" only because it uses the external ScreenshotOne API.
//
// Fix is two-sided:
//   1. next.config.mjs outputFileTracingIncludes ships the bin folder
//      with the Inngest + screenshot functions.
//   2. This module is the ONLY launch path, and it reports the real
//      serverless launch error to console + Sentry before falling back.

import * as Sentry from '@sentry/nextjs'
import puppeteer, { type Browser } from 'puppeteer-core'

export interface LaunchOptions {
  /** Default viewport; null lets callers set per-page viewports (responsive checks). */
  viewport?: { width: number; height: number } | null
  /** Extra Chromium args appended to the serverless defaults. */
  extraArgs?: string[]
}

const LOCAL_CHROME_PATHS = [
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]

// ── ETXTBSY race guard (2026-06-15) ─────────────────────────
// @sparticuz/chromium.executablePath() extracts the brotli-packed binary to
// /tmp on first call, then puppeteer execs it. The audit launches TWO browsers
// in parallel (responsive + WCAG via Promise.all). If both extract to the same
// path at once, one is still WRITING the binary while the other tries to EXEC
// it → `spawn ETXTBSY` (text file busy). Fix: extract exactly once (shared
// promise) and serialize the launch() exec, with a short ETXTBSY retry.
let cachedExecPath: Promise<string> | null = null
let launchLock: Promise<void> = Promise.resolve()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function serializeLaunch<T>(fn: () => Promise<T>): Promise<T> {
  const prev = launchLock
  let release!: () => void
  launchLock = new Promise<void>((r) => (release = r))
  await prev.catch(() => {})
  try {
    return await fn()
  } finally {
    release()
  }
}

export async function launchAuditBrowser(opts: LaunchOptions = {}): Promise<Browser> {
  const viewport = opts.viewport === undefined ? { width: 1440, height: 900 } : opts.viewport
  let serverlessError: unknown = null

  // 1) Serverless (Vercel) — @sparticuz/chromium
  try {
    const chromium = await import('@sparticuz/chromium')
    // Extract the binary ONCE; concurrent callers await the same extraction
    // rather than each writing the file (the ETXTBSY trigger).
    if (!cachedExecPath) cachedExecPath = Promise.resolve(chromium.default.executablePath())
    const executablePath = await cachedExecPath
    const launchArgs = {
      args: [...chromium.default.args, ...(opts.extraArgs ?? [])],
      defaultViewport: viewport,
      executablePath,
      headless: true as const,
    }
    // Serialize the exec so two parallel passes can't spawn the binary while
    // it's mid-write; retry briefly if ETXTBSY still slips through.
    return await serializeLaunch(async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await puppeteer.launch(launchArgs)
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e)
          if (m.includes('ETXTBSY') && attempt < 2) {
            await sleep(200 * (attempt + 1))
            continue
          }
          throw e
        }
      }
    })
  } catch (err) {
    serverlessError = err
    // A failed/rejected extraction must not poison every future launch — reset
    // the cache so the next audit re-extracts.
    cachedExecPath = null
    // On Vercel this is the ONLY viable path — make the real reason loud.
    if (process.env.VERCEL) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[browser-launcher] @sparticuz/chromium launch FAILED on Vercel: ${msg}`)
      Sentry.captureException(err, {
        tags: { area: 'browser-launcher', runtime: 'vercel' },
        extra: { hint: 'Check outputFileTracingIncludes ships @sparticuz/chromium/bin for this function' },
      })
    }
  }

  // 2) Local dev — common Chrome/Chromium install paths
  for (const p of LOCAL_CHROME_PATHS) {
    try {
      const { accessSync } = await import('fs')
      accessSync(p)
      return await puppeteer.launch({
        executablePath: p,
        headless: true,
        defaultViewport: viewport,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', ...(opts.extraArgs ?? [])],
      })
    } catch {
      continue
    }
  }

  const reason = serverlessError instanceof Error ? serverlessError.message : String(serverlessError)
  throw new Error(`No Chromium/Chrome binary available. Serverless launch error: ${reason}`)
}
