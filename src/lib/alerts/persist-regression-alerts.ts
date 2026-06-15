// ============================================================
// Fixpath — Persist Regression Alerts (Phase 2 #2)
// ============================================================
// Thin DB bridge over the pure detectRegressions() detector: compute the
// regressions for a completed monitoring run and write them to audit_alerts
// (per-user/workspace). Email delivery is layered on top by the caller.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  detectRegressions,
  type AlertFinding,
  type BenchmarkVerdict,
  type RegressionAlert,
} from '@/lib/audit-engine/pipeline/regression-alerts'

export interface RegressionAlertContext {
  userId: string
  workspaceId: string | null
  auditId: string
  productUrl: string | null
  previousScore: number | null
  currentScore: number
  previousFindings: AlertFinding[]
  currentFindings: AlertFinding[]
  previousVerdicts?: BenchmarkVerdict[]
  currentVerdicts?: BenchmarkVerdict[]
}

export async function persistRegressionAlerts(
  db: SupabaseClient,
  ctx: RegressionAlertContext,
): Promise<{ created: number; alerts: RegressionAlert[] }> {
  const alerts = detectRegressions({
    previousScore: ctx.previousScore,
    currentScore: ctx.currentScore,
    previousFindings: ctx.previousFindings,
    currentFindings: ctx.currentFindings,
    previousVerdicts: ctx.previousVerdicts,
    currentVerdicts: ctx.currentVerdicts,
  })
  if (alerts.length === 0) return { created: 0, alerts: [] }

  const rows = alerts.map((a) => ({
    user_id: ctx.userId,
    workspace_id: ctx.workspaceId,
    audit_id: ctx.auditId,
    product_url: ctx.productUrl,
    type: a.type,
    level: a.level,
    title: a.title,
    body: a.body,
    meta: a.meta,
  }))

  // Checked insert — supabase-js never throws; a swallowed error would silently
  // drop the alert (the repo's #1 failure pattern).
  const { error } = await db.from('audit_alerts').insert(rows as any)
  if (error) {
    console.error(`[regression-alerts] audit_alerts insert failed: ${error.message}`)
    return { created: 0, alerts }
  }
  return { created: rows.length, alerts }
}
