# Fixpath Changelog

Structured record of every bug fix, feature, and architectural change. Organized by system area, each entry includes the root cause, what was changed, and which files were touched.

Last updated: 2026-05-21

---

## Surgical Fix Engine

### Multilingual lang attribute fix broken on batch deploy
- **Bug**: The deterministic `html-lang-attribute` pattern extracted a single target language from the recommendation text and applied it to ALL pages. On multilingual sites where Italian pages need `lang='it'` and English pages need `lang='en-US'`, it would incorrectly set every page to `lang='it'` (the first match).
- **Fix**: Made the `DeterministicFix.apply` interface accept an optional `pageUrl` parameter. The lang attribute pattern now parses all language-to-page mappings from the recommendation text, matches the current page URL to find the correct target lang, and falls back to URL pattern inference (e.g. `-eng` suffix implies English). The `pageUrl` is threaded from the API route through `tryDeterministicFix` and `checkAlreadyFixed`.
- **Files**: `src/lib/surgical-fix.ts`, `src/app/api/surgical-fix/route.ts`

---

## State Synchronization (AuditBundleContext)

### Cross-page stale data after mutations
- **Bug**: Every dashboard page (Overview, Find, Fix, Track, AI Readability, Intelligence) independently called `loadLatestAuditBundle()` and held its own `useState` copy. A status change on Fix wouldn't appear on Find or Track until the user navigated away and back.
- **Fix**: Created `AuditBundleContext` — a shared React context that loads the bundle once and exposes `updateFindingLocally()` for optimistic updates, `updateReportScore()` for score changes, and `invalidate()` for server reconciliation. Wrapped in `DashboardShell` so all dashboard pages share one source of truth. Migrated all 6 consumer pages to use `useAuditBundle()` instead of local state.
- **Files**: `src/context/AuditBundleContext.tsx` (new), `src/components/layout/DashboardShell.tsx`, `src/app/dashboard/fix/page.tsx`, `src/app/dashboard/find/page.tsx`, `src/app/dashboard/track/page.tsx`, `src/app/dashboard/overview/page.tsx`, `src/app/dashboard/ai-readability/page.tsx`, `src/app/dashboard/intelligence/page.tsx`

### Score not updated after status change
- **Bug**: The Fix page's `handleStatus()` and `handleDismiss()` ignored the `scoreUpdate` returned by `PATCH /api/findings/:id`, so the overview score stayed stale until full page reload.
- **Fix**: Both handlers now read `scoreUpdate.newScore` from the API response and call `updateReportScore()` on the shared context, then `invalidate()` after 500ms to reconcile with the server.
- **Files**: `src/app/dashboard/fix/page.tsx`

### Rollback doesn't revert finding status
- **Bug**: `handleRollback()` in FixConsole restored the original file via FTP but left the finding status as `'fixed'`, creating a mismatch between the deployed state and the finding status.
- **Fix**: Added `onStatusChange?.('in_progress')` after successful rollback so the finding reverts to in-progress state.
- **Files**: `src/components/dashboard/v2/FixConsole.tsx`

---

## FixConsole

### Fixed findings still showing fix action buttons
- **Bug**: Findings with `status === 'fixed'` in the database still showed "Generate surgical fix" / "Fix all pages" buttons instead of the post-deploy UI (undo + edit). This happened because `deployResults` is ephemeral React state that resets when switching between findings.
- **Fix**: Added `isAlreadyFixed` flag derived from `finding.status === 'fixed'`. Updated the three conditional blocks controlling UI visibility: diff preview, deploy actions, and post-deploy actions all now respect the persisted status. The "Edit page" button also calls `onStatusChange?.('in_progress')` to revert the finding status when the user wants to re-edit.
- **Files**: `src/components/dashboard/v2/FixConsole.tsx`

---

## Code Quality UI

### Code Quality section on Technical Health tab
- **Feature**: Added a Code Quality section to the Technical Health tab on the audit detail page. Surfaces per-page HTML and CSS syntax issues detected by the code quality checker engine.
- **Summary stats**: Added "Code errors" stat card to the summary grid (expanded from 4 to 5 columns).
- **Per-page rows**: Expandable `<details>` rows per page showing rating (Good / Needs work / Poor), error/warning counts broken down by HTML vs CSS, and individual issue details with severity badges (ERR/WARN) and category tags (HTML/CSS).
- **Issue display**: Each issue shows type badge, category badge, message text, and line number. Capped at 15 visible issues per page with overflow count.
- **Files**: `src/app/dashboard/audits/[id]/page.tsx`

---

## Code Quality Checker

### HTML & CSS syntax validation engine
- **Feature**: Built a zero-dependency code quality checker that scans raw HTML for structural and CSS syntax issues. Two entry points: `runCodeQualityChecks()` for audit-time full-page scans, and `validateHtmlCss()` for pre-deploy patched file validation.
- **HTML checks**: Unclosed/mismatched tags (stack-based parser), unexpected closing tags, duplicate IDs, unquoted attributes, deprecated tags (`<font>`, `<center>`, `<marquee>`), images missing width/height (CLS risk), missing DOCTYPE.
- **CSS checks**: Unclosed braces (comment/string-aware), missing semicolons (heuristic), invalid hex colors, malformed values (e.g. `: px` without number, space between number and unit).
- **Audit integration**: Runs during the crawl step alongside `runTechnicalChecks()`. Results stored in `audit_pages.code_quality` (jsonb) per page. Issues are capped at 25 per category and deduplicated by rule+line.
- **Pre-deploy integration**: `validatePatch()` in surgical-fix.ts now runs code quality checks on patched HTML before deploy. Only surfaces NEW errors not present in the original file — avoids flagging pre-existing issues.
- **Rating**: `good` (0 errors), `needs_improvement` (1-3 errors), `poor` (4+).
- **Files**: `src/lib/pipeline/code-quality-checker.ts` (new), `src/lib/audit-engine/index.ts`, `src/lib/surgical-fix.ts`

---

## Surgical Fix Engine

### Two-tier deterministic + AI fix architecture
- **Feature**: Built a two-tier surgical fix system: Tier 1 (deterministic patterns, no AI, instant, batch-capable) and Tier 2 (AI-assisted Haiku patches, 2-4s)
- **Architecture**: `DETERMINISTIC_PATTERNS` registry of known fix patterns. Each pattern has: `name`, `detect(finding)` → boolean, `apply(content, finding)` → `{find, replace, explanation}`, and `scope` (`single-page` | `all-pages`). Engine tries every pattern before falling back to AI
- **Patterns implemented**: (1) `html-lang-attribute` — extracts current lang from `<html>` tag, determines target lang from finding text, swaps the attribute. Scope: `all-pages`. (2) `missing-viewport-meta` — inserts viewport meta tag after `<meta charset>`. Scope: `all-pages`. (3) `meta-charset` — adds `<meta charset="utf-8">` as first child of `<head>`. Scope: `all-pages`
- **No-op detection**: `checkAlreadyFixed()` catches when file already has the correct value. Returns human-readable message instead of crashing. Also catches in `applyPatch()` when `find.trim() === content.trim()`
- **Batch detection**: `detectBatchPattern()` returns pattern name + scope for UI to decide whether to show "Fix all pages" button
- **API integration**: `route.ts` tries Tier 1 (checkAlreadyFixed → tryDeterministicFix) before Tier 2 (buildPrompt → callSurgicalAI → applyPatch)
- **Files**: `src/lib/surgical-fix.ts`, `src/app/api/surgical-fix/route.ts`

### Multi-page batch fix UI
- **Feature**: When a deterministic pattern has `scope: 'all-pages'`, FixConsole shows a "Fix all pages" button that generates fixes and deploys across all crawled pages sequentially
- **How it works**: `handleBatchFix()` iterates through all pages, calls `/api/surgical-fix` for each (which hits the deterministic Tier 1 path), then deploys via `/api/ftp` with backup. Shows real-time progress bar with per-page status (pending → loading → success/error). Auto-marks finding as "fixed" when all pages succeed
- **Already-fixed handling**: If a page already has the correct value, it's marked as success with the "already correct" message — no unnecessary writes
- **Files**: `src/components/dashboard/v2/FixConsole.tsx`

### Post-deploy state — hide fix buttons, show undo + edit
- **Problem**: After a fix was deployed (single page or batch), the "Generate surgical fix" and "Fix all pages" buttons remained visible. The undo button was nested inside the same conditional that hides on `deployResult?.ok`, so it disappeared exactly when it should appear — a contradiction.
- **Fix**: Restructured the button area into two separate blocks: (1) pre-deploy actions (fix/generate buttons + reversibility notice), gated by `!deployResult?.ok`; (2) post-deploy actions (success banner + undo + edit), gated by `deployResult?.ok`. The undo button now correctly shows after deploy. Added an "Edit page" button that clears `deployResult` and `surgicalResult`, re-enabling the fix flow for further tweaking on the deployed page.
- **Batch compatibility**: Works seamlessly with batch deploys — `handleBatchFix` already populates `deployResults` per page index, so switching page tabs shows the correct post-deploy state for each page.
- **Files**: `src/components/dashboard/v2/FixConsole.tsx`

### All-pages expansion and auto-path for batch fixes
- **Problem**: For `scope: 'all-pages'` patterns (e.g. html lang attribute), the Fix Console only showed 1 affected page because `groupFindingsForDisplay()` collects `affectedPages` from findings sharing the same signature — but the finding is typically stored on only 1 page. The remote file path field was also left empty, requiring manual user input, which defeats the purpose of one-click fixes.
- **Fix**: Added `allCrawledPages` prop to FixConsole, derived from all unique `page_url` values across every finding in the audit bundle. When `detectBatchPattern()` returns `scope: 'all-pages'`, the page list expands to all crawled pages instead of just the finding's affected pages. Remote file paths are auto-suggested from the page URLs using the FTP connection's `remote_path` root.
- **Prop threading**: `allCrawledPages` is computed in `FixPageInner` via `useMemo` over `bundle.findings`, passed through `ActiveFindingDetail` to `FixConsole`.
- **Files**: `src/app/dashboard/fix/page.tsx`, `src/components/dashboard/v2/FixConsole.tsx`

### Batch fix UX — hide path field, auto-resolve, enable buttons
- **Problem**: For batch patterns (e.g. html lang fix affecting all pages), the "Generate surgical fix" and "Fix all pages" buttons were disabled because `canDeploy` and `canBatchDeploy` required a manually-filled remote file path. The remote file path input was empty and the user had no way to know what to enter.
- **Fix**: (1) Hide the remote file path input when a batch pattern is detected — replaced with a "Paths auto-resolved from N crawled page URLs" message. (2) `canDeploy` and `canBatchDeploy` no longer require pre-filled paths when a batch pattern is active. (3) `handleBatchFix` auto-resolves paths from page URLs + the FTP connection's `remote_path` root via `suggestRemotePath()`. (4) `handleSurgicalFix` and `handleSurgicalDeploy` also auto-resolve paths when the field is empty.
- **Files**: `src/components/dashboard/v2/FixConsole.tsx`

### Redesign page tabs and clarify batch vs single fix flow
- **Problem**: Page tabs were flat underlined text buttons that didn't clearly communicate these are separate pages. The two deploy buttons ("Generate surgical fix" vs "Fix all pages") were confusing — unclear which to use first.
- **Page tabs redesign**: Replaced flat tab-bar with a grid of numbered card-style buttons. Each page shows: a numbered circle (or green check when deployed), the pathname in monospace, and a language badge if non-default. Active page has a bold border and shadow. Section headed by a Globe icon and "Affected pages" label with count badge.
- **Button hierarchy for batch patterns**: "Fix all pages" is now the primary (dark) button, positioned first. "Preview single page fix" is secondary (outlined). Added inline explanation text clarifying each button's purpose.
- **Files**: `src/components/dashboard/v2/FixConsole.tsx`

### `batch-replace` operation type added to DiffPreview
- **Fix**: Added `'batch-replace'` to `SurgicalOperation` type union and `OP_META` record in DiffPreview to prevent TypeScript error
- **Files**: `src/components/dashboard/v2/DiffPreview.tsx`

### JSON-LD structured data patches failing — `ac76afc`
- **Bug**: Hitting "Surgical fix" on schema/JSON-LD findings returned "AI returned invalid JSON" error
- **Root cause**: Three compounding issues: (1) `max_tokens: 2048` too small for JSON-LD replacements — response truncated mid-JSON; (2) markdown fence stripping regex `^```(?:json)?\n?` didn't match all Haiku output variants; (3) AI was copying entire `<script>` blocks into the `find` field, making responses huge
- **Fix**: Increased `max_tokens` to 4096. Improved fence regex to handle whitespace variants. Added truncation detection via `stop_reason === 'max_tokens'` with recovery logic. Added block-aware replacement: when `find` matches just a `<script>` opening tag, engine auto-extends match to `</script>`. Updated prompt to tell AI to keep `find` to 1-3 lines max
- **Files**: `src/lib/surgical-fix.ts`

### `i.split is not a function` crash — `669f6c6`
- **Bug**: Runtime crash when opening surgical fix for some findings
- **Root cause**: `patch` state could be null/undefined when `finding.recommendation` wasn't a string. Code called `patch.split('\n')` without null check
- **Fix**: Changed `patch.split('\n')` to `(patch || '').split('\n')`
- **Files**: `src/components/dashboard/v2/FixConsole.tsx` (line ~1245)

### Italian page showing English recommendation — `669f6c6`
- **Bug**: Surgical fix for Italian pages generated English replacement text
- **Root cause**: `surgical-fix.ts` had zero language awareness — `buildPatchPrompt()` never received page language
- **Fix**: Full pipeline: FixConsole detects language via URL TLD patterns (`detectLang()`) → passes `language` field in API call → `/api/surgical-fix/route.ts` extracts and forwards to `buildPrompt()` → `buildPatchPrompt()` adds `LANGUAGE RULE (CRITICAL)` instruction telling AI all visible text must be in target language
- **Files**: `src/components/dashboard/v2/FixConsole.tsx`, `src/lib/surgical-fix.ts`, `src/app/api/surgical-fix/route.ts`

### Surgical fix 524 timeout — `463cdae`
- **Bug**: Surgical fix requests timing out at 524 on Vercel
- **Root cause**: Original engine used Sonnet to rewrite the entire file (30-60s). Way too slow for serverless
- **Fix**: Rewrote engine to use Haiku with JSON patch mode. AI returns a tiny `{action, find, content}` patch instruction. Engine applies it via string replacement. Typical response: 2-4 seconds
- **Files**: `src/lib/surgical-fix.ts`

### Schema/JSON-LD findings misclassified as "requires design work" — `985f799`
- **Bug**: Code-only fixes like adding JSON-LD were blocked by the `requiresNewUi` gate
- **Root cause**: Classification logic didn't distinguish code/schema fixes from visual design changes
- **Fix**: Skip `requiresNewUi` gate for code-only fix types (schema, meta, script)
- **Files**: `src/components/dashboard/v2/FixConsole.tsx`

---

## Audit Pipeline Performance

### Deep mode audit taking too long — `c410c9e`
- **Bug**: Deep mode audits felt slow — user reported "taking ages"
- **Root cause**: `BATCH_SIZE=4` meant 6 serial waves of AI calls (24 categories / 4). Multiple tiny Inngest steps each added cold-start overhead (~1-2s per checkpoint)
- **Fix**: Increased `BATCH_SIZE` from 4 to 8 (3 serial waves instead of 6). Merged quality-gate Inngest steps: `deduplicate-findings` + `filter-speculative-findings` + `progress-after-analysis` → single `quality-gates` step. Merged `verify-findings` + `progress-after-quality` into one step. Folded `progress-after-crawl` into `check-responsive-design` step
- **Files**: `src/lib/inngest/functions/process-audit.ts`

### Audit rate limiting / 429 errors — `b12e6a9`
- **Bug**: Audits failing with Anthropic rate limit errors on concurrent calls
- **Root cause**: Too many parallel AI calls hitting Anthropic's per-minute token limits
- **Fix**: Reduced concurrency, added exponential retry logic, sequentialized LLM probes
- **Files**: `src/lib/inngest/functions/process-audit.ts`

### Prompt caching — `84ecc81`
- **Feature**: Wire Anthropic prompt caching into analyzer calls
- **What**: High-impact API calls (analyzer, probes) now use prompt caching to reduce token costs and latency
- **Files**: `src/lib/audit-engine/analyzer.ts`, various probe files

### Audit progress stuck at 0% — `350897d`
- **Bug**: Progress bar never updated during audit
- **Root cause**: `progress_percent` field wasn't being set in Inngest pipeline steps
- **Fix**: Added `setProgress()` calls at each pipeline stage
- **Files**: `src/lib/inngest/functions/process-audit.ts`

---

## AI X-Ray & Benchmark

### AI X-Ray score instability — `de3ebab` + `5a8ae6c`
- **Bug**: AI X-Ray scores fluctuated on every page load
- **Root cause**: LLM probe and grading calls used default temperature (non-zero), producing different scores each time
- **Fix**: Set `temperature: 0` on all probe and grading API calls. Added 6-hour cooldown preventing re-scans from overwriting stable scores
- **Files**: `src/lib/audit-engine/llm-probes.ts`, AI X-Ray components

### Gemini probe failing — `53f2edf`
- **Bug**: Gemini probes returning errors, breaking multi-model benchmarking
- **Root cause**: Model name `gemini-pro` was deprecated; needed `gemini-2.5-flash`
- **Fix**: Updated model name to `gemini-2.5-flash`
- **Files**: `src/lib/audit-engine/llm-probes.ts`

### Accuracy grading labeling correct answers as "Fabricated" — commit in `c8a44fa`
- **Bug**: AI X-Ray accuracy badges showing "Fabricated" for answers that were actually correct
- **Root cause**: Grading methodology was too strict — any deviation from ground truth was marked as fabrication
- **Fix**: Revised grading to distinguish genuine fabrication from paraphrasing/approximation
- **Files**: `src/lib/audit-engine/llm-probes.ts`

### Benchmark scores inconsistent on reload — `68f5aca`
- **Bug**: Benchmark page showing different scores each time
- **Root cause**: Legacy audits had unstored scores recalculated from stale data
- **Fix**: Stabilize legacy scores and snapshot at report time
- **Files**: `src/lib/inngest/functions/process-audit.ts`, benchmark components

---

## FTP / Deploy System

### FTP connection dropping between operations — `a0bff53`
- **Bug**: FTP operations failing intermittently after initial connection worked
- **Root cause**: FTP client was connecting/disconnecting per operation, no connection reuse
- **Fix**: Added connection pooling to FTP client factory
- **Files**: `src/lib/ftp-client.ts`

### FTP client factory returning Promise instead of client — related to `5c69cc4`
- **Bug**: Deploy operations crashing on `client.connect is not a function`
- **Root cause**: `createFtpClient()` was async but callers weren't awaiting it
- **Fix**: Fixed factory to properly return resolved client
- **Files**: `src/lib/ftp-client.ts`

### FTP connections not scoped to brand — `213fa3c` + `2602490`
- **Bug**: FTP connections from one brand/site visible on another
- **Root cause**: Queries didn't filter by brand or domain
- **Fix**: Enforce per-brand scoping via `brand_id` filter; scope to site domain when brand isn't available. Return empty list instead of all connections when `brandId` is missing
- **Files**: `src/app/api/ftp/route.ts`, FTP-related components

### Deploy history lost on reload — `0573881`
- **Bug**: Undo/rollback button disappeared after page refresh
- **Root cause**: Deploy history was only in React state, not persisted
- **Fix**: Load deploy history from DB so undo button persists across reloads
- **Files**: Deploy console components, API routes

---

## Fix Console (FixConsole.tsx)

### What Will Change card cleanup — `e8e3a81`
- **Bug**: Card had redundant badges, misaligned metadata, broken affected page display, confusing preview panel
- **Fix**: Removed duplicate "Surgical fix" and "html" labels. Aligned metadata into clean grid columns. Fixed affected page to show correctly. Removed preview section panel (search/social/assistant previews)
- **Files**: `src/components/dashboard/v2/FixConsole.tsx`

### Fix Console full refactor — `7ddc936`
- **Feature**: Strict surgical-fix system with scope boundaries
- **What**: Refactored into two-path deploy console: surgical (code changes via AI patch) vs. strategic (design recommendations). Added fix classification into categories before rendering. Mandatory "What will change" card with metadata and impact fields
- **Files**: `src/components/dashboard/v2/FixConsole.tsx`

### Multi-page deploy tabs — `f8a206c`
- **Feature**: When a finding affects 2+ pages, show tabs for each page instead of a single deploy target
- **Files**: `src/components/dashboard/v2/FixConsole.tsx`

### Active finding not scrolling into view — `409283b`
- **Bug**: Selecting a finding in sidebar didn't scroll it into viewport
- **Fix**: Added `scrollIntoView()` call when active finding changes
- **Files**: `src/components/dashboard/v2/FixConsole.tsx`

---

## Dashboard UI

### Native select dropdowns dark/unreadable — `242946f` + `60dcb5f` + `c82e361`
- **Bug**: Dropdown menus had dark backgrounds in dark mode, making text invisible
- **Root cause**: Native `<select>` and `<option>` elements inherit dark theme colors but can't be fully styled
- **Fix**: First tried `color-scheme: light` force, then reset option backgrounds globally, finally replaced all native selects with custom `CustomSelect` component
- **Files**: `src/components/ui/CustomSelect.tsx`, globals.css, various pages

### Score ring and sticky bar inconsistencies — `30e4060`
- **Bug**: Score ring too small on overview card; Track page had React hooks ordering error
- **Fix**: Enlarged score ring, fixed hooks ordering
- **Files**: Audit detail page, Track page

### Tab navigation redesign — across multiple commits
- **Feature**: Redesigned from basic tab buttons to a proper editorial-style navigation menu
- **Files**: `src/app/dashboard/audits/[id]/page.tsx`

### "Dig deeper" renamed to "Deep mode" — `c410c9e`
- **Change**: All UI instances (action strip, bottom bar, three-dot menu, help text) renamed from "Dig deeper" / "Dig Deeper" to "Deep mode"
- **Files**: `src/app/dashboard/audits/[id]/page.tsx`

---

## Audit Engine / Analyzer

### Speculative findings slipping through — multiple commits
- **Bug**: Findings like "cannot verify from crawled content" appearing in results
- **Root cause**: Analyzer prompt not strict enough; speculative filter had gaps
- **Fix**: Hardened analyzer prompt with explicit quality rules. Strengthened speculative filter patterns in `pipeline/speculative-filter.ts`
- **Files**: `src/lib/audit-engine/analyzer.ts`, `src/lib/proprietary-pipeline/speculative-filter.ts`

### Crawler only scanning 1 page — `130` era commits
- **Bug**: Multi-page audits only analyzing homepage
- **Root cause**: Crawler was returning after first page instead of following internal links
- **Fix**: Updated crawler to follow links and scan multiple pages
- **Files**: `src/lib/audit-engine/crawler.ts`

### Score-to-findings gap — `255` era
- **Bug**: Categories could score low (e.g. 40/100) but have zero findings
- **Root cause**: Analyzer could rate a category poorly without generating specific findings
- **Fix**: Enforce minimum findings for low-scoring categories
- **Files**: `src/lib/inngest/functions/process-audit.ts`

### Duplicate findings in Deep Mode — `28` era
- **Bug**: Deep mode producing near-identical findings
- **Root cause**: Dedup logic used exact title matching only
- **Fix**: Tightened dedup with fuzzy matching, cosine similarity on descriptions
- **Files**: `src/lib/proprietary-pipeline/dedup.ts`

---

## WCAG Compliance

### WCAG 2.1 AA checker — `685453d`
- **Feature**: Built full WCAG conformance checker engine and dashboard tab
- **What**: Checks color contrast, keyboard navigation, ARIA labels, form labels, landmarks, heading hierarchy, focus indicators, touch targets. Results shown in dedicated dashboard tab with pass/fail/warning checklist
- **Files**: `src/lib/proprietary-pipeline/wcag-checker.ts`, `src/components/dashboard/v2/WcagChecklist.tsx`, process-audit.ts

---

## Responsive Checker

### Responsive design checks — `156-159` era
- **Feature**: Puppeteer-based layout checks at 4 viewport sizes (mobile, tablet, desktop, wide)
- **What**: Checks for horizontal overflow, text readability, tap target sizes, image scaling, layout shifts. Results fed into analyzer prompt for better responsive findings
- **Files**: `src/lib/audit-engine/responsive-checker.ts`, process-audit.ts, analyzer.ts

---

## Reports (PDF / DOCX)

### PDF generation broken — `90` era
- **Bug**: PDF route crashing after HTML template migration
- **Fix**: Reverted to PDFKit with template colors for reliable generation
- **Files**: `src/app/api/reports/[id]/pdf/route.ts`

### CATEGORY_KEYWORDS mismatch — `149`
- **Bug**: Report categories not matching finding categories
- **Root cause**: Index array in render-website-report.ts was out of sync with analyzer categories
- **Fix**: Aligned keyword arrays
- **Files**: `src/lib/reports/render-website-report.ts`

---

## Authentication & Security

### Auth bypass in detect-competitors — `152`
- **Bug**: GET `/api/audits/detect-competitors` accessible without auth
- **Fix**: Added auth check at top of handler
- **Files**: `src/app/api/audits/detect-competitors/route.ts`

### Middleware using deprecated getSession — `148`
- **Bug**: Auth middleware using deprecated `getSession()` which doesn't validate tokens
- **Fix**: Switched to `getUser()` which validates the JWT
- **Files**: `src/middleware.ts`

---

## Payments

### Stripe webhook silently losing data — `154`
- **Bug**: Webhook handler swallowing errors, losing payment confirmations
- **Fix**: Added proper error handling and logging to webhook
- **Files**: `src/app/api/webhooks/stripe/route.ts`

---

## Brand Audits

### All categories scoring 82 — `73`
- **Bug**: Every brand audit category returned exactly 82/100
- **Root cause**: Scoring logic had a default fallback that was always triggered
- **Fix**: Fixed scoring to use actual analysis results
- **Files**: Brand audit analyzer

### Brand audit emails saying "Website Audit" — `77` + `83`
- **Bug**: Completion emails not type-aware
- **Fix**: Made email templates check audit type and use "Brand Identity Audit" when appropriate
- **Files**: Email templates, process-audit.ts

---

## Infrastructure

### Inngest failure swallowing — `153`
- **Bug**: Pipeline step failures not surfaced, audits stuck silently
- **Fix**: Added proper error propagation and logging in Inngest step wrappers
- **Files**: `src/lib/inngest/functions/process-audit.ts`

### Re-audits ignoring user-selected modules — `91`
- **Bug**: Re-running audit with different modules (SEO/Brand) still analyzed original modules
- **Fix**: Read module selection from form params, not from previous audit
- **Files**: New audit flow, process-audit.ts

---

## Design System / Marketing

### Rebrand ClearUX → Fixpath — `e631fba`
- **Change**: Full rebrand across all pages, components, emails, and metadata
- **Files**: ~50+ files across the codebase

### v2 marketing redesign — commits `93-109`
- **Feature**: Complete redesign of all marketing pages with editorial/Vercel aesthetic
- **What**: New font system (DM Sans), CSS variable tokens, component primitives, page-by-page rebuild of homepage, about, pricing, how-it-works, FAQ, contact, login, register, legal pages
- **Files**: All marketing page files, globals.css, tailwind.config

### Dashboard redesign — commits `111-117`
- **Feature**: Redesign of dashboard shell, admin shell, all dashboard pages
- **Files**: DashboardShell, AdminShell, all dashboard page components

---

## File Index (most frequently modified)

| File | Area | Description |
|------|------|-------------|
| `src/lib/surgical-fix.ts` | Fix engine | AI patch generation, diff computation, validation |
| `src/lib/inngest/functions/process-audit.ts` | Pipeline | Main audit orchestrator (crawl → analyze → quality gates → report) |
| `src/components/dashboard/v2/FixConsole.tsx` | Fix UI | Two-path deploy console for surgical and strategic fixes |
| `src/app/dashboard/audits/[id]/page.tsx` | Audit detail | Overview, tabs, findings, action strips |
| `src/lib/audit-engine/analyzer.ts` | Analyzer | 24-category AI analysis with language support |
| `src/lib/audit-engine/crawler.ts` | Crawler | Multi-page crawl, head extraction, language detection |
| `src/lib/ftp-client.ts` | Deploy | FTP/SFTP client factory with connection pooling |
| `src/lib/proprietary-pipeline/` | Quality gates | Dedup, speculative filter, relevance scorer, pattern learner |
| `src/app/api/surgical-fix/route.ts` | API | Surgical fix endpoint |
| `src/lib/audit-engine/llm-probes.ts` | AI X-Ray | Multi-model probing (Claude, GPT, Gemini) |
