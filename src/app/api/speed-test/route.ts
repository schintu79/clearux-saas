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
    // Ensure the URL has a protocol
    const testUrl = productUrl.startsWith('http') ? productUrl : `https://${productUrl}`
    console.log(`[speed-test] Running for: ${testUrl}`)

    const speedData = await runFullSpeedTest(testUrl)

    // If both strategies failed, return an error instead of empty data
    if (!speedData.mobile && !speedData.desktop) {
      const hasKey = !!(process.env.GOOGLE_PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY)
      return NextResponse.json(
        {
          error: hasKey
            ? `Google PageSpeed could not analyze "${testUrl}". The site may be unreachable from Google's servers, or the URL may be invalid. Make sure it's a publicly accessible URL.`
            : `Google PageSpeed API key is not configured. Add GOOGLE_PAGESPEED_API_KEY to your .env.local file. Without a key, requests are heavily rate-limited and may fail.`,
          url_tested: testUrl,
          has_api_key: hasKey,
        },
        { status: 502 },
      )
    }

    // Convert to DB summary — includes all 4 category scores, FCP, and screenshot
    const mapResult = (r: typeof speedData.mobile) => r ? {
      score: r.score,
      categories: r.categories,
      strategy: r.strategy,
      metrics: r.metrics,
      issueCount: r.diagnostics.length,
      finalUrl: r.finalUrl,
      screenshotUrl: r.screenshotUrl,
      testedAt: r.testedAt,
    } : null

    const speedSummary: SpeedDataSummary = {
      mobile: mapResult(speedData.mobile),
      desktop: mapResult(speedData.desktop),
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
