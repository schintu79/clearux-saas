// ============================================================
// ClearUX API — /api/account/delete
// DELETE → permanently deletes user account and all data
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function DELETE(request: NextRequest) {
  try {
    // 1. Authenticate — verify the user making the request
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id
    const db = createServiceSupabase()

    // 2. Delete all user data in order (respecting foreign keys)
    // audit_findings → audit_pages → audit_logs → reports → audits → profiles

    // Get all audit IDs for this user
    const { data: audits } = await db
      .from('audits')
      .select('id')
      .eq('user_id', userId)

    const auditIds = (audits || []).map(a => a.id)

    if (auditIds.length > 0) {
      // Delete findings for all audits
      await db
        .from('audit_findings')
        .delete()
        .in('audit_id', auditIds)

      // Delete pages for all audits
      await db
        .from('audit_pages')
        .delete()
        .in('audit_id', auditIds)

      // Delete logs for all audits
      await db
        .from('audit_logs')
        .delete()
        .in('audit_id', auditIds)

      // Delete reports
      await db
        .from('reports')
        .delete()
        .in('audit_id', auditIds)

      // Delete audits
      await db
        .from('audits')
        .delete()
        .eq('user_id', userId)
    }

    // Delete profile
    await db
      .from('profiles')
      .delete()
      .eq('id', userId)

    // 3. Delete the auth user (requires service role)
    const { error: deleteError } = await db.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('[delete-account] auth delete failed:', deleteError.message)
      return NextResponse.json(
        { error: 'Account data deleted but auth removal failed. Please contact support.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'Account permanently deleted' })
  } catch (err) {
    console.error('[delete-account] error:', err)
    return NextResponse.json(
      { error: 'Failed to delete account. Please try again or contact support.' },
      { status: 500 }
    )
  }
}
