// ============================================================
// POST /api/audits/intelligence/rescan
// Body: { audit_id: string }
//
// Re-runs ONLY the multi-model AI X-Ray probe layer for an audit
// the caller owns. Does not touch crawl/findings/scores. Rebuilds
// SiteGroundTruth from existing audit_pages content, calls
// runMultiModelBenchmark(), and replaces rows in multi_model_probes
// for that audit.
//
// Auth: authenticated user must own the audit.
// Required env: ANTHROPIC_API_KEY (always), OPENAI_API_KEY +
// GOOGLE_AI_API_KEY (optional — probe falls back to "skipped" if absent).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { runMultiModelBenchmark } from '@/lib/audit-engine/pipeline/multi-model-probe'
import type { SiteGroundTruth } from '@/lib/audit-engine/pipeline/llm-probe'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  let body: { audit_id?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const auditId = body.audit_id
  if (!auditId) {
    return NextResponse.json({ error: 'audit_id required' }, { status: 400 })
  }

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceSupabase()

  const { data: audit } = await db
    .from('audits')
    .select('id, user_id, product_url')
    .eq('id', auditId)
    .single()

  if (!audit || (audit as any).user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const productUrl = (audit as any).product_url as string | null
  if (!productUrl) {
    return NextResponse.json({ error: 'Audit has no product_url' }, { status: 400 })
  }

  let domain = ''
  try {
    domain = new URL(productUrl).hostname.replace(/^www\./, '')
  } catch {
    return NextResponse.json({ error: 'Invalid product_url' }, { status: 400 })
  }

  // Rebuild ground truth from previously crawled audit_pages so the
  // grader has real site facts (we do NOT recrawl on rescan).
  const { data: pageRows } = await db
    .from('audit_pages')
    .select('url, title, meta_description, content_text')
    .eq('audit_id', auditId)
    .limit(20)

  const pages = (pageRows || []) as Array<{
    url: string
    title: string | null
    meta_description: string | null
    content_text: string | null
  }>

  if (pages.length === 0) {
    return NextResponse.json({
      error: 'No crawled pages found for this audit — run a full audit first.',
    }, { status: 409 })
  }

  const firstPage = pages[0]
  const siteName = firstPage.title?.split('|')[0]?.split('-')[0]?.trim() || null
  const siteDescription = firstPage.meta_description || null
  const firstPageContent = (firstPage.content_text || '').substring(0, 2000)
  const fullContent = pages
    .map(p => `URL: ${p.url}\nTitle: ${p.title || ''}\nContent:\n${p.content_text || ''}`)
    .join('\n---\n')
    .substring(0, 6000)
  const allContentLower = fullContent.toLowerCase()
  let pricingText: string | null = null
  const pricingIdx = allContentLower.indexOf('pricing')
  if (pricingIdx >= 0) {
    pricingText = fullContent.substring(pricingIdx, pricingIdx + 1500)
  }

  const groundTruth: SiteGroundTruth = {
    siteName,
    siteDescription,
    pricingText,
    offeringText: firstPageContent,
    fullContent,
    pages: pages.map(p => ({ url: p.url, title: p.title })),
  }

  let comparison
  try {
    comparison = await runMultiModelBenchmark(domain, groundTruth)
  } catch (err) {
    console.error('[rescan-xray] benchmark failed', err)
    return NextResponse.json({
      error: 'Re-scan failed',
      detail: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }

  // Replace previous rows for this audit
  await db.from('multi_model_probes').delete().eq('audit_id', auditId)

  const insertRows = comparison.benchmarks.map(b => ({
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
  }))

  if (insertRows.length > 0) {
    await db.from('multi_model_probes').insert(insertRows as any)
  }

  // Re-read to return canonical shape that matches GET /api/audits/intelligence
  const { data: modelProbes } = await db
    .from('multi_model_probes')
    .select('*')
    .eq('audit_id', auditId)
    .order('accuracy_score', { ascending: false })

  return NextResponse.json({
    ok: true,
    modelProbes: modelProbes || [],
    averageAccuracy: comparison.averageAccuracy,
    insight: comparison.insight,
    scannedAt: new Date().toISOString(),
  })
}
