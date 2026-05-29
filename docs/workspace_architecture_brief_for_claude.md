# Workspace-Based Architecture Brief for Claude

This brief proposes a structural product change: move from fast site/brand switching inside one shared dashboard context to **workspace-based isolation**. The goal is to eliminate cross-brand state leakage, stale navigation, wrong audit attachment, duplicated loaders, and session confusion by making each workspace own exactly one brand/site context. The current schema is still centered on `user_id` plus site-level fields like `product_url`, optional `brand_identity_id`, and domain-scoped competitor/audit data, which is flexible but also makes accidental cross-context leakage more likely unless the app is extremely strict about canonical state. [file:280]

## Recommendation

Yes — moving to **workspaces** is the right direction.

The current “switch brands quickly from a dropdown” model is fragile because too many parts of the product appear to resolve context indirectly from page state, cache state, or previous selection. A workspace model is cleaner: one workspace equals one site/brand container, one navigation shell, one canonical context, one set of audits, one Brand DNA, one competitors context, one AI perception context, and one deployment context. That sharply reduces the chance that one site’s audit or loader can appear inside another site’s page. The current schema already stores most business entities in a way that can be migrated into this model, but it will require explicit database structure changes so `user_id` is no longer the main top-level grouping key for operational data. [file:280]

## Product principle

**One workspace = one brand/site.**

A workspace should be the primary product boundary. Once a user is inside a workspace, every page, query, audit, competitor benchmark, Brand DNA asset, deployment connection, and report must belong to that workspace. No page inside a workspace should need to “switch brand” through a global dropdown. If the user wants to work on another brand/site, the user switches workspaces, not just page-level context. This is the most reliable way to avoid session bleed and broken navigation. [file:280]

## Why this is better than the current dropdown model

The current model appears to depend on quick in-app switching between sites/brands while sharing the same app shell, route state, and query cache. That is likely why audits can be launched from one context while another page remains visually active, why loaders duplicate, and why refresh changes behavior. Because the current schema attaches many records directly to `user_id` and uses fields like `product_url`, `domain`, or `brand_identity_id` as secondary scoping fields, the frontend must constantly derive “which brand is active right now.” That is the weak point. A workspace removes that ambiguity by giving every operational entity a hard parent. [file:280]

## Core product structure after the change

### Top level

After login, the user should land on a **Workspace Home / Workspace Switcher** page, not immediately inside a mixed multi-brand dashboard.

From there the user can:

- open an existing workspace
- create a new workspace
- archive or rename a workspace

Once a workspace is opened, the user enters that workspace’s dedicated product shell.

### Inside a workspace

Inside a workspace, the left navigation or top navigation should contain only workspace-scoped pages:

- Overview
- New Audit (website audit only)
- Findings
- Competitors
- AI Perception / AI Visibility
- Brand DNA
- Reports
- Settings / Integrations / Deploy

No global brand/site dropdown should exist inside this shell.

If a user wants to work on a different site/brand, the user goes back to the workspace switcher and opens another workspace. [file:280]

## Hard product rules

### Rule 1: No cross-brand switching inside a workspace

A workspace owns exactly one brand/site context.

That means:
- no dropdown to switch to another site within the same workspace
- no audit created for another site while current workspace remains visible
- no shared cache keys that can hydrate from another brand’s data
- no cross-brand tabs appearing later

### Rule 2: Every audit belongs to one workspace

A website audit must always be created inside one workspace and tied to that workspace. The existing `audits` model already contains `product_url`, `audit_type`, `previous_audit_id`, `progress_percent`, `selected_modules`, and optional `brand_identity_id`, so the new rule is not about changing audit behavior conceptually — it is about adding `workspace_id` and making that the parent context for every audit. [file:280]

### Rule 3: Every Brand DNA belongs to one workspace

Brand identity and its files must belong to one workspace only. Right now there are separate `brand_identities`, `brand_identity_files`, and `brand_audit_file_snapshots`, which is a good starting point, but they are not yet clearly grouped under a first-class workspace parent. That should change. [file:280]

### Rule 4: Competitors and AI visibility are workspace-scoped

Competitor benchmark records currently rely on domain fields like `domain` and `competitor_domain`, which is workable but not ideal for product isolation. These records should also belong to a workspace so pages never need to infer “which domain’s competitors should I show right now?” from loose state. [file:280]

## Database redesign direction

This will require database changes. The safest direction is to introduce a new first-class `workspaces` table, then add `workspace_id` to all domain entities that currently rely mainly on `user_id`, `product_url`, or domain strings for scoping. The goal is to make workspace ownership explicit in the database, not just in the frontend. [file:280]

## Proposed new top-level table

### `workspaces`

Suggested fields:

- `id` uuid primary key
- `user_id` uuid owner
- `name` text
- `slug` text unique per user or globally unique
- `primary_domain` text
- `brand_name` text
- `workspace_type` text (`website`, `brand`, `website_and_brand`)
- `status` text
- `created_at`
- `updated_at`
- `archived_at` nullable
- `active_audit_id` nullable
- `active_brand_identity_id` nullable
- `settings_json` jsonb optional

This table becomes the parent container for one site/brand universe.

## Tables that should get `workspace_id`

These tables should likely get a required or backfilled `workspace_id`:

- `audits` [file:280]
- `audit_overview` [file:280]
- `audit_pages` (indirectly through `audit_id`, but direct scoping may help for policies) [file:280]
- `audit_findings` (indirect through audit is acceptable, but workspace inheritance should be clear) [file:280]
- `audit_logs` (through audit or direct) [file:280]
- `reports` [file:280]
- `competitor_benchmarks` [file:280]
- `brand_identities` [file:280]
- `brand_identity_files` [file:280]
- `brand_audit_file_snapshots` [file:280]
- `ftp_connections` [file:280]
- `ftp_deploy_log` [file:280]
- `site_notes` [file:280]
- `scheduled_audits` [file:280]
- `payments` (depending on whether payments are audit-level only or should be browsable by workspace) [file:280]
- `predictive_recommendations` (through audit or direct) [file:280]
- `llm_probe_results` and `multi_model_probes` (through audit or direct) [file:280]
- `ai_citations` (through audit or direct) [file:280]

## Table-specific database decisions

### Audits

Current issue: audits are mainly user-owned and site-described by `product_url`. That is not strong enough as the primary app boundary.

Required change:
- add `workspace_id` to `audits`
- enforce that every new audit is created inside one workspace
- keep `product_url` because the crawler still needs it, but treat it as workspace metadata, not the main app boundary
- `previous_audit_id` should reference a previous audit **within the same workspace only** [file:280]

### Brand identities

Current issue: brand identities are separate entities, but they should be owned by the same workspace as the site they support.

Required change:
- add `workspace_id` to `brand_identities`
- keep only one active Brand DNA per workspace, or define explicit versioning rules
- `brand_identity_files` inherit from the workspace through brand identity [file:280]

### Competitor benchmarks

Current issue: competitor records are domain-scoped, which is vulnerable to wrong-page binding when the frontend context is stale.

Required change:
- add `workspace_id`
- treat `domain` as a stored attribute of the workspace snapshot, not the only routing key
- competitor pages must read by `workspace_id`, then validate `domain` as a secondary integrity field [file:280]

### Scheduled audits

Current issue: scheduled audits are `user_id` + `product_url` scoped.

Required change:
- add `workspace_id`
- a scheduled audit must always belong to exactly one workspace
- if domain changes, scheduled audit should be updated inside that workspace, not recreated loosely under the user [file:280]

### FTP / deploy

Current issue: deployment and FTP records can become disconnected if there are multiple brands/sites under one user.

Required change:
- attach FTP connections to workspace, not only user / brand identity
- all deploy actions should happen inside one workspace shell and target that workspace’s site only [file:280]

## Migration strategy

This needs a staged migration, not a hard cutover.

### Phase 1: Introduce workspaces without breaking the current app

1. Create `workspaces` table.
2. Backfill one workspace per distinct existing site/brand grouping.
3. Add nullable `workspace_id` columns to core tables.
4. Backfill `workspace_id` using current relationships:
   - from `audits.product_url` and `brand_identity_id`
   - from `brand_identities.website_url`
   - from `competitor_benchmarks.domain`
   - from audit-linked child tables through `audit_id` [file:280]

### Phase 2: Dual-write and dual-read

5. Update application services so new records write `workspace_id`.
6. Update frontend data loaders to read by `workspace_id` first.
7. Keep old fields temporarily for compatibility.

### Phase 3: Make workspace ownership mandatory

8. Make `workspace_id` non-null on core tables.
9. Add foreign keys and policies.
10. Remove legacy brand-switching logic and old dropdown-driven context.
11. Remove old `/audit` pages/templates that assume multi-brand live switching. [file:280]

## Frontend architecture after the change

The frontend should no longer carry a mutable “active brand in dashboard” state that can be changed from anywhere through a dropdown. Instead, it should carry:

- `activeWorkspaceId`
- workspace metadata
- optional `activeAuditId` inside that workspace

All routes under the workspace shell should be nested under the workspace.

### Example route shape

- `/workspaces`
- `/workspaces/:workspaceSlug`
- `/workspaces/:workspaceSlug/overview`
- `/workspaces/:workspaceSlug/new-audit`
- `/workspaces/:workspaceSlug/findings`
- `/workspaces/:workspaceSlug/competitors`
- `/workspaces/:workspaceSlug/ai-visibility`
- `/workspaces/:workspaceSlug/brand-dna`
- `/workspaces/:workspaceSlug/reports`
- `/workspaces/:workspaceSlug/settings`

This makes every page inherently scoped to one workspace. A page refresh becomes safer because the URL itself encodes the workspace boundary.

## Navigation rules

### Login flow

After login:
- if user has zero workspaces -> show “Create your first workspace”
- if user has one workspace -> optionally go straight into that workspace Overview
- if user has multiple workspaces -> go to workspace switcher first, or restore last opened workspace safely

### Workspace creation

When user creates a new site/brand:
1. create workspace first
2. create initial site/brand metadata inside workspace
3. navigate to workspace Overview
4. from there start audit

Do not create an audit first and then figure out where to place it.

### No in-workspace site switching

Inside a workspace:
- no site dropdown
- no brand dropdown
- no “switch current site” control that mutates the existing shell

If needed, add a workspace switcher in the header that opens a separate modal/list and navigates to another workspace route, not just swaps data in place.

## Audit flow redesign

### Website audit

The New Audit page inside a workspace should always create a website audit for that workspace’s primary domain/site.

Rules:
- no selecting another brand from inside that page
- no creating audit for another workspace
- if the workspace has Brand DNA, the website audit may compare against it
- loader renders only in that workspace Overview

### Brand DNA audit

Brand DNA audit should be launched only inside `/brand-dna` for that workspace.

Rules:
- results render only there
- files and snapshots stay inside that workspace
- website audit may consume Brand DNA outputs as a related dataset, but must not launch or display Brand DNA as a separate duplicated workflow in Overview [file:280]

## Security and data integrity

This change is not only a UX fix — it is also a data-integrity fix.

Add row-level security and backend validations around `workspace_id` so that:

- user can only access workspaces they own or are shared into
- every audit insert must reference a workspace the user has access to
- every competitor, report, Brand DNA file, and deployment record must belong to the same workspace chain
- `previous_audit_id` must belong to the same workspace
- `active_audit_id` and `active_brand_identity_id` on workspace must also belong to that workspace [file:280]

## Legacy cleanup required

This workspace shift will not succeed unless legacy `/audit` pages/templates are removed or redirected. Those pages likely encode an older mental model: “audit first, figure out site later.” The new model must be the opposite: “open workspace first, everything else happens inside it.” Any old crawler or loader entry points that bypass workspace context must be deleted. [file:280]

## Trade-offs

### Benefits

- massively lower risk of cross-brand state leakage
- safer refresh behavior because URL includes workspace boundary
- simpler query keys and cache invalidation
- cleaner mental model for users
- easier future collaboration and sharing per workspace
- stronger database integrity and RLS model [file:280]

### Costs

- requires database migration
- requires route refactor
- requires replacing current dropdown switching pattern
- requires backfill and compatibility layer for existing user data
- may require changing some assumptions in crawler/orchestration services that currently start from `product_url` or `user_id` first [file:280]

## Acceptance criteria

The workspace architecture is correct only if all of the following are true:

- each workspace represents exactly one site/brand context [file:280]
- no page inside a workspace can show data from another workspace [file:280]
- every new audit is created with a valid `workspace_id` [file:280]
- every Brand DNA belongs to one workspace [file:280]
- competitor and AI visibility pages query by workspace first [file:280]
- switching to another brand means navigating to another workspace, not mutating the same page shell [file:280]
- refresh preserves the same workspace context via URL [file:280]
- old `/audit` pages/templates no longer participate in navigation or audit creation [file:280]

## What I want you to deliver

Please do not patch this superficially. I want a structural plan and implementation path.

Deliver:

1. **Architecture review**
   - assess whether workspace-based isolation is the right long-term model
   - identify what parts of current routing and context make the dropdown model fragile

2. **Database plan**
   - propose exact `workspaces` table
   - identify all tables that need `workspace_id`
   - define migration/backfill plan
   - define foreign keys and RLS updates

3. **Frontend plan**
   - propose new route structure under `/workspaces/:workspace`
   - remove in-dashboard cross-brand switching
   - define workspace switcher UX
   - define workspace Overview, New Audit, Brand DNA behavior

4. **Audit orchestration plan**
   - website audit always launched inside a workspace
   - Brand DNA audit only inside Brand DNA page
   - no cross-workspace audit creation possible

5. **Legacy cleanup plan**
   - identify old `/audit` pages/templates still published
   - remove or redirect them
   - remove old brand identity crawler entry points and duplicate loader logic

6. **Implementation sequencing**
   - safest order to ship this with minimal production risk
   - temporary compatibility layer if needed
   - rollout and QA checklist

## Copy-paste prompt for Claude

```text
I want to seriously evaluate and likely move the product from “multi-brand switching inside one dashboard with dropdowns” to a workspace-based architecture.

My thinking:
- the current quick brand/site switching is too fragile
- there are massive issues with switching brands instantly
- session/context is getting mixed up
- audits/loaders/navigation can appear under the wrong brand context
- this is likely made worse by old /audit pages/templates still being published

Proposed new model:
- one workspace = one brand/site
- no more cross-brand switching inside the same dashboard shell
- if user wants another brand/site, they switch workspace, not page-level context
- every page, audit, Brand DNA, competitors view, AI visibility view, report, and deploy flow belongs to one workspace only

I need you to assess this direction and design the proper implementation.

Please provide:
1. whether workspace-based isolation is the right architecture here
2. exact database changes required
3. a new `workspaces` table design
4. which existing tables need `workspace_id`
5. migration/backfill strategy from current user/product_url/brand_identity model
6. new route/navigation structure under workspaces
7. how login, workspace creation, Overview, New Audit, Brand DNA, Competitors, and Reports should work
8. how to prevent any cross-workspace audit creation or data leakage
9. how to remove old /audit templates/pages and any old crawler/loader logic that bypasses workspace context
10. rollout plan and test plan

Important product rules:
- one workspace = one brand/site context
- no brand/site dropdown inside a workspace
- website audits are launched only inside that workspace
- Brand DNA audit is launched only from Brand DNA page inside that workspace
- website can compare against Brand DNA only if that workspace has a valid Brand DNA attached
- refresh must preserve workspace context via the URL
- no page inside a workspace can ever show data from another workspace

I do NOT want a superficial patch. I want a structural proposal and implementation plan that includes database, routing, frontend state, backend validations, and legacy cleanup.
```
EOF && echo 'created output/workspace_architecture_brief_for_claude.md'
