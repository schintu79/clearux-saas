// ============================================================
// Fixpath — Stall Sweeper (Vercel Cron backup trigger)
// ============================================================
// Added 2026-06-10. The Inngest cron for audit-stall-sweeper
// silently stopped firing: on June 9 audits sat in non-terminal
// states for 49+ minutes (hard ceiling is 20) with zero sweeper
// runs in the Inngest dashboard. This route gives the sweep a
// second, independent trigger via Vercel Cron (vercel.json).
//
// The sweep itself is idempotent — if both Inngest and Vercel
// crons fire, the second pass finds nothing to do.
//
// Security: when CRON_SECRET is set in env, Vercel sends
// Authorization: Bearer <CRON_SECRET> and we enforce it.
// The sweep only moves stuck audits to terminal states and never
// touches ownership fields (workspace_id/user_id) — compliant
// with the "no public route may repair ownership" product rule.
// ============================================================

import { NextResponse } from 'next/server'
import { runStallSweep } from '@/lib/inngest/functions/stall-sweeper'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runStallSweep()
    return NextResponse.json({ ok: true, source: 'vercel-cron', ...result })
  } catch (err) {
    console.error('[cron/stall-sweep] Sweep failed:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
