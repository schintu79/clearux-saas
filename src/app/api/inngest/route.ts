// ============================================================
// ClearUX API — Inngest Webhook Handler
// Serves all Inngest functions. Inngest calls this endpoint
// to execute each step of a background job.
// ============================================================

import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { processAuditFn } from '@/lib/inngest/functions/process-audit'
import { processBrandAuditFn } from '@/lib/inngest/functions/process-brand-audit'
import { stallSweeperFn } from '@/lib/inngest/functions/stall-sweeper'

// Each Inngest step runs as a separate serverless invocation.
// Give it the maximum time on Vercel Pro (300s).
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processAuditFn, processBrandAuditFn, stallSweeperFn],
})
