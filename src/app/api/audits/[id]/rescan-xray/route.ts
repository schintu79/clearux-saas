// ============================================================
// ClearUX API — POST /api/audits/:id/rescan-xray
// Re-run ONLY the multi-model perception probe layer (AI X-Ray)
// against the existing crawled pages for this audit. Does NOT
// re-crawl, re-score, or re-trigger the full audit pipeline.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { runMultiModelBenchmark } from '@/lib/audit-engine/pipeline/multi-model-probe'
import type { SiteGroundTruth } from '@/lib/audit-engine/pipeline/llm-probe'

type AuditPageRow = {
  url: string
  title: string | null
  meta_description: string | null
  content_text: string | null
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: auditId } = await params

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceSupabase()

  const { data: audit } = await db
    .from('audits')
    .select('id, user_id, product_url, status')
    .eq('id', auditId)
    .single()

  if (!audit || (audit as any).user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const productUrl = (audit as any).product_url as string | null
  if (!productUrl) {
    return NextResponse.json({ error: 'Audit has no product URL' }, { status: 400 })
  }

  let domain = ''
  try { domain = new URL(productUrl).hostname.replace(/^www\./, '') } catch {}
  if (!domain) {
    return NextResponse.json({ error: 'Invalid product URL on audit' }, { status: 400 })
  }

  // ── Cooldown: return cached results if last scan was < 6 hours ago ──
  // LLM probes are inherently non-deterministic (search-augmented models
  // like Perplexity fetch live results, grading has natural variance).
  // Re-probing the same site within hours produces noisy score swings
  // that look like bugs. Instead, return the stored data and tell the
  // user when the next scan will be available.
  const COOLDOWN_HOURS = 6
  const { data: existingProbes } = await db
    .from('multi_model_probes')
    .select('model_id, model_label, accuracy_score, status, error_message, created_at')
    .eq('audit_id', auditId)
    .order('created_at', { ascending: false })
    .limit(4)

  if (existingProbes && existingProbes.length > 0) {
    const latestCreated = new Date((existingProbes as any[])[0].created_at)
    const hoursSinceLast = (Date.now() - latestCreated.getTime()) / (1000 * 60 * 60)

    if (hoursSinceLast < COOLDOWN_HOURS) {
      const cached = existingProbes as any[]
      const measured = cached.filter((b) => b.status === 'measured')
      const avgAccuracy = measured.length > 0
        ? Math.round(measured.reduce((s: number, b: any) => s + (b.accuracy_score ?? 0), 0) / measured.length)
        : 0
      const nextScanAt = new Date(latestCreated.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000)

      return NextResponse.json({
        ok: true,
        cached: true,
        lastScannedAt: latestCreated.toISOString(),
        nextScanAvailableAt: nextScanAt.toISOString(),
        cooldownHours: COOLDOWN_HOURS,
        averageAccuracy: avgAccuracy,
        bestModel: measured.sort((a: any, b: any) => (b.accuracy_score ?? 0) - (a.accuracy_score ?? 0))[0]?.model_id || 'claude',
        modelsScored: measured.length,
        providers: cached.map((b: any) => ({
          modelId: b.model_id,
          modelLabel: b.model_label,
          status: b.status,
          accuracyScore: b.status === 'measured' ? b.accuracy_score : null,
          errorMessage: b.error_message,
        })),
        skippedProviders: cached.filter((b: any) => b.status === 'skipped').map((b: any) => b.model_id),
        erroredProviders: cached.filter((b: any) => b.status === 'error').map((b: any) => ({
          modelId: b.model_id,
          errorMessage: b.error_message,
        })),
      })
    }
  }

  // ── No cached data or cooldown expired — run fresh probes ──

  const { data: pages } = await db
    .from('audit_pages')
    .select('url, title, meta_description, content_text')
    .eq('audit_id', auditId)

  const rows = ((pages || []) as AuditPageRow[]).filter(p => !!p.url)
  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'No crawled pages for this audit yet — run a full audit first.' },
      { status: 409 },
    )
  }

  const first = rows[0]
  const fullContent = rows
    .map(p => [
      `URL: ${p.url}`,
      p.title ? `Title: ${p.title}` : null,
      p.meta_description ? `Meta Description: ${p.meta_description}` : null,
      p.content_text ? `Content:\n${p.content_text}` : null,
    ].filter(Boolean).join('\n'))
    .join('\n---\n')

  const siteName = first.title?.split('|')[0]?.split('-')[0]?.trim() || null
  const groundTruth: SiteGroundTruth = {
    siteName,
    siteDescription: first.meta_description || null,
    pricingText: null,
    offeringText: (first.content_text || '').substring(0, 2000),
    fullContent: fullContent.substring(0, 6000),
    pages: rows.map(p => ({ url: p.url, title: p.title })),
  }

  let comparison
  try {
    comparison = await runMultiModelBenchmark(domain, groundTruth)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Probe failed: ${msg}` }, { status: 502 })
  }

  // Replace existing probe rows for this audit so the latest scan wins.
  await db.from('multi_model_probes').delete().eq('audit_id', auditId)

  for (const b of comparison.benchmarks) {
    await db.from('multi_model_probes').insert({
      audit_id: auditId,
      model_id: b.modelId,
      model_label: b.modelLabel,
      accuracy_score: b.accuracyScore,
      accurate_count: b.accurateCount,
      partial_count: b.partialCount,
      inaccurate_count: b.inaccurateCount,
      hallucinated_count: b.hallucinatedCount,
      no_data_count: b.noDataCount,
      total_questions: b.totalQuestions,
      results_json: b.results as any,
      status: b.status,
      error_message: b.errorMessage,
    } as any)
  }

  const measured = comparison.benchmarks.filter((b) => b.status === 'measured')
  const skipped = comparison.benchmarks.filter((b) => b.status === 'skipped')
  const errored = comparison.benchmarks.filter((b) => b.status === 'error')

  return NextResponse.json({
    ok: true,
    cached: false,
    averageAccuracy: comparison.averageAccuracy,
    bestModel: comparison.bestModel,
    modelsScored: measured.length,
    providers: comparison.benchmarks.map((b) => ({
      modelId: b.modelId,
      modelLabel: b.modelLabel,
      status: b.status,
      accuracyScore: b.status === 'measured' ? b.accuracyScore : null,
      errorMessage: b.errorMessage,
    })),
    skippedProviders: skipped.map((b) => b.modelId),
    erroredProviders: errored.map((b) => ({
      modelId: b.modelId,
      errorMessage: b.errorMessage,
    })),
  })
}
