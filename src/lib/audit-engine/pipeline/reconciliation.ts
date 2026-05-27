// ============================================================
// Re-Audit Reconciliation Engine
// ============================================================
// Compares current audit findings against previous audit findings
// to classify each finding's lifecycle status: still_open, fixed,
// regressed, new, or not_reverified.
//
// Uses multi-signal matching:
//   1. checklist_item_id (deterministic match)
//   2. normalized page_url + finding_type + category_index
//   3. title similarity (Jaccard) + category (fuzzy fallback)
//
// PROPRIETARY — do not distribute outside the Fixpath codebase.
// ============================================================

import type { AuditFinding } from '@/types/database'

/* ── Types ──────────────────────────────────────────────────── */

export type ReconciliationStatus =
  | 'still_open'       // Previous finding matched in current — issue persists
  | 'verified_fixed'   // Previous finding NOT in current AND page was crawled — fixed externally
  | 'regressed'        // Was previously fixed/dismissed but reappeared
  | 'not_reverified'   // Previous finding NOT in current but page wasn't crawled — unknown
  | 'new'              // Only in current audit — new issue

export interface ReconciliationItem {
  /** Current finding (null if previous was resolved) */
  currentFindingId: string | null
  /** Previous finding (null if new) */
  previousFindingId: string | null
  /** Lifecycle classification */
  status: ReconciliationStatus
  /** Match confidence (0-1, null for unmatched) */
  matchConfidence: number | null
  /** Which signal matched */
  matchSignal: 'checklist_item' | 'url_type_category' | 'title_similarity' | null
}

export interface ReconciliationSummary {
  stillOpen: number
  verifiedFixed: number
  regressed: number
  notReverified: number
  newFindings: number
  previousTotal: number
  currentTotal: number
}

export interface ReconciliationResult {
  items: ReconciliationItem[]
  summary: ReconciliationSummary
  /** IDs of current findings that should be marked as regressed */
  regressedFindingIds: string[]
  /** IDs of previous findings confirmed as fixed (for score improvement) */
  verifiedFixedPreviousIds: string[]
}

/* ── Matching ──────────────────────────────────────────────── */

function normalizeUrl(url: string | null): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    // Strip www, trailing slash, protocol
    return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '')).toLowerCase()
  } catch {
    return (url || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  }
}

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}

function titleJaccard(a: string, b: string): number {
  const aWords = new Set(normalizeTitle(a).split(/\s+/).filter(Boolean))
  const bWords = new Set(normalizeTitle(b).split(/\s+/).filter(Boolean))
  if (aWords.size === 0 && bWords.size === 0) return 1
  const intersection = [...aWords].filter(w => bWords.has(w)).length
  const union = new Set([...aWords, ...bWords]).size
  return union > 0 ? intersection / union : 0
}

interface MatchResult {
  previousIndex: number
  confidence: number
  signal: 'checklist_item' | 'url_type_category' | 'title_similarity'
}

function findBestMatch(
  current: AuditFinding,
  previousFindings: AuditFinding[],
  usedPrevIndices: Set<number>,
): MatchResult | null {
  let best: MatchResult | null = null

  for (let i = 0; i < previousFindings.length; i++) {
    if (usedPrevIndices.has(i)) continue
    const prev = previousFindings[i]

    // Signal 1: checklist_item_id (deterministic)
    if (current.checklist_item_id && prev.checklist_item_id &&
        current.checklist_item_id === prev.checklist_item_id) {
      return { previousIndex: i, confidence: 1.0, signal: 'checklist_item' }
    }

    // Signal 2: normalized URL + finding_type + category_index
    const currUrl = normalizeUrl(current.page_url)
    const prevUrl = normalizeUrl(prev.page_url)
    const sameUrl = currUrl && prevUrl && currUrl === prevUrl
    const sameType = (current as any).finding_type === (prev as any).finding_type
    const sameCat = current.category_index != null && prev.category_index != null &&
                    current.category_index === prev.category_index

    if (sameUrl && sameType && sameCat) {
      // Within same page + type + category, check title similarity
      const titleSim = titleJaccard(current.title, prev.title)
      if (titleSim >= 0.4) {
        const confidence = 0.7 + titleSim * 0.3
        if (!best || confidence > best.confidence) {
          best = { previousIndex: i, confidence, signal: 'url_type_category' }
        }
      }
    }

    // Signal 3: title similarity + category (fuzzy fallback)
    let score = 0
    if (sameCat) score += 0.3
    const jaccard = titleJaccard(current.title, prev.title)
    score += jaccard * 0.5
    if (sameUrl) score += 0.2
    if (score >= 0.6 && (!best || score > best.confidence)) {
      best = { previousIndex: i, confidence: Math.min(1, score), signal: 'title_similarity' }
    }
  }

  return best
}

/* ── Main reconciliation ──────────────────────────────────── */

/**
 * Reconcile current audit findings against previous audit findings.
 *
 * @param currentFindings  - Findings from the current (new) audit
 * @param previousFindings - Findings from the previous audit (all, including fixed/dismissed)
 * @param crawledUrls      - Set of URLs that were actually crawled in the current audit
 *                           (used to determine if a missing finding's page was re-checked)
 */
export function reconcileFindings(
  currentFindings: AuditFinding[],
  previousFindings: AuditFinding[],
  crawledUrls: Set<string>,
): ReconciliationResult {
  const items: ReconciliationItem[] = []
  const usedPrevIndices = new Set<number>()
  const regressedFindingIds: string[] = []
  const verifiedFixedPreviousIds: string[] = []

  // Normalize crawled URLs for comparison
  const normalizedCrawledUrls = new Set([...crawledUrls].map(u => normalizeUrl(u)))

  // Phase 1: Match each current finding to a previous finding
  for (const current of currentFindings) {
    const match = findBestMatch(current, previousFindings, usedPrevIndices)

    if (match) {
      usedPrevIndices.add(match.previousIndex)
      const prev = previousFindings[match.previousIndex]

      // Check if this was previously fixed/dismissed but reappeared
      const wasFixed = prev.status === 'fixed' || prev.dismissed ||
                       (prev as any).fix_status === 'fixed'
      if (wasFixed) {
        items.push({
          currentFindingId: current.id,
          previousFindingId: prev.id,
          status: 'regressed',
          matchConfidence: match.confidence,
          matchSignal: match.signal,
        })
        regressedFindingIds.push(current.id)
      } else {
        items.push({
          currentFindingId: current.id,
          previousFindingId: prev.id,
          status: 'still_open',
          matchConfidence: match.confidence,
          matchSignal: match.signal,
        })
      }
    } else {
      items.push({
        currentFindingId: current.id,
        previousFindingId: null,
        status: 'new',
        matchConfidence: null,
        matchSignal: null,
      })
    }
  }

  // Phase 2: Previous findings not matched = potentially fixed
  for (let i = 0; i < previousFindings.length; i++) {
    if (usedPrevIndices.has(i)) continue
    const prev = previousFindings[i]

    // Already fixed/dismissed in previous audit — skip (don't double-count)
    if (prev.status === 'fixed' || prev.dismissed) continue

    // Check if the page was crawled in this audit
    const prevUrl = normalizeUrl(prev.page_url)
    const pageWasCrawled = !prevUrl || normalizedCrawledUrls.has(prevUrl) ||
      // Also check if any crawled URL shares the same host (homepage crawl covers the domain)
      [...normalizedCrawledUrls].some(u => {
        try {
          return u.split('/')[0] === prevUrl.split('/')[0]
        } catch { return false }
      })

    if (pageWasCrawled) {
      items.push({
        currentFindingId: null,
        previousFindingId: prev.id,
        status: 'verified_fixed',
        matchConfidence: null,
        matchSignal: null,
      })
      verifiedFixedPreviousIds.push(prev.id)
    } else {
      items.push({
        currentFindingId: null,
        previousFindingId: prev.id,
        status: 'not_reverified',
        matchConfidence: null,
        matchSignal: null,
      })
    }
  }

  const summary: ReconciliationSummary = {
    stillOpen: items.filter(i => i.status === 'still_open').length,
    verifiedFixed: items.filter(i => i.status === 'verified_fixed').length,
    regressed: items.filter(i => i.status === 'regressed').length,
    notReverified: items.filter(i => i.status === 'not_reverified').length,
    newFindings: items.filter(i => i.status === 'new').length,
    previousTotal: previousFindings.filter(f => f.status !== 'fixed' && !f.dismissed).length,
    currentTotal: currentFindings.length,
  }

  return { items, summary, regressedFindingIds, verifiedFixedPreviousIds }
}
