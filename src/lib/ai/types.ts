// ============================================================
// Fixpath AI Gateway — Shared Types
// ============================================================

export interface AIModelSetting {
  model_slug: string
  enabled: boolean
  use_for_competitors: boolean
  use_for_voice: boolean
  use_for_answers: boolean
  use_for_reports: boolean
}

/** DB table shape for ai_model_catalog */
export interface AIModelCatalogRow {
  id: string
  slug: string
  display_name: string
  provider: string
  short_id: string
  supports_tools: boolean
  supports_structured_output: boolean
  supports_vision: boolean
  default_enabled: boolean
  priority_order: number
  features: Record<string, boolean>
  created_at: string
  updated_at: string
}

/** DB table shape for ai_model_settings (per-user or per-workspace) */
export interface AIModelSettingsRow {
  id: string
  user_id: string
  workspace_id: string | null
  model_slug: string
  enabled: boolean
  use_for_competitors: boolean
  use_for_voice: boolean
  use_for_answers: boolean
  use_for_reports: boolean
  created_at: string
  updated_at: string
}
