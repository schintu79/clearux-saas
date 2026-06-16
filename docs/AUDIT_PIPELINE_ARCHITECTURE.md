# Fixpath — Audit Pipeline Architecture (Capture → Analyze → Compose)

**Created:** 2026-06-15 · **Owner:** Stefano Schintu · **Status:** PLAN OF RECORD (design) — build against this; changes are edited HERE first.
**Read alongside:** `CLAUDE_SESSION_GUIDE.md` and `docs/SERIES_A_ENGINEERING_PLAN.md` (this is the concrete design for the §6 pipeline split / D7 refactor).

---

## 0. Why this exists

Every recent trust bug — auditing a stale pre-hydration hero, a "duplicate title" that wasn't, axe jargon no human can read, a "confusing CTA" nobody is confused by — has the **same root cause**: capture and judgment are welded into one pass. The crawler grabs whatever HTML it can, the analyzer reasons over it immediately, and a wrong conclusion is indistinguishable from wrong data because there is no boundary between "what the page was" and "what we decided about it."

We have been patching symptoms — a gate per bad finding. Symptom gates are site-agnostic but **finding-specific**, and that never converges: the LLM rephrases and a new screenshot appears. This document replaces that approach with **two general rules enforced by a staged architecture**, so that from now on every "this finding is wrong" is triaged to *which stage's contract failed*, not to a new patch.

**The two general rules:**
- **Completeness before conclusion.** No finding may be asserted from incomplete or unverified page state. Judgment reads only fully-rendered, captured evidence.
- **Definition of done.** A finding ships only if it names a real element/evidence (WHAT), states concrete impact (WHY), gives an actionable FIX, in plain language — else it is enriched or dropped.

---

## 1. The core principle

> **Capture stores evidence. Meaning is derived. After capture, no stage may inspect the live website.**

Three consequences follow, and they are the whole point:

1. **Reproducible** — every result traces to an immutable, versioned capture. You can see exactly what the analyzer saw.
2. **Cheap to rerun** — a bad analysis costs an LLM call, never a crawl/render/screenshot. Reruns are partial, not full.
3. **Debuggable** — when a finding is wrong, there are exactly three questions, in order: was the **capture** wrong, the **analysis** wrong, or the **composition** wrong? Today those layers are mixed, so debugging is guesswork.

**Evidence is captured; meaning is derived.** This is the line that keeps capture immutable. Anything interpretive — "this is an FAQ block," "this is the pricing section," "this CTA is primary" — is a *derived* layer keyed to a capture version, recomputable without re-crawling. If interpretation is baked into the capture, improving an extractor forces a full re-capture, and the immutability benefit is lost.

---

## 2. The three stages

```
Audit requested
      |
      v
Stage 1: CAPTURE  ── crawl, render every page, collect DOM facts, run axe(raw),
      |              screenshots → write immutable PageCapture artifacts
      |              emits  audit/captured
      v
Stage 2: ANALYZE  ── read PageCapture ONLY (no network). Establish page context
      |              (industry, page type, meaning), run deterministic + AI
      |              analyzers → produce CandidateFindings with reasoning
      |              emits  audit/analyzed
      v
Stage 3: COMPOSE  ── read CandidateFindings + PageCapture. Judge relevance &
      |              severity in context, dedupe, suppress, enforce the finding
      |              schema (WHAT/WHY/FIX + evidence_ref), score, build report
      |              emits  audit/composed
      v
Dashboard results
```

Each stage is its own Inngest function, chained by events, **independently retriable and idempotent**: re-running a stage replaces only its own outputs and touches neither the network nor an earlier stage's artifacts.

| Stage | Reads | Writes | Cost | Re-runnable? |
|---|---|---|---|---|
| Capture | live site | `page_captures` (+ blobs) | expensive (browser/network) | only on explicit recapture |
| Analyze | `page_captures` | `candidate_findings` | cheap (LLM/text) | freely, no re-crawl |
| Compose | `candidate_findings` + `page_captures` | `audit_findings`, `reports` | cheap | freely |

### Stage 1 — Capture (acquisition)
Renders **every** analyzed page in a real browser (no pre-hydration data ever again), and persists a complete, versioned capture. Findings are **never** born here. The audit reaching a `captured` state is durable: if every later stage fails, the capture survives and is reusable forever. This is where the title/hero/duplicate-title class dies — generally, by construction, for any site.

### Stage 2 — Analyze (judgment)
Reads only the capture bucket. **Establishes context first** — industry, page type/intent, meaning of the page — then evaluates each candidate issue against that context: is it real, is it relevant to this page's purpose, does it make sense here, what severity. This single general context layer is the **replacement for every symptom gate** (CTA, input-relevance, structural-ownership-by-pattern, etc.). They retire into "does this hold up against the page's actual context."

### Stage 3 — Compose (review / quality)
Composition does **not** mint raw findings. It reviews, merges, contextualizes, ranks, suppresses, and explains. It enforces the **finding schema** (§5) as a hard gate: anything without a specific WHAT, concrete WHY, actionable FIX, and a valid `evidence_ref` into the capture is dropped or enriched. Jargon and unevidenced claims cannot reach the user.

---

## 3. The immutable `PageCapture` artifact

`PageCapture` is the contract between stages. **Append-only, versioned, never mutated after write.**

### 3.1 What is RAW evidence (immutable, in the capture)
```
PageCapture {
  id                       uuid            -- capture_id
  audit_id                 uuid
  site_id                  uuid
  page_url                 text
  page_status              capture_status  -- pending|partial|complete|failed
  http_status              int

  capture_schema_version   text            -- shape of THIS record
  capture_renderer_version text            -- which renderer/engine produced it
  captured_at             timestamptz

  -- RAW rendered evidence (object storage; columns hold the keys)
  rendered_html_key        text            -- post-hydration outerHTML
  screenshot_keys          text[]          -- viewport screenshots
  axe_raw_key              text            -- full axe-core JSON

  -- CHEAP DETERMINISTIC structure (queryable; safe in Postgres)
  title                    text            -- from rendered DOM
  h1                       text            -- from rendered DOM
  headings                 jsonb           -- ordered [{level,text}]
  links                    jsonb           -- [{href,text}]
  form_presence            jsonb           -- counts/selectors of actionable inputs
  lang                     text
  meta                     jsonb           -- description, canonical, og, robots, viewport
  dom_facts                jsonb           -- landmarks, label coverage, etc.
  extracted_text           text            -- normalized visible text
  viewport_results         jsonb           -- responsive measurements
}
```

### 3.2 What is DERIVED (NOT in the capture)
Semantic interpretation lives in a **separate, recomputable layer** keyed to `(capture_id, capture_schema_version, extractor_version)`:

```
DerivedExtraction {
  capture_id        uuid
  extractor_version text
  faq_blocks        jsonb
  pricing_blocks    jsonb
  nav               jsonb
  section_map       jsonb   -- hero, features, trust, footer...
  page_type         text    -- home|product|pricing|auth|legal|blog|...
  computed_at      timestamptz
}
```
Improving the extractor bumps `extractor_version` and recomputes from the **same** capture — zero re-crawl. **This is the rule that keeps capture truly immutable.**

### 3.3 Capture states
`pending → (partial | complete | failed)`. A `partial` capture is still analyzable when enough evidence exists; analyzers must tolerate missing optional fields. `failed` captures are visible and retriable without disturbing sibling pages.

---

## 4. `CandidateFinding` (Stage 2 output)

Analysis emits candidates — **not** user-visible findings:
```
CandidateFinding {
  id                uuid
  audit_id          uuid
  capture_id        uuid          -- which evidence it was drawn from
  page_url          text
  source            text          -- axe | wcag_checker | responsive | analyzer | ...
  raw_claim         text          -- what the analyzer asserts
  evidence_ref      jsonb         -- {locator: selector|text_span|screenshot_region}
  context_used      jsonb         -- page_type, industry, section it was judged in
  proposed_severity text
  confidence        numeric
  reasoning         text          -- why the analyzer concluded this (audit trail)
}
```

---

## 5. Final `Finding` schema — the definition of done

Compose may persist a user-visible finding **only if every field validates**:
```
Finding {
  capture_id     uuid    -- REQUIRED. ties the finding to durable evidence
  evidence_ref   jsonb   -- REQUIRED. locator must resolve inside the capture
  what           text    -- REQUIRED. names the real element/evidence, plain language
  why            text    -- REQUIRED. concrete user/business impact, plain language
  fix            text    -- REQUIRED. actionable, plain language
  severity       enum    -- justified by context, not by an instrument's raw label
  detection_source text
  confidence_level text
}
```
**Hard rule:** missing or unresolvable `evidence_ref` ⇒ the finding does not exist. Jargon passthrough (e.g. raw axe `help` text) fails the WHAT/WHY/FIX bar and is enriched from the candidate's structured data or dropped.

---

## 6. Keystone rules

1. **After capture, no later stage inspects the live website.** Reproducibility, debuggability, and cheap reruns all depend on this. If analysis needs something not captured, that is an under-capture bug — fixed by capturing more raw evidence, never by a live fetch in Stage 2/3.
2. **Capture stores evidence, not interpretation.** (§1, §3.2)
3. **Every finding carries `evidence_ref` into a specific capture.** (§5)
4. **Each stage is idempotent.** Re-running replaces only its own outputs.
5. **Stages declare capture-schema compatibility.** An analyzer states which `capture_schema_version`s it supports; mismatches are surfaced, not silently mis-read.

---

## 7. Storage & retention

Raw blobs grow fast (HTML, screenshots, axe-raw). Discipline from **day one** — relocating blobs after millions of rows is the painful migration:

- **Object storage (Supabase Storage), not Postgres**, for `rendered_html`, `screenshots`, `axe_raw`. Postgres holds normalized/queryable fields + blob keys only. (Consistent with the Series A plan's "keep heavy JSON out of list queries.")
- **Retention:**
  - Full captures (incl. blobs) for **paid** audits.
  - Screenshots + raw HTML: **90–180 days**, then prune blobs (keep the row + normalized fields).
  - Normalized extracted text, DOM facts, final findings: **long-term**.
  - Compress large artifacts before storing.

---

## 8. Scale

Capture is the **expensive stage by design** (a real browser render per page — the price of never seeing pre-hydration data). Keep analyze/compose cheap (text/LLM over stored evidence). This is exactly where the §6 `RENDERING_MODE=pool` browser-pool investment lands: scale capture on its own dials (concurrency, pool size, per-tenant fairness) while reruns of analyze/compose stay free. The payoff: re-analyze thousands of stored captures with a better prompt/model and **zero** re-crawls.

---

## 9. Replay tooling (arrives with Phase 2, not last)

Internal tools, because they fix the false-positive pain directly:
- `replay analyze --audit <id> --capture-version <v>` — re-run judgment over a stored capture.
- `replay compose --audit <id>` — re-run review/scoring only.
- `diff analyzers --a <verA> --b <verB> --captures <set>` — A/B an analyzer change over historical captures before shipping.

Replay over real captures is how we kill false positives without burning crawl budget — it is the QA backbone, not an epilogue.

---

## 10. Migration — phased, low-risk, trust climbs from step 1

**Frame: immutable capture layer first; pipeline split second.** Do not start by splitting into three services.

**Phase 1 — Shadow capture (no behavior change).**
Write `PageCapture` artifacts inside the *current* pipeline; the existing audit flow is untouched and results are identical.
*Acceptance:* every audit also produces complete, versioned captures; turning capture off changes nothing user-visible.

**Phase 2 — One analyzer reads the capture + first replay tool.**
Point a single contained analyzer (recommend: WCAG checker or content-clarity) at `PageCapture` instead of `crawlResult`. Ship `replay analyze`.
*Acceptance:* that analyzer's output is reproducible from a stored capture with no crawl.

**Phase 3 — All candidate generation reads captures (Stage 2 becomes real).**
`audit/captured → audit/analyzed`. Analysis no longer touches the network.
*Acceptance:* the analyze function runs to completion with zero network calls to the audited site.

**Phase 4 — Move contextual validation + scoring into Compose (Stage 3 becomes real).**
`audit/analyzed → audit/composed`. The current contextual validator becomes Compose's relevance/severity layer; the finding schema (§5) is enforced here. **Retire the symptom gates** (CTA speculative-UX gate, input-relevance gate, and any other per-pattern filter) — their job is now the general context judgment.
*Acceptance:* no finding ships without a resolvable `evidence_ref`; the symptom-gate modules are deleted, not bypassed.

**Phase 5 — Retire the old one-shot flow + full replay suite.**
Decommission the welded path once the three stages carry production.
*Acceptance:* deep mode is "deeper analysis over the same capture," not a separate crawl.

---

## 11. Debugging triage (the everyday payoff)

When a finding is wrong, ask in order:
1. **Capture wrong?** Open the stored `rendered_html`/screenshot for that `capture_id` — did we see the real page? (Kills the stale-data class.)
2. **Analyzer wrong?** Replay analyze over that capture — did it misjudge correct evidence? (Fix the analyzer, rerun cheaply.)
3. **Composer wrong?** Replay compose — did relevance/severity/copy fail? (Fix the gate.)

Three clean questions instead of one tangled guess. That is the structure-and-process this document buys.

---

*Maintained by: Stefano + Claude. This is the design of record for the Capture→Analyze→Compose split. Update HERE before building.*
