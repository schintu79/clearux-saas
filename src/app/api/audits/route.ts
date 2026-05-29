// ============================================================
// ClearUX API — POST /api/audits
// Create a new audit and initiate payment flow
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase-server'
import { createServiceSupabase } from '@/lib/supabase-server'

// Validation schema
const createAuditSchema = z.object({
  product_url: z.string().url('Invalid URL'),
  product_type: z.string().min(1, 'Product type is required'),
  target_user: z.string().optional().nullable(),
  ux_concern: z.string().min(10, 'Please describe your main UX concern'),
  notes: z.string().optional().nullable(),
  plan: z.enum(['starter', 'deep_dive'], {
    errorMap: () => ({ message: 'Plan must be starter or deep_dive' }),
  }),
  workspace_id: z.string().uuid().optional().nullable(),
})

type CreateAuditRequest = z.infer<typeof createAuditSchema>

/**
 * POST /api/audits
 * Create a new audit
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = createAuditSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 },
      )
    }

    const {
      product_url,
      product_type,
      target_user,
      ux_concern,
      notes,
      plan,
      workspace_id,
    }: CreateAuditRequest = validationResult.data

    // Auto-link existing brand identity by matching hostname
    let brandIdentityId: string | null = null
    try {
      const host = new URL(product_url).hostname.replace(/^www\./, '')
      const db = createServiceSupabase()
      const { data: brands } = await db
        .from('brand_identities')
        .select('id, website_url')
        .eq('user_id', user.id)
        .is('deleted_at', null)
      if (brands) {
        const match = brands.find((b: any) => {
          if (!b.website_url) return false
          try {
            const bHost = new URL(b.website_url).hostname.replace(/^www\./, '')
            return bHost === host
          } catch { return false }
        })
        if (match) brandIdentityId = match.id
      }
    } catch {
      // URL parsing or DB lookup failure — proceed without brand linkage
    }

    // Create audit in database
    // @ts-ignore Supabase type inference issue with Partial types
    const { data: audit, error: insertError } = await supabase
      .from('audits')
      // @ts-ignore Supabase type inference issue with Partial types
      .insert({
        user_id: user.id,
        status: 'pending_payment',
        product_url,
        product_type,
        target_user: target_user || null,
        ux_concern,
        notes: notes || null,
        plan,
        progress_percent: 0,
        ...(brandIdentityId ? { brand_identity_id: brandIdentityId } : {}),
        ...(workspace_id ? { workspace_id } : {}),
      })
      .select()
      .single()

    if (insertError || !audit) {
      console.error('Failed to insert audit:', insertError)
      return NextResponse.json(
        { error: 'Failed to create audit' },
        { status: 500 },
      )
    }

    // Return audit ID and redirect URL for Stripe checkout
    // @ts-ignore Supabase type inference issue with generics
    const checkoutUrl = `/api/stripe/checkout?audit_id=${(audit as any).id}`

    return NextResponse.json(
      {
        // @ts-ignore Supabase type inference issue with generics
        audit_id: (audit as any).id,
        redirect_url: checkoutUrl,
      },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error in POST /api/audits:', message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

/**
 * GET /api/audits
 * List user's audits
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's audits with report summaries
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')

    let query = supabase
      .from('audits')
      .select(
        `
        id,
        status,
        product_url,
        product_type,
        created_at,
        completed_at,
        reports!left(overall_score, total_issues, critical_count),
        payments!left(status)
      `,
      )
      .eq('user_id', user.id)
      .is('deleted_at', null)

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId)
    }

    const { data: audits, error: fetchError } = await query
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Failed to fetch audits:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch audits' },
        { status: 500 },
      )
    }

    return NextResponse.json({ audits }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error in GET /api/audits:', message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
