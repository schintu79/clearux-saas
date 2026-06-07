# Brand Intelligence Scoring Integrity Fix

## Before/After Explanation

---

## The Problem (Before)

The "What AI models say about you" question view and the "Model-by-model breakdown" were disagreeing. A model could appear mostly Accurate in the question-level view but show 0% or very low accuracy in the model summary card.

### Root Cause: 4 Contributing Bugs

#### Bug 1: API Aggregation Mismatch

The API route (`/api/audits/intelligence`) stored multiple rows per model in the `multi_model_probes` table (one per probe batch or re-run). It aggregated these rows by:

- **Deduplicating `results_json`** (merging question/answer records, removing duplicates by question text)
- **But averaging `accuracy_score`** across the raw DB rows: `p.accuracy_score = avg(p._accuracyScores)`

This meant the `accuracy_score` returned by the API reflected the *average of stale per-row scores*, while `results_json` reflected the *deduplicated merge of all answers*. The UI displayed answers from the merged set but the model card showed a score computed from a different data set.

**Example failure:** Model has 2 DB rows. Row 1 has 3 questions (score: 33%). Row 2 adds 2 more accurate answers (score: 100%). Merged `results_json` = 5 questions, mostly accurate. But `avg([33, 100]) = 66%` — not the real score of the 5 merged answers.

#### Bug 2: `normalizeAccuracy()` Label Collapse

The frontend `normalizeAccuracy()` function collapsed multiple distinct categories into a binary:

```javascript
// BEFORE (broken):
if (a.includes('accurate')) return 'Accurate';
if (a.includes('partial')) return 'Partial';
return 'Inaccurate'; // ← hallucinated AND no_data BOTH became "Inaccurate"
```

The backend scoring formula gives `no_data` 25 points (neutral — the model simply didn't have data). But the UI was painting these as red "Inaccurate" labels (0 points visually), making models look worse than they actually scored.

#### Bug 3: Dual Scoring Paths

The hero accuracy % was computed from `probe.accuracy_score` (the API's averaged value from Bug 1), while the question-level badges were rendered from the actual `results_json` entries. Two different data sources feeding two different parts of the same page.

#### Bug 4: Sentiment/Placement Shown When Null

Model cards displayed dashes (`—`) for sentiment and placement when no data existed, implying the feature was partially operational. This violated Rule 5 (no fake completeness).

---

## The Fix (After)

### Fix 1: API Recomputes Accuracy From Deduplicated Results

**File:** `src/app/api/audits/intelligence/route.ts`

```typescript
// AFTER: accuracy recomputed from the SAME deduplicated results_json the UI displays
const recomputeAccuracy = (results: any[]): number => {
  const counts = { accurate: 0, partial: 0, inaccurate: 0, hallucinated: 0, noData: 0 };
  for (const r of results) {
    const a = (r.accuracy || '').toLowerCase().trim();
    if (a === 'accurate') counts.accurate++;
    else if (a === 'partial') counts.partial++;
    else if (a === 'inaccurate') counts.inaccurate++;
    else if (a === 'hallucinated') counts.hallucinated++;
    else counts.noData++;
  }
  const total = results.length;
  return Math.round(((counts.accurate * 100 + counts.partial * 50 + counts.noData * 25) / (total * 100)) * 100);
};

// Applied: score is now derived from the exact answers, not averaged across rows
p.accuracy_score = recomputeAccuracy(p.results_json);
```

This mirrors the canonical `buildBenchmark()` formula from `multi-model-probe.ts` (the pipeline code that originally generates the scores).

### Fix 2: 5-Category normalizeAccuracy

**Files:** `ai-perception/page.tsx`, `intelligence/page.tsx`

```typescript
// AFTER: 5 distinct categories, matching backend pipeline
function normalizeAccuracy(raw: string | null | undefined): string | null {
  if (!raw) return 'No Data';
  const a = raw.toLowerCase().trim();
  if (a === 'accurate') return 'Accurate';
  if (a === 'partial') return 'Partial';
  if (a === 'inaccurate') return 'Inaccurate';
  if (a === 'hallucinated') return 'Hallucinated';
  if (a === 'no_data' || a === 'no data') return 'No Data';
  // Fuzzy fallbacks for legacy data...
  return 'Inaccurate';
}
```

"No Data" now gets its own neutral gray styling — never shown as red/failing.

### Fix 3: Single Source of Truth — `computeAccuracyFromResults()`

**File:** `ai-perception/page.tsx`

Both the hero score AND model cards now use the same function on the same data:

```typescript
const computeAccuracyFromResults = (results: Array<{ accuracy: string | null }>) => {
  const counts = { accurate: 0, partial: 0, inaccurate: 0, hallucinated: 0, noData: 0 };
  for (const r of results) {
    const norm = normalizeAccuracy(r.accuracy);
    // ... count each category
  }
  const total = results.length;
  if (total === 0) return null;
  return {
    score: Math.round(((counts.accurate * 100 + counts.partial * 50 + counts.noData * 25) / (total * 100)) * 100),
    counts,
    total,
  };
};
```

- **Hero:** `computeAccuracyFromResults(allMeasuredResults)`
- **Per model card:** `computeAccuracyFromResults(probe.results_json)`

Same function. Same formula. Same underlying data. No divergence possible.

### Fix 4: Sentiment Hidden When Null

Model cards now conditionally render sentiment only when `probe.sentiment_score != null`:

```tsx
{/* Sentiment — only show if actually measured (RULE 5) */}
{hasSent && (
  <div>Sentiment: {probe.sentiment_score}/100</div>
)}
```

No dashes. No placeholder. If data doesn't exist, the row doesn't render.

### Fix 5: Coverage Display

Each model card now shows how many questions it answered:

```
Accuracy: 74%  [Good]
Coverage: 8 questions
Sentiment: 62/100  (only if measured)
```

This immediately explains why a score might be lower — if a model only answered 3 questions vs. another answering 10, the user sees that context.

---

## Scoring Formula (Canonical)

```
score = (accurate × 100 + partial × 50 + noData × 25) / (total × 100) × 100
```

| Category | Points | UI Color | Meaning |
|----------|--------|----------|---------|
| Accurate | 100 | Green | Model gave factually correct answer |
| Partial | 50 | Amber | Partially correct or incomplete |
| No Data | 25 | Gray (muted) | Model had no information (neutral) |
| Inaccurate | 0 | Red | Factually wrong |
| Hallucinated | 0 | Red (dark) | Fabricated information |

### Why No Data = 25 (not 0)

A model saying "I don't have information about that" is not a failure — it's honest uncertainty. The pipeline treats this as a mild negative (you want models to know about you) but not as wrong. Scoring it at 0 would punish honesty the same as hallucination.

---

## Test Case Verification

### A. Model with mostly Accurate answers
- 8/10 Accurate, 2/10 Partial → `(8×100 + 2×50) / (10×100) × 100 = 90%`
- UI shows: "90% — Strong" with green badge

### B. Model with mix of Accurate + Partial
- 4 Accurate, 4 Partial, 2 No Data → `(400 + 200 + 50) / 1000 × 100 = 65%`
- UI shows: "65% — Fair" with amber badge

### C. Model with very few answered questions
- 2 Accurate out of 2 total → `(200) / (200) × 100 = 100%`
- UI shows: "100% — Strong" AND "Coverage: 2 questions" — user sees it's limited data

### D. Sentiment unavailable
- `probe.sentiment_score = null` → row not rendered. No dashes, no "N/A".

### E. Placement unavailable
- Same rule. Hidden entirely.

### F. Regression case (the screenshot scenario)
- **Before:** Model shows "Accurate" and "Partial" in question view. Model card shows ~0% because the averaged DB rows included a stale row where the model hadn't answered yet (scoring 0), and no_data answers were counted as "Inaccurate" (0 points) by the label collapse.
- **After:** Model card recomputes from the SAME merged answers shown in the question view. If those answers are 5 Accurate + 2 Partial + 1 No Data = `(500 + 100 + 25) / 800 × 100 = 78%`. The card says 78%, matching what you see in the questions.

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/api/audits/intelligence/route.ts` | `recomputeAccuracy()` replaces `avg()` for accuracy_score |
| `src/app/dashboard/ai-perception/page.tsx` | Full rewrite of normalizeAccuracy, computeAccuracyFromResults, model cards |
| `src/app/dashboard/intelligence/page.tsx` | Aligned normalizeAccuracy, fixed hallucinated/noData counting |

---

## Rules Enforced

| Rule | Status |
|------|--------|
| RULE 1: Same evaluated records for question + model | Enforced — both use `results_json` |
| RULE 2: No hidden aggregation | Enforced — formula is `computeAccuracyFromResults()` everywhere |
| RULE 3: No metric without truthful source | Enforced — sentiment hidden when null |
| RULE 4: Missing data ≠ negative scoring | Enforced — No Data = 25pts, not 0 |
| RULE 5: Unavailable = hidden | Enforced — no dashes, no placeholders |
| RULE 6: UI cannot overstate negativity | Enforced — scores now match visible answers |
