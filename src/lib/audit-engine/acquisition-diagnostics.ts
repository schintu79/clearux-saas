/**
 * Acquisition Diagnostics — Structured Observability for Page Acquisition
 *
 * Records every fetch attempt, fallback decision, and timing
 * for a single audit run. Written to audit_logs.metadata as JSONB.
 *
 * Part of the Protected Site Audit Mode feature.
 * See docs/protected-site-audit-mode.md for architecture details.
 */

import type {
  AcquisitionMethod,
  AcquisitionState,
  AcquisitionAttempt,
} from './normalized-page'

// ── Types ─────────────────────────────────────────────────────

export interface AcquisitionDiagnosticEntry {
  timestamp: string
  type: 'attempt' | 'decision' | 'error' | 'summary'
  url?: string
  method?: AcquisitionMethod
  message: string
  durationMs?: number
  metadata?: Record<string, unknown>
}

export interface AcquisitionDiagnostics {
  auditId: string
  startedAt: string
  completedAt: string | null
  entries: AcquisitionDiagnosticEntry[]
  /** Total time spent on acquisition in ms */
  totalDurationMs: number
  /** Final state determined */
  finalState: AcquisitionState | null
}

// ── Diagnostic logger ─────────────────────────────────────────

/**
 * Accumulates diagnostic entries during an acquisition run.
 * Call flush() at the end to get the complete diagnostics object.
 */
export class AcquisitionDiagnosticLogger {
  private entries: AcquisitionDiagnosticEntry[] = []
  private startTime: number
  private auditId: string

  constructor(auditId: string) {
    this.auditId = auditId
    this.startTime = Date.now()
  }

  /**
   * Record a fetch attempt for a specific URL and method.
   */
  logAttempt(
    url: string,
    attempt: AcquisitionAttempt,
  ): void {
    this.entries.push({
      timestamp: new Date().toISOString(),
      type: 'attempt',
      url,
      method: attempt.method,
      message: attempt.succeeded
        ? `${attempt.method} succeeded for ${url} (${attempt.durationMs}ms)`
        : `${attempt.method} failed for ${url}: ${attempt.failReason ?? 'unknown'}`,
      durationMs: attempt.durationMs,
      metadata: {
        succeeded: attempt.succeeded,
        failReason: attempt.failReason,
      },
    })
  }

  /**
   * Record a pipeline-level decision (e.g., "escalating to browser render").
   */
  logDecision(
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.entries.push({
      timestamp: new Date().toISOString(),
      type: 'decision',
      message,
      metadata,
    })
  }

  /**
   * Record an error that occurred during acquisition.
   */
  logError(
    message: string,
    url?: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.entries.push({
      timestamp: new Date().toISOString(),
      type: 'error',
      url,
      message,
      metadata,
    })
  }

  /**
   * Record a summary observation (e.g., "3/10 pages blocked").
   */
  logSummary(
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.entries.push({
      timestamp: new Date().toISOString(),
      type: 'summary',
      message,
      metadata,
    })
  }

  /**
   * Finalize the diagnostics and return the complete object.
   */
  flush(finalState: AcquisitionState | null = null): AcquisitionDiagnostics {
    return {
      auditId: this.auditId,
      startedAt: new Date(this.startTime).toISOString(),
      completedAt: new Date().toISOString(),
      entries: this.entries,
      totalDurationMs: Date.now() - this.startTime,
      finalState,
    }
  }

  /**
   * Get the number of entries logged so far.
   */
  get entryCount(): number {
    return this.entries.length
  }
}

// ── Formatting for audit_logs ─────────────────────────────────

/**
 * Format diagnostics into a concise human-readable string for
 * the audit_logs.message column (max ~500 chars).
 */
export function formatDiagnosticsMessage(diag: AcquisitionDiagnostics): string {
  const attempts = diag.entries.filter(e => e.type === 'attempt')
  const succeeded = attempts.filter(e => e.metadata?.succeeded)
  const failed = attempts.filter(e => !e.metadata?.succeeded)
  const decisions = diag.entries.filter(e => e.type === 'decision')

  const parts: string[] = []
  parts.push(`Acquisition: ${diag.finalState ?? 'unknown'} state`)
  parts.push(`${succeeded.length}/${attempts.length} fetch attempts succeeded`)
  if (failed.length > 0) {
    const reasons = [...new Set(failed.map(e => e.metadata?.failReason as string).filter(Boolean))]
    parts.push(`Failures: ${reasons.join(', ')}`)
  }
  if (decisions.length > 0) {
    parts.push(`${decisions.length} escalation decision(s)`)
  }
  parts.push(`Total: ${diag.totalDurationMs}ms`)

  return parts.join('. ')
}
