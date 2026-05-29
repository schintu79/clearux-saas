// ============================================================
// Fixpath API — POST /api/ai-models/refresh
// OpenRouter is currently disabled — all AI routes through Claude.
// This endpoint returns a stub response. Re-enable by uncommenting
// the OpenRouter logic below when needed.
// ============================================================

import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function POST() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // OpenRouter is currently disabled — all AI goes through Claude direct
  return NextResponse.json({
    ok: true,
    modelsCount: 0,
    models: [],
    message: 'OpenRouter is currently disabled. All AI calls route through Claude.',
  })
}
