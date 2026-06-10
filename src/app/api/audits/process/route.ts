// ============================================================
// ClearUX API — POST /api/audits/process
// Manually trigger audit processing (dev/testing only)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { inngest } from '@/lib/inngest/client'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get audit_id from body
    const body = await request.json()
    const { audit_id } = body

    if (!audit_id) {
      return NextResponse.json({ error: 'audit_id is required' }, { status: 400 })
    }

    // Verify audit belongs to user and is in processable state
    const { data: audit, error: auditError } = await supabase
      .from('audits')
      .select('*')
      .eq('id', audit_id)
      .is('deleted_at', null)
      .single()

    if (auditError || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    if ((audit as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const status = (audit as any).status
    if (!['payment_received', 'failed'].includes(status)) {
      return NextResponse.json(
        { error: `Cannot process audit with status: ${status}. Must be payment_received or failed.` },
        { status: 400 },
      )
    }

    // ── Workspace coherence preflight ─────────────────────────
    // Abort if the audit's workspace is archived/deleted or if
    // linked brand identity is soft-deleted.
    const wsId = (audit as any).workspace_id
    if (wsId) {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('status')
        .eq('id', wsId)
        .single()

      if (!ws || ws.status !== 'active') {
        return NextResponse.json(
          { error: 'Cannot process audit — workspace is archived or deleted' },
          { status: 409 },
        )
      }
    }

    const brandId = (audit as any).brand_identity_id
    if (brandId) {
      const { data: brand } = await supabase
        .from('brand_identities')
        .select('id, deleted_at')
        .eq('id', brandId)
        .single()

      if (!brand || brand.deleted_at) {
        return NextResponse.json(
          { error: 'Cannot process audit — linked brand identity is deleted' },
          { status: 409 },
        )
      }
    }

    // Dispatch to Inngest only — no direct execution to prevent race conditions
    const a = audit as any
    const auditType = a.audit_type || (a.brand_identity_id && !a.product_url ? 'brand_identity' : 'website')
    const eventName = auditType === 'brand_identity' ? 'brand-audit/process' : 'audit/process'
    console.log(`[process] Dispatching ${auditType} audit ${audit_id} to Inngest`)
    // MUST await — unawaited send() is dropped when the Vercel lambda
    // freezes after the response returns (audits stuck at payment_received).
    try {
      await inngest.send({ name: eventName, data: { auditId: audit_id } })
    } catch (err) {
      console.error(`[process] Failed to send Inngest event for audit ${audit_id}:`, err)
      return NextResponse.json(
        { error: 'Audit created but the processing job could not be dispatched. Please retry from the audit page.' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { message: 'Audit processing started', audit_id },
      { status: 200 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error in POST /api/audits/process:', message)
    return NextResponse.json(
      { error: 'Failed to start audit processing' },
      { status: 500 },
    )
  }
}
