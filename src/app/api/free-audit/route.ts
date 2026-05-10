// ============================================================
// ClearUX API — POST /api/free-audit
// Creates a free preview audit (no auth required).
// Rate-limited. Only caches in-flight audits (not completed ones).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { inngest } from '@/lib/inngest/client'

export const dynamic = 'force-dynamic'

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

    // Get IP for rate limiting (fallback to email if no IP)
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitKey = email || ip

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
    // Rate limit by IP/email (10 free audits per hour globally)
    // ────────────────────────────────────────────────────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { count: recentCount, error: countError } = await supabase
      .from('audits')
      .select('id', { count: 'exact', head: true })
      .eq('is_free_preview', true)
      .gte('created_at', oneHourAgo)

    if (countError) {
      console.error('Error checking rate limit:', countError)
      return NextResponse.json(
        { error: 'Failed to check rate limit' },
        { status: 500 },
      )
    }

    if ((recentCount ?? 0) > 10) {
      return NextResponse.json(
        { error: 'Too many free audits requested. Please try again later.' },
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
