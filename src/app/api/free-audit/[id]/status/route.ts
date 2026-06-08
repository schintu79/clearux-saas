// ============================================================
// ClearUX API — GET /api/free-audit/[id]/status
//
// Public status endpoint for anonymous free-preview audits. No
// auth required — but it ONLY returns data for audits where
// is_free_preview = true. Authenticated audits cannot be probed
// by ID through this route.
//
// Returns a small, safe envelope: status, progress (0–100),
// top-level scores, and a tiny teaser of findings. Designed for
// the /preview/[id] page and for WordPress / plugin clients that
// want to poll while the audit runs.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Map pipeline statuses → coarse progress %. The Inngest worker
// already streams these statuses through audit_logs; this mapping
// is intentionally conservative so the bar never moves backwards.
const STATUS_PROGRESS: Record<string, number> = {
  pending_payment: 0,
  payment_received: 10,
  crawling: 30,
  analysing: 60,
  generating_report: 85,
  completed: 100,
  failed: 100,
}

const TEASER_FINDING_LIMIT = 3

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Invalid audit id' }, { status: 400 })
    }

    const db = createServiceSupabase()

    const { data: audit, error: auditErr } = await db
      .from('audits')
      .select(
        'id, status, product_url, is_free_preview, created_at, completed_at, depth_mode',
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (auditErr || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    const a = audit as any
    if (!a.is_free_preview) {
      // Hide the existence of authenticated audits behind a 404.
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    const progress = STATUS_PROGRESS[a.status] ?? 0

    // For in-progress audits, return status + progress only.
    if (a.status !== 'completed') {
      return NextResponse.json(
        {
          audit_id: a.id,
          status: a.status,
          progress,
          product_url: a.product_url,
          created_at: a.created_at,
          completed_at: a.completed_at ?? null,
          report: null,
          teaser_findings: [],
          findings_total: 0,
          locked_findings: 0,
        },
        {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
          },
        },
      )
    }

    const [reportRes, findingsCountRes, teaserRes] = await Promise.all([
      db
        .from('reports')
        .select(
          'overall_score, ux_score, conversion_score, mobile_score, ' +
            'ai_discoverability_score, content_score, total_issues, executive_summary',
        )
        .eq('audit_id', a.id)
        .maybeSingle(),
      db
        .from('audit_findings')
        .select('id', { count: 'exact', head: true })
        .eq('audit_id', a.id),
      db
        .from('audit_findings')
        .select('id, severity, title, category')
        .eq('audit_id', a.id)
        .order('sort_order', { ascending: true })
        .limit(TEASER_FINDING_LIMIT),
    ])

    const r = (reportRes.data as any) || null
    const findingsTotal = findingsCountRes.count ?? 0
    const teaser = ((teaserRes.data as any[]) || []).map((f) => ({
      id: f.id,
      severity: f.severity,
      title: f.title,
      category: f.category,
    }))

    return NextResponse.json(
      {
        audit_id: a.id,
        status: 'completed',
        progress: 100,
        product_url: a.product_url,
        depth_mode: a.depth_mode ?? null,
        created_at: a.created_at,
        completed_at: a.completed_at ?? null,
        report: r
          ? {
              overall_score: r.overall_score,
              ux_score: r.ux_score,
              conversion_score: r.conversion_score,
              mobile_score: r.mobile_score,
              ai_discoverability_score: r.ai_discoverability_score,
              content_score: r.content_score,
              total_issues: r.total_issues,
              // The executive summary is intentionally short and
              // already client-safe; full details require sign-up.
              executive_summary: r.executive_summary,
            }
          : null,
        teaser_findings: teaser,
        findings_total: findingsTotal,
        locked_findings: Math.max(0, findingsTotal - teaser.length),
      },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=15, s-maxage=15',
        },
      },
    )
  } catch (err) {
    console.error('GET /api/free-audit/[id]/status error:', err)
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
