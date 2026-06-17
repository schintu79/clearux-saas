# Fixpath — Phase 3: The Fix-Outcomes Dataset (Plan of Record)

**Created:** 2026-06-17 · **Owner:** Stefano Schintu · **Status:** ACTIVE — plan of record.
**Rule:** Edited HERE first, then built. Tests-first, schema firewall, non-fatal wiring. No silent bugs.

Read alongside `docs/SERIES_A_ENGINEERING_PLAN.md` §5 (Phase 3) and `docs/AUDIT_PIPELINE_ARCHITECTURE.md`.

---

## 0. Thesis (why this is the moat)

Today Fixpath finds a problem, suggests a fix, and tracks the site. What it does **not** yet do is
**prove the fix worked.** Phase 3 closes that: every fix that is marked fixed gets automatically
re-checked, and the result — gone or not, with before/after evidence — is recorded as a durable
`fix_outcomes` row. Aggregated and anonymized, this becomes the only dataset linking a concrete
on-site change to a measured outcome ("schema fixes cleared the defect on 92% of pages, median
time-to-fix 3 days"). That is the Series A story; nobody else holds it.

**Trust rule (inherited):** we only record what we can PROVE. A V1 outcome is a binary,
instrument-measured fact, never an AI opinion.

---

## 1. V1 scope (decided 2026-06-17)

- **Trigger:** automatic, the moment a user marks a finding **fixed**. Re-check that ONE page
  immediately (async), not a full re-audit.
- **Eligible findings:** **deterministic only** (`confidence_level = 'deterministic'`: axe, wcag_checker,
  responsive_checker, pagespeed_api, structured_data). Re-run the matching instrument on the page —
  the defect is gone or it isn't. AI/interpretive findings are NOT auto-verified in V1; they close
  the existing way, on the next full re-audit via the `issue_families` / fix-history spine.
- **Outcome recorded either way:** `verified_fixed` (defect gone) or `not_fixed` (still present →
  the finding is reopened). A re-check that errors is `inconclusive`, retried on next re-audit.
- **Surfacing:** a "Verified fixed — re-checked <date>" badge on the finding, and a minimal
  workspace **Impact** list of verified outcomes.

**Explicitly V2 (not now):** AI/interpretive auto-verification; the AI-answer-flip outcome
(re-running benchmark interrogations after a fix — costlier, separate loop); the cross-workspace
anonymized aggregate view and its marketing surface.

---

## 2. What already exists (build on, do not duplicate)

- **Status model** (`audit_findings`): `status ∈ open|in_progress|fixed|backlog`,
  `fix_status ∈ unreviewed|in_progress|approved|deferred|fixed|failed`, `dismissed`.
  `PATCH /api/findings/[id]` sets `status='fixed'`, recalculates the score, and sets the finding's
  `issue_family.fix_status='pending_verification'` (`src/app/api/findings/[id]/route.ts:365–389`).
- **Fix-history spine:** `issue_families` + `applyFixHistoryGate` (`pipeline/fix-history-gate.ts`)
  already suppress a previously-fixed family on re-audit and **reopen** it if a deterministic check
  sees it again. Phase 3 reuses this as the re-audit reconciliation path; it does not replace it.
- **Before evidence on the finding row:** `evidence`, `target_element`, `screenshot_url`, `page_url`,
  `severity`, `detection_source`, `confidence_level`. Plus the `page_captures` snapshot.
- **Re-check primitives (single page):** live fetch (`limitations/route.ts` recheck), the browser
  pass `checkWcagAutomated(urls, maxPages)` (runs axe + WCAG on a URL list), `runFullSpeedTest(url)`
  → `generateSpeedFindings`, the structured-data validator, and the responsive checker — all already
  run on a single URL.

The only missing primitive is a **per-finding verifier** that runs the right instrument on the one
page and decides whether *this* defect is still there.

---

## 3. Data model — `fix_outcomes` (new table, additive)

One row per verification attempt of one finding. Append-only (history of attempts), with the latest
row per finding being authoritative for display.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `finding_id` | uuid | FK → audit_findings(id) ON DELETE CASCADE |
| `audit_id` | uuid | denormalized for query/RLS scoping |
| `workspace_id` | uuid | RLS scope (audit_findings has no workspace_id; resolve via audits) |
| `user_id` | uuid | who marked it fixed |
| `issue_family_id` | uuid null | link to the family spine when present |
| `page_url` | text | the page re-checked |
| `detection_source` | text | the instrument used (axe/wcag_checker/…) |
| `outcome` | text | `verified_fixed` \| `not_fixed` \| `inconclusive` |
| `severity_before` | text | finding severity at mark-fixed |
| `evidence_before` | text null | finding evidence/selector at mark-fixed |
| `evidence_after` | text null | what the re-check saw (e.g. "0 contrast violations on .login") |
| `marked_fixed_at` | timestamptz | when the user marked it fixed |
| `verified_at` | timestamptz | when the re-check completed |
| `time_to_fix_seconds` | bigint null | verified_at − finding.created_at (detection→fix) |
| `recheck_method` | text | `single_page_instrument` (V1) |
| `recheck_meta` | jsonb null | raw re-check detail (http status, rule id, count) for audit/debug |
| `created_at` | timestamptz default now() | |

Indexes: `(finding_id)`, `(workspace_id, created_at)`, `(outcome)`. RLS: workspace-scoped via the
owning audit, same pattern as `coverage_limitation_decisions`. Registered in `INSERT_CONTRACTS` +
`schema-snapshot.json`; written only through `insertChecked`.

A lightweight display field is added to `audit_findings` (additive, no behavioral change):
`verified_fixed_at timestamptz null` — set when an outcome is `verified_fixed`, read by the badge so
the card doesn't need to join `fix_outcomes`.

---

## 4. The verifier (pure core + thin IO)

**Pure core — `src/lib/audit-engine/fix-verification/match-finding.ts` (unit-tested, no IO):**

- `findingStillPresent(original, freshFindings) → boolean` — given the original finding and the fresh
  findings the instrument produced on the page, decide whether the SAME defect is still there.
  Matching key by source:
  - axe / wcag_checker → same WCAG criterion (or axe rule id) AND overlapping target selector.
  - responsive_checker → same check id / metric.
  - pagespeed_api → same diagnostic id (or the metric still in the "poor"/"opportunity" band).
  - structured_data → the required block still absent.
  - Conservative default: if we cannot confidently match, treat as **still present** (never declare a
    fix verified on a weak match — false "verified fixed" is the worst error here).
- `buildFixOutcomeRow(original, result, timing) → FixOutcomeRow` — pure assembly, fully tested.

**IO dispatcher — `fix-verification/verify-finding.ts`:**
`verifyDeterministicFinding(finding) → { outcome, evidenceAfter, meta }` — runs the ONE instrument
matching `finding.detection_source` on `finding.page_url`, then calls `findingStillPresent`. Bounded:
one page, one instrument, hard timeout, non-fatal (errors → `inconclusive`).

---

## 5. The trigger & job

- **Trigger:** in `PATCH /api/findings/[id]`, when a finding transitions to `status='fixed'` AND
  `confidence_level='deterministic'` AND has a `page_url`, fire an Inngest event
  `fix/verify-requested` with `{ findingId, auditId, workspaceId, userId, markedFixedAt }`.
  The PATCH returns immediately (verification is ~10–25s; never block the request).
- **Job:** an Inngest function `verify-fix-outcome` loads the finding, calls
  `verifyDeterministicFinding`, writes the `fix_outcomes` row (insertChecked), and:
  - on `verified_fixed` → set `audit_findings.verified_fixed_at = now()`, keep `status='fixed'`,
    set the family to `validated_fixed`.
  - on `not_fixed` → reopen: `status='open'`, family back to its open state, and surface that the fix
    didn't take (the honest, trust-building behavior — we tell them it's not actually fixed).
  - on `inconclusive` → leave status as the user set it; the next full re-audit reconciles.
  - Concurrency keyed by workspace (fairness, same as the audit pipeline). Idempotent per
    (finding_id, marked_fixed_at).

---

## 6. Surfacing (V1, minimal)

- **Finding card:** when `verified_fixed_at` is set, show a green "Verified fixed — re-checked
  <date>" badge. When a verification reopened it, show "Re-check found this still present."
- **Impact list:** a simple workspace view (or a section on Track) listing verified outcomes:
  finding title, page, severity, time-to-fix. Read-only over `fix_outcomes`.
- No aggregate/percentile view in V1.

---

## 7. Build order (each step: tsc + jest green, checked writes, non-fatal)

1. **Migration + contracts** — `fix_outcomes` table (+ RLS, indexes) and the additive
   `audit_findings.verified_fixed_at` column; register in `INSERT_CONTRACTS`/`UPDATE_CONTRACTS` +
   regenerate `schema-snapshot.json`; schema-contract test green.
2. **Pure core** — `match-finding.ts` (`findingStillPresent`, `buildFixOutcomeRow`) + full unit tests
   (one fixture per detection_source: fixed, not-fixed, ambiguous→still-present).
3. **IO verifier** — `verify-finding.ts` dispatcher reusing the existing single-page checkers.
4. **Trigger + job** — Inngest event from the PATCH route + `verify-fix-outcome` function (write
   outcome, update finding/family, reopen-on-fail). Non-fatal; behind a feature flag
   (`FEATURE_FIX_OUTCOMES`) for a dark launch, then on.
5. **Surfacing** — badge + Impact list.
6. **Verify end-to-end** — mark a deterministic finding fixed on a real audit → within ~30s a
   `fix_outcomes` row exists with before/after + the badge shows. Reopen path tested by marking a
   still-broken finding fixed.

## 8. Acceptance (Series A plan §5)

Deploy/mark a deterministic fix → within 24h (V1: within ~30s) an outcome row exists with before/
after evidence, visible in the UI; a fix that didn't actually land is reopened and the user is told.

## 9. Risks / guards

- **False "verified fixed"** is the worst failure → conservative matching (ambiguous = still present),
  and the reopen path means a wrong "fixed" self-corrects on next re-audit.
- **Cost** — one page, one instrument, only on explicit user action; PSI re-runs are the heaviest
  (~20s) and are already rate-limited.
- **No new silent bugs** — checked writes, schema contract test, non-fatal job, feature-flag dark
  launch, observability log per verification (`fix_verified` / `fix_reopened`).
