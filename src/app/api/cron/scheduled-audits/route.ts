// ============================================================
// Fixpath — Scheduled monitoring trigger (Vercel Cron, Phase 2 #1)
// ============================================================
// Runs daily; triggers a standard re-audit for every brand whose monitoring
// schedule is due (is_active && next_run_at <= now). Idempotent — see
// runScheduledMonitoring(). Auth via CRON_SECRET, same as stall-sweep.
// ============================================================

import { NextResponse } from 'next/server'
import { runScheduledMonitoring } from '@/lib/inngest/functions/scheduled-runner'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runScheduledMonitoring()
    return NextResponse.json({ ok: true, source: 'vercel-cron', ...result })
  } catch (err) {
    console.error('[cron/scheduled-audits] run failed:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
