/**
 * Shared credit refund logic.
 *
 * Used by:
 *  - process-audit.ts (onFailure, outer catch, finally safety net)
 *  - stall-sweeper.ts (external cron recovery)
 *
 * Extracted here so every recovery path refunds consistently.
 */

import { createServiceSupabase } from '@/lib/supabase-server'

/**
 * Refund the credit used to pay for an audit.
 * Only refunds credit-based and free-first payments (not Stripe payments).
 * Safe to call multiple times — worst case is a double-refund which is
 * preferable to the user losing a credit.
 */
export async function refundCredit(auditId: string): Promise<void> {
  try {
    const db = createServiceSupabase()

    // Find the payment record for this audit
    const { data: payment } = await db
      .from('payments')
      .select('user_id, stripe_payment_intent_id')
      .eq('audit_id', auditId)
      .single()

    if (!payment) return // No payment to refund (e.g., free first audit)

    const paymentId = (payment as any).stripe_payment_intent_id as string
    const userId = (payment as any).user_id as string

    // Only refund credit-based or free-first payments (not Stripe payments)
    if (paymentId.startsWith('credit_') || paymentId.startsWith('free_first_')) {
      if (paymentId.startsWith('credit_')) {
        // Add credit back
        const { data: profile } = await db
          .from('profiles')
          .select('credits')
          .eq('id', userId)
          .single()

        const currentCredits = (profile as any)?.credits ?? 0
        await db
          .from('profiles')
          .update({ credits: currentCredits + 1, updated_at: new Date().toISOString() } as any)
          .eq('id', userId)
      }

      // Log the refund
      try {
        await db.from('audit_logs').insert({
          audit_id: auditId,
          event: 'credit_refunded',
          status: 'success',
          message: paymentId.startsWith('free_first_')
            ? 'Free first audit — no credit to refund'
            : '1 credit refunded to user',
          metadata: {},
        } as any)
      } catch {
        // Log is non-critical
      }
    }
  } catch (err) {
    console.error('[refund-credit] Refund error (non-fatal):', err)
  }
}
