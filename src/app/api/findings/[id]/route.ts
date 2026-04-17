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

/**
 * Score bump per confirmed fix, based on severity.
 * These are OVERALL score points (not per-category).
 * A high finding fix should feel impactful: +3 points.
 * Three medium fixes ≈ +6 points total — meaningful progress.
 */
function scoreImpact(severity: string): number {
  switch (severity) {
    case 'critical': return 5
    case 'high': return 3
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

  const allFindingWords = new Set([...titleWords, ...findingRecWords])
  const matchCount = recWords.filter(w => allFindingWords.has(w)).length
  const matchRatio = recWords.length > 0 ? matchCount / recWords.length : 0

  return matchRatio >= 0.4
}

/**
 * Recalculate report scores after a finding status change.
 * Also updates Top Priority Recommendations when a fixed finding
 * is related to one of the current recommendations.
 *
 * Score approach: apply a FLAT improvement per fix (based on severity),
 * distributed across categories proportionally to their headroom.
 * This ensures every confirmed fix produces a visible score change.
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
    const impact = scoreImpact(findingSeverity)
    const numCategories = categoryScores.length

    // Flat overall-score delta, then distribute to categories
    // Target: overall score changes by exactly `impact` points
    // Each category gets `impact` points added (capped at 100)
    // This way the overall average shifts by ~impact points
    const updatedCategoryScores = categoryScores.map(cat => {
      let newScore: number
      if (direction === 'up') {
        // Add impact points, but scale by headroom so near-100 categories gain less
        const headroom = 100 - cat.score
        if (headroom <= 0) return { ...cat, score: 100 }
        // Each category gets `impact` points, but capped by its headroom
        const gain = Math.min(impact, headroom)
        newScore = cat.score + gain
      } else {
        // Penalty: subtract impact points, floored at 0
        newScore = Math.max(0, cat.score - impact)
      }
      return { ...cat, score: Math.round(newScore) }
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

        // Backfill from next highest-severity open findings
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
              const sorted = openFindings.sort((a: any, b: any) =>
                severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
              )

              for (const f of sorted) {
                if (updatedTopRecs.length >= 3) break
                const rec = (f as any).recommendation
                if (!rec) continue

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

    console.log(`[recalculateScores] ${direction === 'up' ? 'Improved' : 'Reduced'} score: ${(report as any).overall_score} → ${newOverallScore} (severity=${findingSeverity}, impact=${impact})`)
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

    // ── Fetch finding — DO NOT include verification_status in select
    // (column may not exist if migration 014 hasn't been run yet)
    const { data: finding } = await db
      .from('audit_findings')
      .select('audit_id, title, severity, recommendation')
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

      // ── Resolve verification status ──
      // Always check report raw_json (works whether migration is run or not)
      let verificationStatus: string | null = null

      // Try DB column first (if migration 014 was run)
      try {
        const { data: findingWithVer } = await db
          .from('audit_findings')
          .select('verification_status')
          .eq('id', findingId)
          .single()
        if (findingWithVer) {
          verificationStatus = (findingWithVer as any).verification_status || null
        }
      } catch {
        // Column doesn't exist — that's fine, fall through to raw_json
      }

      // Fallback: check report raw_json (always reliable)
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
