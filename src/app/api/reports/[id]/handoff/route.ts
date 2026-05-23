// ============================================================
// Fixpath API — GET /api/reports/[id]/handoff
// Generate a role-based handoff export for an audit.
// Query params: role (required), format (optional, default summary)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import type { StakeholderRole, AuditFinding, RoleSummaries } from '@/types/database'
import {
  generateHandoffExport,
  type HandoffFormat,
} from '@/lib/pipeline/handoff-formatter'

const VALID_ROLES: StakeholderRole[] = ['executive', 'marketing', 'product_ux', 'engineering']
const VALID_FORMATS: HandoffFormat[] = ['summary', 'implementation', 'copy_fixes', 'task_list']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auditId } = await params

    // Parse query params
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') as StakeholderRole | null
    const format = (searchParams.get('format') || 'summary') as HandoffFormat

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid or missing role parameter. Must be one of: executive, marketing, product_ux, engineering' },
        { status: 400 }
      )
    }

    if (!VALID_FORMATS.includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format parameter. Must be one of: summary, implementation, copy_fixes, task_list' },
        { status: 400 }
      )
    }

    // Authenticate
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch audit
    const { data: audit, error: auditError } = await supabase
      .from('audits')
      .select('id, user_id, product_url, overall_score, created_at, role_summaries')
      .eq('id', auditId)
      .single()

    if (auditError || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    // Verify ownership
    if (audit.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Fetch findings for the specified role
    const { data: findings, error: findingsError } = await supabase
      .from('audit_findings')
      .select('*')
      .eq('audit_id', auditId)
      .contains('owner_roles', [role])
      .is('dismissed', false)
      .order('severity', { ascending: true })

    if (findingsError) {
      return NextResponse.json({ error: 'Failed to fetch findings' }, { status: 500 })
    }

    // Get role summary
    const roleSummaries = audit.role_summaries as RoleSummaries | null
    const roleSummary = roleSummaries?.summaries?.find(s => s.role === role) || null

    // Generate the export
    const siteName = audit.product_url || 'Unknown site'
    const auditDate = new Date(audit.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const markdown = generateHandoffExport({
      siteName,
      auditDate,
      overallScore: audit.overall_score,
      role,
      roleSummary,
      findings: (findings || []) as AuditFinding[],
      format,
    })

    // Return as markdown with download headers
    const filename = `${siteName.replace(/[^a-zA-Z0-9.-]/g, '_')}-${role}-${format}.md`

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Handoff export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
