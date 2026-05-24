import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase, createServerSupabase } from '@/lib/supabase-server'
import { runFullSpeedTest, generateSpeedFindings } from '@/lib/pagespeed'
import type { SpeedDataSummary } from '@/types/database'

/**
 * POST /api/speed-test
 *
 * Run a PageSpeed Insights test for a specific audit (on-demand).
 * Used when the user clicks "Run speed test" on an audit that has no speed_data yet.
 *
 * Body: { auditId: string }
 */
export async function POST(req: NextRequest) {
  const userSupabase = await createServerSupabase()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { auditId } = body as { auditId?: string }

  if (!auditId) {
    return NextResponse.json({ error: 'auditId is required' }, { status: 400 })
  }

  // Verify the audit exists and belongs to this user
  const db = createServiceSupabase()
  const { data: audit, error: auditErr } = await db
    .from('audits')
    .select('id, product_url, user_id')
    .eq('id', auditId)
    .single()

  if (auditErr || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  if ((audit as any).user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const productUrl = (audit as any).product_url
  if (!productUrl) {
    return NextResponse.json({ error: 'Audit has no product URL' }, { status: 400 })
  }

  try {
    const speedData = await runFullSpeedTest(productUrl)

    // Convert to DB summary
    const speedSummary: SpeedDataSummary = {
      mobile: speedData.mobile ? {
        score: speedData.mobile.score,
        strategy: 'mobile',
        metrics: speedData.mobile.metrics,
        issueCount: speedData.mobile.diagnostics.length,
        finalUrl: speedData.mobile.finalUrl,
        testedAt: speedData.mobile.testedAt,
      } : null,
      desktop: speedData.desktop ? {
        score: speedData.desktop.score,
        strategy: 'desktop',
        metrics: speedData.desktop.metrics,
        issueCount: speedData.desktop.diagnostics.length,
        finalUrl: speedData.desktop.finalUrl,
        testedAt: speedData.desktop.testedAt,
      } : null,
      testedAt: speedData.testedAt,
    }

    // Store on audit
    await db
      .from('audits')
      .update({ speed_data: speedSummary, speed_tested_at: speedData.testedAt } as any)
      .eq('id', auditId)

    // Generate and store findings
    const speedFindings = generateSpeedFindings(speedData)
    let sortOrder = 100
    for (const sf of speedFindings) {
      await db.from('audit_findings').insert({
        audit_id: auditId,
        category_index: 12,
        finding_type: sf.fixableFromConsole ? 'specific' : 'strategic',
        fix_type: null,
        severity: sf.severity,
        title: sf.title,
        description: sf.description,
        evidence: null,
        page_url: productUrl,
        recommendation: sf.recommendation,
        estimated_impact: null,
        target_element: null,
        screenshot_url: null,
        sort_order: sortOrder++,
        detection_source: 'pagespeed_api',
        confidence_level: 'deterministic',
        default_owner: sf.ownerTeam,
        performance_metric_type: sf.metricType,
        owner_team: sf.ownerTeam,
      } as any)
    }

    return NextResponse.json({
      speed_data: speedSummary,
      findings_generated: speedFindings.length,
    })
  } catch (err) {
    console.error('[speed-test] Error:', err)
    return NextResponse.json(
      { error: 'PageSpeed test failed. Please try again.' },
      { status: 500 },
    )
  }
}
