// ============================================================
// ClearUX API — GET /api/shared/[token]
//
// Public JSON variant of the /shared/[token] page. No auth: the
// share token itself is the credential. Designed to be safe to
// expose to third-party clients (WordPress plugin, embeds, etc.):
//
//   * Returns ONLY audits whose owner has share_enabled = true.
//   * Strips identifying fields (user_id, free_audit_email,
//     stripe identifiers, raw evidence URLs, owner email, etc.).
//   * Returns a deterministic, versioned envelope so clients can
//     parse defensively.
//
// Revoking the share token (DELETE /api/audits/[id]/share) flips
// share_enabled = false, after which this endpoint returns 404.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SHARED_REPORT_SCHEMA_VERSION = '1'

type SafeAudit = {
  id: string
  status: string
  product_url: string | null
  audit_type: string | null
  language: string | null
  depth_mode: string | null
  selected_modules: string[] | null
  created_at: string
  completed_at: string | null
}

type SafeReport = {
  overall_score: number | null
  ux_score: number | null
  conversion_score: number | null
  mobile_score: number | null
  ai_discoverability_score: number | null
  content_score: number | null
  total_issues: number | null
  executive_summary: string | null
  category_scores: unknown
  top_recommendations: unknown
}

type SafeFinding = {
  id: string
  category: string | null
  severity: string | null
  title: string
  description: string | null
  recommendation: string | null
  estimated_impact: string | null
  status: string | null
  page_url: string | null
  sort_order: number | null
}

type SafePage = {
  id: string
  url: string
  status_code: number | null
  load_time_ms: number | null
  mobile_friendly: boolean | null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params

    if (!token || typeof token !== 'string' || token.length < 16) {
      return NextResponse.json({ error: 'Invalid share token' }, { status: 400 })
    }

    const db = createServiceSupabase()

    const { data: auditRow, error: auditErr } = await db
      .from('audits')
      .select(
        'id, status, product_url, audit_type, language, depth_mode, ' +
          'selected_modules, created_at, completed_at, share_enabled',
      )
      .eq('share_token', token)
      .single()

    if (auditErr || !auditRow || !(auditRow as any).share_enabled) {
      return NextResponse.json(
        { error: 'This shared report link is invalid or has been revoked.' },
        { status: 404 },
      )
    }

    const a = auditRow as any
    const safeAudit: SafeAudit = {
      id: a.id,
      status: a.status,
      product_url: a.product_url ?? null,
      audit_type: a.audit_type ?? null,
      language: a.language ?? null,
      depth_mode: a.depth_mode ?? null,
      selected_modules: Array.isArray(a.selected_modules) ? a.selected_modules : null,
      created_at: a.created_at,
      completed_at: a.completed_at ?? null,
    }

    // If the audit isn't done yet, return the safe envelope with no
    // report payload — clients can poll until status === 'completed'.
    if (safeAudit.status !== 'completed') {
      return NextResponse.json(
        {
          schema_version: SHARED_REPORT_SCHEMA_VERSION,
          audit: safeAudit,
          report: null,
          findings: [],
          pages: [],
        },
        { status: 200 },
      )
    }

    const [reportRes, findingsRes, pagesRes] = await Promise.all([
      db
        .from('reports')
        .select(
          'overall_score, ux_score, conversion_score, mobile_score, ' +
            'ai_discoverability_score, content_score, total_issues, ' +
            'executive_summary, raw_json',
        )
        .eq('audit_id', safeAudit.id)
        .maybeSingle(),
      db
        .from('audit_findings')
        .select(
          'id, category, severity, title, description, recommendation, ' +
            'estimated_impact, status, page_url, sort_order',
        )
        .eq('audit_id', safeAudit.id)
        .order('sort_order', { ascending: true }),
      db
        .from('audit_pages')
        .select('id, url, status_code, load_time_ms, mobile_friendly')
        .eq('audit_id', safeAudit.id),
    ])

    const r = (reportRes.data as any) || null
    const rawJson = r?.raw_json || {}
    const safeReport: SafeReport | null = r
      ? {
          overall_score: r.overall_score ?? null,
          ux_score: r.ux_score ?? null,
          conversion_score: r.conversion_score ?? null,
          mobile_score: r.mobile_score ?? null,
          ai_discoverability_score: r.ai_discoverability_score ?? null,
          content_score: r.content_score ?? null,
          total_issues: r.total_issues ?? null,
          executive_summary: r.executive_summary ?? null,
          // raw_json contains useful structured fields the page already
          // depends on (categoryScores, topRecommendations). We expose
          // them under stable keys instead of leaking the whole blob —
          // raw_json sometimes carries internal prompts/debug data.
          category_scores: rawJson.categoryScores ?? null,
          top_recommendations:
            rawJson.topRecommendations ??
            (rawJson.keyRecommendation ? [rawJson.keyRecommendation] : null),
        }
      : null

    const findings: SafeFinding[] = ((findingsRes.data as any[]) || []).map((f) => ({
      id: f.id,
      category: f.category ?? null,
      severity: f.severity ?? null,
      title: f.title,
      description: f.description ?? null,
      recommendation: f.recommendation ?? null,
      estimated_impact: f.estimated_impact ?? null,
      status: f.status ?? null,
      page_url: f.page_url ?? null,
      sort_order: f.sort_order ?? null,
    }))

    const pages: SafePage[] = ((pagesRes.data as any[]) || []).map((p) => ({
      id: p.id,
      url: p.url,
      status_code: p.status_code ?? null,
      load_time_ms: p.load_time_ms ?? null,
      mobile_friendly: p.mobile_friendly ?? null,
    }))

    return NextResponse.json(
      {
        schema_version: SHARED_REPORT_SCHEMA_VERSION,
        audit: safeAudit,
        report: safeReport,
        findings,
        pages,
      },
      {
        status: 200,
        // Allow consumers (WordPress plugin, embeds) to fetch this
        // cross-origin. The token in the URL is the only credential
        // required, so CORS doesn't introduce a new exposure.
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Cache-Control': 'public, max-age=30, s-maxage=30',
        },
      },
    )
  } catch (err) {
    console.error('GET /api/shared/[token] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
    },
  })
}
