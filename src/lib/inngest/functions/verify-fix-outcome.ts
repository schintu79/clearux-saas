// ============================================================
// Phase 3 — Fix-outcome verification job
// ============================================================
// Triggered by `fix/verify-requested` when a user marks a finding fixed. Loads
// the finding, re-runs the matching instrument on its page (deterministic
// findings only), records a fix_outcomes row, and applies the result:
//   • verified_fixed → set audit_findings.verified_fixed_at, family validated_fixed
//   • not_fixed      → honest reopen (status='open' + note), family reopened
//   • inconclusive   → leave as the user set it; reconcile on next re-audit
//
// Dark-launched behind FEATURE_FIX_OUTCOMES. Non-fatal: any failure logs and
// returns; never throws into the user's flow (the trigger already returned).
//
// Known V1 limitation: a reopen does not immediately recompute the aggregate
// score (recalculateFromFindings is route-local). The finding shows as open at
// once; the score reconciles on the next status change or re-audit. See
// docs/FIX_OUTCOMES_ARCHITECTURE.md §9.
// ============================================================

import { inngest } from '../client'
import { createServiceSupabase } from '@/lib/supabase-server'
import { getFeatureFlags } from '@/lib/feature-flags'
import { verifyDeterministicFinding } from '@/lib/audit-engine/fix-verification/verify-finding'
import { buildFixOutcomeRow } from '@/lib/audit-engine/fix-verification/match-finding'
import { insertChecked } from '@/lib/db/checked-write'

interface VerifyFixEvent {
  findingId: string
  userId: string | null
  markedFixedAt: string | null
}

export const verifyFixOutcomeFn = inngest.createFunction(
  {
    id: 'fixpath/verify-fix-outcome',
    retries: 1,
    concurrency: { limit: 5 },
    triggers: [{ event: 'fix/verify-requested' }],
  },
  async ({ event }) => {
    const { findingId, userId, markedFixedAt } = (event.data || {}) as VerifyFixEvent

    if (!getFeatureFlags().fixOutcomes) return { skipped: 'flag_off' }
    if (!findingId) return { skipped: 'no_finding_id' }

    const db = createServiceSupabase()

    const { data: finding } = await db
      .from('audit_findings')
      .select('id, audit_id, page_url, detection_source, confidence_level, severity, evidence, title, target_element, performance_metric_type, issue_family_id, created_at, status')
      .eq('id', findingId)
      .single()

    if (!finding) return { skipped: 'finding_not_found' }
    const f = finding as Record<string, any>
    // The job is the single source of truth for eligibility (the trigger fires
    // for any mark-fixed): only deterministic findings still in 'fixed' state.
    if (f.confidence_level !== 'deterministic') return { skipped: 'not_deterministic' }
    if (f.status !== 'fixed') return { skipped: 'no_longer_fixed' }

    const { data: audit } = await db.from('audits').select('workspace_id').eq('id', f.audit_id).single()
    const workspaceId = (audit as any)?.workspace_id ?? null

    const result = await verifyDeterministicFinding(f)
    const verifiedAt = new Date().toISOString()

    const row = buildFixOutcomeRow({
      finding: f as any,
      workspaceId,
      userId: userId ?? null,
      outcome: result.outcome,
      evidenceAfter: result.evidenceAfter,
      markedFixedAt: markedFixedAt ?? null,
      verifiedAt,
      recheckMeta: result.recheckMeta,
    })
    const write = await insertChecked(db, 'fix_outcomes', row as any, { label: 'verify-fix-outcome', auditId: f.audit_id })

    if (result.outcome === 'verified_fixed') {
      await db.from('audit_findings').update({ verified_fixed_at: verifiedAt } as any).eq('id', findingId)
      if (f.issue_family_id) {
        await db.from('issue_families').update({ fix_status: 'validated_fixed', fix_updated_at: verifiedAt } as any).eq('id', f.issue_family_id)
      }
    } else if (result.outcome === 'not_fixed') {
      // Honest reopen — we tell them the fix didn't actually take.
      await db.from('audit_findings').update({
        status: 'open',
        verified_fixed_at: null,
        status_note: 'Automated re-check found this is still present after it was marked fixed.',
        status_updated_at: verifiedAt,
      } as any).eq('id', findingId)
      if (f.issue_family_id) {
        await db.from('issue_families').update({ fix_status: 'reopened', fix_updated_at: verifiedAt } as any).eq('id', f.issue_family_id)
      }
    }

    // Observability — never silent.
    try {
      await db.from('audit_logs').insert([{
        audit_id: f.audit_id,
        event: result.outcome === 'not_fixed' ? 'fix_reopened' : result.outcome === 'verified_fixed' ? 'fix_verified' : 'fix_verify_inconclusive',
        status: result.outcome === 'verified_fixed' ? 'success' : result.outcome === 'not_fixed' ? 'warning' : 'info',
        message: `Fix verification "${f.title}": ${result.outcome}${result.evidenceAfter ? ' — ' + result.evidenceAfter : ''}`,
        metadata: result.recheckMeta,
      }])
    } catch { /* log write is best-effort */ }

    return { outcome: result.outcome, wrote: write.ok, findingId }
  },
)
