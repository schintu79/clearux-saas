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

  // Aggregate probe rows by model_id — the DB may have multiple rows
  // per model (one per probe question batch or re-run). Merge into one
  // entry per model with averaged scores and combined results_json.
  const rawProbes = (modelProbes.data || []) as any[]
  const probeMap = new Map<string, any>()
  for (const row of rawProbes) {
    const key = row.model_id as string
    if (!probeMap.has(key)) {
      probeMap.set(key, {
        ...row,
        _accuracyScores: [row.accuracy_score],
        _sentimentScores: row.sentiment_score != null ? [row.sentiment_score] : [],
        _placementScores: row.placement_score != null ? [row.placement_score] : [],
        _sovScores: row.share_of_voice != null ? [row.share_of_voice] : [],
        results_json: Array.isArray(row.results_json) ? [...row.results_json] : [],
        sentiment_themes: Array.isArray(row.sentiment_themes) ? [...row.sentiment_themes] : [],
      })
    } else {
      const existing = probeMap.get(key)!
      existing._accuracyScores.push(row.accuracy_score)
      if (row.sentiment_score != null) existing._sentimentScores.push(row.sentiment_score)
      if (row.placement_score != null) existing._placementScores.push(row.placement_score)
      if (row.share_of_voice != null) existing._sovScores.push(row.share_of_voice)
      if (Array.isArray(row.results_json)) {
        // Deduplicate by question text — multiple probe runs may store the same Q&A
        const seenQuestions = new Set(existing.results_json.map((r: any) => r.question))
        for (const r of row.results_json) {
          if (!seenQuestions.has(r.question)) {
            existing.results_json.push(r)
            seenQuestions.add(r.question)
          }
        }
      }
      if (Array.isArray(row.sentiment_themes)) {
        for (const t of row.sentiment_themes) {
          const dup = existing.sentiment_themes.find((e: any) => e.theme === t.theme)
          if (dup) { dup.count = (dup.count || 0) + (t.count || 1) }
          else existing.sentiment_themes.push({ ...t })
        }
      }
      // Keep the latest created_at and most informative status
      if (row.created_at > existing.created_at) existing.created_at = row.created_at
      if (row.status === 'measured') existing.status = 'measured'
    }
  }
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0

  // Recompute accuracy_score from the DEDUPLICATED results_json using the
  // same formula as buildBenchmark() in multi-model-probe.ts. This ensures
  // the score always reflects the exact answers the UI will display.
  // Formula: (accurate*100 + partial*50 + noData*25) / (total*100) * 100
  const recomputeAccuracy = (results: any[]): number => {
    if (!results || results.length === 0) return 0
    const counts = { accurate: 0, partial: 0, inaccurate: 0, hallucinated: 0, noData: 0 }
    for (const r of results) {
      const a = (r.accuracy || '').toLowerCase().trim()
      if (a === 'accurate') counts.accurate++
      else if (a === 'partial') counts.partial++
      else if (a === 'inaccurate') counts.inaccurate++
      else if (a === 'hallucinated') counts.hallucinated++
      else counts.noData++
    }
    const total = results.length
    return Math.round(((counts.accurate * 100 + counts.partial * 50 + counts.noData * 25) / (total * 100)) * 100)
  }

  const aggregatedProbes = Array.from(probeMap.values()).map(p => {
    // CRITICAL: accuracy_score is recomputed from deduplicated results_json,
    // NOT averaged across DB rows. This is the single source of truth.
    p.accuracy_score = recomputeAccuracy(p.results_json)
    p.sentiment_score = p._sentimentScores.length ? avg(p._sentimentScores) : null
    p.placement_score = p._placementScores.length ? avg(p._placementScores) : null
    p.share_of_voice = p._sovScores.length ? avg(p._sovScores) : null
    delete p._accuracyScores; delete p._sentimentScores; delete p._placementScores; delete p._sovScores
    return p
  }).sort((a, b) => (b.accuracy_score ?? 0) - (a.accuracy_score ?? 0))

  return NextResponse.json({
    modelProbes: aggregatedProbes,
    recommendations: (recommendations.data || []).map((r: any) => ({
      title: r.action || '',
      description: r.evidence || '',
      impact: r.confidence === 'high' ? 'high' : r.confidence === 'medium' ? 'medium' : 'low',
      category: r.category || '',
      deployable: false,
      predictedImpact: r.predicted_impact ?? 0,
    })),
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
