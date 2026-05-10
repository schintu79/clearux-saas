// ============================================================
// ClearUX API — POST /api/audits/[id]/retry
// Retry a failed audit that was already paid for.
// Resets status to payment_received and re-triggers processing.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { inngest } from '@/lib/inngest/client'

export const maxDuration = 300

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: auditId } = await params

    // Authenticate user
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServiceSupabase()

    // Fetch audit
    const { data: audit, error: auditError } = await db
      .from('audits')
      .select('*')
      .eq('id', auditId)
      .single()

    if (auditError || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    if ((audit as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const retriableStatuses = ['failed', 'crawling', 'analysing', 'generating_report']
    const auditStatus = (audit as any).status as string
    if (!retriableStatuses.includes(auditStatus)) {
      return NextResponse.json(
        { error: 'Only failed or stuck audits can be retried' },
        { status: 400 },
      )
    }

    // Verify there's a payment for this audit
    const { data: payment } = await db
      .from('payments')
      .select('id')
      .eq('audit_id', auditId)
      .eq('status', 'succeeded')
      .maybeSingle()

    if (!payment) {
      return NextResponse.json(
        { error: 'No payment found for this audit' },
        { status: 400 },
      )
    }

    // Reset audit status
    await db
      .from('audits')
      .update({
        status: 'payment_received',
        crawl_error: null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', auditId)

    // Clean up old findings, report, and snapshots so they get regenerated
    await db.from('audit_findings').delete().eq('audit_id', auditId)
    await db.from('reports').delete().eq('audit_id', auditId)
    await db.from('audit_pages').delete().eq('audit_id', auditId)
    await db.from('brand_audit_file_snapshots').delete().eq('audit_id', auditId)

    // Log retry
    await db.from('audit_logs').insert({
      audit_id: auditId,
      event: 'audit_retry',
      status: 'info',
      message: 'User triggered retry on failed audit',
      metadata: {},
    } as any)

    // Trigger audit processing via after() — keeps function alive after response
    const ar = audit as any
    const auditType = ar.audit_type || (ar.brand_identity_id && !ar.product_url ? 'brand_identity' : 'website')
    const eventName = auditType === 'brand_identity' ? 'brand-audit/process' : 'audit/process'
    console.log(`[retry] Scheduling ${auditType} audit ${auditId} via after()`)
    after(async () => {
      try {
        if (auditType === 'website') {
          const { processAudit } = await import('@/lib/audit-engine')
          await processAudit(auditId)
        } else if (auditType === 'brand_identity') {
          const { processBrandAudit } = await import('@/lib/audit-engine/brand-processor')
          await processBrandAudit(auditId)
        }
      } catch (err) {
        console.error(`[retry] ${auditType} audit ${auditId} failed:`, err)
      }
    })
    inngest.send({ name: eventName, data: { auditId } }).catch(() => {})

    return NextResponse.json({
      status: 'payment_received',
      message: 'Audit retry started',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error in POST /api/audits/[id]/retry:', message)
    return NextResponse.json(
      { error: 'Failed to retry audit' },
      { status: 500 },
    )
  }
}
