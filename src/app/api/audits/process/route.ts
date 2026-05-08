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

    // Trigger processing via Inngest (background job)
    // Dispatch to the correct function based on audit type
    const auditType = (audit as any).audit_type || 'website'
    const eventName = auditType === 'brand_identity' ? 'brand-audit/process' : 'audit/process'

    await inngest.send({
      name: eventName,
      data: { auditId: audit_id },
    })

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
