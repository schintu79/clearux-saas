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
