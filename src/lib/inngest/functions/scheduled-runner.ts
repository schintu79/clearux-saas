// ============================================================
// Fixpath — Scheduled monitoring runner (Phase 2 #1)
// ============================================================
// Finds brands whose monitoring schedule is due and triggers a standard
// re-audit for each. Triggered by a daily Vercel cron (/api/cron/scheduled-
// audits), mirroring the stall-sweeper pattern.
//
// CREDIT MODEL: monitoring runs are an INCLUDED paid-plan perk — they must
// NOT consume audit credits. We achieve that simply by creating the audit
// row WITHOUT a `payments` record: nothing is deducted (deduction happens at
// manual audit-start, which we skip), and refundCredit() is a no-op when no
// payment row exists, so a failed monitoring run can't mint a free credit.
//
// IDEMPOTENT + NO LOST CYCLES (2026-06-15): next_run_at is rolled forward after
// the skip checks but BEFORE dispatch. A double cron fire still can't
// double-trigger a brand, AND a run skipped because another audit is already in
// progress is NOT lost — it retries on the next cron tick instead of waiting a
// full cadence. Only a committed run (audit row created) advances the schedule.
// ============================================================

import { createServiceSupabase } from '@/lib/supabase-server'
import { inngest } from '@/lib/inngest/client'

function nextRunFrom(frequency: string): string {
  const now = new Date()
  switch (frequency) {
    case 'weekly': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    case 'monthly': return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString()
    default: return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString()
  }
}

const IN_PROGRESS = ['pending_payment', 'payment_received', 'crawling', 'analysing', 'generating_report', 'stalled']

export async function runScheduledMonitoring(): Promise<{ checked: number; triggered: number; skipped: number }> {
  const db = createServiceSupabase()
  const nowIso = new Date().toISOString()

  const { data: due } = await db
    .from('scheduled_audits')
    .select('id, user_id, workspace_id, product_url, frequency, language')
    .eq('is_active', true)
    .lte('next_run_at', nowIso)
    .limit(50)

  const rows = (due || []) as any[]
  let triggered = 0
  let skipped = 0

  for (const s of rows) {
    // Skip archived/deleted workspaces (product rule: deleted workspaces must
    // not influence live processing).
    if (s.workspace_id) {
      const { data: ws } = await db.from('workspaces').select('status').eq('id', s.workspace_id).single()
      if (!ws || (ws as any).status !== 'active') { skipped++; continue }
    }

    // Skip if an audit for this brand is already running — don't pile up.
    let inProgQ = db.from('audits').select('id')
      .eq('user_id', s.user_id)
      .eq('product_url', s.product_url)
      .in('status', IN_PROGRESS)
      .is('deleted_at', null)
    inProgQ = s.workspace_id ? inProgQ.eq('workspace_id', s.workspace_id) : inProgQ
    const { data: inProg } = await inProgQ.limit(1)
    if (inProg && inProg.length > 0) { skipped++; continue }

    // Mirror the brand + module selection from the most recent audit so the
    // monitoring run matches the user's setup (and attaches Brand DNA).
    let prevQ = db.from('audits')
      .select('brand_identity_id, selected_modules')
      .eq('user_id', s.user_id)
      .eq('product_url', s.product_url)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    prevQ = s.workspace_id ? prevQ.eq('workspace_id', s.workspace_id) : prevQ
    const { data: prev } = await prevQ.limit(1).maybeSingle()

    // Insert the monitoring audit — NO payment row (credit-free by design).
    const { data: audit, error } = await db.from('audits').insert({
      user_id: s.user_id,
      workspace_id: s.workspace_id || null,
      product_url: s.product_url,
      audit_type: 'website',
      product_type: 'auto_detect',
      ux_concern: 'Scheduled monitoring re-audit',
      plan: 'full_audit',
      language: s.language || 'en',
      depth_mode: 'standard',
      status: 'payment_received',
      progress_percent: 1,
      audit_stage: 'preflight',
      brand_identity_id: (prev as any)?.brand_identity_id || null,
      selected_modules: (prev as any)?.selected_modules || null,
    } as any).select('id').single()

    if (error || !audit) {
      console.error(`[scheduled-runner] Failed to create monitoring audit for schedule ${s.id}:`, error?.message)
      skipped++
      continue
    }

    // Commit the schedule forward now that the audit row exists — BEFORE
    // dispatch (idempotent vs. a double cron fire), and only AFTER the skip
    // checks (a run skipped for an in-progress audit retries next tick instead
    // of losing a whole cadence).
    await db.from('scheduled_audits')
      .update({ last_run_at: nowIso, next_run_at: nextRunFrom(s.frequency), updated_at: nowIso } as any)
      .eq('id', s.id)

    try {
      await inngest.send({ name: 'audit/process', data: { auditId: (audit as any).id } })
      triggered++
    } catch (err) {
      console.error(`[scheduled-runner] Failed to dispatch monitoring audit ${(audit as any).id}:`, err)
      skipped++
    }
  }

  return { checked: rows.length, triggered, skipped }
}
