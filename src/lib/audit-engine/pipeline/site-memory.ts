// ============================================================
// ClearUX Proprietary Pipeline — Site Memory Engine
// ============================================================
//
// PURPOSE:
// Per-domain intelligence that persists across audits. When a user
// audits the same site multiple times, the system remembers:
//   - What findings were dismissed (and why)
//   - What findings were fixed (confirmation data)
//   - What context the user provided ("we do this intentionally")
//   - Historical patterns specific to this domain
//
// This module reads all available memory for a domain and composes
// a context block that gets injected into the AI analysis prompt,
// making each re-audit smarter than the last.
//
// DATA SOURCES:
//   1. site_notes table → user-provided context + dismissals
//   2. finding_patterns table → global dismiss rates for this site's finding types
//   3. Previous audit findings → what was flagged before and what happened
//
// HOW IT WORKS:
//   1. Query all data sources for the domain
//   2. Classify each piece of memory by type and confidence
//   3. Compose a structured context block for the AI prompt
//   4. Include "learned rules" — patterns the system has detected
//
// WHEN TO IMPROVE THIS FILE:
// - If the AI keeps re-flagging dismissed findings → strengthen the skip rules
// - If site-specific context isn't being used → check the prompt injection point
// - If memory grows too large → add pruning/relevance filtering
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { createTitleFingerprint } from './relevance-scorer'

// ── Types ───────────────────────────────────────────────────

export interface SiteMemory {
  domain: string
  totalAudits: number
  dismissedFindings: DismissedFinding[]
  fixedFindings: FixedFinding[]
  userContext: UserContext[]
  learnedPatterns: LearnedPattern[]
  promptBlock: string            // The composed context block ready for AI injection
}

interface DismissedFinding {
  title: string
  reason: string
  dismissedAt: string
}

interface FixedFinding {
  title: string
  severity: string
  fixedAt: string
}

interface UserContext {
  type: 'context' | 'dismissal' | 'discussion'
  title: string
  content: string
  category?: string
}

interface LearnedPattern {
  pattern: string
  insight: string
  confidence: number
}

// ── Configuration ───────────────────────────────────────────

export const SITE_MEMORY_CONFIG = {
  // Max dismissals to include in prompt (prevent token bloat)
  MAX_DISMISSALS_IN_PROMPT: 15,

  // Max user context notes to include
  MAX_CONTEXT_NOTES: 10,

  // Max learned patterns to include
  MAX_LEARNED_PATTERNS: 8,

  // Minimum dismiss rate to flag as "known false positive for this domain"
  DOMAIN_FP_THRESHOLD: 0.60,

  // How many past audits to look at for pattern detection
  PAST_AUDIT_LOOKBACK: 5,
}

// ── Memory Composition ──────────────────────────────────────

function composeDismissalBlock(dismissed: DismissedFinding[]): string {
  if (dismissed.length === 0) return ''

  const entries = dismissed
    .slice(0, SITE_MEMORY_CONFIG.MAX_DISMISSALS_IN_PROMPT)
    .map(d => `  - SKIP: "${d.title}" — Reason: ${d.reason}`)

  return `
DISMISSED FINDINGS — DO NOT RE-FLAG:
The following findings were previously reported and the user explicitly dismissed them.
Do NOT report these issues again under any title or phrasing.
${entries.join('\n')}
`.trim()
}

function composeContextBlock(context: UserContext[]): string {
  if (context.length === 0) return ''

  const entries = context
    .slice(0, SITE_MEMORY_CONFIG.MAX_CONTEXT_NOTES)
    .map(c => {
      const label = c.type === 'dismissal' ? 'SKIP' : c.type === 'discussion' ? 'CONTEXT' : 'NOTE'
      return `  [${label}] ${c.title}: ${c.content}`
    })

  return `
CLIENT-PROVIDED CONTEXT — RESPECT THESE:
${entries.join('\n')}
`.trim()
}

function composeLearnedBlock(patterns: LearnedPattern[]): string {
  if (patterns.length === 0) return ''

  const entries = patterns
    .slice(0, SITE_MEMORY_CONFIG.MAX_LEARNED_PATTERNS)
    .map(p => `  - ${p.pattern}: ${p.insight} (confidence: ${Math.round(p.confidence * 100)}%)`)

  return `
LEARNED PATTERNS FOR THIS DOMAIN:
Based on historical audit data, the following patterns have been detected:
${entries.join('\n')}
Apply these insights to avoid repeating known false positives.
`.trim()
}

function composeFixedBlock(fixed: FixedFinding[]): string {
  if (fixed.length === 0) return ''

  const entries = fixed
    .slice(0, 10)
    .map(f => `  - PREVIOUSLY FIXED: "${f.title}" (${f.severity})`)

  return `
PREVIOUSLY FIXED FINDINGS — VERIFY BEFORE RE-FLAGGING:
The user marked these as fixed in a previous audit. Only re-report if
the issue is CLEARLY still present in the current content:
${entries.join('\n')}
`.trim()
}

// ── Public API ──────────────────────────────────────────────

/**
 * Load all site memory for a domain and compose a prompt context block.
 * This is the main entry point — call it before AI analysis.
 */
export async function loadSiteMemory(
  db: SupabaseClient,
  domain: string,
  userId: string,
): Promise<SiteMemory> {
  // Parallel fetch all data sources
  const [siteNotesRes, pastAuditsRes] = await Promise.all([
    // 1. Site notes (dismissals, context, discussions)
    db
      .from('site_notes')
      .select('note_type, title, content, category, finding_ref, created_at')
      .eq('user_id', userId)
      .eq('domain', domain)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(30),

    // 2. Past audits for this domain
    db
      .from('audits')
      .select('id, completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .ilike('product_url', `%${domain}%`)
      .order('completed_at', { ascending: false })
      .limit(SITE_MEMORY_CONFIG.PAST_AUDIT_LOOKBACK),
  ])

  // Parse site notes into structured memory
  const userContext: UserContext[] = []
  const dismissedFindings: DismissedFinding[] = []

  if (siteNotesRes.data) {
    for (const note of siteNotesRes.data as any[]) {
      if (note.note_type === 'dismissal' && note.finding_ref) {
        dismissedFindings.push({
          title: note.finding_ref,
          reason: note.content,
          dismissedAt: note.created_at,
        })
      }
      userContext.push({
        type: note.note_type as 'context' | 'dismissal' | 'discussion',
        title: note.title,
        content: note.content,
        category: note.category || undefined,
      })
    }
  }

  // Fetch fixed findings from most recent past audit
  const fixedFindings: FixedFinding[] = []
  const pastAudits = (pastAuditsRes.data || []) as any[]
  const totalAudits = pastAudits.length

  if (pastAudits.length > 0) {
    const mostRecentAuditId = pastAudits[0].id
    const { data: prevFindings } = await db
      .from('audit_findings')
      .select('title, severity, status, dismissed, status_updated_at')
      .eq('audit_id', mostRecentAuditId)
      .order('sort_order', { ascending: true })

    if (prevFindings) {
      for (const f of prevFindings as any[]) {
        if (f.status === 'fixed') {
          fixedFindings.push({
            title: f.title,
            severity: f.severity,
            fixedAt: f.status_updated_at || '',
          })
        }
      }
    }
  }

  // Detect learned patterns from finding_patterns table
  const learnedPatterns: LearnedPattern[] = []

  // Get fingerprints of dismissed findings to check global patterns
  if (dismissedFindings.length > 0) {
    const hashes = dismissedFindings
      .map(d => createTitleFingerprint(d.title))
      .filter(h => h.length > 0)

    if (hashes.length > 0) {
      const { data: patterns } = await db
        .from('finding_patterns')
        .select('canonical_title, total_shown, total_dismissed, total_fixed')
        .in('title_hash', hashes)

      if (patterns) {
        for (const p of patterns as any[]) {
          if (p.total_shown >= 5) {
            const dismissRate = p.total_dismissed / p.total_shown
            if (dismissRate >= SITE_MEMORY_CONFIG.DOMAIN_FP_THRESHOLD) {
              learnedPatterns.push({
                pattern: p.canonical_title,
                insight: `Dismissed ${Math.round(dismissRate * 100)}% of the time across all audits — likely a false positive pattern`,
                confidence: dismissRate,
              })
            }
          }
        }
      }
    }
  }

  // Also find globally high-FP patterns that might apply
  const { data: globalFPs } = await db
    .from('finding_patterns')
    .select('canonical_title, total_shown, total_dismissed')
    .gte('total_shown', 10)
    .order('total_dismissed', { ascending: false })
    .limit(10)

  if (globalFPs) {
    for (const gfp of globalFPs as any[]) {
      const dismissRate = gfp.total_dismissed / gfp.total_shown
      if (dismissRate >= 0.80) {
        // Only add if not already in learned patterns
        const alreadyExists = learnedPatterns.some(
          lp => lp.pattern === gfp.canonical_title,
        )
        if (!alreadyExists) {
          learnedPatterns.push({
            pattern: gfp.canonical_title,
            insight: `Global false positive: dismissed ${Math.round(dismissRate * 100)}% of the time across all users`,
            confidence: dismissRate,
          })
        }
      }
    }
  }

  // Sort learned patterns by confidence
  learnedPatterns.sort((a, b) => b.confidence - a.confidence)

  // Compose the final prompt block
  const blocks = [
    composeDismissalBlock(dismissedFindings),
    composeContextBlock(userContext.filter(c => c.type !== 'dismissal')),
    composeFixedBlock(fixedFindings),
    composeLearnedBlock(learnedPatterns),
  ].filter(b => b.length > 0)

  const promptBlock = blocks.length > 0
    ? `\n\n=== SITE MEMORY (${totalAudits} previous audit${totalAudits !== 1 ? 's' : ''}) ===\n${blocks.join('\n\n')}\n=== END SITE MEMORY ===`
    : ''

  return {
    domain,
    totalAudits,
    dismissedFindings,
    fixedFindings,
    userContext,
    learnedPatterns,
    promptBlock,
  }
}

/**
 * Quick check: has this domain been audited before?
 * Useful for deciding whether to load full memory.
 */
export async function hasSiteMemory(
  db: SupabaseClient,
  domain: string,
  userId: string,
): Promise<boolean> {
  const { count } = await db
    .from('site_notes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('domain', domain)
    .eq('is_active', true)

  return (count || 0) > 0
}
