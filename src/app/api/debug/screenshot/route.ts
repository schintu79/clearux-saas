// ============================================================
// ClearUX — Debug Screenshot Pipeline
// GET /api/debug/screenshot?url=https://example.com
// Tests: env vars → ScreenshotOne API → Supabase upload
// Only accessible by super admin (s.schintu@gmail.com)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  // Auth check — super admin only
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== 's.schintu@gmail.com') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = request.nextUrl.searchParams.get('url') || 'https://example.com'
  const results: Record<string, unknown> = { url, timestamp: new Date().toISOString() }

  // Step 1: Check env vars
  results.env = {
    SCREENSHOTONE_API_KEY: process.env.SCREENSHOTONE_API_KEY
      ? `set (${process.env.SCREENSHOTONE_API_KEY.slice(0, 6)}...${process.env.SCREENSHOTONE_API_KEY.slice(-4)})`
      : 'MISSING',
    SCREENSHOT_INTERNAL_KEY: process.env.SCREENSHOT_INTERNAL_KEY ? 'set' : 'MISSING',
    GOOGLE_PAGESPEED_API_KEY: process.env.GOOGLE_PAGESPEED_API_KEY ? 'set' : 'not set (optional)',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'MISSING',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING',
  }

  // Step 2: Test ScreenshotOne API
  const apiKey = process.env.SCREENSHOTONE_API_KEY
  if (apiKey) {
    try {
      const params = new URLSearchParams({
        access_key: apiKey,
        url,
        viewport_width: '1280',
        viewport_height: '900',
        format: 'png',
        full_page: 'false',
        delay: '2',
        block_ads: 'true',
        block_cookie_banners: 'true',
      })

      const startTime = Date.now()
      const res = await fetch(`https://api.screenshotone.com/take?${params}`, {
        signal: AbortSignal.timeout(30_000),
      })

      const elapsed = Date.now() - startTime

      if (!res.ok) {
        const body = await res.text().catch(() => 'unable to read body')
        results.screenshotone = {
          status: 'FAILED',
          httpStatus: res.status,
          responseBody: body.slice(0, 500),
          elapsed: `${elapsed}ms`,
        }
      } else {
        const arrayBuf = await res.arrayBuffer()
        const buf = Buffer.from(arrayBuf)
        results.screenshotone = {
          status: 'OK',
          httpStatus: 200,
          sizeBytes: buf.length,
          sizeKB: `${(buf.length / 1024).toFixed(1)} KB`,
          elapsed: `${elapsed}ms`,
          contentType: res.headers.get('content-type'),
        }

        // Step 3: Test Supabase storage upload
        try {
          const db = createServiceSupabase()

          // Check if bucket exists
          const { data: buckets, error: bucketsErr } = await db.storage.listBuckets()
          const bucketExists = buckets?.some(b => b.id === 'audit-screenshots')

          results.supabaseBucket = {
            exists: bucketExists,
            error: bucketsErr?.message || null,
            allBuckets: buckets?.map(b => b.id) || [],
          }

          if (bucketExists) {
            const testPath = `debug/test-${Date.now()}.png`
            const { error: uploadErr } = await db.storage
              .from('audit-screenshots')
              .upload(testPath, buf, { contentType: 'image/png', upsert: true })

            if (uploadErr) {
              results.supabaseUpload = { status: 'FAILED', error: uploadErr.message }
            } else {
              const { data: urlData } = db.storage
                .from('audit-screenshots')
                .getPublicUrl(testPath)

              results.supabaseUpload = {
                status: 'OK',
                publicUrl: urlData?.publicUrl,
              }

              // Cleanup test file
              await db.storage.from('audit-screenshots').remove([testPath])
            }
          } else {
            results.supabaseUpload = {
              status: 'SKIPPED',
              reason: 'Bucket does not exist. Run this SQL in Supabase SQL Editor:',
              sql: "INSERT INTO storage.buckets (id, name, public) VALUES ('audit-screenshots', 'audit-screenshots', true) ON CONFLICT (id) DO NOTHING;",
            }
          }
        } catch (err) {
          results.supabaseUpload = {
            status: 'EXCEPTION',
            error: err instanceof Error ? err.message : String(err),
          }
        }
      }
    } catch (err) {
      results.screenshotone = {
        status: 'EXCEPTION',
        error: err instanceof Error ? err.message : String(err),
      }
    }
  } else {
    results.screenshotone = { status: 'SKIPPED', reason: 'SCREENSHOTONE_API_KEY not set' }
  }

  // Step 4: Check recent audits for screenshot data
  try {
    const db = createServiceSupabase()
    const { data: recentPages } = await db
      .from('audit_pages')
      .select('audit_id, url, screenshot_url')
      .order('created_at', { ascending: false })
      .limit(5)

    const { data: recentFindings } = await db
      .from('audit_findings')
      .select('audit_id, title, screenshot_url')
      .not('screenshot_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5)

    results.recentData = {
      pagesWithScreenshots: (recentPages || []).filter((p: any) => p.screenshot_url).length,
      totalRecentPages: (recentPages || []).length,
      recentPages: (recentPages || []).map((p: any) => ({
        audit_id: p.audit_id,
        url: p.url,
        has_screenshot: !!p.screenshot_url,
        screenshot_url: p.screenshot_url?.slice(0, 80),
      })),
      findingsWithScreenshots: (recentFindings || []).length,
    }
  } catch (err) {
    results.recentData = { error: err instanceof Error ? err.message : String(err) }
  }

  // Step 5: Check audit_logs for screenshot-related entries
  try {
    const db = createServiceSupabase()
    const { data: logs } = await db
      .from('audit_logs')
      .select('audit_id, event, status, message, created_at')
      .like('event', '%screenshot%')
      .order('created_at', { ascending: false })
      .limit(10)

    results.screenshotLogs = logs || []
  } catch (err) {
    results.screenshotLogs = { error: err instanceof Error ? err.message : String(err) }
  }

  return NextResponse.json(results, { status: 200 })
}
