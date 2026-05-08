// ============================================================
// ClearUX API — POST /api/audits/[id]/retry
// Retry a failed audit that was already paid for.
// Resets status to payment_received and re-triggers processing.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { inngest } from '@/lib/inngest/client'

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

    if ((audit as any).status !== 'failed') {
      return NextResponse.json(
        { error: 'Only failed audits can be retried' },
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

    // Clean up old findings and report so they get regenerated
    await db.from('audit_findings').delete().eq('audit_id', auditId)
    await db.from('reports').delete().eq('audit_id', auditId)
    await db.from('audit_pages').delete().eq('audit_id', auditId)

    // Log retry
    await db.from('audit_logs').insert({
      audit_id: auditId,
      event: 'audit_retry',
      status: 'info',
      message: 'User triggered retry on failed audit',
      metadata: {},
    } as any)

    // Re-trigger processing via Inngest (dispatch by audit type)
    const auditType = (audit as any).audit_type || 'website'
    const eventName = auditType === 'brand_identity' ? 'brand-audit/process' : 'audit/process'
    await inngest.send({
      name: eventName,
      data: { auditId },
    })

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
