# Fixpath — Claude Session Guide

**Read this file at the start of EVERY session. No exceptions.**

This document exists because a one-line missing DB enum value (`completed_with_warnings`) took two full days to diagnose. The root cause was trivial. The investigation was not, because the wrong assumptions were made at every step. This guide prevents that from happening again.

---

## 1. NON-NEGOTIABLE PRODUCT RULES

These rules were defined by the product owner. They override all other considerations:

- All saved data must be scoped at user level AND workspace level.
- The system must not behave as if deleted workspaces still exist.
- The system must not reuse stale deleted data in live product flows.
- The system must not reattach deleted integrations automatically.
- The system must not preserve user-visible memory after deletion.
- When a brand or workspace is deleted, it must be 100% wiped from the live system for that user.
- The live product must have no memory of it.
- Only admins may see archived/deleted records, if needed.
- Archived/deleted records must never affect product behavior.
- No live product query may resolve by domain, brand name, or site URL unless it is first constrained by active user_id AND workspace_id.
- Workspace is the only live identity boundary.
- Domain is metadata, not ownership.
- Deleted workspaces must not influence live product behavior.
- Deleted audits and brand identities must never re-enter dashboard, reporting, or processing.
- No public route may repair ownership fields like workspace_id.
- No processing job may start without validating the full relational graph.
- Latest-audit, memory, and reconciliation logic must stay strictly inside the active workspace.

## 2. WORKSPACE RULES — ONE FOLDER ONLY

**ALL work must be done in `clearux-saas/` directly.** Never create, reference, or work in any other folder like `clearux-fresh/`. One repo, one folder, always.

---

## 3. SCHEMA DRIFT PREVENTION — THE #1 LESSON

### What went wrong

Tasks #851 and #862 added `completed_with_warnings` to 26 TypeScript source files but **never created a SQL migration** to add the value to the PostgreSQL `audit_status` enum. TypeScript compiled fine because the type is a string union — it has no awareness of the live DB enum. Every Supabase query using `.in('status', ['completed', 'completed_with_warnings'])` silently failed because PostgREST cannot cast an invalid enum value, returning `{ data: null, error: {...} }`. The code only destructures `data`, so the error was invisible.

### The rule, permanently

**Every time you change a TypeScript type that maps to a database column, you MUST check if a SQL migration is also needed.**

Specific triggers that REQUIRE a migration file:

1. **Adding a new value to a TypeScript string union that maps to a PostgreSQL ENUM** — you MUST write `ALTER TYPE <enum_name> ADD VALUE IF NOT EXISTS '<new_value>';`
2. **Adding a new field to a TypeScript interface that maps to a DB table** — you MUST write `ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <column> <type>;`
3. **Adding a new table type to TypeScript** — you MUST write `CREATE TABLE IF NOT EXISTS` with all columns, indexes, and RLS policies.
4. **Changing a column type or constraint** — you MUST write the ALTER statement.

### Where to look

- TypeScript types: `src/types/database.ts`
- Enum definitions in DB: `supabase/migrations/001_initial_schema.sql` (lines 7-29)
- All migration files: `supabase/migrations/`

### Current known enum mappings

```
PostgreSQL enum: audit_status
DB values:       pending_payment, payment_received, crawling, analysing, generating_report, completed, failed, completed_with_warnings, stalled
TS type:         AuditStatus in src/types/database.ts

PostgreSQL enum: payment_status
DB values:       pending, succeeded, failed, refunded
TS type:         PaymentStatus in src/types/database.ts

PostgreSQL enum: finding_severity
DB values:       critical, high, medium, low
TS type:         FindingSeverity in src/types/database.ts
```

If you add a value to ANY of these TypeScript types, write the migration immediately. Do not finish the task without it.

---

## 4. SUPABASE SILENT FAILURES — THE #2 LESSON

### The pattern that hides bugs

```typescript
// DANGEROUS — error is silently ignored
const { data } = await supabase.from('audits').select('*').eq('workspace_id', wsId)

// SAFE — error is checked
const { data, error } = await supabase.from('audits').select('*').eq('workspace_id', wsId)
if (error) console.error('Query failed:', error.message)
```

When PostgREST encounters an invalid enum value, a missing column, or any schema mismatch, it returns an HTTP error. The Supabase JS client puts the error in the `error` field and sets `data` to `null`. If the code only destructures `data`, the failure is **completely invisible** — it looks like "no rows found" instead of "query crashed."

### What to check when data is "missing" from the UI

Before assuming the data isn't there, verify in this exact order:

1. **Check the Supabase SQL editor directly** — does the row exist in the table? (`SELECT * FROM audits WHERE id = '...'`)
2. **Check the query isn't failing silently** — add `error` to the destructuring and log it. Or run the equivalent PostgREST URL manually.
3. **Check enum values** — if the query filters by a status/type field, verify every value in the `.in()` or `.eq()` filter actually exists in the PostgreSQL enum.
4. **Check column existence** — if the query references columns like `workspace_id` or `deleted_at`, verify they exist on the table.
5. **Check RLS policies** — verify the authenticated user can actually see the rows. Run the query with the service role key to bypass RLS and compare.
6. **Check the workspace_id value** — even if the column exists, is it NULL or pointing to the wrong workspace?

### Quick diagnostic query for any "data not showing" bug

```sql
-- Replace 'audits' and column names as needed
SELECT id, status, workspace_id, deleted_at, user_id, created_at
FROM audits
WHERE user_id = '<user_uuid>'
ORDER BY created_at DESC
LIMIT 10;
```

Then compare what the code queries for vs what's in the DB.

---

## 5. BUG DIAGNOSIS PROTOCOL — USE THIS EVERY TIME

When investigating ANY bug, follow this sequence. Do NOT skip steps.

### Step 1: Reproduce and locate

- What exact UI element is broken? (empty list, wrong data, crash, etc.)
- What component renders it? (grep for the text or element)
- What data fetching function does that component call?
- What Supabase query does that function execute?

### Step 2: Verify the data layer

Run the **exact equivalent query** in Supabase SQL editor. Not a similar query — the exact one, with the same filters.

If the SQL editor returns data but the UI doesn't: the bug is in the **query construction** (enum mismatch, column mismatch, RLS, silent error).

If the SQL editor also returns empty: the bug is in the **data** (missing workspace_id, wrong status, soft-deleted, etc.)

### Step 3: Check for schema drift

Before any other hypothesis, verify:

```sql
-- Do the columns the code uses actually exist?
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = '<table>'
ORDER BY ordinal_position;

-- Do the enum values the code uses actually exist?
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = '<enum_type>')
ORDER BY enumsortorder;
```

### Step 4: Fix forward, not around

When you find the root cause:
1. Fix the actual problem (add missing enum, add missing column, fix query)
2. Write a migration file in `supabase/migrations/`
3. Verify the fix in the SQL editor
4. Then update the code if needed

NEVER patch the frontend to work around a backend issue. NEVER assume the migration history is the source of truth — always check the actual live DB objects.

---

## 6. BEFORE COMPLETING ANY TASK — CHECKLIST

Run through this checklist before marking any task as done:

### Code changes
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] No unused imports
- [ ] Error responses from Supabase are handled (not just `data` destructured)

### Database changes
- [ ] If TypeScript types changed: does the DB need a migration?
- [ ] If a new enum value was added to TS: is it in the PostgreSQL enum?
- [ ] If a new column was added to TS interface: is it in the DB table?
- [ ] Migration file uses `IF NOT EXISTS` / `ADD VALUE IF NOT EXISTS`
- [ ] Migration file is in `supabase/migrations/` with correct naming

### Workspace isolation
- [ ] Every query that touches audits, brand_identities, audit_findings, or reports filters by BOTH `user_id` AND `workspace_id`
- [ ] Every query that reads live data includes `.is('deleted_at', null)` where the column exists
- [ ] No query resolves by domain alone without workspace_id constraint
- [ ] DELETE operations soft-delete (set `deleted_at`) rather than hard-delete

### Pipeline changes
- [ ] Every Inngest step has a timeout
- [ ] Every step has error handling that doesn't silently swallow failures
- [ ] Progress percentage is updated at each stage
- [ ] The stall sweeper can detect and recover from any new failure mode

---

## 7. ARCHITECTURE QUICK REFERENCE

### Stack
- Next.js App Router + Supabase (PostgreSQL + PostgREST + RLS)
- Inngest for background pipeline processing
- Vercel for deployment
- Stripe for billing

### Key files for debugging

| What | Where |
|------|-------|
| TypeScript DB types | `src/types/database.ts` |
| Audit data fetcher | `src/lib/dashboard/latest-audit.ts` |
| Workspace context | `src/context/WorkspaceContext.tsx` |
| Audit bundle context | `src/context/AuditBundleContext.tsx` |
| Audit pipeline | `src/lib/inngest/functions/process-audit.ts` |
| Analyzer (AI calls) | `src/lib/audit-engine/analyzer.ts` |
| Stall sweeper | `src/lib/inngest/functions/stall-sweeper.ts` |
| Feature flags | `src/lib/feature-flags.ts` |
| DB migrations | `supabase/migrations/` |
| Initial schema + enums | `supabase/migrations/001_initial_schema.sql` |
| Supabase client setup | `src/lib/supabase-server.ts` |
| Pricing/plans | `src/lib/pricing.ts` |
| Audit usage/credits | `src/lib/audit-usage.ts` |

### Supabase client types
- `createServerSupabase()` — RLS-bound, uses authenticated user's JWT, respects row-level security
- `createServiceSupabase()` — bypasses RLS entirely, uses service_role key, for server-side operations only

### Environment
- `.env.local` contains all credentials — NEVER expose in responses
- Sandbox cannot reach external Supabase URLs — use Chrome extension or have user run SQL manually
- `git push` fails from sandbox — user must push from their terminal

---

## 8. KNOWN ENUM DRIFT — FIXED BUT WATCH FOR RECURRENCE

The following enum values were missing from the live DB and caused silent query failures across 26+ files:

| Enum | Value | Files affected | Fixed |
|------|-------|----------------|-------|
| `audit_status` | `completed_with_warnings` | 26 files | 2026-06-09 |
| `audit_status` | `stalled` | 11 files | 2026-06-09 |

If you EVER add a new status to `AuditStatus` in `database.ts`, immediately grep for the enum name in `001_initial_schema.sql` and write a new migration file.

---

## 9. COMMON MISTAKES TO AVOID

1. **"TypeScript compiles = it works"** — NO. TypeScript has no knowledge of the live PostgreSQL schema. A TS type can include values the DB doesn't accept.

2. **Investigating the frontend first** — ALWAYS start from the database layer. If the data is correct in the DB, work upward. If it's not, fix the DB first.

3. **Trusting migration history** — The `supabase_migrations.schema_migrations` table only tracks what Supabase CLI applied. If SQL was run manually, the history won't reflect it. Always inspect the actual schema with `information_schema`.

4. **Assuming "no data" means "data doesn't exist"** — It usually means the query is failing. Check for silent errors first.

5. **Writing a script to query the DB from the sandbox** — The sandbox network is restricted and cannot reach Supabase. Use the Chrome extension to access the Supabase SQL editor, or ask the user to run queries and share results.

6. **Creating migration files without IF NOT EXISTS** — All migrations must be idempotent. Use `IF NOT EXISTS`, `ADD VALUE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`.

7. **Patching symptoms instead of root causes** — If audits aren't showing, don't add a fallback in the UI. Find out WHY they aren't showing. The root cause is always in the data or schema layer.

8. **Not checking the `error` field from Supabase responses** — When debugging, always destructure BOTH `data` AND `error`. The error tells you exactly what's wrong.

---

## 10. WHEN THE USER REPORTS "X ISN'T SHOWING" — FAST PATH

This is the most common bug report. Follow these steps in order — each takes under 2 minutes:

1. Ask the user to run in Supabase SQL editor:
   ```sql
   SELECT id, status, workspace_id, deleted_at FROM <table> WHERE user_id = '<id>' ORDER BY created_at DESC LIMIT 5;
   ```

2. If rows exist with correct workspace_id and null deleted_at: **the query is failing, not the data**. Check enum values and column references next.

3. If workspace_id is NULL: the backfill or insert didn't set it. Fix the insert code.

4. If deleted_at is set: something soft-deleted it unexpectedly. Check the stall sweeper and delete handlers.

5. If no rows exist: the record was never created. Check the pipeline or API route that should have created it.

---

## 11. MIGRATION FILE NAMING CONVENTION

```
YYYYMMDD_description.sql        — for date-stamped migrations
NNN_description.sql             — for numbered migrations (001-051 range used)
```

Current highest numbered: `051_brand_file_tag.sql`
Current latest dated: `20260609_add_completed_with_warnings_enum.sql`

Always use the date format for new migrations.

---

## 12. BEFORE STARTING ANY SESSION

1. Read this file
2. Check if there are uncommitted changes: `git status`
3. Check if there are unpushed commits: `git log --oneline @{u}..HEAD`
4. Ask the user what they need — don't assume from prior context
5. If the task involves DB queries or "data not showing" bugs, start with step 2 of the bug diagnosis protocol (verify the data layer), not step 1 (UI investigation)
