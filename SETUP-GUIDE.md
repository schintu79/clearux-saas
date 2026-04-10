# ClearUX SaaS — Complete Setup Guide

Follow these steps in order. Each one builds on the previous.

---

## Step 1 — Install dependencies

Open your terminal, navigate to the project folder, and run:

```bash
cd ~/clearux-saas
npm install
```

This installs everything listed in `package.json`, including the new packages (lucide-react, clsx, react-hot-toast). It should take about 30–60 seconds.

If you hit any peer dependency warnings, they're safe to ignore. If you get actual errors, try:

```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Step 2 — Create a Supabase project and run the SQL

### 2a. Create the project

1. Go to [supabase.com](https://supabase.com) and sign in (or create a free account)
2. Click **New Project**
3. Choose your organization (or create one)
4. Fill in:
   - **Project name**: `clearux` (or whatever you like)
   - **Database password**: generate a strong one and save it somewhere — you'll need it if you ever connect directly
   - **Region**: pick the closest to your users (e.g., West EU for Italy, US East for North America)
5. Click **Create new project** and wait ~2 minutes for it to spin up

### 2b. Get your API keys

1. In your Supabase dashboard, go to **Settings → API** (left sidebar)
2. You'll see:
   - **Project URL** — this is your `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** — this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (click "Reveal") — this is your `SUPABASE_SERVICE_ROLE_KEY`
3. Copy all three. You'll paste them into `.env.local` in Step 6.

### 2c. Run the migration

1. In the Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New query**
3. Open the file `supabase/migrations/001_initial_schema.sql` from your project in any text editor
4. Copy the entire contents and paste it into the SQL Editor
5. Click **Run** (or Ctrl+Enter)
6. You should see "Success. No rows returned" — that means all tables, triggers, RLS policies, and indexes were created

### 2d. Run the seed

1. Still in SQL Editor, click **New query** again
2. Open `supabase/seed/001_checklist.sql`
3. Copy and paste the entire contents
4. Click **Run**
5. You should see "Success" — this inserts the 10 audit categories and 44 checklist items

### 2e. Enable email auth

1. Go to **Authentication → Providers** in the Supabase dashboard
2. Find **Email** and make sure it's enabled
3. Turn on:
   - **Confirm email**: ON (users must verify before accessing the dashboard)
   - **Secure email change**: ON
4. Click **Save**

> **Tip**: While developing locally, you can temporarily turn OFF "Confirm email" so you don't have to check your inbox every time you test registration. Just remember to turn it back ON before going live.

---

## Step 3 — Create a Stripe account and get your keys

### 3a. Create the account

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) and sign up (or sign in)
2. You'll start in **Test Mode** by default — this is what you want for development. You'll see a "Test mode" toggle in the top right.

### 3b. Get your API keys

1. Go to **Developers → API keys** (or click the key icon in the sidebar)
2. You'll see:
   - **Publishable key** (starts with `pk_test_`) — this is your `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** (click "Reveal", starts with `sk_test_`) — this is your `STRIPE_SECRET_KEY`
3. Copy both. You'll paste them into `.env.local` in Step 6.

### 3c. Set up the webhook (do this after deploy, or use the CLI for local testing)

**For local development**, use the Stripe CLI:

```bash
# Install the Stripe CLI (macOS)
brew install stripe/stripe-cli/stripe

# Login to your Stripe account
stripe login

# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This will print a webhook signing secret (starts with `whsec_`). Copy it — that's your `STRIPE_WEBHOOK_SECRET`.

Keep that terminal window running while you develop.

**For production** (after deploying), see Step 9.

---

## Step 4 — Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or sign in
3. Go to **API Keys** in the sidebar
4. Click **Create Key**
5. Name it something like `clearux-production`
6. Copy the key (starts with `sk-ant-`) — this is your `ANTHROPIC_API_KEY`

> **Pricing note**: ClearUX uses Claude Sonnet for the audit analysis. Each audit will use roughly $0.50–$2.00 in API credits depending on how much content is crawled. You'll need to add credits to your Anthropic account — start with $10–20 for testing.

---

## Step 5 — Get a Resend API key and verify your domain

### 5a. Create the account and get the key

1. Go to [resend.com](https://resend.com) and sign up
2. Go to **API Keys** in the sidebar
3. Click **Create API Key**
4. Name it `clearux`, set permissions to **Sending access**, choose **All domains**
5. Copy the key (starts with `re_`) — this is your `RESEND_API_KEY`

### 5b. Verify your sending domain (for production)

For local testing, Resend lets you send to your own email from `onboarding@resend.dev` — that works immediately, no setup needed.

For production:

1. Go to **Domains** in the Resend sidebar
2. Click **Add Domain**
3. Enter your domain (e.g., `clearux.net`)
4. Resend will give you DNS records to add (MX, TXT, and CNAME)
5. Add these records in your domain registrar (see Step 8)
6. Click **Verify** — it can take a few minutes to a few hours

### 5c. Update the from address in code

Once your domain is verified, open `src/lib/audit-engine/email.ts` and update the `from` field from `'ClearUX <noreply@clearux.net>'` to match your actual domain.

---

## Step 6 — Fill in your .env.local

Open `.env.local` in the project root and paste in all the keys you've collected:

```env
# Supabase (from Step 2b)
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghij.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# Stripe (from Step 3b and 3c)
STRIPE_SECRET_KEY=sk_test_51abc...
STRIPE_WEBHOOK_SECRET=whsec_abc...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51abc...

# Anthropic (from Step 4)
ANTHROPIC_API_KEY=sk-ant-api03-abc...

# Resend (from Step 5a)
RESEND_API_KEY=re_abc123...

# App URL (localhost for dev, your real domain for production)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Save the file. Now test locally:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. You should see the ClearUX homepage. Try navigating to `/login`, `/register`, `/pricing`, and `/dashboard`.

---

## Step 7 — Deploy to Vercel

### 7a. Push to GitHub first

If you haven't already:

```bash
cd ~/clearux-saas
git init
git add .
git commit -m "Initial ClearUX SaaS build"
```

Then create a repo on GitHub:

1. Go to [github.com/new](https://github.com/new)
2. Name it `clearux-saas`, set it to **Private**
3. Click **Create repository**
4. Follow the "push an existing repository" instructions:

```bash
git remote add origin https://github.com/YOUR_USERNAME/clearux-saas.git
git branch -M main
git push -u origin main
```

### 7b. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account
2. Click **Add New → Project**
3. Import your `clearux-saas` repository
4. Vercel will auto-detect it's a Next.js project
5. Before clicking Deploy, click **Environment Variables** and add ALL the variables from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET` (you'll update this after Step 9)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `RESEND_API_KEY`
   - `NEXT_PUBLIC_APP_URL` → set this to `https://your-app.vercel.app` for now (or your custom domain once set up)
6. Click **Deploy**
7. Wait 1–2 minutes. Vercel will give you a URL like `https://clearux-saas.vercel.app`

---

## Step 8 — Set up a custom domain and DNS

### 8a. Buy a domain (if you don't have one)

Popular registrars: [Namecheap](https://namecheap.com), [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/), [Google Domains](https://domains.google) (now Squarespace Domains).

For example, `clearux.net` or `clearux.io`.

### 8b. Connect it to Vercel

1. In your Vercel project dashboard, go to **Settings → Domains**
2. Type your domain (e.g., `clearux.net`) and click **Add**
3. Vercel will tell you what DNS records to add. Typically:
   - **A record**: `@` → `76.76.21.21`
   - **CNAME record**: `www` → `cname.vercel-dns.com`
4. Go to your domain registrar's DNS settings and add those records
5. Wait for propagation (usually 5–30 minutes, can take up to 48 hours)
6. Vercel will automatically provision an SSL certificate

### 8c. Update your environment variable

Once the domain is live, go to Vercel → Settings → Environment Variables and update:

```
NEXT_PUBLIC_APP_URL=https://clearux.net
```

Then redeploy (push a commit, or click "Redeploy" in the Vercel dashboard).

### 8d. Update Supabase redirect URLs

1. In Supabase dashboard, go to **Authentication → URL Configuration**
2. Set **Site URL** to `https://clearux.net`
3. Under **Redirect URLs**, add:
   - `https://clearux.net/auth/callback`
   - `https://clearux.net/reset-password`
   - `http://localhost:3000/auth/callback` (keep this for local dev)

---

## Step 9 — Configure the Stripe production webhook

Now that your app is deployed with a real URL:

1. Go to [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Set the **Endpoint URL** to: `https://clearux.net/api/stripe/webhook` (replace with your actual domain)
4. Under **Events to listen to**, click **Select events** and check:
   - `checkout.session.completed`
5. Click **Add endpoint**
6. On the webhook detail page, click **Reveal** next to "Signing secret"
7. Copy that `whsec_...` value
8. Go to Vercel → Settings → Environment Variables
9. Update `STRIPE_WEBHOOK_SECRET` with the new production signing secret
10. Redeploy

### Going live with Stripe

When you're ready to accept real payments:

1. In the Stripe dashboard, toggle OFF **Test mode** (top right)
2. Complete Stripe's onboarding (business info, bank account for payouts)
3. Get your **live** API keys (they start with `pk_live_` and `sk_live_`)
4. Update the three Stripe environment variables in Vercel with the live keys
5. Create a new webhook endpoint for live mode (same URL, same events)
6. Update `STRIPE_WEBHOOK_SECRET` with the live webhook signing secret
7. Redeploy

---

## Quick verification checklist

After completing all steps, test the full flow:

1. ✅ Homepage loads at your URL
2. ✅ Can register a new account
3. ✅ Receive confirmation email (check spam folder)
4. ✅ Can log in after confirming
5. ✅ Dashboard loads with empty state
6. ✅ Can fill out the new audit form
7. ✅ Stripe checkout redirects properly (use test card `4242 4242 4242 4242`, any future date, any CVC)
8. ✅ After payment, audit status updates in dashboard
9. ✅ Audit engine runs (check Supabase → audit_logs table for events)
10. ✅ Report appears when complete
11. ✅ Completion email arrives

---

## Useful test data for Stripe

When testing payments, use these Stripe test cards:

| Scenario           | Card Number          | Expiry  | CVC |
|--------------------|-----------------------|---------|-----|
| Successful payment | 4242 4242 4242 4242  | Any future | Any |
| Card declined      | 4000 0000 0000 0002  | Any future | Any |
| Requires auth (3DS)| 4000 0025 0000 3155  | Any future | Any |

---

That's it! You're live. 🚀
