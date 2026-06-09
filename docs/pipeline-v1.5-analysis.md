# Audit Pipeline V1.5 — Structural Analysis & Lean Redesign

**Date:** 2026-06-09
**Scope:** Complete pipeline map, token cost analysis, lean V1.5 design

---

## Part 1: Complete Pipeline Map (Deep Mode, First Audit)

Every `step.run()` call in order, with API call counts:

| # | Step Name | API Calls | Model | What It Does |
|---|-----------|-----------|-------|-------------|
| 1 | `fetch-audit` | 0 | — | Load audit row from Supabase |
| 2 | `pipeline-init` | 0 | — | Age guard, status update, activity log |
| 3 | `crawl-preflight` | 0 | — | DNS check, robots.txt, URL normalization |
| 4 | `crawl-pages` | 0 | — | Puppeteer crawl (up to 5 pages), head tags, images, headings, a11y |
| 5 | `parallel-site-checks` | 0–3 Claude Sonnet + 1 PageSpeed | Sonnet 4 | Responsive (Puppeteer), PageSpeed (Google API), WCAG automated + **heuristic AI** |
| 6 | `parallel-probes` | 5 ask + 1 grade + 1 citation + 3–10 multi-model ask + 1 grade = **11–18 Claude Haiku** + **18–60 OpenRouter** | Haiku 4.5 + 6 external models | AI Discovery, Structured Data, Readability, LLM Probe, Citation Audit, Multi-Model Benchmark |
| 7 | `fix-playbooks` | 0 | — | Generate fix code from crawl data (deterministic) |
| 8 | `build-site-context` | 0 | — | Aggregate crawl + probe data for analyzer prompt |
| 9 | `detect-site-profile` | **1 Claude Haiku** | Haiku 4.5 | Classify site type/industry/scale from page content |
| 10 | `analysis-prep` | 0 | — | Build `contentForAnalysis` per page, batch categories |
| 11 | `analyze-batch-1` | **7 Claude Haiku** | Haiku 4.5 | Analyze categories 0–6 (system prompt cached) |
| 12 | `analyze-batch-2` | **7 Claude Haiku** | Haiku 4.5 | Analyze categories 7–13 |
| 13 | `analyze-batch-3` | **7 Claude Haiku** | Haiku 4.5 | Analyze categories 14–20 |
| 14 | `analyze-batch-4` | **7 Claude Haiku** | Haiku 4.5 | Analyze categories 21–27 |
| 15 | `quality-gates` | 0 | — | Dedup, speculative filter, contradiction check, fix-history gate, scoring, classification |
| 16 | `canonical-reconciliation` | 0 | — | 6-phase deterministic reconciliation |
| 17 | `generate-report` | **1 Claude Haiku** (deep mode only) | Haiku 4.5 | Executive narrative + category summaries |
| 18 | `complete` | 0 | — | Mark complete, send email |
| 19 | `post-report-enrichment` | **~7 Claude Haiku** (brand intel) + external APIs | Haiku 4.5 | Benchmark snapshot, brand intelligence, human perception, minimum findings, pipeline learn, predictive recs, screenshots |

### Total API Calls Per Deep-Mode First Audit (5-page site)

| Component | Claude Haiku | Claude Sonnet | OpenRouter | Notes |
|-----------|-------------|---------------|------------|-------|
| analyzeCategory (28 categories) | 28 | — | — | Core product — cannot reduce |
| detectSiteProfile | 1 | — | — | Core — site classification |
| generateReport | 1 | — | — | Core — executive narrative |
| LLM Probe (ask + grade) | 6 | — | — | Core — AI X-Ray feature |
| Citation Audit | 1 | — | — | Core — AI Citations tab |
| WCAG Heuristic | — | **3** | — | **EXPENSIVE** — Sonnet is 5× Haiku cost |
| Multi-Model Benchmark (ask) | 3–10 | — | — | Varies by question count |
| Multi-Model Benchmark (grade) | 1 | — | — | Single batch grading call |
| Multi-Model Benchmark (models) | — | — | **18–60** | 6 models × 3–10 questions |
| Brand Intelligence (sentiment) | **7** | — | — | 1 per model (post-report) |
| Competitor Probes | ~3 | — | — | Post-report enrichment |
| **TOTAL** | **~51–61** | **3** | **~18–60** | **~72–124 API calls** |

---

## Part 2: Token Cost Breakdown — Why Audits Reach 600K Tokens

### Per-Call Token Budget

**analyzeCategory** (28 calls):
- System prompt: ~2,250 tokens (cached after first call → 10% cost on calls 2–28)
- User prompt: ~2,000 tokens (category + checklist + 6,000 chars page content + site profile)
- Output: ~1,500 tokens average
- **First call**: 2,250 + 2,000 = 4,250 input + 1,500 output
- **Subsequent 27 calls**: 225 (cached) + 2,000 = 2,225 input + 1,500 output each
- **28-call total**: 4,250 + (27 × 2,225) = **64,325 input** + **42,000 output** = ~106K tokens

**WCAG Heuristic** (3 Sonnet calls):
- Each prompt includes full DOM snippets for a page: ~3,000–8,000 tokens
- Output: ~2,000 tokens per call
- **Total**: ~15,000–24,000 input + 6,000 output = ~21–30K tokens
- **Cost equivalent**: At Sonnet pricing (5× Haiku), this equals **105–150K Haiku tokens**

**Multi-Model Benchmark**:
- Claude ask phase (3–10 questions): 3–10 × ~400 input + ~400 output = ~2,400–8,000 tokens
- Claude grade phase: ~3,000 input + ~2,000 output = ~5,000 tokens
- OpenRouter (18–60 calls): Not billed to Anthropic, but each is ~400 input + ~400 output
- **Total Claude tokens**: ~7,400–13,000

**Brand Intelligence** (7 per-model calls):
- Each call: ~1,200 input + ~600 output = ~1,800 tokens
- **Total**: ~12,600 tokens

**LLM Probe** (5 ask + 1 grade):
- Ask: 5 × ~250 input + ~500 output = ~3,750 tokens
- Grade: ~3,000 input + ~2,000 output = ~5,000 tokens
- **Total**: ~8,750 tokens

**Other calls** (detectSiteProfile, generateReport, citation):
- ~3,000 + ~4,000 + ~2,500 = ~9,500 tokens

### Grand Total (Deep Mode, First Audit)

| Component | Raw Tokens | Haiku-Equivalent Cost |
|-----------|-----------|----------------------|
| analyzeCategory (28 calls) | ~106,000 | ~106,000 |
| WCAG Heuristic (3 Sonnet calls) | ~27,000 | **~135,000** (5× Sonnet multiplier) |
| Multi-Model Benchmark (Claude) | ~10,000 | ~10,000 |
| Multi-Model Benchmark (OpenRouter) | ~48,000 | External cost |
| Brand Intelligence | ~12,600 | ~12,600 |
| LLM Probe | ~8,750 | ~8,750 |
| Other (profile, report, citation) | ~9,500 | ~9,500 |
| **TOTAL** | **~222,000 raw** | **~282,000 Haiku-equivalent** |

### How Does This Reach 600K?

The 600K number the Anthropic dashboard shows likely comes from:

1. **Prompt caching accounting**: The dashboard may count full system prompt tokens (2,250 × 28 = 63,000) even though only the first call pays full price. The actual billed amount is lower, but the dashboard shows raw input tokens.

2. **Re-audit penalty**: A re-audit with `verifyFindings` adds batches of 8 findings each with 30,000 chars of page content. For 50 findings: ~7 batches × ~7,500 tokens = **52,500 additional input tokens**.

3. **`deep-pre-verify-findings`** on re-audits: Another verification pass — same scale as verifyFindings. **+52,500 tokens**.

4. **Retry loops (now fixed)**: Before commit 3c91b57, `llm-probe.ts` retried on timeouts (up to 3× per call). A single slow multi-model benchmark could trigger 60+ retries.

5. **WCAG Sonnet multiplier**: 3 Sonnet calls at 5× pricing = 135K Haiku-equivalent tokens — nearly half the total budget on a non-core feature.

6. **Custom workspace questions**: Multi-model benchmark with 10 shortlist questions instead of 3 = **60 OpenRouter calls** + **10 Claude calls** instead of 18 + 3.

**Worst-case re-audit with custom questions**: 106K (analysis) + 135K (WCAG Sonnet) + 105K (verify×2) + 25K (multi-model 10q) + 12.6K (brand intel) + 8.75K (LLM probe) + 9.5K (other) + retries = **~400–600K raw tokens**.

---

## Part 3: Stage Classification — NEW vs Original

| Stage | Status | Added In | Necessity |
|-------|--------|----------|-----------|
| fetch-audit | ORIGINAL | v1.0 | **MUST HAVE** |
| pipeline-init | ORIGINAL | v1.0 | **MUST HAVE** |
| crawl-preflight | ORIGINAL | v1.1 | **MUST HAVE** |
| crawl-pages | ORIGINAL | v1.0 | **MUST HAVE** |
| parallel-site-checks (responsive) | NEW | Phase 1 | NICE TO HAVE — Puppeteer, 0 API cost |
| parallel-site-checks (PageSpeed) | NEW | Speed feature | NICE TO HAVE — external API, 0 Claude cost |
| parallel-site-checks (WCAG automated) | NEW | WCAG feature | NICE TO HAVE — Puppeteer, 0 API cost |
| **parallel-site-checks (WCAG heuristic)** | **NEW** | WCAG feature | **EXPENSIVE-RISKY** — 3 Sonnet calls, non-core |
| parallel-probes (AI discovery) | NEW | Phase 1 | NICE TO HAVE — 0 API cost (HTTP probes) |
| parallel-probes (structured data) | NEW | Phase 1 | NICE TO HAVE — 0 API cost (deterministic) |
| parallel-probes (readability) | NEW | Phase 2 | NICE TO HAVE — 0 API cost (calculation) |
| parallel-probes (LLM probe) | NEW | Phase 2 | **MUST HAVE** — core AI X-Ray feature (6 Haiku) |
| parallel-probes (citation audit) | NEW | Phase 3 | **MUST HAVE** — core AI Citations feature (1 Haiku) |
| **parallel-probes (multi-model benchmark)** | **NEW** | Phase 4 | **EXPENSIVE-RISKY** — 4–11 Haiku + 18–60 OpenRouter, high timeout risk |
| fix-playbooks | NEW | Phase 3 | NICE TO HAVE — deterministic, 0 API cost |
| build-site-context | ORIGINAL | v1.1 | **MUST HAVE** |
| detect-site-profile | NEW | Module 7 | **MUST HAVE** — improves analysis quality (1 Haiku) |
| deep-pre-verify-findings | NEW | Re-audit | NICE TO HAVE — extra validation pass |
| analysis-prep | ORIGINAL | v1.0 | **MUST HAVE** |
| analyze-batch-1..4 | ORIGINAL | v1.0 | **MUST HAVE** — core product (28 Haiku) |
| quality-gates | ORIGINAL | v1.1 | **MUST HAVE** — all deterministic |
| reconcile-findings | NEW | Reconciliation | NICE TO HAVE — deterministic |
| canonical-reconciliation | NEW | Reconciliation | NICE TO HAVE — deterministic |
| generate-report | ORIGINAL | v1.0 | **MUST HAVE** — (1 Haiku in deep mode) |
| complete | ORIGINAL | v1.0 | **MUST HAVE** |
| **post-report-enrichment (brand intel)** | **NEW** | Tier 1 | **EXPENSIVE-RISKY** — 7 Haiku, runs post-complete |
| **post-report-enrichment (human perception)** | **NEW** | Tier 2 | **EXPENSIVE-RISKY** — external APIs, fragile |
| post-report-enrichment (screenshots) | NEW | v1.2 | NICE TO HAVE — Puppeteer, 0 API cost |
| post-report-enrichment (minimum findings) | NEW | Quality fix | NICE TO HAVE — deterministic |
| post-report-enrichment (pipeline learn) | NEW | Learning | NICE TO HAVE — DB only |
| post-report-enrichment (predictive recs) | NEW | Phase 4 | NICE TO HAVE — DB only |
| post-report-enrichment (benchmark snapshot) | NEW | Phase 4 | NICE TO HAVE — DB only |

### Summary

- **MUST HAVE**: 14 stages, ~37 Claude Haiku calls
- **NICE TO HAVE**: 12 stages, 0 API calls (all deterministic or Puppeteer)
- **EXPENSIVE-RISKY**: 4 stages, ~14–28 Claude calls + 3 Sonnet + 18–60 OpenRouter

---

## Part 4: Lean V1.5 Pipeline Design

### Principle
Keep every MUST HAVE stage. Keep every NICE TO HAVE stage that costs zero API calls. **Disable all EXPENSIVE-RISKY stages by default.** Re-enable them one at a time after measuring stability.

### Lean Pipeline (37 Claude Haiku calls, 0 Sonnet, 0 OpenRouter)

```
fetch-audit → pipeline-init → crawl-preflight → crawl-pages
→ parallel-site-checks [responsive ✓, PageSpeed ✓, WCAG automated ✓, WCAG heuristic ✗]
→ parallel-probes [AI discovery ✓, structured data ✓, readability ✓, LLM probe ✓, citation ✓, multi-model ✗]
→ fix-playbooks → build-site-context → detect-site-profile
→ analysis-prep → analyze-batch-1..4
→ quality-gates → reconcile-findings → canonical-reconciliation
→ generate-report → complete
→ post-report-enrichment [benchmark ✓, min-findings ✓, learn ✓, predictive ✓, screenshots ✓, brand-intel ✗, human-perception ✗]
```

### What Gets Cut

| Cut | Saves | Risk |
|-----|-------|------|
| WCAG heuristic AI | 3 Sonnet calls (~135K Haiku-equiv tokens) | WCAG automated checks still run — only AI heuristic review is cut |
| Multi-model benchmark | 4–11 Haiku + 18–60 OpenRouter calls | Intelligence/Benchmark tab has no data — show "Enable in settings" |
| Brand intelligence sentiment | 7 Haiku calls | Brand Intelligence card shows "Enable in settings" |
| Human perception | External API calls | Human Perception section shows "Enable in settings" |

### Token Budget: Lean V1.5

| Component | Tokens |
|-----------|--------|
| analyzeCategory (28) | ~106,000 |
| LLM Probe (6) | ~8,750 |
| Citation Audit (1) | ~2,500 |
| detectSiteProfile (1) | ~1,875 |
| generateReport (1) | ~4,000 |
| **TOTAL** | **~123,000** |

Down from 282K Haiku-equivalent (or 400–600K worst-case) to **~123K tokens**. That's a **56–80% reduction**.

---

## Part 5: Feature Flag Implementation

```typescript
// feature-flags.ts
export interface FeatureFlags {
  protectedSiteMode: boolean
  acquisitionDiagnostics: boolean
  politeCrawler: boolean
  // NEW — Lean pipeline mode
  leanPipeline: boolean  // Default: true (lean is the safe default)
}

export function getFeatureFlags(): FeatureFlags {
  return {
    protectedSiteMode: process.env.FEATURE_PROTECTED_SITE_MODE === 'true',
    acquisitionDiagnostics: process.env.FEATURE_ACQUISITION_DIAGNOSTICS === 'true',
    politeCrawler: process.env.FEATURE_POLITE_CRAWLER === 'true',
    leanPipeline: process.env.FEATURE_LEAN_PIPELINE !== 'false', // ON by default
  }
}
```

When `leanPipeline = true`:
- WCAG heuristic AI calls → skipped (automated checks still run)
- Multi-model benchmark → skipped entirely
- Brand intelligence sentiment → skipped
- Human perception → skipped
- WCAG model downgraded from Sonnet to Haiku (when re-enabled)

---

## Part 6: Re-Addition Strategy

After lean V1.5 is deployed and confirmed stable (audits completing reliably, no stalls, token budget ~123K):

1. **Week 1**: Re-enable multi-model benchmark (`FEATURE_LEAN_PIPELINE=false`). Monitor: completion rate, time-to-complete, token usage. Target: <10% increase in failure rate.
2. **Week 2**: Re-enable brand intelligence. Monitor same metrics.
3. **Week 3**: Re-enable WCAG heuristic (but downgraded to Haiku). Monitor for timeout increases.
4. **Week 4**: Re-enable human perception. Monitor external API reliability.

Each re-addition must pass: zero stall increase over 20 consecutive audits.

---

## Part 7: Hard Safety Rails (implemented alongside lean mode)

1. **Every step gets `withStepTimeout`**: No step can run longer than its budget.
   - fetch-audit: 30s
   - pipeline-init: 15s
   - crawl-preflight: 30s
   - fix-playbooks: 30s
   - build-site-context: 30s
   - detect-site-profile: 60s
   - quality-gates: 60s
   - reconcile-findings: 60s
   - canonical-reconciliation: 30s
   - generate-report: 120s
   - complete: 30s

2. **WCAG model downgraded**: From `claude-sonnet-4-20250514` to `claude-haiku-4-5-20251001` — eliminates 5× cost multiplier.

3. **No retry on timeout**: Already fixed in commit 3c91b57.

4. **DB helpers have 10s timeouts**: Already fixed in commit 3c91b57.

5. **Post-completion enrichment is best-effort**: Already wrapped in try/catch — failures don't affect audit status.
