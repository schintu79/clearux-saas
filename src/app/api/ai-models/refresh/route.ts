// ============================================================
// Fixpath API — POST /api/ai-models/refresh
// Fetches models from OpenRouter API and returns the list.
// Does NOT modify the local catalog (that's static for now).
// ============================================================

import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { fetchOpenRouterModels, isOpenRouterConfigured } from '@/lib/ai/openrouter-client'

export async function POST() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      { error: 'OpenRouter API key not configured' },
      { status: 503 },
    )
  }

  try {
    const models = await fetchOpenRouterModels()
    return NextResponse.json({
      ok: true,
      modelsCount: models.length,
      models: models.slice(0, 50), // Return first 50 for display
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
