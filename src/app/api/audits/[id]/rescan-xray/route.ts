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
    } as any)
  }

  return NextResponse.json({
    ok: true,
    averageAccuracy: comparison.averageAccuracy,
    bestModel: comparison.bestModel,
    modelsScored: comparison.benchmarks.length,
  })
}
