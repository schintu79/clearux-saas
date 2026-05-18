# ClearUX.ai — Master Product Bible
### Version 1.0 | May 2026 | Confidential

---

## Executive Summary

ClearUX.ai is not an AI visibility tracker. It is an **AI-powered brand health engine** that audits how a business is perceived by real users and by AI systems — and then **automatically fixes the gaps**. The tool's core promise is simple: *you don't just see what's broken, you leave with it fixed.*

Every feature decision, every UI element, every API endpoint must serve this contract. If it only reports, it does not belong in the product.

---

## Part 1 — Product Contract

### The One-Sentence Definition

> ClearUX.ai audits how your brand, website, and content are perceived by users and AI engines, scores the gaps, and fixes them — automatically or with one-click deployment.

### What ClearUX Is NOT

These are freeze zones. We do not build these. We do not add them. If a new idea sounds like one of these, it is noise.

- A rank tracker (that's KIME, SE Ranking, Semrush)
- A social media monitoring tool (that's BuzzWatch, Mention.com)
- A generic SEO audit (that's Ahrefs, Screaming Frog)
- A content scheduler or publishing platform
- A backlink analysis tool
- A keyword research tool
- A reporting dashboard that only visualizes without fixing

### The Core Differentiator (Never Dilute This)

| KIME | ClearUX.ai |
|------|-----------|
| Tracks AI presence | Audits AI perception vs. brand reality |
| Scores visibility | Scores perception gap |
| Shows issues | **Fixes issues automatically** |
| Dashboard-first | Fix-first |
| Agency tool | Any business owner can use it |

---

## Part 2 — The Three User Journeys

### Journey 1 — Onboarding (Day 1, ~10 minutes)

The user must reach their first "aha" moment within 10 minutes of signing up.

**Steps:**
1. Sign up / log in
2. Enter website URL + brand name
3. Optional: Upload brand kit (logo, colors, tone of voice keywords) OR let ClearUX infer them from the site
4. Run first audit (automated, no configuration needed)
5. Land on the Audit Overview — see their overall ClearUX Score, top 3 critical issues, and 1 auto-fixable item ready to deploy

**Rule:** No setup wizard with 8 steps. No empty dashboard. The first screen after onboarding must show real data.

---

### Journey 2 — First Fix (Day 1–3)

The user has seen the audit. Now they fix something.

**Fix delivery methods (in order of user preference):**

1. **Auto-fix via WordPress Plugin** — user installs plugin, connects to ClearUX, fixes are pushed directly. No code. No FTP. This is the gold standard.
2. **Auto-fix via FTP** — user provides FTP credentials, ClearUX pushes the fix directly to the server. For non-WordPress sites.
3. **Copy-paste snippet** — for developer teams. ClearUX generates the exact code to paste, with file path and line number instructions.
4. **Manual guidance** — step-by-step written instructions with screenshots for non-technical users.

Every finding in the system must have at least Fix Method 3 (copy-paste) available. Methods 1 and 2 are Phase 2 features.

---

### Journey 3 — Ongoing Brand Health (Day 7–30+)

The user returns to monitor progress and run re-audits.

**What they expect to see:**
- Score improvement over time (delta from last audit)
- Fixed vs. open issues count
- AI perception framing: how AI engines describe the brand this week vs. last week
- Brand voice drift alerts: if the brand's tone on the site no longer matches the brand DNA on file
- New issues introduced since last audit (regression detection)

**Rule:** The dashboard must answer one question above all others — *"Am I getting better?"* Everything else is secondary.

---

## Part 3 — Audit Engine Architecture

### The Six Audit Modules (Current)

| Module | What It Measures |
|--------|-----------------|
| Foundation | Technical health: speed, schema, canonical tags, robots.txt, sitemap |
| Human Experience | UX clarity, navigation, call-to-action quality, form usability |
| Inclusive Design | Accessibility: WCAG compliance, alt text, color contrast, keyboard nav |
| Future Readiness | Structured data, AI crawlability, LLM-friendly content formatting |
| Brand Consistency | Logo usage, color consistency, tone of voice alignment across pages |
| SEO Structure | Title tags, meta descriptions, heading hierarchy, internal linking |

### The Seventh Module (Phase 2 — New, No Competitor Has This)

**AI Perception vs. Brand Identity Gap**

This module compares:
- What the brand says it is (brand DNA on file)
- What real users say it is (scraped public reviews, Reddit mentions, community tone)
- What AI engines say it is (live query results from ChatGPT, Perplexity, Google AI Overview)

Output: a **Perception Gap Score** with specific framing mismatches. Example: *"ChatGPT describes your brand as 'enterprise-focused and complex.' Your brand DNA says 'simple and accessible for small businesses.' Recommended corrective content: 3 FAQ entries + schema update."*

### Scoring System

- **Overall ClearUX Score**: 0–100, weighted composite of all modules
- **Module Scores**: 0–100 per module
- **Severity Tiers**: Critical (blocks AI indexing or user trust) → High → Medium → Low → Informational
- **Fix Effort Tags**: Quick Win (< 30 min) → Standard (1–4 hours) → Complex (requires developer)
- **Delta Tracking**: every re-audit shows +/- movement per module and overall

---

## Part 4 — The WordPress Plugin Specification

### Plugin Identity

- **Name:** ClearUX for WordPress
- **Slug:** `clearux`
- **Description:** Connect your WordPress site to ClearUX.ai. Run audits, receive findings, and deploy fixes directly from your dashboard — no FTP, no code.

### Core Capabilities (Phase 2 MVP)

| Capability | Description |
|-----------|-------------|
| Site connection | API key auth from ClearUX.ai settings page |
| Audit trigger | Run audit on-demand from WP admin OR on post/page publish |
| Fix deployment | ClearUX pushes approved fixes to the WP site automatically |
| Schema injection | Auto-generates and injects JSON-LD structured data (Organization, WebPage, Article, Product) |
| Meta tag manager | Overwrites or supplements Yoast/RankMath with AI-optimized meta descriptions |
| Alt text fixer | Detects missing alt text and injects AI-generated descriptions |
| Brand voice checker | Flags content that drifts from stored brand DNA, inline in the WP editor |
| Status widget | WP admin bar shows current ClearUX Score + count of open issues |

### Plugin Architecture

```
clearux/
├── clearux.php                    ← Main plugin file, hooks, init
├── includes/
│   ├── class-clearux-api.php      ← Handles all communication with clearux.ai REST API
│   ├── class-clearux-auth.php     ← API key storage, validation, connection status
│   ├── class-clearux-fixer.php    ← Receives fix payloads, applies them to WP DB/files
│   ├── class-clearux-schema.php   ← JSON-LD generation and wp_head injection
│   ├── class-clearux-meta.php     ← Meta tag management (works alongside Yoast/RankMath)
│   ├── class-clearux-alttext.php  ← Alt text audit and auto-fill
│   └── class-clearux-webhook.php  ← Receives push events from clearux.ai
├── admin/
│   ├── class-clearux-admin.php    ← Admin panel pages
│   ├── views/
│   │   ├── settings.php           ← API key input, connection test, site profile
│   │   ├── dashboard.php          ← Mini audit overview inside WP admin
│   │   └── fixes.php              ← Pending and applied fixes queue
│   └── assets/
│       ├── clearux-admin.css
│       └── clearux-admin.js
├── public/
│   └── class-clearux-public.php   ← Front-end schema/meta injection
└── readme.txt
```

### API Contract Between Plugin and SaaS

The plugin communicates with the ClearUX.ai SaaS via a secure REST API. All endpoints require a valid API key in the `Authorization: Bearer` header.

**Plugin → SaaS (outgoing):**

| Endpoint | Method | Purpose |
|---------|--------|---------|
| `/api/plugin/connect` | POST | Register site, store WordPress version, active plugins list |
| `/api/plugin/audit/trigger` | POST | Trigger a new full audit |
| `/api/plugin/content` | POST | Send page HTML content for page-level audit |
| `/api/plugin/fix/confirm` | POST | Confirm a fix was applied successfully |
| `/api/plugin/heartbeat` | POST | Periodic health check, sends score delta |

**SaaS → Plugin (incoming via webhook):**

| Webhook Event | Payload | Purpose |
|--------------|---------|---------|
| `audit.completed` | Audit ID, scores, findings array | Notify plugin audit is ready |
| `fix.approved` | Fix ID, fix type, target (post ID / file / meta key), content | Push approved fix to the site |
| `schema.update` | JSON-LD object | Replace or create structured data for a URL |
| `alert.regression` | Module, issue description | Notify admin of new issue detected |

### Fix Payload Structure

Every fix pushed from ClearUX.ai to the plugin follows this contract:

```json
{
  "fix_id": "fix_abc123",
  "fix_type": "schema_inject | meta_update | alt_text | content_flag | custom_code",
  "target": {
    "type": "post | option | file | head",
    "identifier": "post_id OR option_key OR file_path"
  },
  "action": "insert | update | delete",
  "content": "<actual fix content as string or JSON>",
  "rollback": "<previous value for safe rollback>",
  "requires_approval": true,
  "applied_at": null
}
```

**Key rule:** Every fix includes a `rollback` value. Users can undo any fix with one click.

### Fix Approval Flow

1. ClearUX.ai identifies a fixable issue in the audit
2. Fix payload is generated and stored in the SaaS DB (status: `pending_approval`)
3. Plugin admin panel shows fix in the **Pending Fixes Queue** with a preview
4. User clicks **Deploy Fix** (or **Auto-deploy** is enabled in settings)
5. Plugin applies the fix, sends `fix.confirm` back to SaaS
6. SaaS updates fix status to `applied`, timestamps it, updates the audit score
7. Fix appears in **Fix History** with one-click rollback available

### WordPress Compatibility

- **Minimum WordPress:** 6.0
- **Minimum PHP:** 8.0
- **Tested up to:** Latest stable WordPress
- **Multisite support:** Phase 3
- **Compatible with:** Yoast SEO, RankMath, All in One SEO (meta coexistence mode)
- **Does not conflict with:** WooCommerce, Elementor, Divi, ACF

---

## Part 5 — FTP Auto-Fix Specification (Phase 2, Non-WordPress)

For sites not running WordPress, ClearUX.ai offers direct FTP/SFTP deployment.

### Connection Setup
- User provides FTP host, username, password (or SFTP key)
- Credentials are encrypted at rest using AES-256 and never stored in plaintext
- ClearUX performs a **sandbox test write** to `/clearux-test.txt` to confirm write access, then deletes it

### What Can Be Fixed via FTP

| Fix Type | How It's Applied |
|---------|-----------------|
| Missing JSON-LD schema | Inject `<script type="application/ld+json">` into `<head>` via HTML rewrite |
| Missing alt attributes | Parse HTML files, inject alt text, rewrite file |
| Meta tag updates | Locate `<meta name="description">` in HTML, replace content |
| robots.txt updates | Append or rewrite disallow/allow rules |
| sitemap.xml generation | Generate and upload `sitemap.xml` to web root |
| Custom code snippets | Inject snippets at defined positions in HTML files |

### Safety Rules (Non-Negotiable)

1. ClearUX **never** overwrites a file without creating a timestamped backup first (stored in `/clearux-backups/`)
2. Every FTP fix is staged and shown to the user before deployment
3. Users can roll back any FTP fix by restoring from the backup directory
4. ClearUX never modifies PHP, database, or binary files via FTP

---

## Part 6 — Phased Build Roadmap

### Phase 1 — Foundation (Current / Active)
*Goal: A stable, usable audit tool that any business owner can understand.*

- [x] Audit engine (6 modules)
- [x] Dashboard with score cockpit
- [x] Findings tab with severity and fix guidance
- [x] Shared audit reports
- [x] Stripe billing + Inngest job queue
- [ ] **Fix: onboarding flow (current is confusing)**
- [ ] **Fix: audit page shows score once, not twice**
- [ ] **Fix: empty states on all tabs**
- [ ] **Fix: navigation stability (React #310 fixed, retest all tabs)**
- [ ] Copy-paste fix snippets per finding (every finding gets a code block)
- [ ] Brand DNA input form (logo, colors, tone keywords, brand voice)
- [ ] Re-audit with delta comparison

### Phase 2 — Fix Engine
*Goal: Users can fix issues without touching code.*

- [ ] WordPress Plugin (full spec above)
- [ ] FTP Auto-Fix (spec above)
- [ ] Fix approval queue in SaaS dashboard
- [ ] Fix history with rollback
- [ ] AI Perception Module (Seventh Module)
- [ ] Brand voice drift alerts

### Phase 3 — Intelligence Layer
*Goal: ClearUX becomes proactive, not reactive.*

- [ ] Weekly AI framing digest (email + in-app)
- [ ] Competitor perception comparison
- [ ] AI-generated corrective content briefs
- [ ] WordPress Multisite support
- [ ] White-label reports for agencies
- [ ] Team/client workspace management

---

## Part 7 — Design Principles (Non-Negotiable)

### UI Rules

1. **Every screen answers one question.** Never two questions, never zero.
2. **The fix is always visible.** If a finding has no clear fix path, it should not be shown to the user yet.
3. **Score first, details on click.** The user sees their number immediately. Complexity is hidden behind expansion.
4. **No dead ends.** Every empty state has an action. Every error has a recovery step.
5. **Human-proof navigation.** If a first-time user cannot figure out where to click within 5 seconds, the UI is wrong.

### Copy Rules

1. Never say "visibility." Say "how AI describes you."
2. Never say "audit findings." Say "what's hurting your score."
3. Never say "remediation." Say "fix this."
4. Every button label is a verb: **Run Audit**, **Deploy Fix**, **View Issues**, **Connect Site**.

---

## Part 8 — Technical Stack Reference

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js (App Router) | Hosted on Vercel |
| Database | Supabase (PostgreSQL) | Row-level security enabled |
| Auth | Supabase Auth | Magic link + email/password |
| Payments | Stripe | Webhook → Inngest (never inline) |
| Job Queue | Inngest | All async audit processing |
| AI Engine | Anthropic Claude | Audit analysis + fix generation |
| Email | Resend | Transactional only |
| WordPress Plugin | PHP 8.0+ | Standalone, communicates via REST API |
| FTP Layer | PHP (SaaS-side SFTP client) | Via phpseclib or native SSH2 |

### Critical Rules — Never Break These

1. **Stripe webhook never calls `processAudit()` inline** — always dispatches to Inngest
2. **API keys for plugin auth are stored hashed** (migration 030 applied)
3. **Local `/Users/stefanoschintu/clearux-saas` folder contains proprietary algorithm** — never overwrite without explicit approval
4. **All code changes go to a review branch first** — never push directly to main without typecheck passing
5. **Never deploy to Vercel without `npx tsc --noEmit` passing clean**

---

## Part 9 — The Anti-Noise Checklist

Before adding any new feature, answer all four questions. If any answer is "no," do not build it.

1. **Does this directly help a user fix something on their site?**
2. **Can this be explained in one sentence to a non-technical business owner?**
3. **Does this make ClearUX more different from KIME, or more similar?**
4. **Is this Phase 1 or Phase 2 work? (Never build Phase 3 before Phase 2 is stable.)**

---

*This document is the single source of truth for ClearUX.ai product decisions. Every code branch, every design change, every new feature idea must trace back to a section in this document. If it doesn't fit, it doesn't ship.*

