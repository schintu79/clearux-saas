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
    if (!domain || domain.length < 3) {
      return NextResponse.json({ hasExisting: false })
    }

    const { count } = await supabase
      .from('audits')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .eq('audit_type', 'website')
      .ilike('url', `%${domain}%`)

    return NextResponse.json({ hasExisting: (count ?? 0) > 0 })
  } catch {
    return NextResponse.json({ hasExisting: false })
  }
}
