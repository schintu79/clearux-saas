// ============================================================
// ClearUX API — PATCH /api/findings/:id
// Update finding status, or dismiss with reason
// Dismissals automatically create site_notes for future audits
//
// SCORE RECALCULATION:
// Whenever a finding status changes to/from "fixed", we recalculate
// the report score from scratch based on ALL current finding statuses.
// This is the ONLY reliable approach — no fragile delta math.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import {
  recordFindingActionInPatterns,
  recordFindingActionInStats,
} from '@/lib/audit-engine/pipeline'
import { inngest } from '@/lib/inngest/client'
import { getFeatureFlags } from '@/lib/feature-flags'

function normalizeDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch { return url }
}

/** Severity weight — how much an open finding of this severity drags the score down.
 *  Must match pipeline weights in analyzer.ts calculateScoresFromFindings():
 *  critical=18, high=12, medium=6, low=2 (from base 82). */
function severityPenalty(severity: string): number {
  switch (severity) {
    case 'critical': return 18
    case 'high': return 12
    case 'medium': return 6
    case 'low': return 2
    default: return 6
  }
}

/**
 * Full score recalculation from current finding statuses.
 *
 * Approach: start from the ORIGINAL report scores, then calculate
 * how many findings are now fixed vs the original state. Each fixed
 * finding removes its severity penalty from the deficit.
 *
 * Also rebuilds Top Priority Recommendations from the highest-severity
 * still-open findings — no fuzzy matching, just hard data.
 */
async function recalculateFromFindings(
  db: ReturnType<typeof createServiceSupabase>,
  auditId: string,
) {
  try {
    // 1. Fetch report
    const { data: report } = await db
      .from('reports')
      .select('id, overall_score, raw_json')
      .eq('audit_id', auditId)
      .single()

    if (!report) {
      console.error('[recalculate] No report for audit:', auditId)
      return null
    }

    const rawJson = (report as any).raw_json as any
    if (!rawJson?.categoryScores || !Array.isArray(rawJson.categoryScores)) {
      console.error('[recalculate] No categoryScores in report')
      return null
    }

    // 2. Fetch ALL findings for this audit
    const { data: allFindings } = await db
      .from('audit_findings')
      .select('id, title, severity, status, recommendation, dismissed, sort_order')
      .eq('audit_id', auditId)
      .order('sort_order', { ascending: true })

    if (!allFindings) {
      console.error('[recalculate] Could not fetch findings')
      return null
    }

    // 3. Count fixed + dismissed findings and calculate score improvement
    const originalCategoryScores = rawJson.categoryScores as Array<{ name: string; score: number; summary: string }>

    // Get the BASELINE scores — either from the original report generation
    // or the stored originalCategoryScores if we've recalculated before
    const baselineScores: Array<{ name: string; score: number; summary: string }> =
      rawJson._baselineCategoryScores || originalCategoryScores

    const totalFindings = allFindings.length
    const resolvedFindings = allFindings.filter((f: any) => f.status === 'fixed' || f.dismissed)
    const openFindings = allFindings.filter((f: any) => f.status !== 'fixed' && !f.dismissed)

    // Calculate total severity penalty of ALL findings
    const totalPenalty = allFindings.reduce((sum: number, f: any) => sum + severityPenalty(f.severity), 0)
    // Calculate penalty of still-OPEN findings
    const openPenalty = openFindings.reduce((sum: number, f: any) => sum + severityPenalty(f.severity), 0)

    // Improvement ratio: what fraction of the total penalty has been addressed
    const improvementRatio = totalPenalty > 0 ? 1 - (openPenalty / totalPenalty) : 0

    // Apply improvement to each category score (skip unanalyzed = -1)
    const updatedCategoryScores = baselineScores.map(cat => {
      if (cat.score < 0) return cat // preserve unanalyzed sentinel
      const headroom = 100 - cat.score
      // The improvement fills a proportional amount of the headroom
      const gain = Math.round(headroom * improvementRatio)
      return {
        ...cat,
        score: Math.min(100, cat.score + gain),
      }
    })

    // 4. Recalculate overall + pillar scores (skip unanalyzed = -1)
    const analyzedScores = updatedCategoryScores.filter(c => c.score >= 0)
    const newOverallScore = analyzedScores.length > 0
      ? Math.round(analyzedScores.reduce((s, c) => s + c.score, 0) / analyzedScores.length)
      : (report as any).overall_score

    const pillarAvg = (start: number, end: number) => {
      const cats = updatedCategoryScores.slice(start, Math.min(end, updatedCategoryScores.length)).filter(c => c.score >= 0)
      return cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 50
    }

    // 5. Rebuild Top Priority Recommendations from current open findings
    const severityOrder = ['critical', 'high', 'medium', 'low']
    const sortedOpen = [...openFindings].sort((a: any, b: any) =>
      severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
    )

    // Take top 3 unique recommendations from highest-severity open findings
    const newTopRecs: string[] = []
    const seenTitles = new Set<string>()
    for (const f of sortedOpen) {
      if (newTopRecs.length >= 3) break
      const rec = (f as any).recommendation
      const title = ((f as any).title || '').toLowerCase()
      if (!rec || seenTitles.has(title)) continue
      seenTitles.add(title)
      newTopRecs.push(rec)
    }

    // Fallback if no open findings
    if (newTopRecs.length === 0) {
      newTopRecs.push('All identified issues have been addressed. Run a new audit to discover further improvements.')
    }

    // 6. Update report
    const updatedRawJson = {
      ...rawJson,
      // Preserve baseline for future recalculations
      _baselineCategoryScores: rawJson._baselineCategoryScores || originalCategoryScores,
      categoryScores: updatedCategoryScores,
      overallScore: newOverallScore,
      topRecommendations: newTopRecs,
      keyRecommendation: newTopRecs[0],
    }

    const { error: updateErr } = await db
      .from('reports')
      .update({
        overall_score: newOverallScore,
        ux_score: pillarAvg(0, 4),
        conversion_score: pillarAvg(4, 8),
        mobile_score: pillarAvg(8, 12),
        ai_discoverability_score: pillarAvg(12, 16),
        content_score: newOverallScore,
        raw_json: updatedRawJson,
      } as any)
      .eq('id', (report as any).id)

    if (updateErr) {
      console.error('[recalculate] DB update error:', updateErr)
      return null
    }

    const prevScore = (report as any).overall_score
    console.log(`[recalculate] Score: ${prevScore} → ${newOverallScore} | Resolved: ${resolvedFindings.length}/${totalFindings} | Open penalty: ${openPenalty.toFixed(1)}/${totalPenalty.toFixed(1)} | Improvement: ${(improvementRatio * 100).toFixed(1)}%`)

    return {
      previousScore: prevScore,
      newScore: newOverallScore,
      resolvedCount: resolvedFindings.length,
      openCount: openFindings.length,
      totalCount: totalFindings,
    }
  } catch (err) {
    console.error('[recalculate] Error:', err)
    return null
  }
}

/* ── GET — fetch a single finding for the deploy console ─── */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: findingId } = await params
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()

    const { data: finding, error } = await db
      .from('audit_findings')
      .select('id, audit_id, title, description, severity, status, recommendation, estimated_impact, page_url, sort_order, dismissed, dismissal_reason, action_mode, fix_status, fix_format, is_editable, is_deployable, approval_required, deployable_type, default_owner, fix_payload, issue_family_id, verified_fixed_at, status_note, confidence_level, status_updated_at')
      .eq('id', findingId)
      .single()

    if (error || !finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    // Verify the user owns the parent audit
    const { data: audit } = await db
      .from('audits')
      .select('user_id, product_url, brand_identity_id, workspace_id')
      .eq('id', (finding as any).audit_id)
      .is('deleted_at', null)
      .single()

    if (!audit || (audit as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Defense-in-depth: if workspace_id is provided, verify the audit belongs to that workspace
    const workspaceId = _request.nextUrl.searchParams.get('workspace_id')
    if (workspaceId && (audit as any).workspace_id && (audit as any).workspace_id !== workspaceId) {
      return NextResponse.json({ error: 'Finding does not belong to the specified workspace' }, { status: 403 })
    }

    return NextResponse.json({
      finding,
      audit: {
        id: (finding as any).audit_id,
        product_url: (audit as any).product_url,
        brand_identity_id: (audit as any).brand_identity_id,
      },
    })
  } catch (err) {
    console.error('GET /api/findings/[id] error:', err)
    return NextResponse.json({ error: 'Failed to fetch finding' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: findingId } = await params
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { status, note, dismiss, dismissal_reason, action_mode, fix_status: newFixStatus } = await request.json()

    const db = createServiceSupabase()

    // Fetch finding (no verification_status — column may not exist)
    const { data: finding } = await db
      .from('audit_findings')
      .select('audit_id, title, severity, recommendation, status, action_mode, fix_status, issue_family_id, confidence_level, detection_source')
      .eq('id', findingId)
      .single()

    if (!finding) return NextResponse.json({ error: 'Finding not found' }, { status: 404 })

    const { data: audit } = await db
      .from('audits')
      .select('user_id, product_url, workspace_id')
      .eq('id', (finding as any).audit_id)
      .is('deleted_at', null)
      .single()

    if (!audit || (audit as any).user_id !== user.id)
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

    // Defense-in-depth: if workspace_id is provided, verify the audit belongs to that workspace
    const workspaceId = request.nextUrl.searchParams.get('workspace_id')
    if (workspaceId && (audit as any).workspace_id && (audit as any).workspace_id !== workspaceId) {
      return NextResponse.json({ error: 'Finding does not belong to the specified workspace' }, { status: 403 })
    }

    // Handle dismissal
    if (dismiss) {
      const reason = dismissal_reason || 'Dismissed by user'

      await db
        .from('audit_findings')
        .update({
          dismissed: true,
          dismissal_reason: reason,
          dismissed_at: new Date().toISOString(),
          status: 'backlog',
          status_updated_at: new Date().toISOString(),
        } as any)
        .eq('id', findingId)

      // Auto-create a site_note so the AI skips this in future audits
      const domain = normalizeDomain((audit as any).product_url)
      const { error: uncheckedInsertErr1 } = await db.from('site_notes').insert({
        user_id: user.id,
        domain,
        note_type: 'dismissal',
        title: `Dismissed: ${(finding as any).title}`,
        content: reason,
        finding_ref: (finding as any).title,
        is_active: true,
        workspace_id: (audit as any).workspace_id || null,
      } as any)
      if (uncheckedInsertErr1) console.error(`[db] insert failed (site_notes): ${uncheckedInsertErr1.message}`)

      // Recalculate score after dismissal
      const scoreUpdate = await recalculateFromFindings(db, (finding as any).audit_id)

      // ── LEARNING FEEDBACK: Record dismissal in pipeline ──
      try {
        const findingTitle = (finding as any).title || ''
        const findingSeverity = (finding as any).severity || 'medium'
        await recordFindingActionInPatterns(db, findingTitle, 'dismissed')
        // Fetch sort_order for stats (need description too)
        const { data: fullFinding } = await db
          .from('audit_findings')
          .select('description, sort_order')
          .eq('id', findingId)
          .single()
        if (fullFinding) {
          await recordFindingActionInStats(
            db, findingTitle, (fullFinding as any).description || '',
            findingSeverity, (fullFinding as any).sort_order ?? 0, 'dismissed',
          )
        }
      } catch (learnErr) {
        console.error('[findings-api] Learning feedback error (non-fatal):', learnErr)
      }

      return NextResponse.json({ success: true, dismissed: true, scoreUpdate: scoreUpdate || undefined })
    }

    // Handle status update
    if (status) {
      if (!['open', 'in_progress', 'fixed', 'backlog'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }

      const previousStatus = (finding as any).status
      // Keep the action-model fix_status in sync with the lifecycle status.
      // The Fix list badge prefers fix_status while the header dropdown shows
      // status; the action_mode path already maps action_mode→status, but the
      // reverse was missing, so reopening via the header left fix_status stale
      // ('in_progress') → list said "In Progress" while the header said "Open".
      const STATUS_TO_FIX_STATUS: Record<string, string> = {
        open: 'unreviewed', in_progress: 'in_progress', fixed: 'fixed', backlog: 'deferred',
      }
      const { error: updateErr } = await db
        .from('audit_findings')
        .update({
          status,
          fix_status: STATUS_TO_FIX_STATUS[status],
          status_updated_at: new Date().toISOString(),
          status_note: note || null,
        } as any)
        .eq('id', findingId)

      if (updateErr) {
        console.error('Finding status update error:', updateErr)
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      // Recalculate score whenever status changes to/from "fixed"
      // This covers: open→fixed, fixed→open, in_progress→fixed, etc.
      let scoreUpdate = null
      const statusChanged = previousStatus !== status
      const involvesFixed = status === 'fixed' || previousStatus === 'fixed'

      if (statusChanged && involvesFixed) {
        scoreUpdate = await recalculateFromFindings(db, (finding as any).audit_id)
      }

      // ── CANONICAL ISSUE: Mark issue family as pending verification ──
      if (status === 'fixed' && (finding as any).issue_family_id) {
        try {
          await db
            .from('issue_families')
            .update({
              fix_status: 'pending_verification',
              fix_source: 'user',
              fix_updated_at: new Date().toISOString(),
            })
            .eq('id', (finding as any).issue_family_id)
        } catch (famErr) {
          console.error('[findings-api] Issue family update error (non-fatal):', famErr)
        }
      }

      // ── Phase 3 — fix-outcome verification (dark launch behind flag) ──
      // Fire-and-forget: a background job re-checks the page and records the
      // outcome. The job filters to deterministic findings, so we fire for any
      // mark-fixed and let it decide eligibility. Never block the response.
      // Only deterministic findings get re-checked by the job, so only those
      // drive the "Verifying fix…" UI — AI findings shouldn't show a spinner
      // that never resolves.
      const isVerifiable = (finding as any).confidence_level === 'deterministic'
      let verificationQueued = false
      if (status === 'fixed' && isVerifiable && getFeatureFlags().fixOutcomes) {
        try {
          await inngest.send({
            name: 'fix/verify-requested',
            data: { findingId, userId: user.id, markedFixedAt: new Date().toISOString() },
          })
          verificationQueued = true
        } catch (sendErr) {
          console.error('[findings-api] fix/verify-requested send failed (non-fatal):', sendErr)
        }
      }

      // ── LEARNING FEEDBACK: Record status change in pipeline ──
      if (statusChanged && (status === 'fixed' || status === 'open')) {
        try {
          const findingTitle = (finding as any).title || ''
          const findingSeverity = (finding as any).severity || 'medium'
          const action = status === 'fixed' ? 'fixed' as const : 'accepted' as const
          await recordFindingActionInPatterns(db, findingTitle, action)
          if (status === 'fixed') {
            const { data: fullFinding } = await db
              .from('audit_findings')
              .select('description, sort_order')
              .eq('id', findingId)
              .single()
            if (fullFinding) {
              await recordFindingActionInStats(
                db, findingTitle, (fullFinding as any).description || '',
                findingSeverity, (fullFinding as any).sort_order ?? 0, 'fixed',
              )
            }
          }
        } catch (learnErr) {
          console.error('[findings-api] Learning feedback error (non-fatal):', learnErr)
        }
      }

      return NextResponse.json({
        success: true,
        status,
        verificationQueued,
        scoreUpdate: scoreUpdate || undefined,
      })
    }

    // Handle action model updates (action_mode, fix_status)
    if (action_mode || newFixStatus) {
      const validActionModes = ['self_fix', 'team_handoff', 'defer', 'fixed']
      const validFixStatuses = ['unreviewed', 'in_progress', 'approved', 'deferred', 'fixed', 'failed']

      if (action_mode && !validActionModes.includes(action_mode)) {
        return NextResponse.json({ error: 'Invalid action_mode' }, { status: 400 })
      }
      if (newFixStatus && !validFixStatuses.includes(newFixStatus)) {
        return NextResponse.json({ error: 'Invalid fix_status' }, { status: 400 })
      }

      const updates: Record<string, unknown> = {}
      if (action_mode) updates.action_mode = action_mode
      if (newFixStatus) updates.fix_status = newFixStatus

      // Map action_mode to legacy status for backward compat
      if (action_mode === 'fixed') {
        updates.status = 'fixed'
        updates.fix_status = 'fixed'
      } else if (action_mode === 'defer') {
        updates.status = 'backlog'
        updates.fix_status = 'deferred'
      } else if (action_mode === 'self_fix') {
        updates.status = 'in_progress'
        if (!newFixStatus) updates.fix_status = 'in_progress'
      }

      updates.status_updated_at = new Date().toISOString()

      const { error: updateErr } = await db
        .from('audit_findings')
        .update(updates as any)
        .eq('id', findingId)

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      // Record action history
      const prevFixStatus = (finding as any).fix_status || 'unreviewed'
      const resolvedFixStatus = (updates.fix_status || newFixStatus || prevFixStatus) as string
      const { error: uncheckedInsertErr2 } = await db.from('finding_action_history').insert({
        finding_id: findingId,
        user_id: user.id,
        action: action_mode || 'status_change',
        from_status: prevFixStatus,
        to_status: resolvedFixStatus,
        note: note || null,
      } as any)
      if (uncheckedInsertErr2) console.error(`[db] insert failed (finding_action_history): ${uncheckedInsertErr2.message}`)

      // Recalculate score if status changed to/from fixed
      let scoreUpdate = null
      if (updates.status === 'fixed' || (finding as any).status === 'fixed') {
        scoreUpdate = await recalculateFromFindings(db, (finding as any).audit_id)
      }

      // ── CANONICAL ISSUE: Mark issue family as pending verification ──
      if (updates.status === 'fixed' && (finding as any).issue_family_id) {
        try {
          await db
            .from('issue_families')
            .update({
              fix_status: 'pending_verification',
              fix_source: 'user',
              fix_updated_at: new Date().toISOString(),
            })
            .eq('id', (finding as any).issue_family_id)
        } catch (famErr) {
          console.error('[findings-api] Issue family update error (non-fatal):', famErr)
        }
      }

      // ── Phase 3 — fire fix verification (dark launch behind flag) ──
      // The FixConsole "Mark fixed" button comes through THIS path via
      // action_mode='fixed' (which set status='fixed' above). Without this the
      // verify job only fired from the header-dropdown status path. Fire-and-forget.
      const isVerifiable = (finding as any).confidence_level === 'deterministic'
      let verificationQueued = false
      if (updates.status === 'fixed' && isVerifiable && getFeatureFlags().fixOutcomes) {
        try {
          await inngest.send({
            name: 'fix/verify-requested',
            data: { findingId, userId: user.id, markedFixedAt: new Date().toISOString() },
          })
          verificationQueued = true
        } catch (sendErr) {
          console.error('[findings-api] fix/verify-requested (action_mode) send failed (non-fatal):', sendErr)
        }
      }

      return NextResponse.json({
        success: true,
        action_mode,
        fix_status: resolvedFixStatus,
        verificationQueued,
        scoreUpdate: scoreUpdate || undefined,
      })
    }

    return NextResponse.json({ error: 'Provide status, dismiss, action_mode, or fix_status' }, { status: 400 })
  } catch (err) {
    console.error('PATCH /api/findings error:', err)
    return NextResponse.json({ error: 'Failed to update finding' }, { status: 500 })
  }
}
