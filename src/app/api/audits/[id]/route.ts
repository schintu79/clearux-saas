// ============================================================
// ClearUX API — GET /api/audits/[id]
// Fetch a single audit with report and findings
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

/**
 * GET /api/audits/[id]
 * Fetch audit with report and findings
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Fetch audit
    const { data: audit, error: auditError } = await supabase
      .from('audits')
      .select('*')
      .eq('id', auditId)
      .is('deleted_at', null)
      .single()

    if (auditError || !audit) {
      return NextResponse.json(
        { error: 'Audit not found' },
        { status: 404 },
      )
    }

    // Verify ownership
    if (audit.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 },
      )
    }

    // Fetch report if audit is completed
    let report = null
    if (audit.status === 'completed' || audit.status === 'generating_report') {
      const { data: reportData } = await supabase
        .from('reports')
        .select('*')
        .eq('audit_id', auditId)
        .single()

      report = reportData
    }

    // Fetch findings if available
    let findings = null
    if (audit.status === 'completed' || audit.status === 'analysing' || audit.status === 'generating_report') {
      const { data: findingsData } = await supabase
        .from('audit_findings')
        .select(
          `
          *,
          checklist_item:checklist_items(
            id,
            title,
            description,
            category:checklist_categories(id, name)
          )
        `,
        )
        .eq('audit_id', auditId)
        .order('sort_order', { ascending: true })

      findings = findingsData || []
    }

    // Fetch payment status
    let payment = null
    const { data: paymentData } = await supabase
      .from('payments')
      .select('*')
      .eq('audit_id', auditId)
      .single()

    payment = paymentData

    // Fetch crawled pages
    const { data: pages } = await supabase
      .from('audit_pages')
      .select('*')
      .eq('audit_id', auditId)
      .order('crawled_at', { ascending: true })

    // Return complete audit data
    return NextResponse.json(
      {
        audit,
        report,
        findings,
        payment,
        pages: pages || [],
      },
      { status: 200 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error in GET /api/audits/[id]:', message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/audits/[id]
 * Soft-delete an audit owned by the current user by setting `deleted_at`.
 * The record remains in the database for a 30-day grace period before
 * permanent removal. All dashboard queries filter on deleted_at IS NULL.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: auditId } = await params

    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: audit, error: auditError } = await supabase
      .from('audits')
      .select('id, user_id')
      .eq('id', auditId)
      .single()

    if (auditError || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    if (audit.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const service = createServiceSupabase()

    // Refund the credit or subscription audit that was consumed
    const { data: payment } = await service
      .from('payments')
      .select('stripe_payment_intent_id')
      .eq('audit_id', auditId)
      .single()

    if (payment) {
      const paymentId = (payment as any).stripe_payment_intent_id as string
      if (paymentId.startsWith('credit_')) {
        // Refund 1 credit
        const { data: profile } = await service
          .from('profiles')
          .select('credits')
          .eq('id', user.id)
          .single()
        const currentCredits = (profile as any)?.credits ?? 0
        await service
          .from('profiles')
          .update({ credits: currentCredits + 1, updated_at: new Date().toISOString() } as any)
          .eq('id', user.id)
        console.log(`[audit-delete] Refunded 1 credit to user ${user.id}`)
      } else if (paymentId.startsWith('reaudit_')) {
        // Re-audits for subscribers are free — nothing to refund
      } else if (paymentId.startsWith('free_first_')) {
        // Free first audit — nothing to refund, but allow them to use it again
        // (the free-first check already queries live non-deleted audits)
      } else {
        // Stripe payment — refund 1 subscription audit if the user has an active subscription
        const { data: profile } = await service
          .from('profiles')
          .select('subscription_status, audits_remaining, audits_per_month')
          .eq('id', user.id)
          .single()
        const p = profile as any
        if (p?.subscription_status === 'active' && p?.audits_remaining != null) {
          const maxAudits = p.audits_per_month ?? 1
          const restored = Math.min((p.audits_remaining ?? 0) + 1, maxAudits)
          await service
            .from('profiles')
            .update({ audits_remaining: restored, updated_at: new Date().toISOString() } as any)
            .eq('id', user.id)
          console.log(`[audit-delete] Restored subscription audit for user ${user.id}: ${restored}/${maxAudits}`)
        }
      }
    }

    const { error: delError } = await service
      .from('audits')
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq('id', auditId)
      .eq('user_id', user.id)

    if (delError) {
      console.error('Error soft-deleting audit:', delError)
      return NextResponse.json(
        { error: 'Failed to delete audit' },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error in DELETE /api/audits/[id]:', message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
