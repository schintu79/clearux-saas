// ============================================================
// GET /api/audits/intelligence?audit_id=XXX
// Returns Phase 4 Intelligence Layer data for an audit:
//   - Multi-model benchmarks
//   - Industry benchmark position
//   - Predictive recommendations
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { getUserBenchmarkPosition } from '@/lib/audit-engine/industry-benchmark'

export async function GET(req: NextRequest) {
  const auditId = req.nextUrl.searchParams.get('audit_id')
  if (!auditId) {
    return NextResponse.json({ error: 'audit_id required' }, { status: 400 })
  }

  // Auth check
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceSupabase()

  // Verify the user owns this audit
  const { data: audit } = await db
    .from('audits')
    .select('id, user_id, detected_industry, product_url, brand_name')
    .eq('id', auditId)
    .single()

  if (!audit || (audit as any).user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Derive brand domain for snapshot filtering
  const auditProductUrl = (audit as any).product_url as string | null
  const auditBrandName = (audit as any).brand_name as string | null
  let brandDomain: string | null = null
  if (auditProductUrl) {
    try { brandDomain = new URL(auditProductUrl.startsWith('http') ? auditProductUrl : `https://${auditProductUrl}`).hostname.replace(/^www\./, '') } catch {}
  }
  if (!brandDomain && auditBrandName) {
    brandDomain = auditBrandName.toLowerCase().replace(/\s+/g, '-')
  }

  // Fetch all intelligence data in parallel
  const [modelProbes, recommendations, report, redditMentions, webMentions, reviewData, promptResults, contentGaps, trendSnapshots] = await Promise.all([
    db.from('multi_model_probes')
      .select('*')
      .eq('audit_id', auditId)
      .order('accuracy_score', { ascending: false }),
    db.from('predictive_recommendations')
      .select('*')
      .eq('audit_id', auditId)
      .order('predicted_impact', { ascending: false }),
    db.from('reports')
      .select('ai_visibility_breakdown, model_benchmarks, overall_score, raw_json, brand_intelligence')
      .eq('audit_id', auditId)
      .single(),
    db.from('reddit_mentions')
      .select('*')
      .eq('audit_id', auditId)
      .order('score', { ascending: false })
      .limit(20),
    db.from('web_mentions')
      .select('*')
      .eq('audit_id', auditId)
      .order('domain_authority', { ascending: false })
      .limit(20),
    db.from('brand_reviews')
      .select('*')
      .eq('audit_id', auditId),
    db.from('prompt_results')
      .select('*')
      .eq('audit_id', auditId)
      .order('executed_at', { ascending: false }),
    db.from('content_gaps')
      .select('*')
      .eq('audit_id', auditId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(20),
    brandDomain
      ? db.from('intelligence_snapshots')
          .select('*')
          .eq('user_id', user.id)
          .eq('brand_domain', brandDomain)
          .order('snapshot_at', { ascending: true })
          .limit(52)
      : db.from('intelligence_snapshots')
          .select('*')
          .eq('user_id', user.id)
          .order('snapshot_at', { ascending: true })
          .limit(52),
  ])

  // Get industry benchmark position — prefer frozen snapshot from report
  // so scores stay stable across audits. Fall back to live computation
  // for older audits that don't have a snapshot yet, and freeze the
  // result so subsequent loads return the same numbers.
  let benchmarkPosition = null
  if (report.data) {
    const rawJson = (report.data as any).raw_json as Record<string, any> | null
    const snapshot = rawJson?._industryBenchmarkSnapshot

    if (snapshot && snapshot.benchmark && typeof snapshot.userScore === 'number') {
      // Use frozen snapshot — same numbers every time
      benchmarkPosition = snapshot
    } else {
      // Fallback: live computation for legacy audits — compute once, then
      // freeze the snapshot into the report so it never fluctuates again.
      const aiVis = (report.data as any).ai_visibility_breakdown as { overall?: number } | null
      const score = aiVis?.overall || (report.data as any).overall_score || 0
      const industry = (audit as any).detected_industry || 'General'

      try {
        benchmarkPosition = await getUserBenchmarkPosition(db, score, industry)
      } catch (err) {
        console.error('[intelligence-api] Benchmark position error:', err)
      }

      // Persist the computed snapshot back to the report so future loads
      // return stable numbers. Only writes when the snapshot was missing
      // and we just computed a usable result.
      if (
        benchmarkPosition &&
        (benchmarkPosition as any).benchmark &&
        typeof (benchmarkPosition as any).userScore === 'number'
      ) {
        try {
          const nextRawJson = { ...(rawJson || {}), _industryBenchmarkSnapshot: benchmarkPosition }
          await db
            .from('reports')
            .update({ raw_json: nextRawJson })
            .eq('audit_id', auditId)
        } catch (err) {
          console.error('[intelligence-api] Snapshot write-back error:', err)
        }
      }
    }
  }

  // Get human perception summary from audit record
  const { data: auditFull } = await db
    .from('audits')
    .select('human_perception_data, sentiment_data')
    .eq('id', auditId)
    .single()

  return NextResponse.json({
    modelProbes: modelProbes.data || [],
    recommendations: recommendations.data || [],
    benchmarkPosition,
    modelBenchmarks: (report.data as any)?.model_benchmarks || null,
    industry: (audit as any).detected_industry || 'General',
    brandIntelligence: (report.data as any)?.brand_intelligence || null,
    // Tier 2: Human Perception data
    humanPerception: (auditFull as any)?.human_perception_data || null,
    redditMentions: redditMentions.data || [],
    webMentions: webMentions.data || [],
    reviewData: reviewData.data || [],
    promptResults: promptResults.data || [],
    contentGaps: contentGaps.data || [],
    trendSnapshots: trendSnapshots.data || [],
  })
}
