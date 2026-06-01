# Proprietary Pipeline Rules

These rules are hard-won lessons from production bugs. They MUST be followed
when modifying any part of the audit pipeline.

---

## Rule 1: Re-audits MUST audit what the user selects

**File:** `src/lib/audit-engine/analyzer.ts` → `generateReport()` baseline mode

A re-audit (baseline mode) copies scores from the previous audit. But if the
user selects modules that were NOT in the previous audit (e.g. they add SEO
Structure or Design Consistency), the gap-fill step in `process-audit.ts` creates
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
`future_readiness`, `seo_structure`, `accessibility_readiness`, `design_consistency`.

Each module maps to 4 consecutive category indices (0–3, 4–7, 8–11, 12–15,
16–19, 20–23, 24–27).

---

## Rule 4: Crawler hostname matching MUST handle www/non-www equivalence

**File:** `src/lib/audit-engine/crawler.ts`

The crawler uses hostname comparison to filter discovered links to same-site
only. This comparison MUST use `isSameHost()` (which normalizes `www.` prefix)
and NEVER raw `===` comparison.

### What goes wrong without this rule

1. User enters `keycense.com` as the audit URL.
2. The site redirects to `www.keycense.com`.
3. The crawler fetches the homepage successfully (direct fetch follows
   redirects).
4. All discovered links have `www.keycense.com` as their hostname.
5. The filter `link.hostname === baseHostname` compares `www.keycense.com`
   against `keycense.com` → MISMATCH → all links filtered out → only
   homepage is crawled.

### The fix (implemented)

1. `normalizeHostname()` strips `www.` prefix for comparison.
2. `isSameHost(a, b)` compares normalized hostnames.
3. `normalizeUrlForDedup()` normalizes URLs for the visited set (strips www,
   trailing slash, fragment, lowercases).
4. After fetching the first page, `baseHostname` is updated to the resolved
   hostname from the actual response URL.
5. All hostname comparisons throughout the file (`extractLinks`,
   `extractLinksFromText`, `discoverSitemapUrls`, `probeCommonPaths`,
   level 1/level 2 filtering) use `isSameHost()` instead of `===`.

### Never regress on this

Any new hostname comparison in the crawler MUST use `isSameHost()`. Raw
`===` on hostnames will break for any site that uses www/non-www redirects.

---

## Rule 5: URL deduplication must normalize before comparing

**File:** `src/lib/audit-engine/crawler.ts`

The visited set and URL dedup maps must use `normalizeUrlForDedup()` which
strips www prefix, trailing slashes, fragments, and lowercases. Without this,
the crawler may visit the same page twice via different URL forms
(e.g. `https://example.com/about/` vs `https://example.com/about`).

---

## Rule 6: Crawler must use resolved origin for discovery strategies

**File:** `src/lib/audit-engine/crawler.ts` → `crawlPages()`

After the first page fetch, the crawler resolves the actual hostname from the
response URL. The sitemap and common-path discovery strategies must use this
resolved origin (not the user-entered origin) so that probed URLs match the
actual domain the server responds to. If the resolved origin yields no
sitemap results, fall back to the original origin as well.
