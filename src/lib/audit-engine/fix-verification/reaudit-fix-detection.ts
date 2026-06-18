// ============================================================
// Phase 3 — Re-audit fix detection (pure core)
// ============================================================
// "If we fix something, the re-audit should pick up that it changed and verify
// it — not only when the user marks it." When a full re-audit runs, every
// instrument re-executes. So a previously-OPEN deterministic finding that has
// no match in the fresh results — on a page the re-audit actually analyzed — is
// proven gone, exactly like a manual single-page re-check, but with zero user
// action.
//
// Same doctrine as the manual path (match-finding.ts): a FALSE "verified_fixed"
// is the worst error. So we only conclude when:
//   1. the finding is deterministic and has a reliable identity (a rule key),
//   2. its page was actually covered by the re-audit (instrumentRan), and
//   3. no fresh finding on that page matches it.
// Anything else is skipped (left for the next signal) — never guessed.
//
// We only emit verified_fixed. "Still present" needs no record (the finding
// simply persists), and inconclusive is a non-event. Pure + dependency-free →
// fully unit-testable; the IO layer feeds it rows and writes the outcomes.
// ============================================================

import {
  originalMatchKey,
  classifyFixOutcome,
  hasReliableIdentity,
  buildFixOutcomeRow,
  type MatchKey,
  type FixOutcomeRow,
} from './match-finding'

export interface PriorFinding {
  id: string
  audit_id?: string | null
  page_url?: string | null
  detection_source?: string | null
  confidence_level?: string | null
  status?: string | null
  dismissed?: boolean | null
  severity?: string | null
  title?: string | null
  target_element?: string | null
  performance_metric_type?: string | null
  evidence?: string | null
  issue_family_id?: string | null
  created_at?: string | null
}

export interface FreshFinding {
  page_url?: string | null
  detection_source?: string | null
  title?: string | null
  target_element?: string | null
  performance_metric_type?: string | null
}

export interface DetectResolvedInput {
  /** Findings from the PREVIOUS audit (the baseline being compared against). */
  priorFindings: ReadonlyArray<PriorFinding>
  /** Findings the FRESH re-audit produced. */
  freshFindings: ReadonlyArray<FreshFinding>
  /** Page URLs the fresh re-audit actually analyzed (coverage guard). A page
   *  with zero findings is still "covered & clean" and belongs here. */
  coveredPageUrls: Iterable<string>
  workspaceId: string | null
  userId: string | null
  /** ISO timestamp to stamp the outcomes with (the re-audit completion time). */
  verifiedAt: string
  /** Prior finding ids that already have a recorded outcome — skipped (dedup). */
  alreadyRecordedFindingIds?: Iterable<string>
  /** New audit id, for traceability in recheck_meta. */
  newAuditId?: string | null
}

export interface ResolvedFix {
  priorFindingId: string
  issueFamilyId: string | null
  pageUrl: string
  row: FixOutcomeRow
}

/** Normalize a URL for tolerant comparison: trim, lowercase, drop trailing
 *  slashes and a leading www. so prior/fresh/coverage line up. */
export function normalizeUrl(u: string | null | undefined): string {
  const s = (u || '').trim().toLowerCase()
  if (!s) return ''
  return s.replace(/\/+$/, '').replace(/^(https?:\/\/)www\./, '$1')
}

/** Deterministic findings with a real rule identity are the only ones we can
 *  prove gone. Everything else (AI, responsive_checker, identity-less) is left
 *  alone — never auto-resolved. */
export function isReauditVerifiable(f: PriorFinding): boolean {
  if (f.confidence_level !== 'deterministic') return false
  if (f.status !== 'open') return false
  if (f.dismissed) return false
  if (!f.page_url) return false
  return hasReliableIdentity(originalMatchKey(f))
}

export function detectReauditResolvedFixes(input: DetectResolvedInput): ResolvedFix[] {
  const covered = new Set<string>()
  for (const u of input.coveredPageUrls) covered.add(normalizeUrl(u))
  const recorded = new Set<string>(input.alreadyRecordedFindingIds ?? [])

  // Index fresh findings by normalized page → MatchKey[].
  const freshByPage = new Map<string, MatchKey[]>()
  for (const ff of input.freshFindings) {
    const page = normalizeUrl(ff.page_url)
    if (!page) continue
    const list = freshByPage.get(page) ?? []
    list.push(originalMatchKey(ff))
    freshByPage.set(page, list)
  }

  const resolved: ResolvedFix[] = []
  for (const prior of input.priorFindings) {
    if (recorded.has(prior.id)) continue
    if (!isReauditVerifiable(prior)) continue

    const page = normalizeUrl(prior.page_url)
    const instrumentRan = covered.has(page)
    const original = originalMatchKey(prior)
    const freshKeys = freshByPage.get(page) ?? []

    const outcome = classifyFixOutcome(original, freshKeys, { instrumentRan })
    if (outcome !== 'verified_fixed') continue

    const row = buildFixOutcomeRow({
      finding: {
        id: prior.id,
        audit_id: prior.audit_id ?? null,
        page_url: prior.page_url ?? null,
        detection_source: prior.detection_source ?? null,
        severity: prior.severity ?? null,
        evidence: prior.evidence ?? null,
        issue_family_id: prior.issue_family_id ?? null,
        created_at: prior.created_at ?? null,
      },
      workspaceId: input.workspaceId,
      userId: input.userId,
      outcome: 'verified_fixed',
      evidenceAfter: `Re-audit no longer detects this issue on ${prior.page_url}.`,
      markedFixedAt: null,
      verifiedAt: input.verifiedAt,
      recheckMethod: 'reaudit_diff',
      recheckMeta: { method: 'reaudit_diff', new_audit_id: input.newAuditId ?? null, prior_audit_id: prior.audit_id ?? null },
    })

    resolved.push({
      priorFindingId: prior.id,
      issueFamilyId: prior.issue_family_id ?? null,
      pageUrl: prior.page_url ?? '',
      row,
    })
  }

  return resolved
}
