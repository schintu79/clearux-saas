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
 * Permanently delete an audit owned by the current user. Related rows
 * (report, findings, pages, payments, intelligence) are removed via the
 * `ON DELETE CASCADE` foreign keys defined in the initial schema.
 *
 * Auth model:
 *  - User session is required (via createServerSupabase).
 *  - We verify the audit belongs to the user before deleting.
 *  - The actual delete uses the service-role client because RLS has no
 *    DELETE policy on `audits`. This keeps deletion safe without a schema
 *    migration: ownership is enforced in code, then the privileged client
 *    performs the delete + cascade.
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
    const { error: delError } = await service
      .from('audits')
      .delete()
      .eq('id', auditId)
      .eq('user_id', user.id)

    if (delError) {
      console.error('Error deleting audit:', delError)
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
