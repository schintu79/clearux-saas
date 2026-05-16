# Fixpath.ai — Master Product Bible
### Version 2.0 | May 2026 | Confidential

> Successor to the **ClearUX.ai Master Product Bible (v1.0)**. The
> repository, env vars, database tables, and internal identifiers still
> use the legacy `clearux` naming for safety. User-facing surfaces are
> being migrated to **Fixpath**.

---

## Executive Summary

Fixpath.ai is an **AI-powered brand health engine** that audits how a
business is perceived by real users and by AI systems, then turns every
issue into a clear path to fix it. The product's core promise: *you do
not just see what is broken — you leave with a path to fix it and a way
to track that it stayed fixed.*

The brand name reinforces the workflow:

**Find the issue. Follow the fix path. Track improvement.**

If a feature only reports and does not help the user fix or track, it
does not belong in the product.

---

## Part 1 — Product Contract

### One-sentence definition

> Fixpath.ai audits how your brand, website, and content are perceived
> by users and AI engines, scores the gaps, and gives you the clearest
> path to fix them — automatically or with one-click deployment.

### What Fixpath is NOT

Freeze zones. We do not build these. If a new idea sounds like one of
these, it is noise.

- A rank tracker
- A social-media monitoring tool
- A generic SEO audit
- A content scheduler or publishing platform
- A backlink or keyword research tool
- A reporting dashboard that only visualises without fixing

### Customer-facing score label

The score the user sees in the dashboard, shared reports, and PDF/DOCX
exports is the **Brand Health Score** (0–100).

We intentionally chose `Brand Health Score` over `Fixpath Score`:

- It describes what the score measures, not who measures it.
- It survives future renames of the product.
- It frames the audit around the user's brand, not our tool.

Reserve the name **Fixpath** for the product itself, the workflow
(`Find → Fix → Track`), and the URL.

---

## Part 2 — The Operating Model

### Find

What is hurting the score? The audit ranks every open issue by severity,
module, and fix effort. Empty state always has a CTA.

### Fix

What can the user act on right now? Each finding shows the next best
fix, copy-paste snippets where possible, and a clear ownership signal
(content, design, dev).

### Track

Is the brand getting better? Re-audits compare against the prior
baseline, surface regressions, and show the score delta over time.

This vocabulary is reflected in:

- Sidebar workspace nav (`Overview`, `Find`, `Fix`, `Track`, `Brand DNA`,
  `Reports`).
- Empty-state copy on every dashboard surface.
- The transactional emails that announce a completed audit.

---

## Part 3 — Brand voice (recap from transition brief)

- **Direct** — clear about what is broken and what to do next, never
  alarmist.
- **Practical** — turns diagnosis into action.
- **Trustworthy** — explains why a fix matters without exaggerating
  certainty.
- **Accessible** — written for business owners first, technical users
  second.

---

## Part 4 — Naming and constants

The product name, score label, hero copy, and metadata defaults live in
[`src/lib/branding.ts`](src/lib/branding.ts). Use those constants in any
new user-facing surface so a future rename or label tweak does not
scatter across the codebase.

| Constant | Value |
|---|---|
| `PRODUCT_NAME` | `Fixpath` |
| `PRODUCT_NAME_LONG` | `Fixpath.ai` |
| `LEGACY_PRODUCT_NAME` | `ClearUX` |
| `SCORE_LABEL` | `Brand Health Score` |
| `SCORE_LABEL_SHORT` | `Brand Health` |
| `TAGLINE` | `Find the issue. Follow the fix path. Track improvement.` |

### What stays as ClearUX

- The GitHub repository name (`clearux-saas`).
- All `clearux-*` env vars (`NEXT_PUBLIC_APP_URL`, `clearux-theme`
  cookie, etc.).
- Database table and column names. Historical migrations under
  `supabase/migrations/`.
- Internal identifiers in pipeline modules and inline comments where
  renaming would be risky.
- The `clearux.ai` email sender domains (`hello@`, `audits@`,
  `billing@`, `support@`) until DNS for `fixpath.ai` is provisioned. The
  display name in the `From:` header is already `Fixpath`.

These are P2 items in the transition brief and should be scheduled with
explicit migration plans.

---

## Part 5 — Open follow-ups

- Visual assets: logo SVG (`src/components/ui/Logo.tsx`), favicon, OG
  image. Today the SVG paths still spell `clearux`; the wordmark text on
  the marketing logo and the dashboard shell already says `Fixpath`. New
  vector art is a design task, not a code task.
- Email sender DNS: provision `hello@fixpath.ai`, `audits@fixpath.ai`,
  `billing@fixpath.ai`, then swap the `to`/`from` addresses in
  `src/lib/audit-engine/email.ts`.
- Transition messaging: decide whether existing users see
  `Fixpath.ai, formerly ClearUX.ai` for a period.
- Domain switch: stage `fixpath.ai` behind a redirect from
  `clearux.ai` once the marketing copy is finalised.
- WordPress plugin: rename to `Fixpath for WordPress` when the plugin
  itself is touched.
