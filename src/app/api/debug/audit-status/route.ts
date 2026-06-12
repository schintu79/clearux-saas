// ============================================================
// ClearUX — Debug Audit Status
// GET  /api/debug/audit-status?id=xxx — check what happened to a stuck audit
// POST /api/debug/audit-status?id=xxx&action=retry — force retry a stuck audit
// Only accessible by super admin
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { inngest } from '@/lib/inngest/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== 's.schintu@gmail.com')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auditId = request.nextUrl.searchParams.get('id')
  if (!auditId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = createServiceSupabase()

  const [auditRes, logsRes, findingsRes, pagesRes] = await Promise.all([
    db.from('audits').select('id, status, product_url, crawl_error, pages_crawled, created_at, updated_at').eq('id', auditId).is('deleted_at', null).single(),
    db.from('audit_logs').select('event, status, message, created_at').eq('audit_id', auditId).order('created_at', { ascending: false }).limit(20),
    db.from('audit_findings').select('id', { count: 'exact', head: true }).eq('audit_id', auditId),
    db.from('audit_pages').select('id', { count: 'exact', head: true }).eq('audit_id', auditId),
  ])

  const audit = auditRes.data as any
  const stuckMinutes = audit ? Math.round((Date.now() - new Date(audit.updated_at).getTime()) / 60000) : 0

  return NextResponse.json({
    audit: audit ? {
      id: audit.id,
      status: audit.status,
      url: audit.product_url,
      error: audit.crawl_error,
      pages_crawled: audit.pages_crawled,
      created: audit.created_at,
      updated: audit.updated_at,
      stuckMinutes,
      isStuck: stuckMinutes > 10 && ['crawling', 'analysing', 'generating_report', 'payment_received'].includes(audit.status),
    } : null,
    findingsCount: findingsRes.count ?? 0,
    pagesCount: pagesRes.count ?? 0,
    recentLogs: logsRes.data || [],
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== 's.schintu@gmail.com')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auditId = request.nextUrl.searchParams.get('id')
  const action = request.nextUrl.searchParams.get('action')
  if (!auditId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = createServiceSupabase()

  if (action === 'retry') {
    // Reset audit to payment_received and re-trigger Inngest
    await db.from('audits').update({
      status: 'payment_received',
      crawl_error: null,
      updated_at: new Date().toISOString(),
    } as any).eq('id', auditId)

    // Clean up old findings/pages/reports for fresh re-run
    await db.from('audit_findings').delete().eq('audit_id', auditId)
    await db.from('audit_pages').delete().eq('audit_id', auditId)
    await db.from('reports').delete().eq('audit_id', auditId)

    // Re-trigger via Inngest
    await inngest.send({ name: 'audit/process', data: { auditId } })

    const { error: uncheckedInsertErr1 } = await db.from('audit_logs').insert({
      audit_id: auditId,
      event: 'manual_retry',
      status: 'info',
      message: 'Audit manually retried by admin via debug endpoint',
    } as any)
    if (uncheckedInsertErr1) console.error(`[db] insert failed (audit_logs): ${uncheckedInsertErr1.message}`)

    return NextResponse.json({ success: true, message: 'Audit reset and re-queued' })
  }

  if (action === 'fail') {
    await db.from('audits').update({
      status: 'failed',
      crawl_error: 'Manually marked as failed by admin.',
      updated_at: new Date().toISOString(),
    } as any).eq('id', auditId)

    return NextResponse.json({ success: true, message: 'Audit marked as failed' })
  }

  return NextResponse.json({ error: 'action must be "retry" or "fail"' }, { status: 400 })
}
