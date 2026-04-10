// ============================================================
// ClearUX API — Inngest Webhook Handler
// Serves all Inngest functions. Inngest calls this endpoint
// to execute each step of a background job.
// ============================================================

import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { processAuditFn } from '@/lib/inngest/functions/process-audit'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processAuditFn],
})
