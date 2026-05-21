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

function normalizeDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch { return url }
}

/** Severity weight — how much an open finding of this severity drags the score down */
function severityPenalty(severity: string): number {
  switch (severity) {
    case 'critical': return 8
    case 'high': return 5
    case 'medium': return 3
    case 'low': return 1.5
    default: return 3
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
      .select('id, audit_id, title, description, severity, status, recommendation, estimated_impact, page_url, sort_order, dismissed, dismissal_reason')
      .eq('id', findingId)
      .single()

    if (error || !finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    // Verify the user owns the parent audit
    const { data: audit } = await db
      .from('audits')
      .select('user_id, product_url, brand_identity_id')
      .eq('id', (finding as any).audit_id)
      .single()

    if (!audit || (audit as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
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

    const { status, note, dismiss, dismissal_reason } = await request.json()

    const db = createServiceSupabase()

    // Fetch finding (no verification_status — column may not exist)
    const { data: finding } = await db
      .from('audit_findings')
      .select('audit_id, title, severity, recommendation, status')
      .eq('id', findingId)
      .single()

    if (!finding) return NextResponse.json({ error: 'Finding not found' }, { status: 404 })

    const { data: audit } = await db
      .from('audits')
      .select('user_id, product_url')
      .eq('id', (finding as any).audit_id)
      .single()

    if (!audit || (audit as any).user_id !== user.id)
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

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
      await db.from('site_notes').insert({
        user_id: user.id,
        domain,
        note_type: 'dismissal',
        title: `Dismissed: ${(finding as any).title}`,
        content: reason,
        finding_ref: (finding as any).title,
        is_active: true,
      } as any)

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
      const { error: updateErr } = await db
        .from('audit_findings')
        .update({
          status,
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
        scoreUpdate: scoreUpdate || undefined,
      })
    }

    return NextResponse.json({ error: 'Provide status or dismiss' }, { status: 400 })
  } catch (err) {
    console.error('PATCH /api/findings error:', err)
    return NextResponse.json({ error: 'Failed to update finding' }, { status: 500 })
  }
}
