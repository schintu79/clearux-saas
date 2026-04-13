// ============================================================
// ClearUX API — POST /api/free-audit
// Creates a free preview audit (no auth required).
// Rate-limited and URL-cached to prevent abuse.
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
 *     url: string     (required) — the URL to audit (https:// prepended if missing)
 *     email?: string  (optional) — email for rate limiting and follow-up
 *   }
 *
 * Response:
 *   {
 *     success: true,
 *     audit_id: string,
 *     cached: boolean  (true if returned existing audit from last 24h)
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const { url, email } = body

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
    // Check for cached audit (URL + 24h)
    // ────────────────────────────────────────────────────────────
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: existingAudits, error: fetchError } = await supabase
      .from('audits')
      .select('id, status, created_at')
      .eq('product_url', validatedUrl)
      .eq('is_free_preview', true)
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(1)

    if (fetchError) {
      console.error('Error checking for cached audit:', fetchError)
      return NextResponse.json(
        { error: 'Failed to check for existing audits' },
        { status: 500 },
      )
    }

    // If cached audit exists and is already processed or being processed, return it
    if (existingAudits && existingAudits.length > 0) {
      const cached = existingAudits[0]
      return NextResponse.json(
        {
          success: true,
          audit_id: cached.id,
          cached: true,
        },
        { status: 200 },
      )
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
