// ============================================================
// ClearUX API — GET /api/audits/diff?current=ID&previous=ID
// Returns structured diff between two audits of the same domain
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { computeAuditDiff } from '@/lib/audit-engine/audit-diff'
import type { AuditFinding, Report } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const currentId = request.nextUrl.searchParams.get('current')
    const previousId = request.nextUrl.searchParams.get('previous')
    if (!currentId || !previousId) {
      return NextResponse.json({ error: 'current and previous audit IDs required' }, { status: 400 })
    }

    const db = createServiceSupabase()

    // Fetch both audits + reports + findings in parallel
    const [currentAudit, previousAudit, currentReport, previousReport, currentFindings, previousFindings] = await Promise.all([
      db.from('audits').select('id, user_id, product_url, status').eq('id', currentId).is('deleted_at', null).single(),
      db.from('audits').select('id, user_id, product_url, status').eq('id', previousId).is('deleted_at', null).single(),
      db.from('reports').select('*').eq('audit_id', currentId).single(),
      db.from('reports').select('*').eq('audit_id', previousId).single(),
      db.from('audit_findings').select('*').eq('audit_id', currentId).order('sort_order'),
      db.from('audit_findings').select('*').eq('audit_id', previousId).order('sort_order'),
    ])

    // Validate ownership
    if (!currentAudit.data || !previousAudit.data) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }
    if (currentAudit.data.user_id !== user.id || previousAudit.data.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (!currentReport.data || !previousReport.data) {
      return NextResponse.json({ error: 'Both audits must be completed with reports' }, { status: 400 })
    }

    const diff = computeAuditDiff(
      currentReport.data as unknown as Report,
      previousReport.data as unknown as Report,
      (currentFindings.data || []) as unknown as AuditFinding[],
      (previousFindings.data || []) as unknown as AuditFinding[],
    )

    return NextResponse.json({
      currentAuditId: currentId,
      previousAuditId: previousId,
      currentDate: currentAudit.data.status === 'completed' ? currentAudit.data : null,
      ...diff,
    })
  } catch (err) {
    console.error('GET /api/audits/diff error:', err)
    return NextResponse.json({ error: 'Failed to compute diff' }, { status: 500 })
  }
}
