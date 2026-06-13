# Fixpath — Series A Engineering & Product Execution Plan

**Created:** 2026-06-11 · **Owner:** Stefano Schintu · **Status:** ACTIVE — this is the plan of record.
**Rule:** Nothing in this document is optional. Changes to this plan are edited HERE first, then built. No assumptions, no "we'll remember."

---

## 0. The thesis (why we win)

The market has two crowded halves: AI-visibility monitoring (Profound, Peec, Otterly, Semrush/Ahrefs add-ons) that stops at "here's your score," and AI website audits (UXAudit.Now, MyWebAudit, O8) that stop at "here's our advice."

**Fixpath owns the seam: measure → diagnose the on-site cause → deploy the fix → re-measure and PROVE the delta.**
We already hold every piece of that loop. Nobody else holds all four. Every engineering decision below serves one of:

1. **Trust** — every number on screen is derived, capped, evidenced, and reproducible. We never fabricate. If we have nothing, we say so and refund.
2. **The loop** — find → fix → track must be closed, instrumented, and provable.
3. **The dataset** — every deployed fix + re-measurement accrues into the only dataset linking site changes to AI-perception deltas. This is the moat.
4. **Scale-ready** — built so growth means turning dials (concurrency, quotas, pool sizes), never rebuilding logic.

What we STOP doing: adding dashboard surfaces, speculative features, "nice to have" widgets. Breadth is done; depth and reliability are the game.

---

## 1. Current state — honest inventory (as of 2026-06-11)

### 1.1 What we HAVE and it works (protect these)

| Asset | Where | Notes |
|---|---|---|
| Deterministic scoring chain (caps + composition) | `src/lib/scoring/severity-cap.ts` | Single source. Overall caps, module caps, composition. |
| Interrogation metrics (accuracy/visibility/sentiment) | `src/lib/scoring/interrogation-metrics.ts` | Single source. Used by intelligence page + overview card. |
| One-button benchmark interrogation | `src/app/dashboard/intelligence/page.tsx` | Persistent, per-model cache merge, selected-models aware, navigable mid-run. |
| Checked-insert helpers | `process-audit.ts`: `insertFindingsChecked`, `insertPagesChecked` | The pattern that ended 6 silent-data-loss incidents. |
| Fabrication net at quality gates | `analyzer.ts` (`contradictsContent` + rule sets), wired in `process-audit.ts` quality-gates | Screens new AND carried findings every run. |
| Zero-findings policy (fail+refund vs verified clean) | `process-audit.ts` `zero-findings-policy` step | Refund only when WE have nothing of value. |
| Honest-absence / quote-to-critique prompt doctrine | `analyzer.ts` system instructions | Never recommend fake testimonials; only critique what's quotable. |
| Dual-path stall sweeping (Inngest cron + Vercel cron) | `stall-sweeper.ts`, `/api/cron/stall-sweep`, `vercel.json` | Queue-aware hard ceiling (processing time, not wall time). |
| Awaited dispatches | `restart/`, `retry/`, `process/`, `credits/` routes | Fire-and-forget inngest.send was dropping events. NEVER regress this. |
| Fix console + FTP deploy | `FixConsole.tsx`, ftp routes | The rarest competitive asset. |
| Per-page canonical, sitemap, AI-readability per page | `layout.tsx` (`canonical: './'`), `sitemap.ts`, `audit_pages.ai_readability` | |
| Carry-forward fidelity | `process-audit.ts` previousRawFindings mapper | Preserves category_index/fix_type/confidence_level. |

### 1.2 What is BROKEN or WEAK (the debt register)

| # | Debt | Where | Severity |
|---|---|---|---|
| D1 | **Zero automated tests.** The trust engine is untested. | whole repo (jest + ts-jest installed, `jest.config.ts` exists, ~no specs) | CRITICAL |
| D2 | **No error tracking.** Production errors vanish unless someone greps Vercel logs within retention. | nowhere | CRITICAL |
| D3 | **No CI gates.** Broken builds reach main (happened 2026-06-11: bee740f). | no GitHub Actions | CRITICAL |
| D4 | **Chromium broken in production.** Every audit logs "No Chromium binary found" → responsive checks, WCAG checks, screenshots silently skipped. Evidence mix is 0% verified / 100% heuristic — our own trust strip admits it. | `responsive-checker.ts`, `browser-renderer.ts`, `screenshots.ts` runtime | CRITICAL |
| D5 | Remaining unchecked `.insert()` calls (the 6-incident pattern). | repo-wide sweep needed; known: `audit-engine/index.ts:209`, brand-processor, others | HIGH |
| D6 | Remaining uncapped/uncomposed score displays. | `audits/[id]/page.tsx` module sections (~L1820, 1871, 2217), `audits/site/[domain]`, `audits/brand/[name]`, `track/page.tsx` L126, `latest-audit.ts moduleScoresFromReport` fallback | HIGH |
| D7 | `process-audit.ts` is ~5,000 lines. Unreviewable, unownable. | `src/lib/inngest/functions/process-audit.ts` | HIGH |
| D8 | PageSpeed API failing every run ("continuing without real CWV data"). | `process-audit.ts` site-checks; API key/quota | HIGH |
| D9 | Score model unvalidated (cap table + jitter constants are first calibration; no external validation; no public methodology). | `severity-cap.ts`, `analyzer.ts` | MEDIUM |
| D10 | "Track" pillar thin: `scheduled_audits` table exists, nothing built on it. No alerts, no digests. | DB + nothing | MEDIUM (HIGH for retention) |
| D11 | Lean-pipeline flag silently disables features; per-audit LLM cost not stored on the audit row. | `feature-flags.ts`, pipeline | MEDIUM |
| D12 | RLS/permissions never formally audited; restart route is unauthenticated (service-role, no user check). | `restart/route.ts` + RLS policies | MEDIUM (HIGH pre-launch) |
| D13 | Brand DNA comparison only runs in deep mode (now disclosed, not solved). | pipeline | LOW |
| D14 | "AI Agent Readiness" category is text-only vibes. | `analyzer.ts` UX_CATEGORIES | LOW (Phase 4 opportunity) |
| D15 | **Dashboard "false empty / needs refresh".** Pages fall through to the *empty* state while the single client-side bundle fetch is in flight — there's a `loading` flag but it's not checked before the empty state, so a slow fetch shows "No audit yet" then swaps to data. Worse, `AuditBundleContext` ends every fetch in a silent `.catch(()=>{})`, so a transient network/timeout failure leaves the page empty with no retry until manual refresh. **Quick fixes (small, do first in the perf pass):** loading-guard before the empty state on overview/find/fix; retry-with-backoff on fetch error instead of silent catch. **Bigger (Phase 2 perf):** slim the per-page bundle so each page loads only what it needs (+ parallelize), instead of one heavy `loadLatestAuditBundle` after the auth→workspace→bundle serial chain. | `src/context/AuditBundleContext.tsx`; `overview/find/fix/page.tsx` (empty-state checks ~L571 overview) | MEDIUM (HIGH for perceived reliability) |

### 1.3 Recurring failure patterns (institutional memory — test for these)

1. **Silent insert loss**: supabase-js returns `{error}`, never throws. Six incidents in 48h (viewport column, audit_pages NUL bytes, interrogation grades, etc.). Cure: checked helpers + schema contract tests (Phase 0.4).
2. **Field-name drift**: API returns `question_text_snapshot`, client reads `question_text` → feature silently dead since shipped. Cure: shared TS types for API payloads + contract tests.
3. **Recompute divergence**: same metric computed in 2+ places with different formulas (87 vs 65; 81 vs 48). Cure: shared modules (`scoring/*`) + rule: any new score display imports from them — enforced in review.
4. **Generation-time filters miss carried findings**: baseline re-audits recycle findings verbatim; nets must run at quality gates (the chokepoint), not only at generation.
5. **Fire-and-forget async in Vercel routes**: lambda freezes on response; unawaited promises die. Always await side effects.

---

## 2. Phase 0 — Reliability foundation (Weeks 1–2) · NON-NEGOTIABLE

**Goal:** no silent failures, no untested trust math, no broken builds on main, eyes on production.

### 0.1 CI pipeline (Day 1–2)
- GitHub Actions on every PR + push to main: `tsc --noEmit` → `eslint` → `jest` (all must pass; merge blocked otherwise).
- Vercel: enable "require CI pass" for production deploys.
- **Acceptance:** a PR with a type error or failing test cannot merge. Period.

### 0.2 Test suite — trust engine first (Week 1)
Priority order (all pure functions — fast to test, highest blast radius):
1. `severity-cap.ts`: applySeverityCap, applyModuleSeverityCap, composeModuleScores — full threshold table, composition invariant (mean of displayed modules == capped overall when cap applied; clean modules untouched), edge cases (all clean, all carriers, target<=0).
2. `interrogation-metrics.ts`: accuracy weights, visibility brand-token matching + refusal regex, sentiment 3-marker minimum.
3. `analyzer.ts` exported pieces: `contradictsContent` — **regression fixtures from real incidents**: the fixpath "testimonials lack attribution" fabrication (must drop), the QIN "no testimonials" false-absence (must drop), honest absence on a site without the word (must pass), real testimonials with attribution (quality critique must pass).
4. `calculateScoresFromFindings` + generateReport deterministic paths (deductions, jitter determinism, cap integration).
5. `pipeline/dedup.ts`: quoted-phrase rule (the request-information double), thresholds.
6. `normQ` + interrogation cache-merge semantics.
- **Acceptance:** ≥80% line coverage on `src/lib/scoring/**` and the exported analyzer functions; every past incident has a named regression test.

### 0.3 Schema contract tests (Week 1–2) — kills failure pattern #1 forever
- Script: generate `schema-snapshot.json` from `supabase/migrations` (or introspect a local supabase in CI).
- Test: for every checked-insert payload shape (findings, pages, interrogations, results, logs, reports), assert every key exists as a column in the snapshot. New payload key without migration = red CI.
- **Acceptance:** re-introducing the viewport-column bug class fails CI before deploy.

### 0.4 Unchecked-insert sweep (Week 2)
- Generic `dbWriteChecked(db, table, rows, label, auditId?)` in `src/lib/db/checked-writes.ts`; migrate `insertFindingsChecked`/`insertPagesChecked` onto it.
- Sweep EVERY `.insert(`/`.update(`/`.upsert(` in `src/lib` + `src/app/api`: route through checked helper or explicitly annotate `// fire-and-forget OK: <reason>` (allowed only for logs/telemetry).
- **Acceptance:** `grep` audit shows zero unannotated unchecked writes.

### 0.5 Sentry (Week 1, parallel)
- `@sentry/nextjs`: server + client + edge. Tag events with auditId/workspaceId/step. Capture in: inngest step catch blocks, onFailure, checked-write failures, API route catches.
- Alert rules: any `pages_insert_failed` / `findings_insert_failed` / `fabrication_net_dropped` spike; audit failure rate >5%/hour; sweeper sweeps >3/hour.
- **Acceptance:** a deliberate test error in staging appears in Sentry with full context in <1 min.

### 0.6 Chromium in production (Week 2) — gateway to Phase 1
- Diagnose `@sparticuz/chromium` on Vercel (likely executablePath/launch config or bundle size vs function limits). If in-lambda rendering is not reliable at scale, decide NOW for a browser pool (Browserless/etc.) — config-switchable: `RENDERING_MODE=lambda|pool`.
- **Acceptance:** production audit shows `responsive_check` and `wcag_check` success events + ≥1 stored screenshot. No "No Chromium binary found" in logs.

### 0.7 Auth on operational routes (Week 2)
- `restart`/`retry` routes: require authenticated owner (currently service-role with no user check — D12).
- **Acceptance:** unauthenticated restart returns 401.

---

## 3. Phase 1 — Verified measurement layer (Weeks 3–6)

**Goal:** evidence mix from 0% verified to ≥40% verified. The LLM interprets; instruments measure.

1. **axe-core on rendered pages** (top N pages/audit): real WCAG violations → findings with `detection_source: 'axe'`, `confidence_level: 'deterministic'`, element selectors + screenshots. Replaces text-only guesses in Accessibility Readiness.
2. **CWV for real**: fix PageSpeed API (D8) with key + quota monitoring; fallback to lab measurement during render. Performance findings become deterministic.
3. **Schema/meta validation** (exists: `structured-data-validator.ts`) — ensure it runs and feeds `verified` tier on every audit.
4. **Screenshots per finding** (`screenshots.ts` — unblocked by 0.6): every deterministic finding carries visual evidence; finding cards show them.
5. **Scoring integration**: deterministic findings drive deductions with full weight; heuristic findings exist but the trust strip now shows real verified %. Severity weights documented.
6. **Public methodology page** (`/methodology`): scoring formula, cap table, evidence tiers, grading rubric, refund policy. "Show your work" is the trust brand.
- **Acceptance:** fixpath.ai audit shows ≥40% verified evidence mix; every Accessibility finding has a selector + screenshot; methodology page live.

---

## 4. Phase 2 — Track engine / retention (Weeks 6–10)

**Goal:** convert episodic audits into a monitoring subscription. This is the revenue heartbeat.

1. **Scheduled re-measurement** on `scheduled_audits` (exists, unused). **DESIGN LOCKED 2026-06-13:**
   - **Cadence is USER-chosen, per brand** (Stefano's call): Off / Weekly / Monthly. Stored in the existing table — `is_active=false` = Off; `is_active=true` + `frequency` ∈ {`weekly`,`monthly`}. Table already has `frequency, is_active, next_run_at, last_run_at, workspace_id, user_id, product_url` → **no migration for the core** (optional: add `brand_identity_id` + a frequency CHECK).
   - **Control UI** on the Track page ("Monitoring: Off/Weekly/Monthly" per brand) → writes the schedule + computes `next_run_at`.
   - **Run type (V1): reuse the existing standard re-audit pipeline** — produces a complete, comparable data point and enables alerts immediately. Cost-optimised "light run" (deterministic + free-model interrogation + crawl-delta only) is a fast-follow, not V1.
   - **Access/billing: paid plans only; scheduled runs are INCLUDED (do NOT consume audit credits).** The cron trigger must start the audit on a monitoring path that bypasses the credit check/deduction (integration point: the audit-start credit logic).
   - **Mechanism:** daily cron (Vercel cron like the existing stall-sweep, or Inngest cron) finds due brands (`is_active && next_run_at <= now`), triggers a standard re-audit each with **per-workspace fairness** (Inngest concurrency keyed by workspace), rolls `next_run_at` forward by cadence, sets `last_run_at`. Idempotent + must not double-fire.
   - **Build order:** (a) schedule API + Track "Monitoring" control; (b) cron runner + credit-bypass monitoring trigger + fairness; (c) verify a due schedule fires one audit and rolls forward.
2. **Regression alerts**: score drop ≥N, new high-severity finding, **AI answer flip** (diff stored benchmark answers vs previous run — "DeepSeek stopped calling you legitimate" is the single most viral alert in this market).
3. **Weekly digest** (Resend exists; `notifications` table exists): deltas, open-issue aging, "fixes that moved your numbers."
4. **Track page upgrade**: per-metric trends (accuracy, visibility, score, CWV) from stored runs — read-only over data Phase 0–1 already persists.
- **Acceptance:** a workspace with monitoring on receives a real digest with a real delta; an induced regression fires an alert within one cycle.

---

## 5. Phase 3 — The outcome dataset (Weeks 8–12, overlaps Phase 2)

**Goal:** the moat. Every fix → measured outcome, automatically.

1. New table `fix_outcomes`: finding_id, fix description/diff ref, deployed_at, verification: before/after evidence (page snapshot refs, re-grade result, benchmark answers before/after where relevant), delta fields, time-to-fix.
2. **Auto-verification job**: when a fix is deployed via console (or marked fixed), schedule re-crawl of the affected page + re-grade of that finding (existing verifyFindings machinery) + store outcome.
3. Surface in product: "Verified fixed — re-checked <date>" on findings; workspace "Impact" view (fixes deployed, deltas achieved).
4. **The aggregate** (anonymized): which fix types move which metrics — feeds marketing ("schema fixes moved AI accuracy +12 median across 400 deployments"), pricing, and the Series A deck.
- **Acceptance:** deploy a fix on fixpath.ai via console → within 24h an outcome row exists with before/after evidence, visible in UI.

---

## 6. Scale architecture — built for thousands, dialed up later

**Principle: every scale lever is a config value, not a rewrite.**

| Concern | Today | At scale (the dial) | Where |
|---|---|---|---|
| Audit concurrency | Inngest `concurrency: 3` (Anthropic tier bound) | Env-driven constant + per-user fairness `concurrency: { key: user_id }` so one tenant can't starve others. Raise with Anthropic tier upgrade (support request, not code). | `process-audit.ts` config |
| Queue vs sweeper | Queue-safe ceiling done (processing-time based) | Raise Tier-2 queued threshold alongside concurrency; expose queue position in UI | `stall-sweeper.ts` |
| LLM costs | Haiku + cheap OpenRouter; ~$0.30–0.50/audit | Store `llm_cost_cents` on audits (tokens already returned); unit-economics view; per-plan budget enforcement | pipeline + new column |
| Rendering | In-lambda (broken; fixing in 0.6) | `RENDERING_MODE=pool` → external browser pool; per-audit page budget | `browser-renderer.ts` abstraction |
| DB | Single Supabase; chunked writes learned the hard way | Index audit NOW: `audit_findings(audit_id)`, `audit_pages(audit_id)`, `workspace_ai_interrogations(workspace_id, created_at)`, `audits(workspace_id, status, created_at)`. Keep `raw_json` out of list queries. PgBouncer already via Supabase. | migration |
| Inngest envelope | streaming + 800s maxDuration | Long-term: split pipeline into chained events (`audit/crawled`, `audit/analyzed`) so each function is small — do during D7 refactor, NOT as a rewrite | Phase 1.5 refactor |
| Multi-tenancy | Workspace scoping rules (session guide §1) + RLS | Formal RLS audit (0.7 extension); service-role usage inventory | policies |
| Observability | Sentry (0.5) + audit_logs | Per-step timing metrics already in categoryTimings → ship to Sentry perf; weekly ops review of: audit success rate, p50/p95 duration, evidence mix, cost/audit | dashboards |

**D7 refactor (scheduled Week 4–6, after tests exist to protect it):** split `process-audit.ts` into `pipeline/steps/*` modules (crawl, checks, probes, analysis, gates, report, complete) with the handler as thin orchestration. Tests first, then move code — never the reverse.

---

## 7. Operating standards (start today)

1. **Definition of done:** tsc clean + tests green + checked writes + score displays import from `scoring/*` + Sentry context on new failure paths. No exceptions, including founder commits.
2. **No commit without green local `tsc` + `jest`.** (2026-06-11 bee740f shipped broken — never again.)
3. **Every incident gets a named regression test** before the fix is considered done.
4. **Schema changes:** migration file + live apply + contract-test snapshot regen in the SAME commit (session guide §3 extended).
5. **Weekly metrics review** (15 min, written): audit success rate (target ≥99%), p50 audit time, evidence-mix %, interrogation usage, cost/audit, Sentry new-issue count.
6. **This document is the backlog of record.** New ideas get a line in §9 or they don't exist.

## 8. KPIs that define "Series A solid"

| KPI | Now (honest) | Phase 0 exit | Phase 2 exit |
|---|---|---|---|
| Audit success rate | ~unknown (was 19% on 6/9) | ≥97% | ≥99% |
| Evidence mix (verified+observed) | ~0% | n/a | ≥40% |
| Test coverage (scoring core) | 0% | ≥80% | ≥80% maintained |
| Silent-data-loss incidents | 6 in 48h | 0 (CI-blocked) | 0 |
| Mean time to detect prod error | days | <5 min (Sentry) | <5 min |
| Retained monitoring workspaces | 0 | n/a | ≥60% of design partners weekly-active |
| Fix outcomes recorded | 0 | n/a | every console deploy |

## 9. Parking lot (explicitly deferred — do not build before Phase 3 ships)

- Agent-readiness real browsing tests (strong Phase 4 candidate — differentiated, has budget behind it)
- Industry percentile benchmarks from accumulated audits (needs volume)
- Competitor side-by-side interrogation
- White-label/agency tier polish
- Visibility/sentiment premium-model expansion

---

---

## 10. Brand Consistency box (APPROVED 2026-06-13 — Phase 1 verified-layer feature)

**What it is:** a dedicated "Brand Consistency" box on the audit that cross-references the customer's uploaded Brand DNA (the `brand_identities` record + files, which otherwise only display on the Brand DNA page) against the **live site**, and surfaces *real, evidenced* mismatches ranked by severity. Not a re-run of the brand audit — a consistency diff. "No speculation, only data that genuinely mismatches and hurts consistency/trust."

**Scoring decision (Stefano, 2026-06-13):** Brand Consistency gets its **own score in its own box — it does NOT fold into the site health score.** Rationale: the health score must mean the same thing for every site regardless of whether brand files were uploaded (cross-site comparability is a core trust principle, §0.1). Folding brand fit into health would make two identical sites score differently based only on whether files exist. **Carve-out:** mismatches that genuinely harm *end-user* trust (e.g. logo/colour scheme that makes a page look unofficial, copy that contradicts stated positioning) ALSO surface as normal findings in Design Consistency / Trust, where they legitimately affect health. So: separate score, trust-harming subset double-surfaces as real findings.

**Data model (confirmed):** `brand_identities` → `description` (text), `brand_voice` (text), `tone_keywords` (text[]), `primary_colors` (text[]), `logo_url` / `logo_file_id`. Plus `brand_identity_files`.

**Provability per attribute (this is the whole game — anything not provable is noise and must not ship):**
- **Colours** — provable ONLY with a measured live-site palette. There is currently NO deterministic colour extraction in the website pipeline (WCAG extracts contrast *pairs*, not a stored palette). V1 must add a colour-extraction step (dominant rendered colours) and diff declared `primary_colors` vs observed. Without it, colour findings are AI eyeballing = speculation → do not ship colour until the extractor exists.
- **Voice / tone** — provable via quote-to-critique only: declared `brand_voice`/`tone_keywords` vs **quoted** live copy that contradicts them. The brand-analyzer already enforces this doctrine (bans "could not determine…" non-findings); reuse it, route output into the box.
- **Logo / visuals** — deferred to V2 (needs vision tooling; presence/obvious-mismatch only, never aesthetic critique).

**V1 scope (Stefano, 2026-06-13): Colours + quoted voice/tone.** Logo/visual comparison → V2.

**Build sequencing (Claude's recommendation):** land the in-flight `report-honesty-batch` work first (Brand DNA toggle gate, site-checks race fix, checks_executed move) — committing a new feature on top of that uncommitted pile makes it unreviewable. Then build V1 on a clean branch, tests-first:
1. Pure module `src/lib/scoring/brand-consistency.ts` — `compareBrandConsistency(declared, observed) → { mismatches[], score }`, fully unit-tested, no pipeline/UI deps. Colour-delta + quoted voice/tone matcher.
2. Colour-extraction step feeding `observed` (the one genuinely new capability).
3. Pipeline wiring (deep path only — gated like Brand DNA enrichment) + persistence.
4. UI "Brand Consistency" box; double-surface the trust-harming subset as normal findings.

**Acceptance:** on a site with uploaded brand files, the box shows only evidenced mismatches (measured colour deltas; quoted voice/tone contradictions), each with severity; zero "could not determine" entries; the box score never moves the health score; a trust-harming mismatch also appears as a normal finding.

---

*Maintained by: Stefano + Claude. Read alongside `CLAUDE_SESSION_GUIDE.md` at session start. Last full revision: 2026-06-13 (added §10 Brand Consistency box).*
