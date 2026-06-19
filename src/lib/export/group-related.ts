/**
 * Related-finding grouper for export.
 *
 * Detects findings that orbit the same UI element, feature, or page
 * section and groups them under a single heading with sub-points.
 *
 * Example: 9 separate findings about the signup checkbox opt-in
 * language → 1 group titled "Signup form consent and opt-in" with
 * the individual recommendations as sub-items.
 *
 * This runs AFTER deduplication — it handles the case where findings
 * are genuinely different observations (not duplicates) but all relate
 * to the same user-facing element.
 *
 * React-free, reusable across all export renderers.
 */

import type { ClassifiedFinding } from './classify-evidence';

/* ── Types ─────────────────────────────────────────────── */

export interface FindingCluster {
  /** Human-readable cluster label. */
  label: string;
  /** The cluster's overall severity (highest among members). */
  severity: string;
  /** Primary finding — the most severe / most detailed. */
  primary: ClassifiedFinding;
  /** All findings in this cluster, ordered by severity then detail. */
  members: ClassifiedFinding[];
  /** True if this is a genuine cluster (>1 member). */
  isClustered: boolean;
}

/* ── Cluster definitions ───────────────────────────────── */

interface ClusterRule {
  /** Unique key for this cluster. */
  id: string;
  /** Human-readable label for the cluster heading. */
  label: string;
  /** Patterns to match against title + description. ALL must match. */
  patterns: RegExp[];
}

const CLUSTER_RULES: ClusterRule[] = [
  {
    id: 'signup-consent',
    label: 'Signup form consent and opt-in clarity',
    patterns: [
      /opt[- ]?in|checkbox|consent|marketing\s+(communication|email)|unsubscribe|signup\s+(form|process|language)|sign[- ]?up\s+(form|process)/i,
    ],
  },
  {
    id: 'meta-tags',
    label: 'Page-specific meta tags and descriptions',
    patterns: [
      // `og[:\s]` matched the substring "og " inside ordinary words (log, blog,
      // dialog, catalog), pulling unrelated findings into this cluster. Require
      // the real Open Graph prefix (og:title / og_title) or explicit meta terms.
      /meta\s+description|\bog[:_][a-z]|open\s+graph|<meta\b/i,
    ],
  },
  {
    id: 'structured-data',
    label: 'Structured data and schema markup',
    patterns: [
      /json-?ld|structured\s+data|schema\.org|@type|rich\s+snippet/i,
    ],
  },
  {
    id: 'canonical-urls',
    label: 'Canonical URL configuration',
    patterns: [
      /canonical\s*(url|tag)?/i,
    ],
  },
  // Accessibility is a CATEGORY, not a related-finding cluster. The old single
  // rule matched anything containing "wcag"/"aria", so four unrelated criteria
  // (2.5.5 touch targets, 2.1.1 keyboard, 1.1.1 alt text, 2.4.6 headings) all
  // collapsed into one meaningless "Accessibility and inclusive design" group
  // with different elements and different fixes. Cluster ONLY by a shared,
  // cohesive sub-topic so genuinely-related findings group and distinct WCAG
  // criteria stay separate.
  {
    id: 'a11y-contrast',
    label: 'Color contrast and legibility',
    patterns: [/color\s+contrast|contrast\s+ratio|low\s+contrast|\b1\.4\.(3|6|11)\b/i],
  },
  {
    id: 'a11y-keyboard',
    label: 'Keyboard accessibility and focus order',
    patterns: [/keyboard\s+(nav|access|accessib|operab)|tabindex|focus\s+(order|manage|management|trap|visible|indicator)|\b2\.1\.1\b|\b2\.4\.7\b/i],
  },
  {
    id: 'a11y-alt-text',
    label: 'Alternative text for images and media',
    patterns: [/\balt\s+text\b|non-?text\s+content|image\s+alt|missing\s+alt|\b1\.1\.1\b/i],
  },
  {
    id: 'i18n',
    label: 'Internationalization and language support',
    patterns: [
      /hreflang|language\s+(variant|support)|i18n|international|non-?english|locali[zs]/i,
    ],
  },
  {
    id: 'social-proof',
    label: 'Trust signals and social proof',
    patterns: [
      /testimonial|case\s+stud|social\s+proof|trust\s+(signal|badge|messaging)|security\s+messaging|credibilit/i,
    ],
  },
];

/* ── Matching ──────────────────────────────────────────── */

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function matchCluster(f: ClassifiedFinding): string | null {
  const text = `${f.title} ${f.description}`.toLowerCase();
  for (const rule of CLUSTER_RULES) {
    if (rule.patterns.every((p) => p.test(text))) {
      return rule.id;
    }
  }
  return null;
}

function clusterLabel(id: string): string {
  return CLUSTER_RULES.find((r) => r.id === id)?.label || id;
}

/* ── Public API ─────────────────────────────────────────── */

/**
 * Group related findings into clusters.
 *
 * Findings that don't match any cluster rule pass through as
 * single-member clusters (isClustered = false).
 *
 * Returns clusters ordered by highest severity, then by size.
 */
export function groupRelatedFindings(
  findings: ClassifiedFinding[],
): FindingCluster[] {
  const clusters = new Map<string, ClassifiedFinding[]>();
  const unclustered: ClassifiedFinding[] = [];
  const clusterOrder: string[] = [];

  for (const f of findings) {
    const clusterId = matchCluster(f);
    if (clusterId) {
      if (!clusters.has(clusterId)) {
        clusters.set(clusterId, []);
        clusterOrder.push(clusterId);
      }
      clusters.get(clusterId)!.push(f);
    } else {
      unclustered.push(f);
    }
  }

  const result: FindingCluster[] = [];

  // Build clustered groups (only if >1 member — single findings stay standalone)
  for (const id of clusterOrder) {
    const members = clusters.get(id)!;

    if (members.length === 1) {
      // Single member doesn't benefit from clustering
      unclustered.push(members[0]);
      continue;
    }

    // Sort by severity then description length
    members.sort((a, b) => {
      const sevDiff = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
      if (sevDiff !== 0) return sevDiff;
      return b.description.length - a.description.length;
    });

    const highestSev = members[0].severity;

    result.push({
      label: clusterLabel(id),
      severity: highestSev,
      primary: members[0],
      members,
      isClustered: true,
    });
  }

  // Add unclustered findings as single-member clusters
  for (const f of unclustered) {
    result.push({
      label: f.title,
      severity: f.severity,
      primary: f,
      members: [f],
      isClustered: false,
    });
  }

  // Sort: severity desc, then clustered first (clusters are more impactful)
  result.sort((a, b) => {
    const sevDiff = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
    if (sevDiff !== 0) return sevDiff;
    if (a.isClustered !== b.isClustered) return a.isClustered ? -1 : 1;
    return b.members.length - a.members.length;
  });

  return result;
}
