# Proprietary Pipeline Rules

These rules are hard-won lessons from production bugs. They MUST be followed
when modifying any part of the audit pipeline.

---

## Rule 1: Re-audits MUST audit what the user selects

**File:** `src/lib/audit-engine/analyzer.ts` → `generateReport()` baseline mode

A re-audit (baseline mode) copies scores from the previous audit. But if the
user selects modules that were NOT in the previous audit (e.g. they add SEO
Structure or Brand Consistency), the gap-fill step in `process-audit.ts` creates
new findings for those modules. The report generator MUST also produce scores
for those gap-filled categories.

### What goes wrong without this rule

1. User runs an initial audit without SEO.
2. User re-audits with SEO selected.
3. `process-audit.ts` gap-fill correctly detects SEO is missing, runs AI
   analysis, and inserts findings into the DB.
4. `generateReport()` baseline mode maps ONLY over `previousCategoryScores`,
   which has no SEO entries → SEO categories are silently dropped from the
   report → the user sees no SEO scores despite selecting it.

### The fix (implemented)

After building `categoryScores` from `previousCategoryScores`, iterate over the
current audit's `selected_modules`. For any module whose categories are NOT
present in the previous scores, calculate scores from the gap-filled findings
using severity-based deduction (same approach as `calculateScoresFromFindings`).
Append those scores to `categoryScores` so pillar averages and overall score
include them.

Also: the baseline `pillarAvg()` function must use **name-based lookup** against
the full 24-category name list (like deep mode does), NOT positional slicing,
because gap-filled categories are appended at the end of the array.

### Never regress on this

Any future change to baseline report generation must ensure that ALL categories
from the audit's `selected_modules` appear in the final `categoryScores` array,
even if they weren't in the previous audit.

---

## Rule 2: Gap-fill findings must be scored, not just inserted

**File:** `src/lib/inngest/functions/process-audit.ts` → gap-fill section

The gap-fill step inserts findings into the DB but does NOT produce scores.
Score production is the responsibility of `generateReport()`. Any change to
gap-fill must ensure that `generateReport()` can detect and score gap-filled
categories (see Rule 1).

---

## Rule 3: Module selection flows through `selected_modules`

The canonical field for which modules to audit is `audits.selected_modules`
(a JSON array of slug strings). The legacy `selected_pillars` (integer array)
is still supported for old audits but new code should always check
`selected_modules` first.

Module slugs: `foundation`, `human_experience`, `inclusive_design`,
`future_readiness`, `seo_structure`, `brand_consistency`.

Each module maps to 4 consecutive category indices (0–3, 4–7, 8–11, 12–15,
16–19, 20–23).
