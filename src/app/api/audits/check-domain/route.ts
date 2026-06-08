// ============================================================
// GET /api/audits/check-domain?domain=example.com
// Returns whether the user has a completed audit for this domain
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ hasExisting: false })
    }

    const domain = request.nextUrl.searchParams.get('domain')?.trim()
    const workspaceId = request.nextUrl.searchParams.get('workspace_id')?.trim()
    if (!domain || domain.length < 3) {
      return NextResponse.json({ hasExisting: false })
    }

    let q = supabase
      .from('audits')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .eq('audit_type', 'website')
      .ilike('product_url', `%${domain}%`)
      .is('deleted_at', null)
    if (workspaceId) q = q.eq('workspace_id', workspaceId)

    const { count } = await q
    return NextResponse.json({ hasExisting: (count ?? 0) > 0 })
  } catch {
    return NextResponse.json({ hasExisting: false })
  }
}
