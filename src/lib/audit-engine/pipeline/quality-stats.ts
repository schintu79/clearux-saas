// ============================================================
// ClearUX Proprietary Pipeline — Global Quality Stats
// ============================================================
//
// PURPOSE:
// Cross-user aggregate metrics that reveal where the pipeline
// is strongest and weakest. This is the "dashboard" layer — it
// doesn't change behavior directly, but feeds data to:
//   - Pattern Learner (which patterns to investigate)
//   - Admin dashboard (quality KPIs)
//   - Threshold tuning decisions
//
// METRICS TRACKED:
//   - False positive rate per finding topic
//   - False positive rate per severity level
//   - False positive rate per audit module
//   - Average time-to-fix per severity
//   - Finding volume trends
//
// DATA FLOW:
//   audit_findings + finding_patterns → aggregate stats
//   Written after each audit completes + on dismiss/fix actions.
//   Read by admin dashboard and Pattern Learner.
//
// WHEN TO IMPROVE THIS FILE:
// - If new metrics are needed → add a new stat_type
// - If aggregation is too slow → add database indexes
// - If admin needs new views → add query helpers
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { createTitleFingerprint } from './relevance-scorer'
import { TOPIC_PATTERNS } from './dedup'

// ── Types ───────────────────────────────────────────────────

export interface QualitySnapshot {
  period: string
  totalFindings: number
  totalDismissed: number
  totalFixed: number
  totalOpen: number
  overallFalsePositiveRate: number
  byTopic: TopicStats[]
  bySeverity: SeverityStats[]
  byModule: ModuleStats[]
}

interface TopicStats {
  topic: string
  total: number
  dismissed: number
  fixed: number
  falsePositiveRate: number
}

interface SeverityStats {
  severity: string
  total: number
  dismissed: number
  fixed: number
  falsePositiveRate: number
}

interface ModuleStats {
  module: string
  total: number
  dismissed: number
  fixed: number
  falsePositiveRate: number
}

// ── Topic Detection ─────────────────────────────────────────
// Reuses topic patterns from dedup.ts to classify findings

function detectTopic(title: string, description: string): string | null {
  const combined = `${title} ${description}`.toLowerCase()
  for (const { topic, keywords } of TOPIC_PATTERNS) {
    const hits = keywords.filter(k => combined.includes(k)).length
    if (hits >= 2) return topic
  }
  return null
}

// Module detection from sort_order (each module = 4 categories)
const MODULE_NAMES = [
  'foundation', 'human_experience', 'inclusive_design',
  'future_readiness', 'seo_structure', 'accessibility_readiness', 'design_consistency',
]

function detectModule(sortOrder: number): string {
  const moduleIdx = Math.floor(sortOrder / 4)
  return MODULE_NAMES[moduleIdx] || 'unknown'
}

// ── Stats Recording ─────────────────────────────────────────

/**
 * Record quality stats after an audit completes.
 * Aggregates finding outcomes into the global_quality_stats table.
 */
export async function recordAuditStats(
  db: SupabaseClient,
  auditId: string,
): Promise<void> {
  // Fetch all findings for this audit
  const { data: findings } = await db
    .from('audit_findings')
    .select('title, description, severity, status, dismissed, sort_order')
    .eq('audit_id', auditId)
    .order('sort_order', { ascending: true })

  if (!findings || findings.length === 0) return

  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Aggregate by topic, severity, and module
  const topicAgg = new Map<string, { total: number; dismissed: number; fixed: number; open: number }>()
  const severityAgg = new Map<string, { total: number; dismissed: number; fixed: number; open: number }>()
  const moduleAgg = new Map<string, { total: number; dismissed: number; fixed: number; open: number }>()

  for (const f of findings as any[]) {
    const topic = detectTopic(f.title, f.description) || 'uncategorized'
    const severity = f.severity || 'medium'
    const module = detectModule(f.sort_order ?? 0)
    const isDismissed = f.dismissed || false
    const isFixed = f.status === 'fixed'
    const isOpen = !isDismissed && !isFixed

    // Topic
    const ta = topicAgg.get(topic) || { total: 0, dismissed: 0, fixed: 0, open: 0 }
    ta.total++
    if (isDismissed) ta.dismissed++
    if (isFixed) ta.fixed++
    if (isOpen) ta.open++
    topicAgg.set(topic, ta)

    // Severity
    const sa = severityAgg.get(severity) || { total: 0, dismissed: 0, fixed: 0, open: 0 }
    sa.total++
    if (isDismissed) sa.dismissed++
    if (isFixed) sa.fixed++
    if (isOpen) sa.open++
    severityAgg.set(severity, sa)

    // Module
    const ma = moduleAgg.get(module) || { total: 0, dismissed: 0, fixed: 0, open: 0 }
    ma.total++
    if (isDismissed) ma.dismissed++
    if (isFixed) ma.fixed++
    if (isOpen) ma.open++
    moduleAgg.set(module, ma)
  }

  // Upsert aggregates into global_quality_stats
  const upserts: Array<{
    stat_period: string
    stat_type: string
    stat_key: string
    total_findings: number
    total_dismissed: number
    total_fixed: number
    total_open: number
    false_positive_rate: number
  }> = []

  const addUpserts = (
    statType: string,
    agg: Map<string, { total: number; dismissed: number; fixed: number; open: number }>,
  ) => {
    for (const [key, stats] of agg) {
      upserts.push({
        stat_period: period,
        stat_type: statType,
        stat_key: key,
        total_findings: stats.total,
        total_dismissed: stats.dismissed,
        total_fixed: stats.fixed,
        total_open: stats.open,
        false_positive_rate: stats.total > 0 ? stats.dismissed / stats.total : 0,
      })

      // Also update all_time stats
      upserts.push({
        stat_period: 'all_time',
        stat_type: statType,
        stat_key: key,
        total_findings: stats.total,
        total_dismissed: stats.dismissed,
        total_fixed: stats.fixed,
        total_open: stats.open,
        false_positive_rate: stats.total > 0 ? stats.dismissed / stats.total : 0,
      })
    }
  }

  addUpserts('by_topic', topicAgg)
  addUpserts('by_severity', severityAgg)
  addUpserts('by_module', moduleAgg)

  // Upsert each stat (increment existing or insert new)
  for (const stat of upserts) {
    const { data: existing } = await db
      .from('global_quality_stats')
      .select('id, total_findings, total_dismissed, total_fixed, total_open')
      .eq('stat_period', stat.stat_period)
      .eq('stat_type', stat.stat_type)
      .eq('stat_key', stat.stat_key)
      .single()

    if (existing) {
      const ex = existing as any
      const newTotal = ex.total_findings + stat.total_findings
      const newDismissed = ex.total_dismissed + stat.total_dismissed
      const newFixed = ex.total_fixed + stat.total_fixed
      const newOpen = ex.total_open + stat.total_open
      await db
        .from('global_quality_stats')
        .update({
          total_findings: newTotal,
          total_dismissed: newDismissed,
          total_fixed: newFixed,
          total_open: newOpen,
          false_positive_rate: newTotal > 0 ? newDismissed / newTotal : 0,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', ex.id)
    } else {
      await db
        .from('global_quality_stats')
        .insert({
          ...stat,
          updated_at: new Date().toISOString(),
        } as any)
    }
  }
}

/**
 * Update stats when a user takes action on a finding.
 * Called from the findings API on dismiss/fix.
 */
export async function recordFindingAction(
  db: SupabaseClient,
  title: string,
  description: string,
  severity: string,
  sortOrder: number,
  action: 'dismissed' | 'fixed',
): Promise<void> {
  const topic = detectTopic(title, description) || 'uncategorized'
  const module = detectModule(sortOrder)

  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const column = action === 'dismissed' ? 'total_dismissed' : 'total_fixed'

  // Update by_topic, by_severity, by_module for both current period and all_time
  const updates = [
    { type: 'by_topic', key: topic },
    { type: 'by_severity', key: severity },
    { type: 'by_module', key: module },
  ]

  for (const { type, key } of updates) {
    for (const targetPeriod of [period, 'all_time']) {
      const { data: existing } = await db
        .from('global_quality_stats')
        .select(`id, ${column}, total_findings, total_dismissed`)
        .eq('stat_period', targetPeriod)
        .eq('stat_type', type)
        .eq('stat_key', key)
        .single()

      if (existing) {
        const ex = existing as any
        const newValue = (ex[column] || 0) + 1
        const newDismissed = column === 'total_dismissed' ? newValue : ex.total_dismissed
        await db
          .from('global_quality_stats')
          .update({
            [column]: newValue,
            false_positive_rate: ex.total_findings > 0 ? newDismissed / ex.total_findings : 0,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', ex.id)
      }
      // If no existing stat, it will be created on next full audit recording
    }
  }
}

// ── Query Helpers (for admin dashboard) ─────────────────────

/**
 * Get a full quality snapshot for a time period.
 */
export async function getQualitySnapshot(
  db: SupabaseClient,
  period: string = 'all_time',
): Promise<QualitySnapshot> {
  const { data: stats } = await db
    .from('global_quality_stats')
    .select('*')
    .eq('stat_period', period)
    .order('total_findings', { ascending: false })

  const byTopic: TopicStats[] = []
  const bySeverity: SeverityStats[] = []
  const byModule: ModuleStats[] = []
  let totalFindings = 0
  let totalDismissed = 0
  let totalFixed = 0
  let totalOpen = 0

  if (stats) {
    for (const s of stats as any[]) {
      const entry = {
        total: s.total_findings,
        dismissed: s.total_dismissed,
        fixed: s.total_fixed,
        falsePositiveRate: s.false_positive_rate || 0,
      }

      switch (s.stat_type) {
        case 'by_topic':
          byTopic.push({ topic: s.stat_key, ...entry })
          break
        case 'by_severity':
          bySeverity.push({ severity: s.stat_key, ...entry })
          totalFindings += s.total_findings
          totalDismissed += s.total_dismissed
          totalFixed += s.total_fixed
          totalOpen += s.total_open
          break
        case 'by_module':
          byModule.push({ module: s.stat_key, ...entry })
          break
      }
    }
  }

  return {
    period,
    totalFindings,
    totalDismissed,
    totalFixed,
    totalOpen,
    overallFalsePositiveRate: totalFindings > 0 ? totalDismissed / totalFindings : 0,
    byTopic: byTopic.sort((a, b) => b.falsePositiveRate - a.falsePositiveRate),
    bySeverity,
    byModule: byModule.sort((a, b) => b.falsePositiveRate - a.falsePositiveRate),
  }
}

/**
 * Get the worst-performing topics (highest false positive rate).
 * Useful for the Pattern Learner to prioritize investigation.
 */
export async function getWorstTopics(
  db: SupabaseClient,
  limit: number = 10,
): Promise<TopicStats[]> {
  const { data: stats } = await db
    .from('global_quality_stats')
    .select('stat_key, total_findings, total_dismissed, total_fixed, false_positive_rate')
    .eq('stat_period', 'all_time')
    .eq('stat_type', 'by_topic')
    .gte('total_findings', 5)
    .order('false_positive_rate', { ascending: false })
    .limit(limit)

  if (!stats) return []

  return (stats as any[]).map(s => ({
    topic: s.stat_key,
    total: s.total_findings,
    dismissed: s.total_dismissed,
    fixed: s.total_fixed,
    falsePositiveRate: s.false_positive_rate || 0,
  }))
}
