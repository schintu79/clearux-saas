// ============================================================
// ClearUX Proprietary Pipeline — Pattern Learner
// ============================================================
//
// PURPOSE:
// The learning engine that evolves the pipeline over time.
// Analyzes accumulated dismiss/accept data to:
//   1. Detect recurring false positive patterns
//   2. Propose new filter rules (speculative patterns, whitelist entries)
//   3. Detect new synonym groups from dismissed title clusters
//   4. Flag threshold drift (dedup catching too much or too little)
//   5. Log all proposals in rule_changelog for auditability
//
// This is the "brain" — it doesn't change rules directly (yet).
// It proposes changes with confidence scores. High-confidence
// proposals (>0.90) can be auto-applied; lower ones get logged
// for manual review.
//
// WHEN TO RUN:
// - After every audit completion (lightweight pattern check)
// - On a scheduled basis (weekly deep analysis)
// - Manually triggered for full learning cycle
//
// WHEN TO IMPROVE THIS FILE:
// - If false positives keep recurring → lower the detection threshold
// - If good rules are being proposed but not applied → adjust auto-apply logic
// - If the learner is too aggressive → raise confidence requirements
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { createTitleFingerprint } from './relevance-scorer'
import { SPECULATIVE_LANGUAGE, UNVERIFIABLE_TOPICS } from './speculative-filter'

// ── Types ───────────────────────────────────────────────────

export interface LearnedRule {
  ruleType: 'speculative_regex' | 'whitelist' | 'synonym' | 'topic_pattern' | 'threshold'
  action: 'added' | 'modified' | 'proposed'
  ruleKey: string
  oldValue: string | null
  newValue: string
  reason: string
  confidence: number
  dataPoints: number
  autoApplied: boolean
}

export interface LearningReport {
  analyzedPatterns: number
  proposedRules: LearnedRule[]
  autoAppliedRules: LearnedRule[]
  insights: string[]
}

// ── Configuration ───────────────────────────────────────────

export const LEARNER_CONFIG = {
  // Minimum data points before proposing a rule
  MIN_DATA_FOR_RULE: 8,

  // Confidence thresholds
  AUTO_APPLY_CONFIDENCE: 0.92,    // Auto-apply rules above this
  PROPOSAL_CONFIDENCE: 0.70,      // Propose rules above this

  // Dismiss rate to trigger false-positive detection
  FALSE_POSITIVE_THRESHOLD: 0.75,

  // Minimum cluster size for synonym detection
  MIN_CLUSTER_SIZE: 3,

  // Maximum rules to propose per learning cycle
  MAX_PROPOSALS_PER_CYCLE: 10,
}

// ── Pattern Analysis ────────────────────────────────────────

/**
 * Analyze a finding title to extract key phrases that could become
 * filter patterns if the finding is consistently dismissed.
 */
function extractKeyPhrases(title: string): string[] {
  const normalized = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim()
  const phrases: string[] = []

  // Extract 2-word and 3-word n-grams
  const words = normalized.split(/\s+/).filter(w => w.length >= 3)
  for (let i = 0; i < words.length - 1; i++) {
    phrases.push(`${words[i]} ${words[i + 1]}`)
    if (i < words.length - 2) {
      phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
    }
  }

  return phrases
}

/**
 * Check if a phrase is already covered by existing speculative patterns.
 */
function isAlreadyCovered(phrase: string): boolean {
  const combined = phrase
  return (
    SPECULATIVE_LANGUAGE.some(p => p.test(combined)) ||
    UNVERIFIABLE_TOPICS.some(p => p.test(combined))
  )
}

// ── Core Learning Functions ─────────────────────────────────

/**
 * Detect recurring false positive patterns from finding_patterns data.
 * Returns proposed filter rules for high-dismiss-rate patterns.
 */
async function detectFalsePositivePatterns(
  db: SupabaseClient,
): Promise<LearnedRule[]> {
  const rules: LearnedRule[] = []

  // Fetch patterns with high dismiss rates
  const { data: patterns } = await db
    .from('finding_patterns')
    .select('title_hash, canonical_title, topic, total_shown, total_dismissed, total_fixed')
    .gte('total_shown', LEARNER_CONFIG.MIN_DATA_FOR_RULE)
    .order('total_dismissed', { ascending: false })
    .limit(50)

  if (!patterns) return rules

  for (const p of patterns as any[]) {
    const dismissRate = p.total_dismissed / p.total_shown
    const fixRate = p.total_fixed / p.total_shown

    if (dismissRate < LEARNER_CONFIG.FALSE_POSITIVE_THRESHOLD) continue
    if (fixRate > 0.20) continue // If 20%+ users fix it, it's probably valid

    // Check if this pattern is already covered
    if (isAlreadyCovered(p.canonical_title)) continue

    // Extract the key phrase that should become a filter
    const phrases = extractKeyPhrases(p.canonical_title)
    const bestPhrase = phrases[0] || p.canonical_title.toLowerCase()

    const confidence = Math.min(
      dismissRate,
      calculateDataConfidence(p.total_shown),
    )

    if (confidence < LEARNER_CONFIG.PROPOSAL_CONFIDENCE) continue

    rules.push({
      ruleType: 'whitelist',
      action: confidence >= LEARNER_CONFIG.AUTO_APPLY_CONFIDENCE ? 'added' : 'proposed',
      ruleKey: `FALSE_POSITIVE_WHITELIST: ${bestPhrase}`,
      oldValue: null,
      newValue: `"${bestPhrase}" — auto-detected false positive`,
      reason: `Dismissed ${Math.round(dismissRate * 100)}% of the time across ${p.total_shown} occurrences (fixed only ${Math.round(fixRate * 100)}% of the time)`,
      confidence,
      dataPoints: p.total_shown,
      autoApplied: confidence >= LEARNER_CONFIG.AUTO_APPLY_CONFIDENCE,
    })

    if (rules.length >= LEARNER_CONFIG.MAX_PROPOSALS_PER_CYCLE) break
  }

  return rules
}

/**
 * Detect finding titles that are worded differently but always
 * dismissed together — potential new synonym groups or topic patterns.
 */
async function detectSynonymClusters(
  db: SupabaseClient,
): Promise<LearnedRule[]> {
  const rules: LearnedRule[] = []

  // Fetch all highly-dismissed patterns
  const { data: patterns } = await db
    .from('finding_patterns')
    .select('title_hash, canonical_title, topic, total_shown, total_dismissed')
    .gte('total_shown', 5)
    .gte('total_dismissed', 3)
    .order('canonical_title', { ascending: true })
    .limit(100)

  if (!patterns || patterns.length < 2) return rules

  // Group by topic — patterns in the same topic that are both high-dismiss
  // might need a merged synonym group
  const topicGroups = new Map<string, any[]>()
  for (const p of patterns as any[]) {
    if (!p.topic) continue
    const group = topicGroups.get(p.topic) || []
    group.push(p)
    topicGroups.set(p.topic, group)
  }

  for (const [topic, group] of topicGroups) {
    if (group.length < LEARNER_CONFIG.MIN_CLUSTER_SIZE) continue

    // Extract common words across titles in this cluster
    const wordSets: Set<string>[] = group.map((p: any) =>
      new Set<string>(
        (p.canonical_title as string)
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter((w: string) => w.length >= 4),
      ),
    )

    // Find words that appear in most titles (>60%)
    const allWords = new Map<string, number>()
    for (const ws of wordSets) {
      for (const w of ws) {
        allWords.set(w, (allWords.get(w) || 0) + 1)
      }
    }

    const commonWords = [...allWords.entries()]
      .filter(([, count]) => count >= group.length * 0.6)
      .map(([word]) => word)

    if (commonWords.length >= 2) {
      const totalDataPoints = group.reduce((s: number, p: any) => s + p.total_shown, 0)
      const avgDismissRate = group.reduce((s: number, p: any) => s + p.total_dismissed / p.total_shown, 0) / group.length
      const confidence = Math.min(avgDismissRate, calculateDataConfidence(totalDataPoints))

      if (confidence >= LEARNER_CONFIG.PROPOSAL_CONFIDENCE) {
        rules.push({
          ruleType: 'topic_pattern',
          action: 'proposed',
          ruleKey: `TOPIC_PATTERN: ${topic}`,
          oldValue: null,
          newValue: JSON.stringify({ topic, keywords: commonWords }),
          reason: `${group.length} findings in "${topic}" cluster share keywords [${commonWords.join(', ')}] and are dismissed ${Math.round(avgDismissRate * 100)}% of the time`,
          confidence,
          dataPoints: totalDataPoints,
          autoApplied: false, // Topic patterns are always manual review
        })
      }
    }
  }

  return rules
}

/**
 * Analyze dedup effectiveness — are the current thresholds right?
 * Checks if similar findings keep appearing despite dedup.
 */
async function analyzeThresholdDrift(
  db: SupabaseClient,
): Promise<LearnedRule[]> {
  const rules: LearnedRule[] = []

  // Find patterns with very similar canonical_titles (potential dedup misses)
  const { data: patterns } = await db
    .from('finding_patterns')
    .select('canonical_title, total_shown')
    .gte('total_shown', 3)
    .order('canonical_title', { ascending: true })
    .limit(200)

  if (!patterns || patterns.length < 2) return rules

  // Simple check: look for titles that share 70%+ words but have different hashes
  let nearDupCount = 0
  const patternList = patterns as any[]

  for (let i = 0; i < patternList.length - 1; i++) {
    for (let j = i + 1; j < Math.min(i + 10, patternList.length); j++) {
      const wordsA = new Set(patternList[i].canonical_title.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 4))
      const wordsB = new Set(patternList[j].canonical_title.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 4))

      if (wordsA.size === 0 || wordsB.size === 0) continue

      let overlap = 0
      for (const w of wordsA) {
        if (wordsB.has(w)) overlap++
      }

      const similarity = overlap / Math.min(wordsA.size, wordsB.size)
      if (similarity >= 0.70) nearDupCount++
    }
  }

  if (nearDupCount >= 5) {
    rules.push({
      ruleType: 'threshold',
      action: 'proposed',
      ruleKey: 'THRESHOLDS: BASE',
      oldValue: '0.50',
      newValue: '0.45',
      reason: `Detected ${nearDupCount} near-duplicate pattern pairs that survived dedup — consider lowering BASE threshold`,
      confidence: Math.min(0.85, nearDupCount / 20),
      dataPoints: nearDupCount,
      autoApplied: false,
    })
  }

  return rules
}

// ── Helpers ─────────────────────────────────────────────────

function calculateDataConfidence(dataPoints: number): number {
  return 1 - Math.exp(-dataPoints / 15)
}

// ── Public API ──────────────────────────────────────────────

/**
 * Run a full learning cycle. Analyzes all accumulated data and
 * proposes (or auto-applies) pipeline improvements.
 *
 * Call after each audit completes, or on a schedule.
 */
export async function runLearningCycle(
  db: SupabaseClient,
): Promise<LearningReport> {
  const insights: string[] = []

  // 1. Count analyzed patterns
  const { count: patternCount } = await db
    .from('finding_patterns')
    .select('id', { count: 'exact', head: true })

  const analyzedPatterns = patternCount || 0
  insights.push(`Analyzed ${analyzedPatterns} finding patterns`)

  // 2. Run all detection algorithms in parallel
  const [fpRules, synonymRules, thresholdRules] = await Promise.all([
    detectFalsePositivePatterns(db),
    detectSynonymClusters(db),
    analyzeThresholdDrift(db),
  ])

  const allRules = [...fpRules, ...synonymRules, ...thresholdRules]

  // 3. Sort by confidence (highest first)
  allRules.sort((a, b) => b.confidence - a.confidence)

  // 4. Separate auto-applied from proposed
  const autoAppliedRules = allRules.filter(r => r.autoApplied)
  const proposedRules = allRules.filter(r => !r.autoApplied)

  // 5. Log all rules to rule_changelog
  for (const rule of allRules) {
    const { error: uncheckedInsertErr1 } = await db.from('rule_changelog').insert({
      rule_type: rule.ruleType,
      action: rule.action,
      rule_key: rule.ruleKey,
      old_value: rule.oldValue,
      new_value: rule.newValue,
      reason: rule.reason,
      confidence: rule.confidence,
      data_points: rule.dataPoints,
      auto_applied: rule.autoApplied,
    } as any)
    if (uncheckedInsertErr1) console.error(`[db] insert failed (rule_changelog): ${uncheckedInsertErr1.message}`)
  }

  // 6. Generate insights
  if (fpRules.length > 0) {
    insights.push(`Detected ${fpRules.length} recurring false positive pattern${fpRules.length > 1 ? 's' : ''}`)
  }
  if (synonymRules.length > 0) {
    insights.push(`Found ${synonymRules.length} potential synonym cluster${synonymRules.length > 1 ? 's' : ''}`)
  }
  if (thresholdRules.length > 0) {
    insights.push(`Threshold drift detected — dedup may need tuning`)
  }
  if (autoAppliedRules.length > 0) {
    insights.push(`Auto-applied ${autoAppliedRules.length} high-confidence rule${autoAppliedRules.length > 1 ? 's' : ''}`)
  }

  return {
    analyzedPatterns,
    proposedRules,
    autoAppliedRules,
    insights,
  }
}

/**
 * Lightweight post-audit learning check.
 * Faster than full cycle — only checks patterns related to
 * the findings from this specific audit.
 */
export async function postAuditLearn(
  db: SupabaseClient,
  findingTitles: string[],
): Promise<{ newInsights: number; logged: boolean }> {
  if (findingTitles.length === 0) return { newInsights: 0, logged: false }

  // Check if any of this audit's findings match known high-FP patterns
  const hashes = findingTitles
    .map(t => createTitleFingerprint(t))
    .filter(h => h.length > 0)

  if (hashes.length === 0) return { newInsights: 0, logged: false }

  const { data: patterns } = await db
    .from('finding_patterns')
    .select('canonical_title, total_shown, total_dismissed')
    .in('title_hash', hashes)
    .gte('total_shown', LEARNER_CONFIG.MIN_DATA_FOR_RULE)

  if (!patterns) return { newInsights: 0, logged: false }

  let newInsights = 0
  for (const p of patterns as any[]) {
    const dismissRate = p.total_dismissed / p.total_shown
    if (dismissRate >= LEARNER_CONFIG.FALSE_POSITIVE_THRESHOLD && !isAlreadyCovered(p.canonical_title)) {
      newInsights++
    }
  }

  return { newInsights, logged: newInsights > 0 }
}

/**
 * Get pending rule proposals for admin review.
 */
export async function getPendingProposals(
  db: SupabaseClient,
  limit: number = 20,
): Promise<LearnedRule[]> {
  const { data } = await db
    .from('rule_changelog')
    .select('*')
    .eq('action', 'proposed')
    .eq('auto_applied', false)
    .order('confidence', { ascending: false })
    .limit(limit)

  if (!data) return []

  return (data as any[]).map(d => ({
    ruleType: d.rule_type,
    action: d.action,
    ruleKey: d.rule_key,
    oldValue: d.old_value,
    newValue: d.new_value,
    reason: d.reason,
    confidence: d.confidence,
    dataPoints: d.data_points,
    autoApplied: d.auto_applied,
  }))
}
