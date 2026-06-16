// ============================================================
// ClearUX API — POST /api/dev/replay-analyze
// Capture→Analyze→Compose, Phase 2b: REPLAY analysis over a stored capture.
// ============================================================
// Re-runs the real category analyzer fed from an immutable PageCapture — with
// NO crawl, render, or screenshot. The QA backbone for killing false-positive
// findings: iterate analysis over a saved capture in seconds instead of paying
// for a full re-audit. Read-only: writes nothing.
//
// Safety:
//   • Gated behind FEATURE_CAPTURE_SHADOW (404 when off).
//   • Requires an authenticated session that OWNS the audit (403 otherwise).
//   • Runs ONE category per call to bound LLM cost.
// See docs/AUDIT_PIPELINE_ARCHITECTURE.md §9.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { getFeatureFlags } from '@/lib/feature-flags'
import { loadCaptureBucket, captureToPageContent } from '@/lib/audit-engine/capture/capture-bucket'
import { analyzeCategory, detectSiteProfile, UX_CATEGORIES, type SiteProfile } from '@/lib/audit-engine/analyzer'

export async function POST(request: NextRequest) {
  try {
    // Dev/QA tool — only available where capture is enabled.
    if (!getFeatureFlags().captureShadow) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const authDb = await createServerSupabase()
    const { data: { user } } = await authDb.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const auditId: string | undefined = body.audit_id || body.auditId
    if (!auditId) return NextResponse.json({ error: 'audit_id required' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = createServiceSupabase()

    // Ownership check — only the audit's owner may replay it.
    const { data: audit, error: auditErr } = await db
      .from('audits')
      .select('id, user_id, product_url, ux_concern, language')
      .eq('id', auditId)
      .is('deleted_at', null)
      .single()
    if (auditErr || !audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    if ((audit as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Load the capture bucket (no crawl) and rebuild the analyzer input.
    const bucket = await loadCaptureBucket(db, auditId)
    if (!bucket.ok) {
      return NextResponse.json({ error: `Failed to load captures: ${bucket.errorMessage}` }, { status: 500 })
    }
    const pageContent = captureToPageContent(bucket.pages)
    if (!pageContent) {
      return NextResponse.json({
        error: 'No analyzable captures for this audit. Was FEATURE_CAPTURE_SHADOW on (and the audit paid) when it ran?',
        capture_rows: bucket.pages.length,
      }, { status: 422 })
    }

    // One category per call (bounds cost). Default to the first UX category.
    const requested: string = body.category || UX_CATEGORIES[0].name
    const category = UX_CATEGORIES.find(c => c.name.toLowerCase() === requested.toLowerCase())?.name || requested

    // Site profile is best-effort context; never block the replay on it.
    let siteProfile: SiteProfile | null = null
    try {
      siteProfile = await detectSiteProfile(pageContent, (audit as any).product_url || '')
    } catch { /* optional */ }

    const findings = await analyzeCategory(
      pageContent,
      category,
      [],
      (audit as any).ux_concern || null,
      (audit as any).language || 'en',
      'deep',
      siteProfile,
    )

    return NextResponse.json({
      audit_id: auditId,
      category,
      capture_pages: bucket.pages.length,
      pages_analyzed: pageContent.split('\n---\n').length,
      candidate_findings: (findings || []).map((f: any) => ({
        title: f.title,
        severity: f.severity,
        page_url: f.pageUrl ?? f.page_url ?? null,
        description: f.description,
        recommendation: f.recommendation,
      })),
      note: 'Replay over stored capture — no crawl performed. Read-only; nothing was written.',
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error)?.message || 'Replay failed' }, { status: 500 })
  }
}
