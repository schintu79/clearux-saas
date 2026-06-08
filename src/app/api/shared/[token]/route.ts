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
import { UX_CATEGORIES } from '@/lib/audit-engine/analyzer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SHARED_REPORT_SCHEMA_VERSION = '1'

const ALLOWED_SEVERITIES = new Set(['critical', 'high', 'medium', 'low'])
const ALLOWED_FINDING_STATUS = new Set([
  'open', 'in_progress', 'fixed', 'backlog',
  'confirmed_open', 'likely_fixed', 'poorly_fixed',
])

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

// Map a category_index (0..23) to a stable human-readable category name.
// Returns null for out-of-range or null inputs — callers must accept null.
function categoryNameFromIndex(idx: number | null | undefined): string | null {
  if (idx == null || typeof idx !== 'number') return null
  const cat = (UX_CATEGORIES as Array<{ name: string }>)[idx]
  return cat?.name ?? null
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

// Strict validation for raw_json fallback findings.
// We will NEVER surface raw_json findings unless every guardrail passes:
//   - Concrete title, description, recommendation (non-empty strings)
//   - Allowed severity
//   - At least one of evidence or page_url (so the user can act on it)
// This preserves the product principle: no fake, speculative, or filler
// findings; everything we expose must be evidence-based.
function normalizeRawFinding(raw: unknown, index: number): SafeFinding | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const title = r.title
  const description = r.description ?? r.detail
  const recommendation = r.recommendation ?? r.fix ?? r.suggestion
  const severity = typeof r.severity === 'string' ? r.severity.toLowerCase() : null
  const evidence = r.evidence
  const pageUrl = r.page_url ?? r.pageUrl ?? r.url

  if (!isNonEmptyString(title)) return null
  if (!isNonEmptyString(description)) return null
  if (!isNonEmptyString(recommendation)) return null
  if (!severity || !ALLOWED_SEVERITIES.has(severity)) return null
  // Evidence requirement — at minimum a citation source (evidence text or page URL).
  if (!isNonEmptyString(evidence) && !isNonEmptyString(pageUrl as string)) return null

  const idRaw = r.id
  const id = isNonEmptyString(idRaw) ? idRaw : `raw-${index}`

  const categoryIdx = typeof r.category_index === 'number' ? r.category_index : null
  const category = categoryNameFromIndex(categoryIdx) ?? (isNonEmptyString(r.category) ? (r.category as string) : null)

  const status = isNonEmptyString(r.status) && ALLOWED_FINDING_STATUS.has(r.status) ? r.status : 'open'

  return {
    id,
    category,
    severity,
    title: title.trim(),
    description: (description as string).trim(),
    recommendation: (recommendation as string).trim(),
    estimated_impact: isNonEmptyString(r.estimated_impact) ? (r.estimated_impact as string) : null,
    status,
    page_url: isNonEmptyString(pageUrl as string) ? (pageUrl as string) : null,
    sort_order: typeof r.sort_order === 'number' ? r.sort_order : index,
  }
}

function normalizeRawPage(raw: unknown, index: number): SafePage | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const url = r.url
  if (!isNonEmptyString(url)) return null
  return {
    id: isNonEmptyString(r.id) ? (r.id as string) : `raw-page-${index}`,
    url: (url as string).trim(),
    status_code: typeof r.status_code === 'number' ? r.status_code : null,
    load_time_ms: typeof r.load_time_ms === 'number' ? r.load_time_ms : null,
    mobile_friendly:
      typeof r.is_mobile_friendly === 'boolean'
        ? r.is_mobile_friendly
        : typeof r.mobile_friendly === 'boolean'
        ? (r.mobile_friendly as boolean)
        : null,
  }
}

// Pull a findings array out of raw_json if it exists and survives validation.
// raw_json is written by the audit engine and may carry an array of structured
// findings under one of a few known keys. We accept only entries that include
// concrete title/description/recommendation/severity AND some form of evidence
// (evidence text or page_url) — anything weaker is dropped.
function extractFindingsFromRawJson(rawJson: unknown): SafeFinding[] {
  if (!rawJson || typeof rawJson !== 'object') return []
  const r = rawJson as Record<string, unknown>
  const candidateArrays: unknown[][] = []
  for (const key of ['findings', 'allFindings', 'normalizedFindings']) {
    const v = r[key]
    if (Array.isArray(v)) candidateArrays.push(v)
  }
  const merged = candidateArrays.flat()
  if (merged.length === 0) return []
  const out: SafeFinding[] = []
  merged.forEach((entry, i) => {
    const f = normalizeRawFinding(entry, i)
    if (f) out.push(f)
  })
  return out
}

function extractPagesFromRawJson(rawJson: unknown): SafePage[] {
  if (!rawJson || typeof rawJson !== 'object') return []
  const r = rawJson as Record<string, unknown>
  const candidateArrays: unknown[][] = []
  for (const key of ['pages', 'crawledPages', 'auditPages']) {
    const v = r[key]
    if (Array.isArray(v)) candidateArrays.push(v)
  }
  const merged = candidateArrays.flat()
  if (merged.length === 0) return []
  const out: SafePage[] = []
  merged.forEach((entry, i) => {
    const p = normalizeRawPage(entry, i)
    if (p) out.push(p)
  })
  return out
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
      .is('deleted_at', null)
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
      // NOTE: select must match the real schema. The audit_findings table
      // has `category_index` (smallint) not `category`, and exposes a
      // `status` column added in migration 010. Selecting a non-existent
      // column makes PostgREST return an error and `data` becomes null —
      // which is what was silently producing `findings: []` even when 39
      // rows existed in the table.
      db
        .from('audit_findings')
        .select(
          'id, category_index, severity, title, description, recommendation, ' +
            'estimated_impact, evidence, status, page_url, sort_order',
        )
        .eq('audit_id', safeAudit.id)
        .order('sort_order', { ascending: true }),
      // Same fix here: the column is `is_mobile_friendly`, not `mobile_friendly`.
      db
        .from('audit_pages')
        .select('id, url, status_code, load_time_ms, is_mobile_friendly')
        .eq('audit_id', safeAudit.id),
    ])

    // Surface DB errors so future schema drift fails loudly instead of silently.
    if (findingsRes.error) {
      console.error('[shared API] audit_findings query failed:', findingsRes.error)
    }
    if (pagesRes.error) {
      console.error('[shared API] audit_pages query failed:', pagesRes.error)
    }
    if (reportRes.error) {
      console.error('[shared API] reports query failed:', reportRes.error)
    }

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

    let findings: SafeFinding[] = ((findingsRes.data as any[]) || []).map((f) => ({
      id: f.id,
      category: categoryNameFromIndex(f.category_index),
      severity: f.severity ?? null,
      title: f.title,
      description: f.description ?? null,
      recommendation: f.recommendation ?? null,
      estimated_impact: f.estimated_impact ?? null,
      status: f.status ?? null,
      page_url: f.page_url ?? null,
      sort_order: f.sort_order ?? null,
    }))

    let pages: SafePage[] = ((pagesRes.data as any[]) || []).map((p) => ({
      id: p.id,
      url: p.url,
      status_code: p.status_code ?? null,
      load_time_ms: p.load_time_ms ?? null,
      mobile_friendly: p.is_mobile_friendly ?? null,
    }))

    // Fallback: only if normalized tables are unexpectedly empty (e.g. a
    // legacy audit that never had findings persisted because of an earlier
    // pipeline bug) try to recover validated entries from raw_json. The
    // validator drops anything that does not include concrete title,
    // description, recommendation, severity, AND some form of evidence —
    // so we never surface speculative or placeholder content. raw_json
    // itself is never returned to the client.
    let fallback_used: 'none' | 'findings' | 'pages' | 'findings+pages' = 'none'
    if (findings.length === 0) {
      const rawFindings = extractFindingsFromRawJson(rawJson)
      if (rawFindings.length > 0) {
        findings = rawFindings
        fallback_used = 'findings'
      }
    }
    if (pages.length === 0) {
      const rawPages = extractPagesFromRawJson(rawJson)
      if (rawPages.length > 0) {
        pages = rawPages
        fallback_used = fallback_used === 'findings' ? 'findings+pages' : 'pages'
      }
    }

    return NextResponse.json(
      {
        schema_version: SHARED_REPORT_SCHEMA_VERSION,
        audit: safeAudit,
        report: safeReport,
        findings,
        pages,
        // Debug-friendly counts — useful for the WordPress plugin and
        // anyone integrating, no PII leakage.
        meta: {
          finding_count: findings.length,
          page_count: pages.length,
          fallback_used,
        },
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
