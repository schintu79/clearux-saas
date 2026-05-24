# Fixpath Changelog

Structured record of every bug fix, feature, and architectural change. Organized by system area, each entry includes the root cause, what was changed, and which files were touched.

Last updated: 2026-05-24

---

## Audit pipeline speed optimization — batch DB writes and parallel AI calls

### Problem
The audit pipeline was noticeably slow. Serial database inserts (one finding at a time), sequential AI model calls, and individual delete operations were adding significant latency to every audit run.

### What changed
1. **Batch finding inserts**: Analysis findings, responsive findings, and WCAG findings are now collected into arrays and inserted in a single `db.insert()` call instead of one-by-one in a loop.
2. **Parallel page updates**: Responsive and WCAG page update queries now run concurrently via `Promise.all()` instead of sequentially.
3. **Parallel WCAG heuristic AI calls**: All Anthropic API calls for WCAG heuristic analysis now fire concurrently with `Promise.all()` instead of awaiting each in series.
4. **Batch dedup deletes**: Duplicate finding removal now uses a single `.delete().in('id', duplicateIds)` call instead of looping individual deletes.

### Estimated impact
- 15–40% reduction in total audit duration depending on finding count and page count
- Eliminates N+1 patterns on the heaviest write paths

### Files touched
- `src/lib/inngest/functions/process-audit.ts` — 7 specific optimizations across responsive, WCAG, analysis, and dedup steps

---

## Website / Brand DNA tab navigation and brand audit CTA

### Problem
The overview and brand DNA pages lacked a shared tab bar to switch between them. The "Run brand audit" CTA was buried at the bottom of the brand DNA page, making it easy to miss.

### What changed
1. **OverviewTabs component**: Wired the shared `OverviewTabs` tab bar into all states (loading, in-progress, failed, empty, populated) on both the overview page and brand DNA page.
2. **Top-of-page brand audit CTA**: Added a prominent "Run a brand DNA audit" banner at the top of the brand DNA page (below header, above DNA card). Shows an enabled button when brand files exist, disabled with guidance when no files uploaded. This is in addition to the existing CTA in the audit section below.

### Files touched
- `src/app/dashboard/overview/page.tsx` — Added `<OverviewTabs />` to loading skeleton, in-progress, failed, empty, and populated states
- `src/app/dashboard/brand-dna/page.tsx` — Added `OverviewTabs` import and placement in skeleton, empty, and full states; added top-of-page "Run brand audit" CTA banner

---

## Sidebar menu restructuring — Dashboard first, Website/Brand DNA split

### Problem
The sidebar navigation had the Dashboard link buried below action buttons, lacked visual hierarchy between website audit nav items and brand DNA, and the Re-audit/Dig deeper buttons disappeared during the initial restructuring pass.

### What changed
1. **Dashboard link first**: Moved to the top of the sidebar with larger icon, semibold weight, and border highlight when active, followed by a 40px spacer before the workspace section.
2. **Action buttons restored**: Re-audit and Dig deeper buttons (context-aware based on selected brand/site) placed after the brand/site selector, before the nav groups.
3. **Navigation split**: Single "Audit workspace" group split into two labeled groups — "Website" (Overview, Find, Fix, Track, Connect site) and "Brand DNA" (Brand DNA). Each group shows a small uppercase label.

### Files touched
- `src/components/layout/DashboardShell.tsx` — Dashboard link position, action buttons, navGroups split, group label rendering

---

## Brand Intelligence — Tier 2: Placement Parsing and Share of Voice

### Problem
Brand Intelligence Tier 1 computed visibility, sentiment, and accuracy — but placement (where in an AI response the brand appears) and share of voice (how much response content is dedicated to the brand) were hardcoded to `null`. This left two key metrics on the intelligence dashboard permanently blank.

### What changed
1. **Placement parsing**: The sentiment extraction prompt now also asks Claude Haiku to evaluate *where* in each model's response the brand first appears (scale 1–5, where 1 = top recommendation and 5 = buried at end). The extracted placement feeds into the composite Brand Intelligence Score's 20% placement weight.
2. **Share of Voice**: Each model's response is analyzed for what percentage of content is dedicated to the audited brand vs competitors mentioned. The per-model share is averaged into a portfolio-level Share of Voice metric.
3. **Composite score**: The `computeBrandIntelligenceScore` function now uses real placement data instead of the 50% default fallback, producing more accurate scores.
4. **Pipeline storage**: Per-model `placement_score` is now stored on the `multi_model_probes` table alongside sentiment data.
5. **UI**: The Intelligence page shows a placement pill ("Top pick", "Early", "Middle", "Buried") on each model probe row. The BrandIntelligenceCard on the overview now displays the average placement score.

### Modified files
- `src/lib/audit-engine/brand-intelligence.ts` — Rewrote `extractModelSentiment` to return placement + shareOfVoice; updated `runBrandIntelligenceAnalysis` to aggregate real placement and share of voice data
- `src/lib/inngest/functions/process-audit.ts` — Store `placement_score` on multi_model_probes
- `src/app/api/audits/intelligence/route.ts` — Return `brandIntelligence` in API response
- `src/app/dashboard/intelligence/page.tsx` — Added `placement_score` to ModelProbe type; added placement pill to model probe rows
- `src/components/dashboard/v2/BrandIntelligenceCard.tsx` — Show average placement score metric

---

## Audit Navigation & Brand Management Refactor

### Problem
The "New Audit" button in the sidebar did not distinguish between re-auditing an existing brand (no URL input needed) and adding a completely new site/brand (URL input required). This caused UX confusion and incorrect routing behaviour.

### What changed
1. **Sidebar**: Removed the ambiguous "New Audit" button. When a brand is selected, the sidebar now shows two scoped actions: "Re-audit" and "Dig deeper" — both use the stored brand URL without showing a URL input. When no brand is active or in collapsed mode, it shows "Add new site or brand."
2. **Dashboard page**: CTAs updated from "New audit" to "Add new site or brand"; empty state headline changed to "Audit your first site or brand."
3. **New audit page**: Now accepts a `mode` query parameter (`new-brand`, `re-audit`, `dig-deeper`). In re-audit/dig-deeper mode, the URL input is hidden and replaced with a context banner showing the brand being re-audited. The page heading updates dynamically based on mode.
4. **Overview page**: Re-audit and Dig deeper links now pass `mode=re-audit` / `mode=dig-deeper` params so the new-audit page renders correctly.

### Routing logic
| User Action | URL Input? | Outcome |
|---|---|---|
| Re-audit (sidebar or overview) | No | Refreshes existing brand with new results |
| Dig deeper (sidebar or overview) | No | Runs deeper analysis on existing brand |
| Add new site or brand (sidebar/dashboard) | Yes | Creates new brand + audit |

### Modified files
- `src/components/layout/DashboardShell.tsx` — Replaced "New audit" with context-aware Re-audit/Dig deeper buttons; added RefreshCw import
- `src/app/dashboard/new-audit/page.tsx` — Added `mode` param handling, URL input conditional rendering, brand URL auto-resolution, dynamic heading
- `src/app/dashboard/overview/page.tsx` — Updated Re-audit/Dig deeper links to pass mode params
- `src/app/dashboard/page.tsx` — Updated CTA labels and empty state copy

---

## PageSpeed Insights — Pipeline Integration

### Problem
PageSpeed tests were only callable from the dead monolithic audit engine (`src/lib/audit-engine/index.ts`). The real Inngest pipeline never ran speed tests, so `speed_data` was always null.

### What changed
Added a `'pagespeed-test'` step to `src/lib/inngest/functions/process-audit.ts` that runs `runFullSpeedTest()` during every website audit, stores results on the audit record, and generates speed findings.

### Modified files
- `src/lib/inngest/functions/process-audit.ts` — Added pagespeed-test step with import of `runFullSpeedTest` and `generateSpeedFindings`

---

## Brand Intelligence Platform — Tier 1

### What was added
Unified Brand Intelligence system that merges the old Benchmark + AI Readiness cards into a single intelligence layer. Provides a composite Brand Intelligence Score (0-100) weighted from AI visibility (30%), sentiment (25%), accuracy (25%), and placement (20%). Adds per-model sentiment extraction via Claude Haiku post-probe, evidence panel showing actual AI responses, and actionable fix recommendations.

### New files
- `src/lib/audit-engine/brand-intelligence.ts` — Core engine: `extractModelSentiment` (LLM sentiment classification), `computeBrandIntelligenceScore` (weighted composite), `runBrandIntelligenceAnalysis` (orchestrator). Types: `BrandIntelligenceSummary`, `ModelSentiment`, `SentimentTheme`.
- `src/components/dashboard/v2/BrandIntelligenceCard.tsx` — Overview dashboard card replacing BenchmarksSummaryCard. Shows score, AI Visibility %, sentiment pill, share of voice, models tested, issue count.
- `supabase/migrations/045_brand_intelligence.sql` — Adds `sentiment_score` (numeric) and `sentiment_themes` (jsonb) to `multi_model_probes`; adds `brand_intelligence` (jsonb) to `reports`.

### Modified files
- `src/app/dashboard/intelligence/page.tsx` — Complete rewrite from Benchmark Console to Brand Intelligence hub. Section 1: Overview with 5 metric blocks. Section 2: AI Model Performance with expandable evidence rows. Sentiment Themes section. Section 7: Fix & Improve recommendations. Competitive benchmark preserved as subsection.
- `src/app/dashboard/overview/page.tsx` — Replaced `BenchmarksSummaryCard` with `BrandIntelligenceCard`; removed dead code (old card function, `handleBenchmark`, `detectingCompetitors`, `hideBenchmarks`).
- `src/lib/inngest/functions/process-audit.ts` — Added `brand-intelligence-analysis` step after multi-model probes. Extracts sentiment per model, computes aggregate BI summary, stores on reports and probes.
- `src/app/api/audits/intelligence/route.ts` — Updated report select to include `brand_intelligence` field.

---

## Website Speed Card — PageSpeed Insights integration

### What was added
Full PageSpeed Insights integration: the audit pipeline now runs Google PSI tests (mobile + desktop) during every audit, stores Core Web Vitals on the audit record, and generates actionable speed findings. Users can also trigger on-demand speed tests from the dashboard.

### New files
- `src/lib/pagespeed.ts` — PageSpeed API client (`runPageSpeedTest`, `runFullSpeedTest`, `generateSpeedFindings`). Classifies LCP/CLS/INP/TTFB/Speed Index/TBT against CWV thresholds, extracts Lighthouse diagnostics, maps to fixable vs advisory findings.
- `src/app/api/speed-test/route.ts` — POST endpoint for on-demand PageSpeed tests. Validates auth/ownership, runs test, stores results on audit, generates findings.
- `src/components/dashboard/v2/WebsiteSpeedCard.tsx` — Overview dashboard card showing score, mobile/desktop toggle, LCP/CLS/INP metrics, issue count, "Run speed test" empty state.
- `src/components/dashboard/v2/SpeedDetailPanel.tsx` — Detailed speed view on Technical Health tab with side-by-side mobile/desktop scores, full 6-metric CWV table, threshold legend, categorized findings (fixable vs advisory), re-run button, and link to PageSpeed web tool.
- `supabase/migrations/044_speed_data.sql` — Adds `speed_data` jsonb and `speed_tested_at` columns to audits table.

### Modified files
- `src/types/database.ts` — Added `SpeedDataSummary`, `SpeedStrategyResult`, `SpeedMetric` interfaces; extended Audit type.
- `src/lib/audit-engine/index.ts` — Added PageSpeed test step (2d) after performance findings, stores summary and generates speed findings.
- `src/app/dashboard/overview/page.tsx` — Added WebsiteSpeedCard to overview grid (row 3 expanded to 4 columns).
- `src/app/dashboard/audits/[id]/page.tsx` — Imported SpeedDetailPanel, rendered at top of Technical Health tab.

---

## Auto-create brand when auditing a new website

### Problem
When a user entered a new domain (e.g. clearux.ai) via "Add site or brand" and ran a website audit, no `brand_identity` record was created. The domain appeared as a transient "site" entry in the sidebar (derived from the audit's `product_url` hostname). The user had no persistent brand tab and switching away lost context.

### Fix — new-audit page (`src/app/dashboard/new-audit/page.tsx`)
- Added `ensureBrandForWebsite(productUrl)` — looks up existing brand_identities by hostname match; if none exists, creates one via `POST /api/brand-identities` with the hostname as the brand name.
- Website audit submit path now calls `ensureBrandForWebsite` and sets `brand_identity_id` on the audit insert, so the audit is linked to the brand from the start.
- Post-audit redirect uses brand-based URL param (`?brand=<id>`) so the user lands in the brand context.
- Added `resolvedBrandIdRef` and updated `persistAuditSelection` to prefer brand-based selection over site-based.

### Fix — sidebar deduplication (`src/components/layout/DashboardShell.tsx`)
- `loadSites` now builds a set of brand hostnames from brand_identity `website_url` fields. Site entries whose hostname matches a brand are suppressed, preventing duplicate entries.
- Stale `site:host` selections in localStorage are auto-migrated to the matching `brand:id` entry, so existing users see the brand tab immediately after the migration.

---

## Fix Console bug fixes -- action gating, affected URL, and already-fixed handling

### Non-fixable findings showing "Fix it yourself" button
- **Root cause**: `inferDeployableType` used broad text-pattern matching (e.g. any mention of "structured data" or "meta description") to classify findings as deployable. Advisory/strategic findings whose text happened to mention these keywords were incorrectly marked `selfFixable: true`.
- **Fix**: Added a secondary concrete-fix-data gate in `resolveCapability`. After `inferDeployableType` matches, the recommendation must contain actual code (HTML tags, JSON-LD patterns, attribute assignments) or be flagged with `fix_type` by the pipeline. Findings with long advisory paragraphs but no code fall through to `FIXABLE_NON_DEPLOYABLE` (selfFixable: false), hiding the "Fix it yourself" button.

### Affected URL often empty in evidence panel
- **Root cause (UI)**: The "Affected URL" row in EvidenceSection was conditionally rendered only when `finding.page_url` was truthy. Findings with null page_url showed no row at all.
- **Root cause (pipeline)**: Baseline re-audit finding copies used `pf.page_url` directly without fallback. Older findings with null page_url were perpetuated across re-audits.
- **Fix (UI)**: Always render the Affected URL row. When page_url is null, display "All pages" as fallback.
- **Fix (pipeline)**: Added `|| crawlResult.firstPageUrl` fallback on baseline re-audit finding copies.

### Surgical fix returning "already exists" / "already correct" errors
- **Root cause**: In single-page mode, `handleSurgicalFix` stored the API result as `surgicalResult` regardless of whether it contained actual changes. When the API returned a warning with 0 changes (file already correct), the DiffPreview showed an empty diff with a warning message, looking like an error.
- **Fix**: Added early detection in `handleSurgicalFix` for results with `warning + changes.length === 0`. These are now treated as successful outcomes: the finding is auto-marked as fixed, the success banner shows the actual warning message (e.g. "This page already has the correct value"), and the empty diff preview is never shown.

### Files changed
- `src/lib/fix-action-model.ts` -- added concrete-fix-data gate in `resolveCapability` after `inferDeployableType` match
- `src/components/dashboard/v2/FixConsole.tsx` -- always show Affected URL, handle already-fixed surgical results, show contextual success message
- `src/lib/inngest/functions/process-audit.ts` -- added page_url fallback on baseline re-audit copies

---

## Fix brand/website selector working only from overview page

### Brand selector navigation fix
- **Removed forced redirect**: The sidebar brand/website selector was forcing `router.push('/dashboard/overview')` on every selection change, even when the user was on Find, Fix, Track, or other pages. Removed this redirect so the selector updates the selection in place and the current page re-renders with the new brand's data via AuditBundleContext.

### New domain appearing in selector after audit creation
- **Dynamic sites list refresh**: Refactored the sites loader in DashboardShell into a reusable `loadSites` callback. When a selection points to a domain not yet in the sites list (e.g. a brand-new audit for a new domain), a temporary entry is added immediately so the selector shows it, and the full list is refreshed in the background.

### Files changed
- `src/components/layout/DashboardShell.tsx` — removed forced navigation, refactored sites loader, added dynamic refresh on new domain selection

---

## Fix 2 Completion — Proposed Value, Affected Selector, and Evidence Enrichment

### Data model
- **`proposed_value` field added** to AuditFinding type: stores the proposed replacement value for fixable findings, derived from the recommendation when it contains a concrete fix (code, markup, or short actionable text).
- **`affected_selector` field added** to AuditFinding type: stores the CSS selector or XPath targeting the affected DOM element, derived from `target_element` when it matches selector patterns.

### Pipeline enrichment
- **Evidence enrichment step** added to the quality-gates pipeline in `process-audit.ts`: after dedup, speculative filtering, language softening, and stale-result removal, a new pass populates `proposed_value` and `affected_selector` on all fixable findings using pattern-based heuristics.

### Evidence UI
- **"Proposed value" card** added to the EvidenceSection in FixConsole: shows the proposed replacement in a green-tinted box below the "Current value" red-tinted box, giving users a clear before/after view inside the evidence panel.
- **"Affected selector" display** added: when a CSS/XPath selector is available, it renders as a monospace code badge below the proposed value.

### Stale-result pipeline verification
- Confirmed `identifyStaleFindings()` and `softenInterpretiveLanguage()` are fully wired into the quality-gates step, with results applied to DB and logged.

### Files changed
- `src/types/database.ts` — added `proposed_value` and `affected_selector` fields
- `src/lib/inngest/functions/process-audit.ts` — added evidence enrichment step
- `src/components/dashboard/v2/FixConsole.tsx` — added proposed value and affected selector to EvidenceSection

---

## Stronger Product Positioning in UI and Marketing (Fix 6)

### Canonical messaging alignment
- **Footer copy updated**: Now uses the exact canonical message hierarchy: "Find what is hurting your website. Fix the right issues first. Track whether things are improving."
- **Track messaging strengthened** across HomeWorkflow, HomeAdvantage, and Product page: replaced passive "see exactly what improved" with action-oriented "confirm fixes landed" and "prove progress to your team."

### In-product copy sharpened
- **Dashboard subtitle**: Changed from passive "Everything across your brands and sites" to action-oriented "See which brands need attention and where to focus next."
- **Find page subtitle**: Changed from inventory-style "All findings from your latest audit, grouped by module" to action-driven "What is hurting your site right now, ranked by impact."
- **Reports page subtitle**: Changed from noun-list "Audit reports, exports, and shareable links" to active "Download, share, or export your audit results."
- **Empty states updated**: All empty states now answer "what should I do next" with direct, action-oriented language tied to the Find/Fix/Track framework.
- **Severity mislabel fixed**: AuditDashboard medium severity label changed from misleading "Low impact improvements" to accurate "Worth addressing soon." Overview low severity changed from "Low impact improvements" to "Minor improvements."
- **PriorityRecommendations copy**: Helper text changed from passive "Top N actions from the latest audit" to direct "Top N actions to fix next."

### Files changed
- `src/components/dashboard/AuditDashboard.tsx` — severity label fix
- `src/app/dashboard/overview/page.tsx` — low severity label fix
- `src/app/dashboard/page.tsx` — dashboard subtitle and empty state copy
- `src/app/dashboard/find/page.tsx` — page subtitle and empty state copy
- `src/app/dashboard/fix/page.tsx` — empty state copy
- `src/app/dashboard/track/page.tsx` — empty state copy
- `src/app/dashboard/reports/page.tsx` — page subtitle and empty state copy
- `src/components/dashboard/v2/EmptyAudit.tsx` — default empty state body copy
- `src/components/dashboard/v2/PriorityRecommendations.tsx` — helper text
- `src/components/marketing/HomeAdvantage.tsx` — Track advantage description
- `src/components/marketing/HomeWorkflow.tsx` — Track step description
- `src/components/marketing/Footer.tsx` — footer description
- `src/app/product/ProductContent.tsx` — Track section description

---

## FixConsole Panel Cleanup and Brand Selector Bug Fix

### Resolve issue panel cleanup
- **Merged Evidence and What Will Change cards**: Removed the separate "What will change" card entirely. Merged its fields (Fix type, Scope, Impact, Deploy target) into the unified Evidence card. Evidence card now has a 3-column grid with 7 fields: Fix type, Scope, Impact, Deploy target, Confidence, Detected by, Affected URL.
- **Removed redundant fields**: Removed "Affected page" (duplicate of Affected URL) and "Issue rationale" (redundant restatement of finding description).
- **Removed Suggested owner label**: Removed the "Suggested owner: Engineering" tag from the action selection panel — ownership is already indicated by the role-based handoff system.
- **Preserved contextual notices**: Design work gate notice and strategic comment notice moved into the Evidence card.
- Files changed: `src/components/dashboard/v2/FixConsole.tsx`

### Brand selector double-navigation bug
- **Root cause**: Brand selector `onClick` unconditionally called `router.push('/dashboard/overview')` alongside `selectSiteInternal()`, causing a visible double-navigation when switching brands from a non-overview page.
- **Fix**: Conditionally navigate to overview only if not already on that page (`pathname !== '/dashboard/overview'`).
- Files changed: `src/components/layout/DashboardShell.tsx`

---

## Role-based Output and Handoff Workflows (Fix 5)

### Data model and role mapping engine (Phase 1)
- **Migration 043**: Added `owner_roles text[]`, `primary_owner_role text`, `handoff_ready boolean`, `handoff_payload jsonb` to `audit_findings`. Added `role_summaries jsonb` to `audits`. GIN index on `owner_roles`, btree index on `primary_owner_role`.
- **StakeholderRole type**: `'executive' | 'marketing' | 'product_ux' | 'engineering'` — four stakeholder views.
- **HandoffPayload interface**: `summary`, `business_impact`, `next_steps[]`, `effort` (quick_win/moderate/significant), `priority_rank`.
- **RoleSummary/RoleSummaries**: Per-role aggregate with finding_count, critical_count, top_issues, impact_summary, next_steps. Site-level container with generated_at timestamp.
- **Role mapping engine** (`role-mapper.ts`): `CATEGORY_ROLE_MAP` maps 24 category indices to stakeholder roles. `assignOwnerRoles()` determines which roles see a finding (category-based + detection source overrides + high/critical escalation to executive). `assignPrimaryOwner()` picks single best role using severity weight + detection source bonus. `generateHandoffPayload()` creates structured handoff data. `enrichFindingsWithRoles()` batch processes all findings. `generateRoleSummaries()` produces per-role summaries.
- **Pipeline wiring**: Role enrichment runs as step 3b after analysis, non-fatal. Updates each finding's `owner_roles`, `primary_owner_role`, `handoff_ready`, `handoff_payload` in DB and stores `role_summaries` on the audit.
- **Files**: `supabase/migrations/043_role_based_handoff.sql`, `src/types/database.ts`, `src/lib/pipeline/role-mapper.ts`, `src/lib/audit-engine/index.ts`

### UI and filtering (Phase 2)
- **Team overview panel**: 2x2 grid of role cards on the Overview tab showing finding_count, critical_count, top_issues, impact_summary per role. Each card is clickable to filter the Findings tab by that role.
- **Role filter chips**: Row of team filter pills on the Findings tab (after severity grid) — Executive, Marketing, Product & UX, Engineering — with finding counts, toggle on/off, integrated with active filter banner.
- **Owner labels on finding cards**: Primary owner role shown as a pill with Users icon in the finding card metadata row.
- **Filter state**: `filterRole` state filters `filteredFindings` by `owner_roles` array containment. Active filter banner shows role badge and "Clear all" resets role filter.
- **Files**: `src/app/dashboard/audits/[id]/page.tsx`

### Handoff and export (Phase 3)
- **Handoff formatter** (`handoff-formatter.ts`): Four export formats — `summary` (executive-friendly overview with severity breakdown and priority findings), `implementation` (detailed findings grouped by severity with effort estimates), `copy_fixes` (copy/meta fixes ready for immediate implementation), `task_list` (checkbox-style task list with quick wins separated). Role-recommended format mapping.
- **Handoff API route** (`/api/reports/[id]/handoff`): Authenticated GET endpoint with `role` and `format` query params. Fetches role-filtered findings, generates markdown export, returns as downloadable `.md` file. Validates role and format params.
- **Team handoff panel**: Collapsible panel on the Overview tab action bar. Two-column selector for team (with finding counts) and format (with recommended indicator). Download and copy-to-clipboard actions.
- **QA bug fixes**: Fixed `critical` severity handling in `generateRoleSummaries()` — was only counting `high`, now counts both `critical` and `high`. Fixed `generateHandoffPayload()` severity label — was missing `critical` case. Fixed business_impact derivation for `critical` severity.
- **Files**: `src/lib/pipeline/handoff-formatter.ts`, `src/app/api/reports/[id]/handoff/route.ts`, `src/app/dashboard/audits/[id]/page.tsx`, `src/lib/pipeline/role-mapper.ts`

---

## Performance and Speed Intelligence (Fix 3)

### Data model — performance schema (Phase 1)
- **Migration 042**: Added `performance_data` (jsonb) to `audit_pages` for per-page CWV estimates and asset analysis. Added `performance_summary` (jsonb) to `audits` for site-level aggregation. Added `owner_team` (text) and `performance_metric_type` (text) to `audit_findings` for performance finding routing. Index on `performance_metric_type`.
- **PagePerformanceData type**: Per-page metrics — LCP/INP/CLS estimates, page weight, script count/weight, render-blocking scripts, image count/weight/lazy/dimensions, third-party count/domains, CSS/font counts, overall rating (good/needs_improvement/poor).
- **PerformanceSummary type**: Site-level aggregation — averages across all CWV metrics, page rating distribution (good/needs_improvement/poor counts), unique third-party domains, pages with blocking scripts and layout shift risk, plain-language `top_concerns` array, overall rating.
- **OwnerTeam type**: `'engineering' | 'marketing' | 'product' | 'design'` — tags performance findings with the team responsible for fixing each issue.
- **Files**: `supabase/migrations/042_performance_data.sql`, `src/types/database.ts`

### Performance extraction engine (Phase 2)
- **Third-party detection**: 60+ regex patterns covering analytics (Google Analytics, Hotjar, Mixpanel), ads (Google Ads, Facebook Pixel), CDNs, widgets, chat tools, A/B testing, tag managers, social embeds, and more. Classifies external script/resource domains as third-party.
- **CWV heuristic estimators**: `estimateLcp()` from load time + page weight + blocking resources. `estimateInp()` from script count + weight + third parties. `estimateCls()` from images missing dimensions + font count. `computeRating()` from composite of CWV thresholds + page weight + blocking script count.
- **Page-level extraction**: `extractPerformanceData()` parses raw HTML to count scripts, images, stylesheets, fonts, detect render-blocking resources, identify third-party domains, measure asset weights, and flag lazy-loading and dimension issues.
- **Site-level aggregation**: `aggregatePerformanceSummary()` computes averages, distributions, and generates plain-language top concerns (e.g., "Average LCP of 3.2s — above the 2.5s threshold").
- **Files**: `src/lib/pipeline/performance-checker.ts`

### Performance findings and pipeline wiring (Phase 3)
- **7 finding types**: Slow LCP, render-blocking scripts, third-party overload, layout shift risk, images not lazy loaded, heavy pages, sluggish INP. Each includes title, description, recommendation, severity (high/medium/low), owner_team, estimated_impact, why_it_matters, who_should_fix.
- **Pipeline integration**: Performance extraction runs per page alongside technical and code-quality checks. Results stored as `performance_data` on `audit_pages` and `performance_summary` on `audits`. Performance context injected into AI analyzer prompt. Findings inserted as `audit_findings` with `detection_source: 'performance_checker'`, `category_index: 12`, `finding_type: 'strategic'`.
- **Prompt enrichment**: `formatPerformanceForPrompt()` produces compact text block appended to each page's analyzer context, giving the AI visibility into performance metrics for its analysis.
- **Files**: `src/lib/pipeline/performance-checker.ts`, `src/lib/audit-engine/index.ts`

### Performance UI (Phase 2b)
- **Overview tab**: Performance summary panel between crawl coverage and AI transparency. Shows overall rating badge, CWV estimates grid (LCP/INP/CLS with color-coded values and thresholds), stats row (page weight, blocking scripts, third-party count, layout shift risk pages), page rating distribution bar, top concerns list with AlertTriangle icons, expandable third-party domains drill-down.
- **Pages tab**: Per-page performance badge showing Fast/Moderate/Slow with Zap icon and LCP time, color-coded by rating.
- **Files**: `src/app/dashboard/audits/[id]/page.tsx`

---

## Crawl Quality and Audit Transparency (Fix 4)

### Data model — crawl visibility contract (Phase 1)
- **Migration 041**: Added `crawl_summary` (jsonb), `crawl_started_at`, `crawl_completed_at` to `audits` table. Added `crawl_status`, `skip_reason`, `canonical_url`, `is_duplicate`, `page_type`, `fetch_strategy` to `audit_pages` table.
- **CrawlSummary type**: New interface tracking URLs discovered, pages analyzed/skipped/blocked/duplicate/excluded, JS pages detected, average load time, discovery sources (sitemap/html_links/common_paths), excluded URLs with reasons, and coverage notes.
- **CrawlStats**: New runtime interface returned from `crawlPages()` alongside pages, collecting all crawl metrics for pipeline consumption.
- **Crawler enrichment**: `fetchStrategy` tracked per page (direct/jina/google_cache). Discovery sources counted after parallel discovery. Exclusion tracking captures URL and reason. Both return paths now return `{ pages, stats }`.
- **Pipeline wiring**: `process-audit.ts` destructures crawl output, enriches `audit_pages` inserts with per-page crawl metadata, builds `crawl_summary` from stats, and stores crawl timeline on audits.
- **Files**: `supabase/migrations/041_crawl_summary.sql`, `src/types/database.ts`, `src/lib/audit-engine/crawler.ts`, `src/lib/inngest/functions/process-audit.ts`, `src/lib/audit-engine/index.ts`

### Crawl coverage UI panel (Phase 2)
- **Overview tab**: Added "Audit coverage" panel between CheckpointHealth and AI transparency note. Shows stats grid (URLs discovered, pages analyzed, skipped, coverage %), coverage progress bar, discovery sources breakdown, skipped breakdown (blocked/duplicates/excluded/other), JS-rendered page count, crawl duration, coverage notes, and expandable excluded URLs drill-down.
- **Freshness badge**: Added age-based badge (Fresh/Xd ago) in audit header next to Deep Mode badge. Uses `crawl_completed_at` or `created_at` with color coding: green (<= 7d), yellow (<= 30d), muted (> 30d).
- **Pages tab**: Added fetch strategy badge per page (shows "JS rendered" for Jina-fetched pages).
- **Files**: `src/app/dashboard/audits/[id]/page.tsx`

### Crawl logic improvements (Phase 3)
- **URL normalization**: Enhanced `normalizeUrlForDedup()` to strip 30+ tracking query parameters (UTM, fbclid, gclid, msclkid, etc.) before deduplication. Prevents duplicate crawling of the same page with different tracking params.
- **Canonical dedup**: When a crawled page's `<link rel="canonical">` points to an already-visited URL, the page is skipped and counted as a duplicate. Applied to both level 1 and level 2 crawl passes.
- **JS detection tracking**: Pages fetched via non-direct strategies (Jina, Google Cache) are counted as JS-rendered in crawl stats. Final count is authoritative from all pages.
- **Stats accuracy**: Replaced hardcoded `pagesDuplicate: 0` placeholders with actual runtime count in all three return paths (early return, normal return, catch block).
- **Files**: `src/lib/audit-engine/crawler.ts`

---

## QA and Calibration (Fix 2 Phase 4)

### Template grouping consumed-set bug fix
- **Bug**: In `identifyTemplateGroups()`, the seed index `i` could escape the `consumed` set when it was not selected as the primary after sorting by confidence/severity. This allowed `i` to form additional groups, producing overlapping clusters. Fixed by consuming ALL cluster indices instead of only the sorted primary.
- **Files**: `src/lib/audit-engine/pipeline/dedup.ts`

### Dead import removal
- **Cleanup**: Removed unused `CONFIDENCE_WEIGHT` import from `process-audit.ts`. The constant is only needed by downstream consumers (UI/export), not the pipeline orchestration.
- **Files**: `src/lib/inngest/functions/process-audit.ts`

### Threshold and logic review
- **Verified**: Template grouping threshold (0.85 title similarity, >= 3 pages) is conservative enough to avoid false merges. Relevance scorer boosts (+10% deterministic, -5% interpretive) are correctly bounded. Language softener regex patterns reviewed for false-positive safety. Stale-result check only targets gap_fill findings with quoted evidence >= 8 chars. All thresholds deemed well-calibrated.

---

## Logic and Deduplication Refinement (Fix 2 Phase 3)

### Confidence-aware deduplication
- **Dedup engine enhanced**: When merging duplicate findings, the engine now prefers findings with higher confidence (deterministic > heuristic > interpretive) instead of only using severity as tiebreaker. Added `confidence_level` and `detection_source` to `FindingForDedup` interface.
- **Files**: `src/lib/audit-engine/pipeline/dedup.ts`

### Template-based issue grouping
- **New `identifyTemplateGroups()` function**: Detects findings with very high title similarity (>= 0.85) repeated across 3+ different page URLs. Groups them into a single finding annotated with "This issue affects X pages" instead of showing N near-identical entries. Keeps the highest-confidence/severity finding as primary.
- **Files**: `src/lib/audit-engine/pipeline/dedup.ts`, `src/lib/inngest/functions/process-audit.ts`

### Confidence rules by detector type
- **Relevance scorer boost/penalty**: Deterministic findings get a +10% relevance boost, interpretive findings get a -5% penalty. This ensures machine-verified findings rank higher than AI-interpreted ones in relevance scoring.
- **Files**: `src/lib/audit-engine/pipeline/relevance-scorer.ts`

### Interpretive language softener
- **New `softenInterpretiveLanguage()` function**: Post-processes interpretive findings to replace assertive language ("is missing", "fails to", "lacks") with hedged alternatives ("may benefit from", "could improve by", "may lack"). Only affects findings with `confidence_level: 'interpretive'`.
- **Files**: `src/lib/audit-engine/pipeline/confidence-rules.ts`, `src/lib/inngest/functions/process-audit.ts`

### Stale-result checks for gap-fill findings
- **New `identifyStaleFindings()` function**: Checks gap-fill findings (carried forward from previous audits) against current crawl content. If quoted evidence in the description no longer appears in the latest crawl, the finding is removed as stale.
- **Files**: `src/lib/audit-engine/pipeline/confidence-rules.ts`, `src/lib/inngest/functions/process-audit.ts`

### Pipeline orchestrator update
- **New exports**: Added `identifyTemplateGroups`, `CONFIDENCE_RANK`, `softenInterpretiveLanguage`, `identifyStaleFindings`, `CONFIDENCE_WEIGHT` to pipeline orchestrator.
- **Files**: `src/lib/audit-engine/pipeline/index.ts`

---

## Evidence UI in Fix Console (Fix 2 Phase 2)

### Evidence section in expanded findings
- **EvidenceSection component**: New panel renders below "What will change" in both self-fix and team handoff paths. Shows confidence badge (High confidence / Likely issue / Needs review), detection source (e.g. WCAG 2.1 AA checker, LLM analysis), affected URL, current value snippet, and issue rationale.
- **Confidence badge colors**: Deterministic findings show green "High confidence", heuristic shows amber "Likely issue", interpretive shows muted "Needs review".
- **Detection source labels**: Human-readable labels for all 9 detection sources (analyzer, deep_analyzer, wcag_checker, responsive_checker, structured_data, head_tag, crawler, gap_fill, brand_analyzer).
- **Graceful degradation**: Panel only renders when evidence metadata is present — existing findings without the new fields show no Evidence panel.
- **Files**: `src/components/dashboard/v2/FixConsole.tsx`

---

## Evidence Contract for Findings Precision (Fix 2 Phase 1)

### Standardized evidence metadata on every finding
- **DB migration**: Added `confidence_level` and `detection_source` columns to `audit_findings` with CHECK constraints. `confidence_level` classifies certainty: `deterministic` (measurable), `heuristic` (rule-based), `interpretive` (AI judgment). `detection_source` identifies the pipeline stage that produced the finding.
- **Type update**: Extended `AuditFinding` interface in `database.ts` with the two new typed fields.
- **Pipeline population**: All 8 finding insertion points now set both fields correctly:
  - Responsive checker findings: `deterministic` / `responsive_checker`
  - WCAG checker findings: `deterministic` / `wcag_checker`
  - Structured data validator findings: `deterministic` / `structured_data`
  - Main analyzer (24-category LLM analysis): `heuristic` / `analyzer`
  - Gap-fill (baseline carry-forward): inherits `confidence_level` from previous audit / `gap_fill`
  - Deep analyzer (gap-fill re-analysis): `heuristic` / `deep_analyzer`
  - Starved-category generator: `interpretive` / `analyzer`
  - Brand analyzer: `interpretive` / `brand_analyzer`
- **Files**: `supabase/migrations/040_evidence_contract.sql`, `src/types/database.ts`, `src/lib/inngest/functions/process-audit.ts`, `src/lib/inngest/functions/process-brand-audit.ts`

---

## Fix Console QA Hardening (Fix 1 Phase 4)

### Deploy failure and batch fix state transitions
- **Bug fix**: HTTP error responses from the deploy API (`!res.ok`) were not transitioning `fix_status` to `failed`. Only network exceptions (caught by `catch`) triggered the transition. Now both paths update `fix_status='failed'` via the findings API.
- **Bug fix**: Batch fix (`handleBatchFix`) was not persisting `fix_status` transitions. Now transitions to `fixed` when all pages succeed, or `failed` when any page fails.
- **Verified**: No stale state bugs when switching between findings — `key={finding.id}` on `ActiveFindingDetail` forces full remount of FixConsole and all children.
- **Verified**: All 13 deployable fix types resolve correct capability flags. Tier 1 (deterministic) correctly sets `aiAssistAvailable: false`. Tier 2 (AI-assisted) correctly sets `editable: true`.
- **Verified**: Copy-only, download-only, handoff-only, and deferred flows work independently of FTP connections.
- **Verified**: Deep links (`#finding-<id>`) auto-select and scroll correctly from all entry points.
- **Files**: `src/components/dashboard/v2/FixConsole.tsx`

---

## Fix Console Workflow Logic (Fix 1 Phase 3)

### fix_status state transitions and capability gating
- **State transitions**: FixConsole now persists `action_mode` and `fix_status` to the API at every workflow step. Selecting "Fix it yourself" sets `fix_status='in_progress'` and `action_mode='self_fix'`. Successful deploy transitions to `fix_status='fixed'`. Failed deploy transitions to `fix_status='failed'`. Rollback reverts to `fix_status='in_progress'`.
- **Inline status indicator**: A colored status pill appears above the ActionPanel showing the current `fix_status` (In progress, Fixed, Failed, Deferred) with semantic colors — green for fixed, red for failed, muted for deferred.
- **Capability-gated deploy**: Deploy section is now gated by both `capability.deployable` and the existing classification check. Findings where the capability model says "not deployable" will never show deploy controls regardless of classification heuristics.
- **Strict approval enforcement**: DiffPreview requires explicit "Approve and deploy" click before any live mutation. No deploy path bypasses this approval step.
- **Deep links verified**: `#finding-<id>` hash-based deep links work correctly from Find tab, Overview, and direct URLs with auto-select and scroll-into-view.
- **Files**: `src/components/dashboard/v2/FixConsole.tsx`

---

## Fix Console UI Rebuild (Fix 1 Phase 2)

### Decision-first action panel replaces tab bar
- **Feature**: Replaced the 2-tab "Fix it yourself / Let your team handle it" tab bar with a decision-first ActionPanel showing 3 capability-driven choices: "Fix it yourself", "Send to your team", and "Save for later". Each choice is gated by the canonical action model from Phase 1 — only actions the finding supports are shown.
- **Capability model wiring**: FixConsole now imports and uses `resolveCapability()` from `fix-action-model.ts` instead of scattered heuristic pattern matching. AI helper visibility is driven by `capability.aiAssistAvailable`, deploy controls by `capability.selfFixable`, and default owner is shown from `capability.defaultOwner`.
- **Save for later (defer)**: New DeferPanel component lets users defer a finding with an optional note. Calls `PATCH /api/findings/:id` with `action_mode='defer'` and `fix_status='deferred'`. Deferred findings show a confirmation state and are filtered from the main Fix queue.
- **Deferred status filter**: Fix page sidebar now shows `fix_status` when available (falling back to legacy `status`). Status filter dropdown includes a "Deferred" option when deferred findings exist. Deferred findings are excluded from other status filters.
- **Graceful fallback**: If "Fix it yourself" is selected for a non-self-fixable finding, the UI shows a guidance notice explaining the finding requires manual implementation and falls through to HandoffPanel.
- **Files**: `src/components/dashboard/v2/FixConsole.tsx`, `src/app/dashboard/fix/page.tsx`

---

## Fix Action Model (Fix 1 Phase 1)

### Canonical action model for finding lifecycle
- **Feature**: Built a data-driven action model that replaces scattered pattern matching across the Fix Console and API with a single capability map. Every finding now gets pre-computed action model fields at pipeline creation time.
- **Action modes**: `self_fix` (inline deploy), `team_handoff` (copy/export), `defer` (save for later), `fixed` (manually resolved).
- **Fix status lifecycle**: `unreviewed` > `in_progress` > `approved` > `fixed` (or `deferred` / `failed`).
- **Capability map**: 13 deployable fix types across two tiers. Tier 1 (deterministic, instant): `lang_attribute`, `viewport_meta`, `meta_charset`, `canonical_url`. Tier 2 (AI-assisted, editable): `meta_title`, `meta_description`, `heading_copy`, `alt_text`, `og_tags`, `schema_jsonld`, `faq_block`, `robots_llms`, `ai_summary`. Each entry specifies selfFixable, editable, deployable, aiAssistAvailable, approvalRequired, patchFormat, and defaultOwner.
- **Fallback capabilities**: `FIXABLE_NON_DEPLOYABLE` (team handoff only), `DESIGN_REQUIRED` (design team), `STRATEGIC` (product team).
- **Pipeline wiring**: `computeActionModelFields()` helper added to `process-audit.ts` and called at all 6 finding insertion points (responsive, WCAG, structured data, baseline copy, gap-fill, deep-mode analysis).
- **API support**: `PATCH /api/findings/:id` now accepts `action_mode` and `fix_status` with backward-compatible mapping to legacy `status`. Records every action in `finding_action_history`.
- **DB migration 039**: Adds 9 columns to `audit_findings` (`action_mode`, `fix_payload`, `fix_format`, `is_editable`, `is_deployable`, `approval_required`, `fix_status`, `deployable_type`, `default_owner`) and creates `finding_action_history` table with RLS policies.
- **Files**: `src/lib/fix-action-model.ts` (new), `supabase/migrations/039_fix_action_model.sql` (new), `src/lib/inngest/functions/process-audit.ts`, `src/app/api/findings/[id]/route.ts`, `src/types/database.ts`

---

## Brand Dropdown

### Selection doesn't change on first click
- **Bug**: Switching brands in the sidebar dropdown required 2-3 clicks before the selection actually changed. The brand menu would close but the dashboard would still show the previous brand's data.
- **Root cause**: The click handler called both `selectSiteInternal(s.id)` (which sets `internalChangeRef` and triggers a React state update) AND `writeSelection(selectionFromSidebarId(s.id))` (which directly writes to localStorage and dispatches a synchronous CustomEvent). The subscription listener fired synchronously from the CustomEvent before the React effect had a chance to run, causing a race where the old value was re-written to localStorage by the effect, clobbering the new selection.
- **Fix**: Removed the direct `writeSelection()` call from the click handler. The write-back effect at lines 238-253 already handles persistence correctly through the `internalChangeRef` flag, so there's no need for a second write path.
- **Files**: `src/components/layout/DashboardShell.tsx`

---

## Export Pipeline

### Proprietary dedup, enrich, classify, and group engines
- **Feature**: Built four proprietary export pipeline engines to improve audit report quality. (1) Dedup engine: Jaccard similarity on 3-gram shingle sets with Union-Find clustering to merge near-duplicate findings (threshold 0.35). (2) Page enrichment: extracts URLs from finding description/recommendation text to populate sparse `affected_pages`. (3) Evidence classifier: tags findings as verified/observed/unverified based on pattern matching against description text. (4) Related-finding grouper: clusters findings by UI element using keyword rules (signup-consent, meta-tags, structured-data, canonical-urls, accessibility, i18n, social-proof).
- **Pipeline orchestrator**: `processExportPipeline()` runs all four engines in sequence. Export button on Fix page now uses the full pipeline instead of raw findings.
- **Files**: `src/lib/export/dedup-findings.ts` (new), `src/lib/export/enrich-pages.ts` (new), `src/lib/export/classify-evidence.ts` (new), `src/lib/export/group-related.ts` (new), `src/lib/export/findings-formatter.ts`, `src/app/dashboard/fix/page.tsx`

---

## Surgical Fix — Content-Based Language Detection

### Lang attribute fix blindly trusted AI recommendation
- **Bug**: The deterministic `html-lang-attribute` pattern determined the target language entirely from the AI recommendation text, never checking actual page content. If the AI said "change to Italian", it blindly did that — even for English pages. On re-audits, this caused flip-flopping: one audit says "change to en-US", the next says "change back to it".
- **Fix**: Rewrote the lang fix to use content-first detection. A new `detectContentLanguage()` function strips HTML tags and counts stop-word frequencies across 6 languages (Italian, English, German, French, Spanish, Portuguese). The page content is the ground truth. URL patterns (e.g. `-eng` suffix) are a secondary signal. The AI recommendation is only a last resort fallback. Requires minimum 3 stop-word hits and 1.5x lead over the second language to avoid false matches.
- **Files**: `src/lib/surgical-fix.ts`

---

## Dedup Engine — Language Finding Deduplication

### Three findings generated for the same lang attribute issue
- **Bug**: "Language Tagging Inconsistency", "Language Attribute Mismatch", and "Meta Description Mismatch Between Italian/English" all survived deduplication despite being about the same underlying language issue. Root causes: (1) `language` was in the same synonym group as `copy`/`text`/`content`, diluting similarity scores; (2) no topic fingerprint existed for language/i18n findings.
- **Fix**: Moved `language` to its own synonym group (`language`, `lang`, `locale`, `localization`, `i18n`, `multilingual`, `hreflang`). Added two topic fingerprints: `lang_i18n` and `meta_description_i18n` to boost similarity for language-related findings.
- **Files**: `src/lib/audit-engine/pipeline/dedup.ts`

---

## Fix Console — Page Tab Deduplication

### Duplicate and ghost pages in deploy tabs
- **Bug**: The page tabs in FixConsole showed `/privacy` and `/privacy.html` as separate pages, and `/` appeared twice. These came from `allCrawledPages` which collected every unique `page_url` from findings without normalizing URL variants.
- **Fix**: Added URL normalization when building `allCrawledPages`: strips trailing slashes, strips `.html` extension to create canonical keys, then prefers the `.html` variant when duplicates exist. This collapses `/privacy` + `/privacy.html` into just `/privacy.html`, and deduplicates repeated `/` entries.
- **Files**: `src/app/dashboard/fix/page.tsx`

---

## Fix Console — Path Suggestion

### Extensionless URLs mapped to wrong remote path
- **Bug**: `suggestRemotePath()` mapped extensionless URLs like `/privacy` to `/privacy/index.html`, which doesn't exist on most static hosting setups. The actual file is `/privacy.html`.
- **Fix**: Changed the fallback for extensionless paths from `${clean}/index.html` to `${clean}.html`. Root paths (`/`) still correctly resolve to `/index.html`.
- **Files**: `src/components/dashboard/v2/FixConsole.tsx`

---

## Speculative Filter

### Extensionless URL 404 false positive
- **Bug**: The analyzer would flag findings like "/privacy returns 404 while /privacy.html exists" as a crawl inefficiency issue. This is normal static hosting behavior (the .html extension is required), not a real site problem.
- **Fix**: Added 4 regex patterns to `UNVERIFIABLE_TOPICS` in the speculative filter to catch title variations of "extensionless URL returns 404 but .html variant exists."
- **Files**: `src/lib/audit-engine/pipeline/speculative-filter.ts`

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
