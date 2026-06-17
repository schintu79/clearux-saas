/**
 * Export-layer deduplication engine.
 *
 * Detects near-duplicate findings that were surfaced independently by
 * different audit modules (e.g. the same canonical URL issue reported
 * by SEO Structure, Future Readiness, and the crawler). Merges them
 * into a single consolidated export entry so the handoff document
 * reads like 20 unique issues, not 36 with repeats.
 *
 * This module is intentionally React-free and lives in the pre-export
 * layer so it can be reused across Markdown, PDF, DOCX, email, and
 * API export renderers.
 *
 * Algorithm:
 *  1. Normalize each finding's title + description into a fingerprint.
 *  2. Compute pairwise Jaccard similarity on 3-gram shingle sets.
 *  3. Merge findings whose similarity exceeds a tuned threshold.
 *  4. Preserve the highest-severity finding as the primary, absorb
 *     metadata (modules, pages, evidence) from all members.
 */

import type { ExportFinding } from './findings-formatter';

/* ── Configuration ─────────────────────────────────────── */

/** Similarity threshold (0..1). Findings above this merge into one group. */
const SIMILARITY_THRESHOLD = 0.35;

/** Minimum shared n-gram count to even consider a pair (fast pre-filter). */
const MIN_SHARED_NGRAMS = 3;

/** N-gram size for shingling. 3-grams balance precision vs recall. */
const NGRAM_SIZE = 3;

/* ── Types ─────────────────────────────────────────────── */

export interface DeduplicatedFinding extends ExportFinding {
  /** Number of original findings merged into this entry. */
  mergedCount: number;
  /** Titles of absorbed duplicates (for transparency). */
  mergedTitles: string[];
  /** All modules across every merged finding. */
  modules: string[];
  /** All affected pages across every merged finding. */
  affectedPages: string[];
}

/* ── Core algorithm ────────────────────────────────────── */

/**
 * Normalize text for fingerprinting: lowercase, strip punctuation,
 * collapse whitespace, remove stop words that inflate false matches.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, '') // strip URLs (they vary per finding)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(
      /\b(the|a|an|of|for|to|and|or|with|in|on|is|are|was|were|be|been|has|have|had|that|this|it|its|by|at|from|as|but|not|all|each|every|some|any|no|more|most|such|than|other|into|over|after|before|between|under|through|during|about|their|our|your|which|who|whom|whose|how|what|when|where|why|will|would|should|could|can|may|might|must)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/** Build a set of character n-grams (shingles) from normalized text. */
function shingleSet(text: string): Set<string> {
  const norm = normalize(text);
  const shingles = new Set<string>();
  for (let i = 0; i <= norm.length - NGRAM_SIZE; i++) {
    shingles.add(norm.slice(i, i + NGRAM_SIZE));
  }
  return shingles;
}

/** Jaccard similarity between two shingle sets. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const s of smaller) {
    if (larger.has(s)) intersection++;
  }
  if (intersection < MIN_SHARED_NGRAMS) return 0;
  return intersection / (a.size + b.size - intersection);
}

/**
 * Extract the "root cause" keywords from a finding to boost matching
 * for findings that describe the same underlying problem differently.
 */
function rootCauseKey(f: ExportFinding): string {
  const combined = `${f.title} ${f.description}`.toLowerCase();

  // Canonical URL issues
  if (/canonical\s*(url|tag)?/i.test(combined)) return 'canonical-url';
  // OG / Open Graph tags
  if (/open\s*graph|og[:_]title|og[:_]desc/i.test(combined)) return 'og-tags';
  // Meta descriptions
  if (/meta\s*description/i.test(combined) && /identical|duplicate|generic|same/i.test(combined)) return 'meta-descriptions';
  // JSON-LD / structured data / @type
  if (/@type|json-?ld|structured\s*data/i.test(combined)) return 'structured-data';
  // hreflang / i18n
  if (/hreflang|language\s*variant/i.test(combined)) return 'hreflang';

  return ''; // no identifiable root cause cluster
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Deduplicate an array of export findings.
 *
 * Returns a new array where near-duplicates have been merged. The
 * highest-severity finding becomes the primary; metadata from all
 * members is absorbed.
 */
export function deduplicateFindings(
  findings: ExportFinding[],
): DeduplicatedFinding[] {
  if (findings.length <= 1) {
    return findings.map((f) => ({
      ...f,
      mergedCount: 1,
      mergedTitles: [],
    }));
  }

  // Pre-compute fingerprints
  const fingerprints = findings.map((f) => ({
    titleShingles: shingleSet(f.title),
    descShingles: shingleSet(f.description),
    combinedShingles: shingleSet(`${f.title} ${f.description}`),
    rootCause: rootCauseKey(f),
  }));

  // Union-Find for clustering
  const parent = findings.map((_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]; // path compression
      x = parent[x];
    }
    return x;
  }
  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  // Pairwise comparison
  for (let i = 0; i < findings.length; i++) {
    for (let j = i + 1; j < findings.length; j++) {
      const fi = fingerprints[i];
      const fj = fingerprints[j];

      // Fast path: same root cause → merge immediately
      if (fi.rootCause && fi.rootCause === fj.rootCause) {
        union(i, j);
        continue;
      }

      // Title similarity — strong signal
      const titleSim = jaccard(fi.titleShingles, fj.titleShingles);
      if (titleSim >= 0.5) {
        union(i, j);
        continue;
      }

      // Combined similarity
      const combinedSim = jaccard(fi.combinedShingles, fj.combinedShingles);
      if (combinedSim >= SIMILARITY_THRESHOLD) {
        union(i, j);
      }
    }
  }

  // Collect clusters
  const clusters = new Map<number, number[]>();
  for (let i = 0; i < findings.length; i++) {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(i);
  }

  // Merge each cluster
  const result: DeduplicatedFinding[] = [];
  for (const indices of clusters.values()) {
    // Sort by severity (highest first), then by description length (most detailed first)
    const sorted = [...indices].sort((a, b) => {
      const sevDiff =
        (SEVERITY_RANK[findings[b].severity] ?? 0) -
        (SEVERITY_RANK[findings[a].severity] ?? 0);
      if (sevDiff !== 0) return sevDiff;
      return findings[b].description.length - findings[a].description.length;
    });

    const primaryIdx = sorted[0];
    const primary = findings[primaryIdx];

    // Absorb only NON-CONTENT metadata (modules, pages, the absorbed titles)
    // from all members. The displayed title, description, why, recommendation,
    // and evidence are ALL kept from the single primary finding so the group is
    // internally coherent. Previously we spliced in the "longest" description /
    // why / recommendation from other members, which — when a merge was not a
    // true duplicate — produced a primary whose title and body described
    // different issues (e.g. a "meta tags" title over error-modal content). The
    // other members remain visible as "additional observations" via mergedTitles.
    const allModules = new Set<string>();
    const allPages = new Set<string>();
    const mergedTitles: string[] = [];

    for (const idx of sorted) {
      const f = findings[idx];
      for (const m of f.modules) allModules.add(m);
      for (const p of f.affectedPages) allPages.add(p);
      if (idx !== primaryIdx) mergedTitles.push(f.title);
    }

    result.push({
      ...primary,
      modules: Array.from(allModules),
      affectedPages: Array.from(allPages),
      mergedCount: sorted.length,
      mergedTitles,
    });
  }

  return result;
}
