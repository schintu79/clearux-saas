# Protected Site Audit Mode — System Design

## 1. Architecture Summary: Current Audit Acquisition Flow

The current acquisition pipeline is a linear chain with binary gates:

```
POST /api/credits (consume credit/quota)
  → Inngest: audit/process
    → Step: crawl-preflight (15s timeout)
        ├─ checkRobotsTxt(domain)        ── parallel
        └─ checkHttpAccess(normalizedUrl) ── parallel
        Decision: accessible → continue | crawl-blocked/unreachable/http-error → throw → refund
    → Step: crawl-pages (180s timeout)
        └─ crawlPages(url, maxPages)
            └─ Per URL: fetchPageRobust(url) (30s timeout)
                ├─ Strategy 1: firecrawlFetch()       ← JS-rendered, best quality
                ├─ Strategy 2: directFetch()           ← raw HTTP, parallel with Jina
                └─ Strategy 3: jinaFetch()             ← Jina Reader API, parallel with direct
        Post-crawl validation:
          ├─ No pages / empty first page → check blockedByBot → throw BLOCKED or generic fail
          ├─ SOFT_BLOCK_MARKERS regex on homepage contentText → throw BLOCKED
          ├─ Homepage < 200 chars → throw BLOCKED
          └─ > 80% pages thin → add degraded_crawl limitation, continue
    → Filter: remove auth-gated pages, thin pages, error pages, near-duplicates
    → Aggregate: CrawledPage[] → single `pageContent` string (URL/Title/H1/Meta/HeadTags/Content per page, joined by \n---\n)
    → Enrich: prepend site context, append AI discovery / structured data / LLM probe summaries
    → Analyze: analyzeCategory(contentWithContext, category, ...) in batches of 8
    → Report → Screenshots → Complete
```

**Key characteristics:**

- **Credit timing**: Credits are consumed at `payment_received` status (before crawl). Refund on failure via `refundCredit()`.
- **Refund triggers**: preflight blocked, soft block markers, thin homepage, crawl timeout, any uncaught error in the pipeline.
- **Browser rendering exists** for responsive checking (`responsive-checker.ts` uses Puppeteer) but NOT for content acquisition.
- **Detection is binary**: any block signal → hard stop + refund. No fallback to alternative acquisition.
- **Three fetch strategies** exist but the fallback is within a single page fetch, not a pipeline-level escalation.
- **The analyzer receives a flat string**, not structured page objects. It parses URLs back out via regex.

**What this misses:**

- Sites behind JS-only rendering (React SPAs, Next.js SSR that returns skeleton to raw fetch) get thin content or false blocks.
- Sites with mild anti-bot (rate limiting, soft challenges) that a real browser would pass get hard-stopped.
- No diagnostic visibility into *why* content was thin — was it bot protection, JS-only, or genuinely thin?
- No partial success path — if standard crawl gets 3 real pages and 7 blocked ones, the whole audit either proceeds with degraded data or gets killed.

---

## 2. Proposed Acquisition State Model

### Three acquisition states

```
┌─────────────────────────────────────────────────────────────────┐
│                     ACQUISITION STATES                          │
├───────────────┬──────────────────────┬──────────────────────────┤
│   CRAWLABLE   │  BROWSER-ACCESSIBLE  │  PROTECTED/OWNER-GATED  │
│               │                      │                          │
│ Standard HTTP │ JS rendering needed  │ Anti-bot wall blocks     │
│ fetch works.  │ OR mild rate-limit   │ both HTTP and browser.   │
│ Firecrawl /   │ bypassed by real     │ Owner must whitelist or  │
│ Direct / Jina │ browser behavior.    │ provide content.         │
│ return real   │ Puppeteer headful    │                          │
│ content.      │ gets content.        │ Future: manual upload,   │
│               │                      │ sitemap-only mode, or    │
│               │                      │ API key auth.            │
└───────────────┴──────────────────────┴──────────────────────────┘
```

### State transitions

```
                    ┌──────────────┐
                    │   PREFLIGHT  │
                    │  (unchanged) │
                    └──────┬───────┘
                           │
                    accessible / partial
                           │
                    ┌──────▼───────┐
                    │  STANDARD    │
                    │  CRAWL       │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────────┐
              │            │                │
        pages OK    partial block      full block
        + content   (some pages thin   (homepage blocked
        adequate    or blocked)         or all pages thin)
              │            │                │
              ▼            │                │
         CRAWLABLE         │                │
         (continue)        │                │
                    ┌──────▼───────┐        │
                    │  BROWSER     │◄───────┘
                    │  RENDER      │
                    │  FALLBACK    │ (feature-flagged)
                    └──────┬───────┘
                           │
              ┌────────────┼────────────────┐
              │            │                │
        content OK   partial content    still blocked
              │            │                │
              ▼            ▼                ▼
         BROWSER-     BROWSER-        PROTECTED
         ACCESSIBLE   ACCESSIBLE      (refund + suggest
         (continue    (continue       owner action)
          full audit)  with limits)
```

### Per-page acquisition metadata

Every page carries its acquisition state so downstream steps know the provenance:

```typescript
type AcquisitionMethod = 'firecrawl' | 'direct' | 'jina' | 'browser_render' | 'owner_provided'

type AcquisitionQuality = 'full' | 'partial' | 'degraded' | 'empty'

interface PageAcquisition {
  method: AcquisitionMethod
  quality: AcquisitionQuality
  /** Which strategies were attempted before success */
  attempts: Array<{
    method: AcquisitionMethod
    succeeded: boolean
    durationMs: number
    failReason?: string  // e.g. 'blocked_cloudflare', 'thin_content', 'timeout'
  }>
  /** Content length of the acquired text */
  contentLength: number
  /** Whether this page was acquired via fallback */
  isFallback: boolean
}
```

### Audit-level acquisition summary

Stored in `audits.crawl_summary` (existing JSONB column):

```typescript
interface AcquisitionSummary {
  /** Overall acquisition state for the audit */
  state: 'crawlable' | 'browser_accessible' | 'protected'
  /** Breakdown by method */
  pagesByMethod: Record<AcquisitionMethod, number>
  /** How many pages hit each quality level */
  pagesByQuality: Record<AcquisitionQuality, number>
  /** Whether browser render fallback was used */
  usedBrowserFallback: boolean
  /** Whether any pages were still blocked after all strategies */
  hasBlockedPages: boolean
  /** Diagnostic: what protection systems were detected */
  detectedProtection: string[]  // e.g. ['cloudflare', 'datadome']
  /** Total pages attempted vs successfully acquired */
  pagesAttempted: number
  pagesAcquired: number
}
```

---

## 3. Canonical Normalized Page-Input Schema

All acquisition methods MUST produce this schema before any content enters the analysis pipeline. This replaces the current ad-hoc string aggregation.

```typescript
/**
 * NormalizedPage — the canonical page record that the analysis
 * pipeline consumes. Every acquisition method (standard fetch,
 * browser render, owner upload) MUST produce this exact shape.
 *
 * This is the contract between acquisition and analysis.
 * If a field can't be populated, it MUST be null — never omitted.
 */
export interface NormalizedPage {
  // ── Identity ──────────────────────────────────────────────
  /** Canonical URL after redirect resolution */
  url: string
  /** Original URL before redirects (null if no redirect) */
  originalUrl: string | null

  // ── SEO metadata ──────────────────────────────────────────
  title: string | null
  h1: string | null
  metaDescription: string | null
  /** Parsed <head> tag data (canonical, og:*, hreflang, etc.) */
  headTags: HeadTagData | null

  // ── Content ───────────────────────────────────────────────
  /** Clean extracted text content, max 12000 chars */
  contentText: string | null
  /** Raw HTML (for link extraction, structured data, etc.) */
  rawHtml: string | null
  /** Content language detected or from <html lang> */
  language: string | null

  // ── Links ─────────────────────────────────────────────────
  /** URLs discovered on this page */
  discoveredUrls: string[]
  /** Total link count */
  linksFound: number

  // ── Technical ─────────────────────────────────────────────
  statusCode: number | null
  /** Wall-clock fetch time in ms */
  loadTimeMs: number | null
  /** ISO timestamp of acquisition */
  acquiredAt: string

  // ── Acquisition provenance ────────────────────────────────
  acquisition: PageAcquisition

  // ── Block detection ───────────────────────────────────────
  /** True when the page appears to be a bot-block page */
  blockedByBot: boolean
  /** Human-readable block reason */
  blockReason: string | null
}
```

### Adapter pattern

Each acquisition method has an adapter that converts its raw output to `NormalizedPage`:

```typescript
// Adapters — one per acquisition method
function fromCrawledPage(page: CrawledPage, attempts: PageAcquisition['attempts']): NormalizedPage
function fromBrowserRender(result: BrowserRenderResult): NormalizedPage
function fromOwnerUpload(upload: OwnerUploadData): NormalizedPage  // future
```

### Aggregation to analysis input

The existing string-based aggregation (`pageContent = pages.map(...).join('\n---\n')`) is preserved as a **formatting step** that reads from `NormalizedPage[]`. This avoids breaking the analyzer's URL-parsing logic:

```typescript
function formatPagesForAnalysis(pages: NormalizedPage[]): string {
  return pages
    .map(p => {
      let block = ''
      if (p.url) block += `URL: ${p.url}\n`
      if (p.title) block += `Title: ${p.title}\n`
      if (p.h1) block += `H1: ${p.h1}\n`
      if (p.metaDescription) block += `Meta Description: ${p.metaDescription}\n`
      if (p.headTags) {
        const headBlock = formatHeadTagsForAnalysis(p.headTags)
        if (headBlock) block += `Head Tags:\n${headBlock}\n`
      }
      if (p.contentText) block += `Content:\n${p.contentText}\n`
      return block
    })
    .join('\n---\n')
}
```

This is deliberately identical to the current aggregation logic. The only change is that it reads from `NormalizedPage` fields instead of `CrawledPage` fields.

---

## 4. Implementation Plan with Exact Touchpoints

### Phase 0: Foundation (no behavior change)

**Goal**: Introduce the `NormalizedPage` schema and adapters without changing any pipeline behavior. All existing tests and audits continue working identically.

#### Step 0.1: Create `src/lib/audit-engine/normalized-page.ts`

New file containing:
- `NormalizedPage` interface
- `PageAcquisition` interface
- `AcquisitionMethod` and `AcquisitionQuality` types
- `AcquisitionSummary` interface
- `fromCrawledPage()` adapter — converts existing `CrawledPage` → `NormalizedPage`
- `formatPagesForAnalysis()` — the string formatter (extracted from process-audit.ts lines 965-980)
- `computeAcquisitionSummary()` — derives summary from `NormalizedPage[]`

#### Step 0.2: Create `src/lib/audit-engine/acquisition-diagnostics.ts`

New file containing:
- `AcquisitionDiagnostics` interface (per-audit diagnostic log)
- `logAcquisitionAttempt()` — records each strategy attempt
- `logAcquisitionDecision()` — records escalation/fallback decisions
- `formatDiagnosticsForLog()` — serializes for `audit_logs`

#### Step 0.3: Refactor `process-audit.ts` crawl step output

**File**: `src/lib/inngest/functions/process-audit.ts`
**Lines**: 965-1000 (content aggregation)

Change: After `crawlPages()` returns, convert `CrawledPage[]` → `NormalizedPage[]` via `fromCrawledPage()`, then use `formatPagesForAnalysis()` for the string output. The downstream `pageContent` string is byte-identical — this is a pure refactor.

```typescript
// Before (current):
const pageContent = filteredPages.map((p) => { ... }).join('\n---\n')

// After:
const normalizedPages = filteredPages.map(p => fromCrawledPage(p, [{ method: p.fetchStrategy as AcquisitionMethod ?? 'direct', succeeded: true, durationMs: p.loadTimeMs ?? 0 }]))
const pageContent = formatPagesForAnalysis(normalizedPages)
```

The `crawlResult` object gains a new field `normalizedPages` alongside the existing `pageContent` string.

### Phase 1: Browser Render Fallback (feature-flagged)

**Goal**: When standard crawl returns blocked or thin content, attempt Puppeteer-based content extraction before giving up.

#### Step 1.1: Create `src/lib/audit-engine/browser-renderer.ts`

New file. Extracts content using Puppeteer (reusing the browser launch logic from `responsive-checker.ts`):

```typescript
export interface BrowserRenderResult {
  url: string
  title: string | null
  h1: string | null
  metaDescription: string | null
  contentText: string | null
  rawHtml: string | null
  statusCode: number | null
  loadTimeMs: number
  blockedByBot: boolean
  blockReason: string | null
}

/**
 * Render a single page in a headless browser and extract content.
 * Uses the same Puppeteer launch path as responsive-checker.ts.
 *
 * Timeout: 20s per page (browser navigation + content extraction).
 */
export async function browserRenderPage(url: string): Promise<BrowserRenderResult>

/**
 * Render multiple pages with controlled concurrency.
 * Shares a single browser instance across pages.
 *
 * @param urls URLs to render
 * @param concurrency Max parallel pages (default 2)
 * @param timeoutMs Per-page timeout (default 20000)
 */
export async function browserRenderPages(
  urls: string[],
  concurrency?: number,
  timeoutMs?: number,
): Promise<BrowserRenderResult[]>
```

Implementation details:
- Launches one browser instance, opens pages in parallel (max concurrency 2)
- Sets a realistic viewport (1440x900) and user agent
- Waits for `networkidle0` (no pending requests for 500ms) with 15s timeout
- Extracts: `document.title`, first `h1`, `meta[name=description]`, `document.body.innerText`, `document.documentElement.outerHTML`
- Runs the same `detectBlockReason()` check on the rendered HTML
- If still blocked (challenge page rendered), returns `blockedByBot: true`
- Closes the browser in a `finally` block

#### Step 1.2: Create `src/lib/audit-engine/acquisition-pipeline.ts`

New file. The staged acquisition orchestrator:

```typescript
export interface AcquisitionConfig {
  /** Enable browser render fallback */
  browserFallbackEnabled: boolean
  /** Max pages to browser-render (expensive) */
  browserFallbackMaxPages: number
  /** Threshold: % of pages that must be blocked/thin to trigger fallback */
  fallbackThreshold: number
  /** Max total acquisition time in ms */
  totalTimeoutMs: number
}

export interface AcquisitionResult {
  pages: NormalizedPage[]
  summary: AcquisitionSummary
  diagnostics: AcquisitionDiagnostics
  /** The acquisition state determined for this audit */
  state: 'crawlable' | 'browser_accessible' | 'protected'
}

/**
 * Staged acquisition pipeline:
 * 1. Standard crawl (existing crawlPages)
 * 2. Evaluate: if sufficient content → return CRAWLABLE
 * 3. If blocked/thin → browser render fallback (if enabled)
 * 4. Evaluate: if browser got content → return BROWSER_ACCESSIBLE
 * 5. If still blocked → return PROTECTED (caller decides: refund or partial audit)
 */
export async function acquirePages(
  url: string,
  maxPages: number,
  config: AcquisitionConfig,
  onProgress?: (pct: number, stage: string) => Promise<void>,
): Promise<AcquisitionResult>
```

Decision logic inside `acquirePages`:

```
standardResult = crawlPages(url, maxPages)
normalizedPages = standardResult.pages.map(fromCrawledPage)

homepageOk = normalizedPages[0]?.acquisition.quality !== 'empty'
            && !normalizedPages[0]?.blockedByBot
contentPages = normalizedPages.filter(p => p.acquisition.quality !== 'empty')
contentRatio = contentPages.length / normalizedPages.length

if (homepageOk && contentRatio >= 0.5):
  return { state: 'crawlable', pages: normalizedPages }

if (!config.browserFallbackEnabled):
  // Feature flag off → behave exactly like current pipeline
  if any blocked → throw BLOCKED (same as today)
  else → return with degraded_crawl limitation

// Browser fallback
blockedUrls = normalizedPages
  .filter(p => p.blockedByBot || p.acquisition.quality === 'empty')
  .map(p => p.url)
  .slice(0, config.browserFallbackMaxPages)

browserResults = await browserRenderPages(blockedUrls)
browserNormalized = browserResults.map(fromBrowserRender)

// Merge: replace blocked pages with browser-rendered versions
mergedPages = merge(normalizedPages, browserNormalized)

newContentRatio = mergedPages.filter(p => p.acquisition.quality !== 'empty').length / mergedPages.length
homepageOk = mergedPages[0]?.acquisition.quality !== 'empty'

if (homepageOk && newContentRatio >= 0.3):
  return { state: 'browser_accessible', pages: mergedPages }

// Still blocked
return { state: 'protected', pages: mergedPages }
```

#### Step 1.3: Integrate into `process-audit.ts`

**File**: `src/lib/inngest/functions/process-audit.ts`

Replace the crawl step (lines 726-849) and the subsequent validation logic with a call to `acquirePages()`. The feature flag controls whether the new path runs or the old one.

```typescript
// In the crawl-pages step:
const featureFlags = await getFeatureFlags(userId)

if (featureFlags.protectedSiteMode) {
  const acqResult = await acquirePages(productUrl, maxPages, {
    browserFallbackEnabled: true,
    browserFallbackMaxPages: Math.min(5, maxPages),
    fallbackThreshold: 0.5,
    totalTimeoutMs: 240_000,  // 4 minutes (standard 180s + browser 60s)
  }, onProgress)

  if (acqResult.state === 'protected') {
    // Refund and mark as blocked — same as current behavior
    throw new Error(`BLOCKED: Site is protected. ${acqResult.summary.detectedProtection.join(', ')}`)
  }

  // Store acquisition diagnostics
  await db.from('audit_logs').insert({
    audit_id: auditId,
    event: 'acquisition_complete',
    status: 'info',
    message: `Acquisition state: ${acqResult.state}`,
    metadata: { summary: acqResult.summary, diagnostics: acqResult.diagnostics },
  })

  crawlResult = {
    pageContent: formatPagesForAnalysis(acqResult.pages),
    normalizedPages: acqResult.pages,
    // ... existing fields for backwards compat
  }
} else {
  // Current behavior — unchanged
  crawlResult = await step.run('crawl-pages', async () => { ... })
}
```

#### Step 1.4: Update `crawl_summary` storage

**File**: `src/lib/inngest/functions/process-audit.ts`
**Lines**: ~1000 (after crawl step, where crawl_summary is written to DB)

Add `AcquisitionSummary` fields to the existing `crawl_summary` JSONB column. No schema migration needed — it's already JSONB.

### Phase 2: Observability and Diagnostics

**Goal**: Every acquisition attempt is logged with strategy, timing, and outcome.

#### Step 2.1: Wire diagnostics into `audit_logs`

After each acquisition step, write a structured log entry:

```typescript
await db.from('audit_logs').insert({
  audit_id: auditId,
  event: 'acquisition_attempt',
  status: 'info',
  message: `${method} on ${url}: ${succeeded ? 'ok' : failReason}`,
  metadata: {
    url,
    method,
    succeeded,
    durationMs,
    contentLength,
    failReason,
    attemptIndex,
  },
})
```

This uses the existing `audit_logs` table with its existing `metadata` JSONB column. No schema change needed.

#### Step 2.2: Surface in admin panel

**File**: `src/app/dashboard/admin/audit/[id]/page.tsx` (or wherever audit detail is shown)

Add an "Acquisition Log" section that reads `audit_logs` entries with `event = 'acquisition_attempt'` and displays them in a timeline.

### Phase 3: Politer Crawler Behavior

**Goal**: Reduce false positives from rate limiting and improve success rate.

#### Step 3.1: Rate limiting in `crawlPages()`

**File**: `src/lib/audit-engine/crawler.ts`
**Lines**: 1155-1553 (inside `crawlPages`)

Current behavior: pages are fetched with concurrency controlled by `Promise.all` batches but no per-domain rate limiting.

Add:
- Per-domain delay between requests: 500ms minimum gap
- Adaptive backoff: if a 429 is received, double the delay (up to 5s)
- Lower concurrency: max 2 concurrent fetches to the same domain (currently unbounded within a batch)

#### Step 3.2: Better User-Agent rotation

**File**: `src/lib/audit-engine/crawler.ts`
**Lines**: 423-428

Current: 4 static UAs, randomly selected per request (inconsistent within a session).

Change: Select one UA at crawl start and use it consistently for all requests in the same crawl session. Add 2-3 more recent UA strings (Chrome 126+).

### Phase 4: Protected Mode UX (future)

Not in initial implementation. Design only.

When an audit returns `state: 'protected'`:
- UI shows "This site has bot protection. Here's what we could still analyze:" with partial results
- Offers options: "Verify site ownership" (DNS TXT record), "Upload sitemap", "Try again with different URL"
- Owner verification unlocks a special crawl mode with higher timeouts and browser rendering by default

---

## 5. Schema Changes

### No new tables needed.

All changes fit into existing columns:

| Table | Column | Type | Change |
|-------|--------|------|--------|
| `audits` | `crawl_summary` | JSONB | Already exists. Add `AcquisitionSummary` fields to the JSON structure. No migration needed — JSONB is schema-free. |
| `audit_logs` | `metadata` | JSONB | Already exists. Acquisition diagnostics stored here. No migration needed. |

### Optional migration (Phase 2+):

```sql
-- Add acquisition_state column for fast filtering in admin panel
-- Only needed if we want to query by acquisition state without parsing JSONB
ALTER TABLE audits ADD COLUMN IF NOT EXISTS acquisition_state TEXT;
-- Values: 'crawlable', 'browser_accessible', 'protected', NULL (legacy)

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_audits_acquisition_state ON audits (acquisition_state) WHERE acquisition_state IS NOT NULL;
```

This is a non-breaking additive column. Existing audits have `NULL` which means "legacy / pre-feature".

### Feature flags table

If no feature flags table exists yet:

```sql
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_percent INTEGER DEFAULT 0,  -- 0-100, for gradual rollout
  allowed_user_ids UUID[] DEFAULT '{}',  -- specific users to enable for
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO feature_flags (flag_name, enabled, rollout_percent, metadata) VALUES
  ('protected_site_mode', false, 0, '{"description": "Enable browser render fallback for blocked sites"}'),
  ('acquisition_diagnostics', true, 100, '{"description": "Log detailed acquisition diagnostics to audit_logs"}');
```

Alternatively, if feature flags are managed via environment variables (simpler for a small team):

```env
# .env
FEATURE_PROTECTED_SITE_MODE=false
FEATURE_ACQUISITION_DIAGNOSTICS=true
```

---

## 6. Feature Flags

### Flag: `protected_site_mode`

Controls whether the browser render fallback is attempted.

| Value | Behavior |
|-------|----------|
| `false` (default) | Pipeline behaves exactly as today. Standard crawl → binary block detection → refund or continue. Zero risk. |
| `true` | After standard crawl detects blocking, attempts browser render fallback before giving up. Adds ~30-60s to blocked audits. |

**Rollout plan:**
1. Deploy code with flag `false`. Run existing test suite. Verify zero behavior change.
2. Enable for internal test accounts (`allowed_user_ids`).
3. Run against the 6 regression scenarios (Section 7).
4. Enable for 10% of audits (`rollout_percent: 10`).
5. Monitor: acquisition success rate, average audit time, browser render success rate, error rate.
6. Ramp to 50%, then 100%.

### Flag: `acquisition_diagnostics`

Controls verbose logging of acquisition attempts.

| Value | Behavior |
|-------|----------|
| `false` | Existing logging only. |
| `true` (default) | Every fetch attempt, fallback decision, and timing is logged to `audit_logs.metadata`. |

Ship this flag enabled from day one. It's read-only logging with zero risk to pipeline behavior.

### Flag: `polite_crawler`

Controls the rate-limiting and backoff behavior.

| Value | Behavior |
|-------|----------|
| `false` | Current concurrency and timing. |
| `true` | 500ms inter-request delay, adaptive 429 backoff, consistent UA per session. |

---

## 7. Regression Test Plan

### Test Matrix

Six scenarios covering the full acquisition spectrum. Each must be tested with `protected_site_mode = false` (current behavior preserved) AND `protected_site_mode = true` (new behavior correct).

#### Scenario A: Fully Crawlable Site

- **Test URL**: A standard marketing site with no bot protection (e.g., a static Hugo/Jekyll site).
- **Expected (flag off)**: Standard crawl succeeds. All pages have content. Audit completes normally.
- **Expected (flag on)**: Identical behavior. Browser fallback is never triggered. Diagnostics log shows all pages acquired via standard strategies.
- **Verify**: Final `pageContent` string is byte-identical in both modes. Audit score is identical. Credits consumed correctly (no double-charge, no erroneous refund).

#### Scenario B: Cloudflare-Protected Site (full block)

- **Test URL**: A site behind Cloudflare Under Attack Mode or similar aggressive WAF.
- **Expected (flag off)**: Preflight or soft block detection catches it. Audit fails. Credit refunded. Status: `failed`. Error message mentions bot protection.
- **Expected (flag on)**: Standard crawl blocked → browser render attempted → if browser also blocked → state: `protected` → refund + fail. If browser succeeds → state: `browser_accessible` → audit continues with browser-rendered content.
- **Verify**: Refund fires correctly for `protected` state. No double refund. Audit log shows acquisition attempts for each strategy. If audit proceeds, analysis quality is acceptable.

#### Scenario C: JS-Rendered SPA (React/Next.js with client-side rendering)

- **Test URL**: A React SPA where raw HTTP fetch returns only a shell (`<div id="root"></div>`).
- **Expected (flag off)**: Firecrawl handles this if configured (it does JS rendering). If Firecrawl is down or returns thin content, direct+Jina also get thin content → soft block or degraded crawl.
- **Expected (flag on)**: If standard crawl returns thin content → browser render fallback fires → Puppeteer gets full rendered content → state: `browser_accessible` → audit proceeds normally.
- **Verify**: Content quality from browser render is comparable to Firecrawl output. Page count, scores, and findings are reasonable.

#### Scenario D: Rate-Limited Site

- **Test URL**: A site that returns 429 after N rapid requests.
- **Expected (flag off)**: First few pages crawl fine. After rate limit, remaining pages get 429 → marked as blocked. If > 80% thin → degraded_crawl limitation. If homepage is fine, audit continues with partial data.
- **Expected (flag on + polite_crawler)**: Inter-request delay and backoff prevent 429s entirely. More pages crawled successfully. If some still rate-limited → browser fallback for those specific pages.
- **Verify**: No false "site blocked" errors. Audit completes with more pages than flag-off mode. Credits NOT refunded (audit succeeds).

#### Scenario E: Mixed Protection (some pages accessible, some blocked)

- **Test URL**: A site where `/` and `/about` are public but `/pricing` and `/blog/*` are behind a login wall or geo-restriction.
- **Expected (flag off)**: Homepage crawls fine. Some pages blocked. If > 80% thin → degraded. If < 80% thin → continues with partial data + limitation.
- **Expected (flag on)**: Standard crawl for all. Browser fallback only for blocked pages. Merged result has more content. Auth-gated filter still removes genuinely private pages.
- **Verify**: Auth-gated page filter still works correctly. Browser render doesn't accidentally crawl behind login walls (no cookies/sessions). Audit quality improves vs flag-off.

#### Scenario F: Site Down / DNS Failure

- **Test URL**: A non-existent domain or a server that's actually down.
- **Expected (flag off)**: Preflight catches it → `unreachable` → fail + refund.
- **Expected (flag on)**: Identical. Browser fallback is NOT attempted for unreachable sites (no point rendering a DNS failure). Preflight gate still fires first.
- **Verify**: No change in behavior. Refund happens. Error message is clear. No browser resources wasted.

### Verification Checklist (for each scenario)

- [ ] Audit completes with correct final status (`completed` / `failed` / `completed_with_warnings`)
- [ ] Credit/quota accounting is correct (consumed if success, refunded if fail)
- [ ] No double-charge and no double-refund
- [ ] `audit_logs` contain acquisition diagnostic entries (when `acquisition_diagnostics` flag is on)
- [ ] `crawl_summary` JSONB contains `AcquisitionSummary` fields
- [ ] Analysis findings reference real page URLs (not bot-block pages)
- [ ] Screenshots capture real content (not challenge pages)
- [ ] Report PDF/DOCX is generated correctly
- [ ] Scores are reasonable given the content quality
- [ ] Pipeline completes within Vercel Pro timeout (300s per step)
- [ ] Browser instances are properly cleaned up (no zombie Puppeteer processes)
- [ ] Existing audit history is unaffected (no migration changes old data)

---

## 8. Implementation Order and Dependency Graph

```
Phase 0 (zero risk):
  0.1  normalized-page.ts (types + fromCrawledPage adapter)
  0.2  acquisition-diagnostics.ts (logging utilities)
  0.3  Refactor process-audit.ts aggregation to use NormalizedPage
       └─ depends on 0.1
  ── Deploy. Run full test suite. Verify zero behavior change. ──

Phase 1 (feature-flagged):
  1.1  browser-renderer.ts (Puppeteer content extraction)
  1.2  acquisition-pipeline.ts (staged orchestrator)
       └─ depends on 0.1, 0.2, 1.1
  1.3  Integrate into process-audit.ts behind flag
       └─ depends on 0.3, 1.2
  1.4  Update crawl_summary storage
       └─ depends on 1.3
  ── Deploy with flag off. Test scenarios A-F with flag off. ──
  ── Enable flag for test accounts. Test scenarios A-F with flag on. ──
  ── Gradual rollout: 10% → 50% → 100%. ──

Phase 2 (observability):
  2.1  Wire diagnostics into audit_logs
       └─ depends on 0.2, 1.3
  2.2  Admin panel acquisition log view
       └─ depends on 2.1
  ── Deploy. Always-on logging. ──

Phase 3 (crawler polish):
  3.1  Rate limiting in crawlPages()
  3.2  UA rotation improvement
  ── Deploy behind polite_crawler flag. ──

Phase 4 (future):
  Protected mode UX (ownership verification, manual upload)
  ── Not in initial scope. ──
```

### Critical safety invariants (must hold at every phase)

1. **Billing**: `checkAuditQuota()` and `getAuditUsage()` are NEVER touched. Credit/quota logic remains in `audit-usage.ts`.
2. **Refund**: `refundCredit()` is called on the same conditions as today. Browser fallback failure still triggers refund.
3. **Analysis input**: `analyzeCategory()` receives the same string format. The `NormalizedPage` → string conversion produces identical output to the current direct aggregation.
4. **Screenshots**: The screenshot step (`capture-audit-screenshots`) continues to use its own Puppeteer path. It is NOT affected by acquisition changes.
5. **Existing fetch strategies**: `firecrawlFetch()`, `directFetch()`, `jinaFetch()` are not modified. The browser renderer is a new strategy added alongside them, not a replacement.
6. **Inngest step boundaries**: Each acquisition phase runs within the existing `crawl-pages` step. No new Inngest steps are added (which would change the step graph and break in-flight audits).
7. **Feature flag off = zero change**: When `protected_site_mode` is `false`, the code path is identical to the current implementation. The flag gate is at the top of the crawl step, not sprinkled throughout.
