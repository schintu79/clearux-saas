// ============================================================
// Reconciliation Persistence Layer
// ============================================================
// Handles all Supabase reads and writes for the canonical issue
// system: loading prior context, creating/updating issue families,
// writing lifecycle events, persisting score snapshots, and
// updating finding records with reconciliation results.
//
// PROPRIETARY — do not distribute outside the Fixpath codebase.
// ============================================================

import { createClient } from '@supabase/supabase-js'
import type { IssueFamily, FindingStatusInAudit, ScoreSnapshot, ReconciliationSummaryV2 } from '@/types/canonical-issues'
import type { AuditFinding } from '@/types/database'
import type { ReconciliationContext, PriorContext, ReconciliationMatch, UnmatchedIssue, ReconciliationResult } from './reconciliation-v2'
import type { ScoringResult } from './scoring-engine'

/* ── Supabase Admin Client ───────────────────────────────────── */

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

/* ── Phase 1: Load Prior Context ─────────────────────────────── */

/**
 * Load all prior context needed for reconciliation:
 * - Previous audit for this workspace
 * - Open issue families
 * - Previous findings
 * - User fix statuses
 */
export async function loadPriorContext(
  workspaceId: string,
  currentAuditId: string,
  previousAuditId: string | null,
): Promise<PriorContext> {
  const supabase = getAdminClient()

  // 1. Fetch open issue families for this workspace
  const { data: families, error: famError } = await supabase
    .from('issue_families')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('current_lifecycle_state', ['open', 'improved', 'regressed'])
    .order('created_at', { ascending: true })

  if (famError) {
    console.warn(`[reconciliation] Failed to load issue families: ${famError.message}`)
  }

  // 2. Fetch previous audit's findings (if re-audit)
  let previousFindings: AuditFinding[] = []
  if (previousAuditId) {
    const { data: prevFindings, error: prevError } = await supabase
      .from('audit_findings')
      .select('*')
      .eq('audit_id', previousAuditId)
      .order('sort_order', { ascending: true })

    if (prevError) {
      console.warn(`[reconciliation] Failed to load previous findings: ${prevError.message}`)
    } else {
      previousFindings = (prevFindings || []) as AuditFinding[]
    }
  }

  // 3. Build user fix status map from issue families
  const userFixStatuses = new Map<string, string>()
  for (const fam of (families || [])) {
    if (fam.fix_status && fam.fix_status !== 'none') {
      userFixStatuses.set(fam.id, fam.fix_status)
    }
  }

  return {
    openIssueFamilies: (families || []) as IssueFamily[],
    previousFindings,
    userFixStatuses,
  }
}

/* ── Persist Issue Families ──────────────────────────────────── */

/**
 * Create or update issue families based on reconciliation results.
 * Returns a map of canonical_key → issue_family_id for linking findings.
 */
export async function persistIssueFamilies(
  result: ReconciliationResult,
  ctx: ReconciliationContext,
): Promise<Map<string, string>> {
  const supabase = getAdminClient()
  const keyToId = new Map<string, string>()

  // Process matched existing families (update last_seen, times_seen, lifecycle state)
  const updates: Array<{ id: string; updates: Record<string, unknown> }> = []

  for (const match of result.matches) {
    if (match.matchedFamily) {
      keyToId.set(match.detection.canonical_key, match.matchedFamily.id)

      updates.push({
        id: match.matchedFamily.id,
        updates: {
          last_seen_audit_id: ctx.currentAuditId,
          times_seen: (match.matchedFamily.times_seen || 1) + 1,
          current_lifecycle_state: match.newLifecycleState,
          default_severity: match.detection.severity,
          title_canonical: match.detection.title,
          description_canonical: match.detection.finding_text,
        },
      })
    }
  }

  // Batch update existing families
  for (const upd of updates) {
    const { error } = await supabase
      .from('issue_families')
      .update(upd.updates)
      .eq('id', upd.id)

    if (error) {
      console.warn(`[reconciliation] Failed to update issue family ${upd.id}: ${error.message}`)
    }
  }

  // Create new issue families for unmatched detections
  const newFamilies: Array<Record<string, unknown>> = []

  for (const match of result.matches) {
    if (match.matchMethod === 'new') {
      newFamilies.push({
        workspace_id: ctx.workspaceId,
        category_key: match.detection.category_key,
        issue_key: match.detection.canonical_key,
        issue_type: match.detection.issue_type,
        title_canonical: match.detection.title,
        description_canonical: match.detection.finding_text,
        default_severity: match.detection.severity,
        score_weight: 1.0,
        matching_strategy: 'canonical_key',
        scope_signature: match.detection.scope_signature,
        current_lifecycle_state: 'open',
        first_seen_audit_id: ctx.currentAuditId,
        last_seen_audit_id: ctx.currentAuditId,
        times_seen: 1,
      })
    }
  }

  if (newFamilies.length > 0) {
    // Insert in batches to avoid payload limits
    const batchSize = 50
    for (let i = 0; i < newFamilies.length; i += batchSize) {
      const batch = newFamilies.slice(i, i + batchSize)
      const { data: inserted, error } = await supabase
        .from('issue_families')
        .insert(batch)
        .select('id, issue_key')

      if (error) {
        console.warn(`[reconciliation] Failed to insert issue families: ${error.message}`)
      } else if (inserted) {
        for (const row of inserted) {
          keyToId.set(row.issue_key, row.id)
        }
      }
    }
  }

  // Update families for issues verified as fixed
  for (const unmatched of result.unmatchedOldIssues) {
    if (unmatched.resolution === 'fixed') {
      const { error } = await supabase
        .from('issue_families')
        .update({
          current_lifecycle_state: 'resolved',
          last_seen_audit_id: ctx.currentAuditId,
        })
        .eq('id', unmatched.family.id)

      if (error) {
        console.warn(`[reconciliation] Failed to mark family resolved: ${error.message}`)
      }
    }
  }

  return keyToId
}

/* ── Update Findings with Reconciliation Data ────────────────── */

/**
 * Update audit_findings records with issue_family_id, status_in_audit,
 * score_impact, and other reconciliation metadata.
 */
export async function updateFindingsWithReconciliation(
  result: ReconciliationResult,
  keyToId: Map<string, string>,
): Promise<void> {
  const supabase = getAdminClient()

  const updates: Array<{
    findingId: string
    patch: Record<string, unknown>
  }> = []

  for (const match of result.matches) {
    if (!match.detection.source_finding_id) continue

    const issueFamilyId = match.matchedFamily?.id || keyToId.get(match.detection.canonical_key) || null

    updates.push({
      findingId: match.detection.source_finding_id,
      patch: {
        issue_family_id: issueFamilyId,
        status_in_audit: match.statusInAudit,
        score_impact: match.detection.score_impact,
        confidence_score: match.detection.confidence,
        business_relevance: match.detection.business_relevance,
        page_count_affected: match.detection.page_count,
        scope_json: {
          scope_signature: match.detection.scope_signature,
          pages_affected: match.detection.pages_affected,
          template_types: match.detection.template_types,
        },
      },
    })
  }

  // Batch updates
  const batchSize = 50
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize)
    await Promise.all(
      batch.map(({ findingId, patch }) =>
        supabase
          .from('audit_findings')
          .update(patch)
          .eq('id', findingId)
          .then(({ error }) => {
            if (error) console.warn(`[reconciliation] Failed to update finding ${findingId}: ${error.message}`)
          })
      )
    )
  }
}

/* ── Write Lifecycle Events ──────────────────────────────────── */

/**
 * Record lifecycle events for all reconciliation changes.
 */
export async function writeLifecycleEvents(
  result: ReconciliationResult,
  ctx: ReconciliationContext,
  keyToId: Map<string, string>,
): Promise<void> {
  const supabase = getAdminClient()

  const events: Array<Record<string, unknown>> = []

  // Events for matched/new findings
  for (const match of result.matches) {
    const issueFamilyId = match.matchedFamily?.id || keyToId.get(match.detection.canonical_key)
    if (!issueFamilyId) continue

    events.push({
      issue_family_id: issueFamilyId,
      audit_id: ctx.currentAuditId,
      event_type: match.lifecycleEvent,
      old_state: match.matchedFamily?.current_lifecycle_state || null,
      new_state: match.newLifecycleState,
      reason: match.matchMethod === 'new'
        ? 'New issue detected'
        : `Matched via ${match.matchMethod} (confidence: ${match.matchConfidence.toFixed(2)})`,
      metadata_json: {
        match_method: match.matchMethod,
        match_confidence: match.matchConfidence,
        canonical_key: match.detection.canonical_key,
        severity: match.detection.severity,
        score_impact: match.detection.score_impact,
      },
    })
  }

  // Events for fixed issues
  for (const unmatched of result.unmatchedOldIssues) {
    if (unmatched.resolution === 'fixed') {
      events.push({
        issue_family_id: unmatched.family.id,
        audit_id: ctx.currentAuditId,
        event_type: 'fixed',
        old_state: unmatched.family.current_lifecycle_state,
        new_state: 'resolved',
        reason: unmatched.pageWasCrawled
          ? 'Page was crawled and issue not found — verified fixed'
          : 'User confirmed fix',
        metadata_json: {
          page_was_crawled: unmatched.pageWasCrawled,
        },
      })
    }
  }

  // Batch insert
  if (events.length > 0) {
    const batchSize = 100
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize)
      const { error } = await supabase
        .from('issue_lifecycle_events')
        .insert(batch)

      if (error) {
        console.warn(`[reconciliation] Failed to insert lifecycle events: ${error.message}`)
      }
    }
  }
}

/* ── Persist Score Snapshots ─────────────────────────────────── */

/**
 * Write all score snapshots (per-category + overall) to the DB.
 */
export async function persistScoreSnapshots(
  scoring: ScoringResult,
): Promise<void> {
  const supabase = getAdminClient()

  const snapshots = [
    ...scoring.categorySnapshots,
    scoring.overallSnapshot,
  ].map(s => ({
    audit_id: s.audit_id,
    workspace_id: s.workspace_id,
    category_key: s.category_key,
    raw_score: s.raw_score,
    adjusted_score: s.adjusted_score,
    active_issue_count: s.active_issue_count,
    weighted_issue_total: s.weighted_issue_total,
    resolved_issue_credit: s.resolved_issue_credit,
    recommendation_penalty: s.recommendation_penalty,
    calculation_json: s.calculation_json,
  }))

  const { error } = await supabase
    .from('score_snapshots')
    .insert(snapshots)

  if (error) {
    console.warn(`[reconciliation] Failed to insert score snapshots: ${error.message}`)
  }
}

/* ── Update Audit Record ─────────────────────────────────────── */

/**
 * Update the audit record with reconciliation summary and audit run type.
 */
export async function updateAuditWithReconciliation(
  auditId: string,
  summary: ReconciliationSummaryV2,
  overallScore: number,
  auditRunType: string,
): Promise<void> {
  const supabase = getAdminClient()

  const { error } = await supabase
    .from('audits')
    .update({
      reconciliation_summary: summary,
      audit_run_type: auditRunType,
      score_version: 'v1',
    })
    .eq('id', auditId)

  if (error) {
    console.warn(`[reconciliation] Failed to update audit record: ${error.message}`)
  }
}

/* ── Full Reconciliation + Persistence ───────────────────────── */

/**
 * Run the full reconciliation pipeline:
 * 1. Load prior context
 * 2. Run reconciliation
 * 3. Persist issue families
 * 4. Update findings
 * 5. Write lifecycle events
 * 6. Compute and persist scores
 * 7. Update audit record
 */
export async function runFullReconciliation(
  currentFindings: AuditFinding[],
  ctx: ReconciliationContext,
): Promise<{
  result: ReconciliationResult
  scoring: ScoringResult
}> {
  // Dynamic imports to avoid circular dependencies
  const { reconcileV2 } = await import('./reconciliation-v2')
  const { computeScores, computeScoreDelta } = await import('./scoring-engine')

  console.log(`[reconciliation] Starting reconciliation for audit ${ctx.currentAuditId}`)
  console.log(`[reconciliation] ${currentFindings.length} current findings, previous audit: ${ctx.previousAuditId || 'none'}`)

  // Phase 1: Load prior context
  const prior = await loadPriorContext(
    ctx.workspaceId,
    ctx.currentAuditId,
    ctx.previousAuditId,
  )

  console.log(`[reconciliation] Prior context: ${prior.openIssueFamilies.length} open families, ${prior.previousFindings.length} previous findings`)

  // Phases 3-6: Run reconciliation
  const result = reconcileV2(currentFindings, ctx, prior)

  console.log(`[reconciliation] Result: ${result.summary.matched_count} matched, ${result.summary.new_count} new, ${result.summary.fixed_count} fixed`)

  // Persist issue families
  const keyToId = await persistIssueFamilies(result, ctx)

  // Update findings with reconciliation data
  await updateFindingsWithReconciliation(result, keyToId)

  // Write lifecycle events
  await writeLifecycleEvents(result, ctx, keyToId)

  // Compute scores
  const scoring = computeScores({
    matches: result.matches,
    fixedIssues: result.unmatchedOldIssues,
    auditId: ctx.currentAuditId,
    workspaceId: ctx.workspaceId,
  })

  // Compute score delta from previous audit
  let previousScore: number | null = null
  if (ctx.previousAuditId) {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('score_snapshots')
      .select('adjusted_score')
      .eq('audit_id', ctx.previousAuditId)
      .is('category_key', null)
      .single()

    if (data) {
      previousScore = data.adjusted_score
    }
  }

  result.summary.score_delta = computeScoreDelta(scoring.overallScore, previousScore)

  // Persist score snapshots
  await persistScoreSnapshots(scoring)

  // Determine audit run type
  const auditRunType = ctx.previousAuditId
    ? (ctx.isDeepAudit ? 'deep_audit' : 'reaudit')
    : 'first_audit'

  // Update audit record
  await updateAuditWithReconciliation(
    ctx.currentAuditId,
    result.summary,
    scoring.overallScore,
    auditRunType,
  )

  console.log(`[reconciliation] Complete. Overall score: ${scoring.overallScore}, delta: ${result.summary.score_delta}`)

  return { result, scoring }
}
