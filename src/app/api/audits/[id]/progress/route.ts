import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

/**
 * GET /api/audits/[id]/progress
 *
 * Lightweight polling endpoint for progressive audit loading.
 * Returns the current stage, progress %, and available partial results
 * so the frontend can populate the dashboard incrementally.
 *
 * Designed for 2-3s polling intervals during audit processing.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: auditId } = await params

  const userSupabase = await createServerSupabase()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceSupabase()

  // Fetch audit status + stage + available data indicators
  const { data: audit, error } = await db
    .from('audits')
    .select(`
      id, status, progress_percent, audit_stage, updated_at,
      pages_crawled, crawl_summary, speed_data, speed_tested_at,
      human_perception_data, sentiment_data, detected_industry
    `)
    .eq('id', auditId)
    .single()

  if (error || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Verify ownership
  const { data: ownerCheck } = await db
    .from('audits')
    .select('user_id')
    .eq('id', auditId)
    .single()

  if ((ownerCheck as any)?.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const a = audit as any

  // Count findings available so far
  const { count: findingsCount } = await db
    .from('audit_findings')
    .select('id', { count: 'exact', head: true })
    .eq('audit_id', auditId)

  // Check if report exists
  const { data: report } = await db
    .from('reports')
    .select('overall_score, total_issues')
    .eq('audit_id', auditId)
    .single()

  // Build stage completion map
  const stages = {
    preflight: true, // Always done if we're past it
    crawling: (a.pages_crawled ?? 0) > 0,
    checking: !!(a.speed_data || a.audit_stage === 'probing' || a.audit_stage === 'analysing' || a.audit_stage === 'reporting' || a.audit_stage === 'enriching' || a.audit_stage === 'complete'),
    probing: !!(a.audit_stage === 'analysing' || a.audit_stage === 'reporting' || a.audit_stage === 'enriching' || a.audit_stage === 'complete'),
    analysing: !!(a.audit_stage === 'reporting' || a.audit_stage === 'enriching' || a.audit_stage === 'complete'),
    reporting: !!(report || a.audit_stage === 'enriching' || a.audit_stage === 'complete'),
    enriching: a.audit_stage === 'complete',
    complete: a.status === 'completed',
  }

  return NextResponse.json({
    status: a.status,
    stage: a.audit_stage || (a.status === 'completed' ? 'complete' : 'preflight'),
    progress: a.progress_percent ?? 0,
    updatedAt: a.updated_at,
    // Available data indicators
    data: {
      pagesCrawled: a.pages_crawled ?? 0,
      hasCrawlSummary: !!a.crawl_summary,
      hasSpeedData: !!a.speed_data,
      findingsCount: findingsCount ?? 0,
      hasReport: !!report,
      overallScore: (report as any)?.overall_score ?? null,
      hasSentimentData: !!a.sentiment_data,
      hasHumanPerception: !!a.human_perception_data,
      hasIndustry: !!a.detected_industry,
    },
    // Stage completion map for UI
    stages,
  })
}
