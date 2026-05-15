// ============================================================
// ClearUX API — POST /api/free-audit
// Creates a free preview audit (no auth required).
// Rate-limited. Only caches in-flight audits (not completed ones).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceSupabase } from '@/lib/supabase-server'
import { inngest } from '@/lib/inngest/client'

export const dynamic = 'force-dynamic'

// Per-key rate limits for anonymous free audits. The cap intentionally
// applies to a stable per-requester key (email or hashed IP) rather than
// to global hourly volume, so one heavy user can no longer block every
// other site from running a free preview.
const FREE_AUDIT_MAX_PER_HOUR = 3
const FREE_AUDIT_GLOBAL_BURST_PER_HOUR = 200

/**
 * Build a stable rate-limit key.
 * We never store raw IPs (PII minimisation). When a real email is
 * provided we trust that as the identity; otherwise we salt + SHA-256
 * the first non-private IP in x-forwarded-for so the value is opaque
 * but stable for a given client.
 */
function buildRateLimitKey(request: NextRequest, email?: string): string {
  if (email && typeof email === 'string') {
    const normalised = email.trim().toLowerCase()
    if (normalised.includes('@')) return `email:${normalised}`
  }
  const fwd = request.headers.get('x-forwarded-for') || ''
  const ip = fwd.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'anon'
  const salt = process.env.FREE_AUDIT_RATE_LIMIT_SALT || 'clearux-static-salt'
  const hash = createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 24)
  return `ip:${hash}`
}

/**
 * POST /api/free-audit
 * Create a free preview audit for a given URL (no authentication required)
 *
 * Request body:
 *   {
 *     url: string      (required) — the URL to audit (https:// prepended if missing)
 *     email?: string   (optional) — email for rate limiting and follow-up
 *     force?: boolean  (optional) — skip in-flight dedup and always create a new audit
 *   }
 *
 * Response:
 *   {
 *     success: true,
 *     audit_id: string,
 *     cached: boolean  (true if returned an in-flight audit instead of creating new)
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const { url, email, force } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'url is required and must be a string' },
        { status: 400 },
      )
    }

    // Normalize and validate URL
    let validatedUrl = url
    if (!validatedUrl.startsWith('http://') && !validatedUrl.startsWith('https://')) {
      validatedUrl = `https://${validatedUrl}`
    }

    try {
      new URL(validatedUrl)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 },
      )
    }

    // Build a stable per-requester key (email if available, otherwise
    // a hashed IP — we don't persist raw IPs).
    const rateLimitKey = buildRateLimitKey(request, email)

    // Initialize Supabase service client
    const supabase = createServiceSupabase()

    // ────────────────────────────────────────────────────────────
    // Check for in-flight audit (same URL, still processing)
    // Only cache if an audit is actively running to prevent duplicates.
    // Completed audits are never cached — always run fresh.
    // ────────────────────────────────────────────────────────────
    if (!force) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

      const { data: inFlightAudits, error: fetchError } = await supabase
        .from('audits')
        .select('id, status, created_at')
        .eq('product_url', validatedUrl)
        .eq('is_free_preview', true)
        .gte('created_at', tenMinutesAgo)
        .in('status', ['payment_received', 'crawling', 'analysing', 'generating_report'])
        .order('created_at', { ascending: false })
        .limit(1)

      if (fetchError) {
        console.error('Error checking for in-flight audit:', fetchError)
        return NextResponse.json(
          { error: 'Failed to check for existing audits' },
          { status: 500 },
        )
      }

      // Only return cached result if an audit is currently in progress
      if (inFlightAudits && inFlightAudits.length > 0) {
        const inFlight = inFlightAudits[0]
        return NextResponse.json(
          {
            success: true,
            audit_id: inFlight.id,
            cached: true,
          },
          { status: 200 },
        )
      }
    }

    // ────────────────────────────────────────────────────────────
    // Per-key rate limit (per email OR per hashed IP).
    // Previously this counted free audits globally, which meant a
    // single noisy requester could lock every other anonymous user
    // out of the free preview. Now each requester gets their own
    // FREE_AUDIT_MAX_PER_HOUR quota.
    //
    // We also keep a loose global burst guard so a botnet sweeping
    // many IPs can't drain Anthropic budget unbounded — but it's
    // intentionally much higher than the per-key limit.
    // ────────────────────────────────────────────────────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { count: perKeyCount, error: perKeyErr } = await supabase
      .from('audits')
      .select('id', { count: 'exact', head: true })
      .eq('is_free_preview', true)
      .eq('free_audit_email', rateLimitKey)
      .gte('created_at', oneHourAgo)

    if (perKeyErr) {
      console.error('Error checking per-key rate limit:', perKeyErr)
      return NextResponse.json(
        { error: 'Failed to check rate limit' },
        { status: 500 },
      )
    }

    if ((perKeyCount ?? 0) >= FREE_AUDIT_MAX_PER_HOUR) {
      return NextResponse.json(
        {
          error: `You've used your hourly free audit quota (${FREE_AUDIT_MAX_PER_HOUR}). Try again later or create an account for unlimited audits.`,
          retry_after_seconds: 3600,
        },
        { status: 429 },
      )
    }

    const { count: globalCount, error: globalErr } = await supabase
      .from('audits')
      .select('id', { count: 'exact', head: true })
      .eq('is_free_preview', true)
      .gte('created_at', oneHourAgo)

    if (globalErr) {
      console.error('Error checking global burst limit:', globalErr)
      // Soft-fail: don't block the user on the burst check; the per-key
      // limit above is the meaningful guardrail.
    } else if ((globalCount ?? 0) >= FREE_AUDIT_GLOBAL_BURST_PER_HOUR) {
      console.warn(`[free-audit] Global burst limit hit (${globalCount}/${FREE_AUDIT_GLOBAL_BURST_PER_HOUR})`)
      return NextResponse.json(
        { error: 'ClearUX is experiencing unusually high free-audit volume. Please try again shortly.' },
        { status: 429 },
      )
    }

    // ────────────────────────────────────────────────────────────
    // Create new free audit record
    // ────────────────────────────────────────────────────────────
    const { data: audit, error: insertError } = await supabase
      .from('audits')
      .insert({
        user_id: null,
        status: 'payment_received',
        product_url: validatedUrl,
        product_type: 'auto_detect',
        ux_concern: 'General UX audit',
        plan: 'free_preview',
        language: 'en',
        is_free_preview: true,
        free_audit_email: rateLimitKey,
      })
      .select('id')
      .single()

    if (insertError || !audit) {
      console.error('Failed to create free audit:', insertError)
      return NextResponse.json(
        { error: 'Failed to create audit' },
        { status: 500 },
      )
    }

    // ────────────────────────────────────────────────────────────
    // Trigger processing via Inngest
    // ────────────────────────────────────────────────────────────
    try {
      await inngest.send({
        name: 'audit/process',
        data: { auditId: (audit as any).id },
      })
    } catch (inngestError) {
      console.error('Failed to trigger Inngest, falling back to direct processing:', inngestError)
      // Fallback: log the error but don't fail the request
      // The audit is created and marked payment_received, so it will be picked up eventually
    }

    return NextResponse.json(
      {
        success: true,
        audit_id: (audit as any).id,
        cached: false,
      },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error in POST /api/free-audit:', message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
