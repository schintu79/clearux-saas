// ============================================================
// ClearUX API — GET /api/reports/[id]
// Fetch a single audit report with findings
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

/**
 * GET /api/reports/[id]
 * Fetch report with all findings
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params

    // Authenticate user
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch report
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select(
        `
        *,
        audit:audits(
          id,
          user_id,
          product_url,
          product_type,
          target_user,
          ux_concern,
          status,
          created_at,
          completed_at
        )
      `,
      )
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 },
      )
    }

    // Verify ownership
    const auditData = (report as any).audit
    if (auditData?.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 },
      )
    }

    // Fetch all findings for the report
    const { data: findings, error: findingsError } = await supabase
      .from('audit_findings')
      .select(
        `
        *,
        checklist_item:checklist_items(
          id,
          title,
          description,
          what_to_check,
          category:checklist_categories(
            id,
            name,
            slug,
            icon
          )
        )
      `,
      )
      .eq('audit_id', auditData.id)
      .order('sort_order', { ascending: true })

    if (findingsError) {
      console.error('Failed to fetch findings:', findingsError)
      return NextResponse.json(
        { error: 'Failed to fetch findings' },
        { status: 500 },
      )
    }

    // Organize findings by severity
    const findingsBySeverity = {
      critical: findings?.filter((f: any) => f.severity === 'critical') || [],
      high: findings?.filter((f: any) => f.severity === 'high') || [],
      medium: findings?.filter((f: any) => f.severity === 'medium') || [],
      low: findings?.filter((f: any) => f.severity === 'low') || [],
    }

    // Organize findings by category
    const findingsByCategory: Record<string, any[]> = {}
    for (const finding of findings || []) {
      const categoryName = (finding as any).checklist_item?.category?.name || 'Uncategorized'
      if (!findingsByCategory[categoryName]) {
        findingsByCategory[categoryName] = []
      }
      findingsByCategory[categoryName].push(finding)
    }

    // Return complete report data
    return NextResponse.json(
      {
        report,
        findings: findings || [],
        findingsBySeverity,
        findingsByCategory,
      },
      { status: 200 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error in GET /api/reports/[id]:', message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
