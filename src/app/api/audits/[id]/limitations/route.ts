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
import { buildCommunicationForGenericFinding } from '@/lib/audit-engine/pipeline/communication-layer'
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
      const descByReason: Record<LimitationReason, string> = {
        upstream_error: `During the audit, this page returned a server/proxy error ("upstream connect error") instead of its content, so it could not be analyzed. It may be a persistent outage or a transient blip — re-check confirms which.`,
        unreachable: `During the audit, no content came back for this page at all — it failed to load, timed out, was blocked, or is fully JavaScript-rendered. It could not be analyzed.`,
        partial_capture: `During the audit, only part of this page's content loaded, so its analysis is incomplete.`,
        thin_content: `During the audit, only this page's title loaded — almost none of its body content rendered, so any analysis of its content is unreliable.`,
      }
      const impactByReason: Record<LimitationReason, string> = {
        upstream_error: `If real visitors hit this error, they can't use the page at all. On a key page (pricing, signup, a product page) that is lost conversions and eroded trust, and search engines that see an error can drop the page from results.`,
        unreachable: `If the page doesn't load for visitors or crawlers, it can't convert or be found. On an important page this is severe; verify it loads reliably for real users.`,
        partial_capture: `Content that didn't load can't convince, convert, or be indexed — and you can't see what's missing without inspecting the page directly.`,
        thin_content: `If the main content doesn't render for visitors or crawlers, the page can't convert or rank on its actual content, and AI/search engines may treat it as thin or empty.`,
      }
      const recByReason: Record<LimitationReason, string> = {
        upstream_error: `Open the page in a browser and check your hosting/CDN/proxy logs for the 5xx/upstream error. Resolve the routing or gateway issue, then re-run the audit so the page can be analyzed.`,
        unreachable: `Open the page in a browser. If it loads, the failure was likely transient or bot-blocking — re-run the audit. If it doesn't, fix the load/timeout/blocking issue first.`,
        partial_capture: `Open the page and confirm all sections render. If content is JavaScript-gated or slow, ensure it is server-rendered or loads quickly, then re-run the audit.`,
        thin_content: `Confirm the page's body renders without JavaScript (or quickly with it). If the content is client-only, add server rendering so crawlers and the audit can read it, then re-run the audit.`,
      }
      const title = titleByReason[reason]
      const description = descByReason[reason]
      const estimatedImpact = impactByReason[reason]
      const recommendation = recByReason[reason]
      const severity = reason === 'upstream_error' || reason === 'unreachable' ? 'high' : 'medium'
      // Full communication layer so the finding is first-class (WHY IT MATTERS,
      // What we found, Fix) — same as every analyzer/instrument finding.
      const communication = buildCommunicationForGenericFinding(
        { title, description, recommendation, estimatedImpact, severity } as any,
        null,
      )
      // Insert the finding and read back its DB-generated id. (We do NOT set id
      // ourselves — the insert contract strips it, which previously left the
      // decision pointing at a non-existent finding → FK violation.)
      const { data: inserted, error: findErr } = await db.from('audit_findings').insert({
        audit_id: auditId,
        category_index: null,
        severity,
        title,
        description,
        estimated_impact: estimatedImpact,
        page_url: pageUrl,
        recommendation,
        communication,
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
