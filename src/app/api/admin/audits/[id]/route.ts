// ============================================================
// ClearUX Admin API — /api/admin/audits/[id]
// GET → Fetch a single audit with report + findings (admin only)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error
    const { db } = auth
    const { id } = await params

    // Fetch audit
    const { data: audit, error: auditErr } = await db
      .from('audits')
      .select('*')
      .eq('id', id)
      .single()

    if (auditErr || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    // Fetch report
    const { data: report } = await db
      .from('reports')
      .select('*')
      .eq('audit_id', id)
      .single()

    // Fetch findings
    const { data: findings } = await db
      .from('audit_findings')
      .select('*')
      .eq('audit_id', id)
      .order('sort_order')

    // Fetch user profile
    let userProfile = null
    if (audit.user_id) {
      const { data: profile } = await db
        .from('profiles')
        .select('id, email, full_name, plan')
        .eq('id', audit.user_id)
        .single()
      userProfile = profile
    }

    return NextResponse.json({
      audit,
      report: report || null,
      findings: findings || [],
      userProfile,
    })
  } catch (err) {
    console.error('GET /api/admin/audits/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
