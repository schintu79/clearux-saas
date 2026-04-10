# ClearUX SaaS — Database Setup

## Prerequisites
- Supabase account (free at supabase.com)
- New Supabase project created

---

## Step 1 — Run the migration

In your Supabase dashboard → SQL Editor, paste and run:

```
supabase/migrations/001_initial_schema.sql
```

This creates all tables, enums, triggers, indexes, RLS policies, and the
audit_overview view.

---

## Step 2 — Seed the checklist

In the same SQL Editor, paste and run:

```
supabase/seed/001_checklist.sql
```

This inserts all 10 audit categories and 40 checklist items. These are
the items Claude uses when running each audit.

---

## Step 3 — Enable Email Auth in Supabase

Dashboard → Authentication → Providers → Email → Enable

Configure:
- Confirm email: ON (users must verify before accessing dashboard)
- Secure email change: ON

---

## Step 4 — Add environment variables

Create a `.env.local` file in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe (next step)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Anthropic (next step)
ANTHROPIC_API_KEY=sk-ant-...

# Resend (next step)
RESEND_API_KEY=re_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Find your Supabase keys at:
Dashboard → Settings → API

---

## Schema overview

| Table                 | Purpose                                      |
|-----------------------|----------------------------------------------|
| `profiles`            | Extended user data (extends auth.users)      |
| `audits`              | Audit requests, status, submission data      |
| `payments`            | Stripe payment records                       |
| `checklist_categories`| Audit checklist category groups              |
| `checklist_items`     | Individual checklist items with AI prompts   |
| `audit_pages`         | Raw crawled page content                     |
| `audit_findings`      | Individual issues found during audit         |
| `reports`             | Final report summary and scores              |
| `audit_logs`          | Full event trail for every audit             |

## Audit status flow

```
pending_payment → payment_received → crawling → analysing → generating_report → completed
                                                                               ↘ failed
```

## Checklist categories (10 total, 40 items)

1. First Impression (4 items)
2. Value Proposition (4 items)
3. Navigation & IA (4 items)
4. Conversion & CTAs (4 items)
5. Onboarding (4 items)
6. Mobile Experience (4 items)
7. Trust & Credibility (4 items)
8. Content & Copy (4 items)
9. Performance & Tech (4 items)
10. AI Discoverability (6 items)

---

## Next steps

With the database in place, the next pieces to build are:

1. **Auth** — registration, login, email verification, session management
2. **Stripe integration** — payment flow + webhook handler
3. **Audit engine** — crawler + Claude API + report writer
4. **Dashboard** — user-facing audit status and report viewer
