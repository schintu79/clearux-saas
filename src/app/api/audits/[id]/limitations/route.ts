// ============================================================
// ClearUX API — /api/audits/:id/limitations
// Coverage limitations: list (with evidence), decide (dismiss/promote → memory),
// and re-check (live single-page re-fetch). See AUDIT_PIPELINE_ARCHITECTURE.md.
// ============================================================
// "No empty 'limited' labels." Limitations are derived from the audit's
// captures; the user inspects the evidence, re-checks live, then dismisses or
// promotes to a tracked finding. Decisions are remembered per workspace so the
// same limitation doesn't re-surface on a deeper audit. Owner-auth gated.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { isUpstreamErrorBody } from '@/lib/audit-engine/error-body'
import {
  buildLimitations,
  type CaptureForLimitation,
  type LimitationDecisionRecord,
  type LimitationReason,
} from '@/lib/audit-engine/capture/coverage-limitations'

const VALID_REASONS: LimitationReason[] = ['upstream_error', 'unreachable', 'partial_capture', 'thin_content']

/** Auth + ownership. Returns { user, audit, db } or a NextResponse error. */
async function authorize(auditId: string) {
  const authDb = await createServerSupabase()
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = createServiceSupabase()
  const { data: audit } = await db.from('audits')
    .select('id, user_id, workspace_id, product_url')
    .eq('id', auditId).is('deleted_at', null).single()
  if (!audit) return { error: NextResponse.json({ error: 'Audit not found' }, { status: 404 }) }
  if (audit.user_id !== user.id) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user, audit, db }
}

// ── GET: list coverage limitations (with evidence, workspace memory applied) ──
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: auditId } = await params
    const a = await authorize(auditId)
    if ('error' in a) return a.error
    const { audit, db } = a

    const { data: captures } = await db.from('page_captures')
      .select('page_url, page_status, http_status, fetch_strategy, extracted_text, captured_at')
      .eq('audit_id', auditId)

    let decisions: LimitationDecisionRecord[] = []
    if (audit.workspace_id) {
      const { data: dec } = await db.from('coverage_limitation_decisions')
        .select('page_url, reason, decision, finding_id')
        .eq('workspace_id', audit.workspace_id)
      decisions = (dec as LimitationDecisionRecord[]) || []
    }

    const limitations = buildLimitations((captures as CaptureForLimitation[]) || [], decisions)
    const dismissed = buildLimitations((captures as CaptureForLimitation[]) || [], decisions, { includeDecided: true })
      .filter(l => l.status === 'dismissed').length

    return NextResponse.json({ audit_id: auditId, limitations, dismissed_count: dismissed })
  } catch (err) {
    return NextResponse.json({ error: (err as Error)?.message || 'Failed' }, { status: 500 })
  }
}

// ── POST: decide a limitation (dismiss | promote) or re-check it live ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: auditId } = await params
    const a = await authorize(auditId)
    if ('error' in a) return a.error
    const { user, audit, db } = a

    const body = await req.json().catch(() => ({}))
    const pageUrl: string | undefined = body.page_url
    const reason: LimitationReason | undefined = body.reason
    const action: string | undefined = body.action
    if (!pageUrl || !reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: 'page_url and a valid reason are required' }, { status: 400 })
    }

    // ── Re-check: re-fetch this ONE page live (no full audit) ──
    if (action === 'recheck') {
      try {
        const res = await fetch(pageUrl, { redirect: 'follow', cache: 'no-store' })
        const text = await res.text()
        const stillError = isUpstreamErrorBody(text) || !res.ok
        return NextResponse.json({
          page_url: pageUrl,
          http_status: res.status,
          still_failing: stillError,
          verdict: stillError
            ? `Still failing (HTTP ${res.status}${isUpstreamErrorBody(text) ? ', upstream error body' : ''}).`
            : `Loads fine now (HTTP ${res.status}, ${text.length} chars) — the earlier failure looks transient.`,
        })
      } catch (e) {
        return NextResponse.json({ page_url: pageUrl, still_failing: true, verdict: `Re-check failed to connect: ${(e as Error)?.message}` })
      }
    }

    if (action !== 'dismiss' && action !== 'promote') {
      return NextResponse.json({ error: "action must be 'dismiss', 'promote', or 'recheck'" }, { status: 400 })
    }

    let findingId: string | null = null

    // ── Promote: create a tracked finding (NOT a console-deployable fix — an
    //    upstream error is infra to investigate). ──
    if (action === 'promote') {
      const titleByReason: Record<LimitationReason, string> = {
        upstream_error: `Page returns a server/proxy error: ${pageUrl}`,
        unreachable: `Page could not be reached: ${pageUrl}`,
        partial_capture: `Page only partially loads: ${pageUrl}`,
        thin_content: `Page loads with almost no content: ${pageUrl}`,
      }
      // Insert the finding and read back its DB-generated id. (We do NOT set id
      // ourselves — the insert contract strips it, which previously left the
      // decision pointing at a non-existent finding → FK violation.)
      const { data: inserted, error: findErr } = await db.from('audit_findings').insert({
        audit_id: auditId,
        category_index: null,
        severity: reason === 'upstream_error' || reason === 'unreachable' ? 'high' : 'medium',
        title: titleByReason[reason],
        description: `Promoted from a coverage limitation. The crawler could not analyze this page (${reason.replace('_', ' ')}). Verify the page is reachable and serving real content; if it is genuinely failing, this is an infrastructure issue to investigate.`,
        page_url: pageUrl,
        recommendation: 'Check the page in a browser and your hosting/CDN logs. Resolve the server/proxy error or routing issue, then re-run the audit so the page can be analyzed.',
        detection_source: 'crawler',
        confidence_level: 'deterministic',
        finding_type: 'manual',
        status: 'open',
      }).select('id').single()
      if (findErr || !inserted) {
        return NextResponse.json({ error: `Could not create finding: ${findErr?.message || 'no row returned'}` }, { status: 500 })
      }
      findingId = inserted.id
    }

    // ── Persist the decision (workspace memory) ──
    const { error: upsertErr } = await db.from('coverage_limitation_decisions').upsert({
      workspace_id: audit.workspace_id ?? null,
      user_id: user.id,
      audit_id: auditId,
      page_url: pageUrl,
      reason,
      decision: action === 'promote' ? 'promoted' : 'dismissed',
      finding_id: findingId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,page_url,reason' })
    if (upsertErr) return NextResponse.json({ error: `Could not save decision: ${upsertErr.message}` }, { status: 500 })

    return NextResponse.json({
      ok: true,
      page_url: pageUrl,
      reason,
      decision: action === 'promote' ? 'promoted' : 'dismissed',
      finding_id: findingId,
      note: action === 'promote'
        ? 'Promoted to a tracked finding and remembered for this workspace.'
        : 'Dismissed and remembered — it will not re-surface on future audits of this workspace.',
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error)?.message || 'Failed' }, { status: 500 })
  }
}
