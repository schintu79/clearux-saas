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
import { refreshQuestionShortlistsFn } from '@/lib/inngest/functions/refresh-question-shortlists'

// REALITY CHECK (2026-06-10): Inngest v4 executes MANY steps inside ONE
// invocation — the run that died at 09:34:52 lived exactly 300.9s from
// pipeline_started. The whole pipeline must fit in a single invocation's
// budget, which is why deep audits (~5.5 min) died at 82/89% and the git
// history is full of "stall at X%" fixes. Two mitigations:
//  1. maxDuration 800 (Vercel Pro max)
//  2. streaming: true — the SDK streams the response back to Inngest,
//     which Vercel treats as a streaming function with an extended
//     execution window ("circumvent restrictive request timeouts").
// Rollback if the Inngest handshake misbehaves: streaming: false, 300.
export const maxDuration = 800

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processAuditFn, processBrandAuditFn, stallSweeperFn, refreshQuestionShortlistsFn],
  streaming: true,
})
