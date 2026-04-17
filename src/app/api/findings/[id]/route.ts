// ============================================================
// ClearUX API — PATCH /api/findings/:id
// Update finding status, or dismiss with reason
// Dismissals automatically create site_notes for future audits
// When a "likely_fixed" finding is confirmed fixed → recalculate scores
// When a "poorly_fixed" finding is acknowledged → reduce scores
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

function normalizeDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch { return url }
}

/** Severity weight for score impact calculation */
function severityWeight(severity: string): number {
  switch (severity) {
    case 'critical': return 5
    case 'high': return 3.5
    case 'medium': return 2
    case 'low': return 1
    default: return 2
  }
}

/** Extract significant words from text for fuzzy matching */
function extractKeywords(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
}

/** Check if a recommendation text is related to a finding (fuzzy match) */
function isRecommendationRelated(recText: string, findingTitle: string, findingRecommendation: string): boolean {
  const recWords = extractKeywords(recText)
  const titleWords = extractKeywords(findingTitle)
  const findingRecWords = extractKeywords(findingRecommendation)

  // Count how many significant words from the recommendation match the finding
  const allFindingWords = new Set([...titleWords, ...findingRecWords])
  const matchCount = recWords.filter(w => allFindingWords.has(w)).length
  const matchRatio = recWords.length > 0 ? matchCount / recWords.length : 0

  // If 40%+ of the recommendation's keywords appear in the finding, it's related
  return matchRatio >= 0.4
}

/**
 * Recalculate report scores after a finding status change.
 * Also updates Top Priority Recommendations when a fixed finding
 * is related to one of the current recommendations.
 *
 * Called when:
 * - A "likely_fixed" finding is confirmed as "fixed" → score goes UP, recs updated
 * - A "poorly_fixed" finding is acknowledged → score goes DOWN
 */
async function recalculateReportScores(
  db: ReturnType<typeof createServiceSupabase>,
  auditId: string,
  findingSeverity: string,
  findingTitle: string,
  findingRecommendation: string,
  findingId: string,
  direction: 'up' | 'down',
) {
  try {
    // Fetch current report
    const { data: report } = await db
      .from('reports')
      .select('id, overall_score, raw_json')
      .eq('audit_id', auditId)
      .single()

    if (!report) {
      console.error('[recalculateScores] No report found for audit:', auditId)
      return null
    }

    const rawJson = (report as any).raw_json as any
    if (!rawJson?.categoryScores || !Array.isArray(rawJson.categoryScores)) {
      console.error('[recalculateScores] No categoryScores in report')
      return null
    }

    const categoryScores = rawJson.categoryScores as Array<{ name: string; score: number; summary: string }>
    const weight = severityWeight(findingSeverity)

    // Calculate total headroom (for upward) or total score (for downward)
    const totalHeadroom = categoryScores.reduce((sum, c) => sum + (100 - c.score), 0)
    const totalScore = categoryScores.reduce((sum, c) => sum + c.score, 0)

    // Apply proportional adjustment across all categories
    const updatedCategoryScores = categoryScores.map(cat => {
      let newScore: number
      if (direction === 'up') {
        const catHeadroom = 100 - cat.score
        const improvement = totalHeadroom > 0
          ? Math.round((catHeadroom / totalHeadroom) * weight * 3)
          : 0
        newScore = Math.min(100, cat.score + improvement)
      } else {
        const catWeight = cat.score / Math.max(1, totalScore / categoryScores.length)
        const penalty = Math.round(weight * catWeight * 1.5)
        newScore = Math.max(0, cat.score - penalty)
      }
      return { ...cat, score: newScore }
    })

    // Recalculate overall score
    const newOverallScore = updatedCategoryScores.length > 0
      ? Math.round(updatedCategoryScores.reduce((s, c) => s + c.score, 0) / updatedCategoryScores.length)
      : (report as any).overall_score

    // Recalculate pillar scores
    const pillarAvg = (start: number, end: number) => {
      const cats = updatedCategoryScores.slice(start, Math.min(end, updatedCategoryScores.length))
      return cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 50
    }

    // ── Update Top Priority Recommendations ──
    // If a confirmed fix is related to a top recommendation, remove it and
    // backfill from the next highest-severity open finding
    let updatedTopRecs = rawJson.topRecommendations as string[] | undefined
    let updatedKeyRec = rawJson.keyRecommendation as string | undefined

    if (direction === 'up' && updatedTopRecs && updatedTopRecs.length > 0) {
      const beforeCount = updatedTopRecs.length

      // Filter out recommendations related to the just-fixed finding
      updatedTopRecs = updatedTopRecs.filter(
        rec => !isRecommendationRelated(rec, findingTitle, findingRecommendation)
      )

      const removedCount = beforeCount - updatedTopRecs.length

      if (removedCount > 0) {
        console.log(`[recalculateScores] Removed ${removedCount} recommendation(s) related to fixed finding: "${findingTitle}"`)

        // Backfill: fetch remaining open findings sorted by severity to get replacement recs
        if (updatedTopRecs.length < 3) {
          try {
            const severityOrder = ['critical', 'high', 'medium', 'low']
            const { data: openFindings } = await db
              .from('audit_findings')
              .select('id, title, recommendation, severity')
              .eq('audit_id', auditId)
              .in('status', ['open', 'in_progress'])
              .eq('dismissed', false)
              .neq('id', findingId)

            if (openFindings && openFindings.length > 0) {
              // Sort by severity priority
              const sorted = openFindings.sort((a: any, b: any) =>
                severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
              )

              // Add recommendations from open findings that aren't already in the list
              for (const f of sorted) {
                if (updatedTopRecs.length >= 3) break
                const rec = (f as any).recommendation
                if (!rec) continue

                // Check this rec isn't already represented
                const isDuplicate = updatedTopRecs.some(existing =>
                  isRecommendationRelated(existing, (f as any).title, rec)
                )
                if (!isDuplicate) {
                  updatedTopRecs.push(rec)
                }
              }
            }
          } catch (e) {
            console.error('[recalculateScores] Backfill error (non-fatal):', e)
          }
        }

        // Update keyRecommendation to match the new top rec
        updatedKeyRec = updatedTopRecs[0] || 'Continue addressing open findings to improve your score.'
      }
    }

    // Update report in DB
    const updatedRawJson = {
      ...rawJson,
      categoryScores: updatedCategoryScores,
      overallScore: newOverallScore,
      topRecommendations: updatedTopRecs || rawJson.topRecommendations,
      keyRecommendation: updatedKeyRec || rawJson.keyRecommendation,
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
      console.error('[recalculateScores] Update error:', updateErr)
      return null
    }

    console.log(`[recalculateScores] ${direction === 'up' ? 'Improved' : 'Reduced'} score: ${(report as any).overall_score} → ${newOverallScore} (severity=${findingSeverity})`)
    return { previousScore: (report as any).overall_score, newScore: newOverallScore }
  } catch (err) {
    console.error('[recalculateScores] Error:', err)
    return null
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

    // Verify the user owns this finding's audit — also fetch verification_status for score recalc
    const { data: finding } = await db
      .from('audit_findings')
      .select('audit_id, title, severity, recommendation, verification_status')
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

      return NextResponse.json({ success: true, dismissed: true })
    }

    // Handle status update
    if (status) {
      if (!['open', 'in_progress', 'fixed', 'backlog'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }

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

      // ── Score recalculation for verified findings ──
      // Also check raw_json verification results as fallback (when DB column isn't set)
      let verificationStatus = (finding as any).verification_status as string | null

      // Fallback: check report raw_json for verification data
      if (!verificationStatus) {
        try {
          const { data: report } = await db
            .from('reports')
            .select('raw_json')
            .eq('audit_id', (finding as any).audit_id)
            .single()
          const verResults = (report as any)?.raw_json?.verificationResults as Array<{ findingId: string; status: string }> | undefined
          if (verResults) {
            const match = verResults.find(v => v.findingId === findingId)
            if (match) verificationStatus = match.status
          }
        } catch { /* ignore fallback errors */ }
      }

      let scoreUpdate = null

      if (verificationStatus === 'likely_fixed' && status === 'fixed') {
        // User confirmed the AI's "likely fixed" → IMPROVE score + update recommendations
        scoreUpdate = await recalculateReportScores(
          db,
          (finding as any).audit_id,
          (finding as any).severity,
          (finding as any).title || '',
          (finding as any).recommendation || '',
          findingId,
          'up',
        )
      } else if (verificationStatus === 'poorly_fixed') {
        // AI flagged a bad fix — score was already penalized during verification,
        // but if user sets to fixed anyway, we don't penalize again.
        // If user acknowledges by setting back to open/in_progress, no extra penalty needed.
        // The penalty was applied when the poorly_fixed status was first detected.
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
