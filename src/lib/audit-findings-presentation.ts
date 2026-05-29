/**
 * Presentation-only helpers for the audit detail page.
 *
 * These helpers DO NOT mutate or change audit-engine behaviour. They are pure
 * functions that take the already-stored findings and produce display-friendly
 * groupings, so the UI can show a single card when the same issue spans
 * multiple categories/pages — without touching dedupe in the pipeline, the DB,
 * or status-mutation semantics.
 *
 * Safety rules baked in:
 *  - Status / dismiss actions remain tied to a single "primary" finding (the
 *    highest-severity / strongest-evidence record in the group).
 *  - The original AuditFinding[] is preserved on the group so callers can
 *    still surface page URLs / evidence from every grouped record.
 *  - We never invent strengths. "Doing right" is derived only from explicit
 *    category scores + their summary text.
 */

import type { AuditFinding } from '@/types/database';

export interface GroupedFinding {
  /** The primary record — status / dismiss actions operate ONLY on this id. */
  primary: AuditFinding;
  /** Every finding record that was merged into this display group. */
  members: AuditFinding[];
  /** Stable signature used for grouping (debug / keys). */
  signature: string;
  /** Module indices (0..5) that this consolidated finding affects. */
  affectedModuleIndices: number[];
  /** Distinct page URLs collected across members (deduped, order-preserved). */
  affectedPages: string[];
  /** True if more than one finding was merged. */
  isConsolidated: boolean;
}

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** Strip common boilerplate so near-duplicate titles collapse to one key. */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(on|in|the|a|an|of|for|to|and|or|with)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Take the first ~80 chars of the recommendation as a fingerprint. */
function recommendationFingerprint(rec: string | null | undefined): string {
  if (!rec) return '';
  return normalizeTitle(rec).slice(0, 80);
}

/**
 * Build a stable, conservative signature for grouping. We require BOTH a
 * matching normalized title AND a matching recommendation fingerprint — so we
 * never collapse unrelated findings that happen to share a word.
 */
function buildSignature(f: AuditFinding): string {
  const title = normalizeTitle(f.title || '');
  const rec = recommendationFingerprint(f.recommendation);
  if (!title) return `__id__:${f.id}`;
  return `${title}|${rec}`;
}

/** Pick the strongest record as the primary — drives status/dismiss actions. */
function pickPrimary(members: AuditFinding[]): AuditFinding {
  return [...members].sort((a, b) => {
    const sevA = SEVERITY_WEIGHT[a.severity] || 0;
    const sevB = SEVERITY_WEIGHT[b.severity] || 0;
    if (sevA !== sevB) return sevB - sevA;
    const evA = (a.target_element ? 2 : 0) + (a.page_url ? 1 : 0) + (a.screenshot_url ? 1 : 0);
    const evB = (b.target_element ? 2 : 0) + (b.page_url ? 1 : 0) + (b.screenshot_url ? 1 : 0);
    if (evA !== evB) return evB - evA;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  })[0];
}

export function groupFindingsForDisplay(
  findings: AuditFinding[],
  moduleIndexResolver: (f: AuditFinding) => number,
): GroupedFinding[] {
  const buckets = new Map<string, AuditFinding[]>();
  const order: string[] = [];

  for (const f of findings) {
    const sig = buildSignature(f);
    if (!buckets.has(sig)) {
      buckets.set(sig, []);
      order.push(sig);
    }
    buckets.get(sig)!.push(f);
  }

  return order.map((sig) => {
    const members = buckets.get(sig)!;
    const primary = pickPrimary(members);
    const moduleSet = new Set<number>();
    const pageSet = new Set<string>();
    for (const m of members) {
      moduleSet.add(moduleIndexResolver(m));
      if (m.page_url) pageSet.add(m.page_url);
    }
    return {
      primary,
      members,
      signature: sig,
      affectedModuleIndices: Array.from(moduleSet).sort((a, b) => a - b),
      affectedPages: Array.from(pageSet),
      isConsolidated: members.length > 1,
    };
  });
}

/** Tag used in the cockpit / chips to communicate health at a glance. */
export type RiskLevel = 'strong' | 'solid' | 'attention' | 'critical' | 'not_audited';

export function riskFromScore(score: number, audited: boolean): RiskLevel {
  if (!audited) return 'not_audited';
  if (score >= 80) return 'strong';
  if (score >= 60) return 'solid';
  if (score >= 40) return 'attention';
  return 'critical';
}

/** Conservative label for "doing right" — derived only from category score. */
export function strengthLabel(score: number): string | null {
  if (score >= 85) return 'Strong';
  if (score >= 70) return 'Solid';
  return null;
}

/** Conservative label for the bottom of the score range. */
export function weaknessLabel(score: number): string | null {
  if (score < 40) return 'Critical gap';
  if (score < 60) return 'Needs attention';
  return null;
}

/**
 * Brand Clarity Signals — fallback mode detection.
 *
 * When Brand Consistency module (indices 20-23) is NOT included in the audit,
 * the canonical `brand` category still receives findings from category 1
 * (Value Proposition & Messaging). This helper flags that the brand score
 * is based on limited signals so the UI can show an appropriate qualifier.
 *
 * @param auditedModuleSlugs - module slugs that were included (null = all)
 * @returns true if brand scoring is based on partial data only
 */
export function isBrandScorePartial(auditedModuleSlugs: string[] | null): boolean {
  if (!auditedModuleSlugs) return false; // all modules included
  return !auditedModuleSlugs.includes('brand_consistency');
}

/* ── Reconciliation-Aware Sort ─────────────────────────────── */

/**
 * Sort priority for reconciliation status.
 * Spec order: regressions → still-active → net-new → improved/fixed → recommendations.
 */
const STATUS_SORT_RANK: Record<string, number> = {
  regressed: 6,
  still_present: 5,
  new: 4,
  improved: 2,
  fixed: 1,
  duplicate: 0,
  superseded: 0,
  invalidated: 0,
};

/**
 * Combined sort for reconciliation-aware display.
 * Primary: reconciliation status rank (regressions first)
 * Secondary: severity within each status group
 * Falls back to severity-only when no status_in_audit is set (first audits).
 */
export function reconciliationAwareSort(a: GroupedFinding, b: GroupedFinding): number {
  const aStatus = (a.primary as any).status_in_audit || '';
  const bStatus = (b.primary as any).status_in_audit || '';

  // If neither has a reconciliation status, sort by severity only
  const aRank = STATUS_SORT_RANK[aStatus] ?? 4; // default to 'new' rank
  const bRank = STATUS_SORT_RANK[bStatus] ?? 4;

  if (aRank !== bRank) return bRank - aRank;

  // Within same status group, sort by severity
  const sevA = SEVERITY_WEIGHT[a.primary.severity] || 0;
  const sevB = SEVERITY_WEIGHT[b.primary.severity] || 0;
  return sevB - sevA;
}

/**
 * Group findings by reconciliation status for section-based display.
 * Returns groups in spec order with only non-empty groups.
 */
export interface ReconciliationGroup {
  key: string;
  label: string;
  findings: GroupedFinding[];
  variant: 'danger' | 'warning' | 'info' | 'success' | 'muted';
}

export function groupByReconciliationStatus(groups: GroupedFinding[]): ReconciliationGroup[] {
  const sections: Array<{ key: string; label: string; variant: ReconciliationGroup['variant'] }> = [
    { key: 'regressed', label: 'Regressions', variant: 'danger' },
    { key: 'still_present', label: 'Still active', variant: 'warning' },
    { key: 'new', label: 'New findings', variant: 'info' },
    { key: 'improved', label: 'Improved', variant: 'success' },
    { key: 'fixed', label: 'Fixed', variant: 'success' },
  ];

  const result: ReconciliationGroup[] = [];

  for (const section of sections) {
    const items = groups.filter(g => {
      const status = (g.primary as any).status_in_audit || 'new';
      return status === section.key;
    });

    if (items.length > 0) {
      // Sort within each group by severity
      items.sort((a, b) => {
        const sevA = SEVERITY_WEIGHT[a.primary.severity] || 0;
        const sevB = SEVERITY_WEIGHT[b.primary.severity] || 0;
        return sevB - sevA;
      });

      result.push({ ...section, findings: items });
    }
  }

  // Catch any findings with unexpected statuses (duplicate, superseded, etc.)
  const knownStatuses = new Set(sections.map(s => s.key));
  const other = groups.filter(g => {
    const status = (g.primary as any).status_in_audit || 'new';
    return !knownStatuses.has(status);
  });
  if (other.length > 0) {
    result.push({ key: 'other', label: 'Other', variant: 'muted', findings: other });
  }

  return result;
}
