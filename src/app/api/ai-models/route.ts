// ============================================================
// Fixpath API — GET/POST /api/ai-models
// GET: Returns the model catalog + user's settings
// POST: Updates user's model settings
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { DEFAULT_MODEL_CATALOG } from '@/lib/ai/model-catalog'
import type { AIModelSetting } from '@/lib/ai/types'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceSupabase()

  // Fetch user's model settings
  const { data: settings } = await db
    .from('ai_model_settings')
    .select('*')
    .eq('user_id', user.id)

  // Build merged response: catalog + user overrides
  const settingsMap = new Map(
    (settings || []).map((s: any) => [s.model_slug, s]),
  )

  const models = DEFAULT_MODEL_CATALOG.map((model) => {
    const userSetting = settingsMap.get(model.slug) as any | undefined
    return {
      slug: model.slug,
      displayName: model.displayName,
      provider: model.provider,
      shortId: model.shortId,
      supportsTools: model.supportsTools,
      supportsStructuredOutput: model.supportsStructuredOutput,
      supportsVision: model.supportsVision,
      defaultEnabled: model.defaultEnabled,
      priorityOrder: model.priorityOrder,
      features: model.features,
      // User settings (fall back to defaults)
      enabled: userSetting ? userSetting.enabled : model.defaultEnabled,
      useForCompetitors: userSetting ? userSetting.use_for_competitors : model.features.competitors,
      useForVoice: userSetting ? userSetting.use_for_voice : model.features.voice,
      useForAnswers: userSetting ? userSetting.use_for_answers : model.features.answers,
      useForReports: userSetting ? userSetting.use_for_reports : model.features.reports,
    }
  })

  return NextResponse.json({ models })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as { settings: AIModelSetting[] }
  if (!body.settings || !Array.isArray(body.settings)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const db = createServiceSupabase()

  // Upsert each setting
  for (const setting of body.settings) {
    await db.from('ai_model_settings').upsert(
      {
        user_id: user.id,
        workspace_id: null,
        model_slug: setting.model_slug,
        enabled: setting.enabled,
        use_for_competitors: setting.use_for_competitors,
        use_for_voice: setting.use_for_voice,
        use_for_answers: setting.use_for_answers,
        use_for_reports: setting.use_for_reports,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: 'user_id,workspace_id,model_slug' },
    )
  }

  return NextResponse.json({ ok: true })
}
