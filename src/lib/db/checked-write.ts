// ============================================================
// Generic checked DB writes (Plan §0.4)
// ============================================================
// supabase-js NEVER throws on write failure — it returns { error }.
// A repo sweep (2026-06-12) found 54 of 81 .insert() sites ignoring
// that return value, including all three non-webhook payment writes.
// Every silent-data-loss incident this month was this one disease.
//
// Use insertChecked() for any new insert. It:
//   1. applies the insert contract (strips+reports unknown keys) when
//      the table has one — the viewport-class net
//   2. checks the error and logs it loudly with full PostgREST detail
//   3. optionally records an audit_logs row so failures are visible
//      in the product, not just in Vercel logs

import { filterRowsToContract, INSERT_CONTRACTS, type ContractTable } from './insert-contracts'

type AnyDb = {
  from: (table: string) => {
    insert: (rows: unknown) => PromiseLike<{ error: { message: string; code?: string; details?: string } | null }>
  }
}

export interface InsertCheckedResult {
  ok: boolean
  saved: number
  errorMessage?: string
}

export async function insertChecked(
  db: AnyDb,
  table: string,
  rowOrRows: Record<string, unknown> | Array<Record<string, unknown>>,
  ctx: {
    /** Where this write happens, e.g. 'stripe-verify payment record' */
    label: string
    /** When set, a failure is also recorded in audit_logs (best-effort) */
    auditId?: string | null
  },
): Promise<InsertCheckedResult> {
  let rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
  if (rows.length === 0) return { ok: true, saved: 0 }

  if (table in INSERT_CONTRACTS) {
    const { rows: filtered, unknownKeys } = filterRowsToContract(table as ContractTable, rows)
    if (unknownKeys.length > 0) {
      console.error(`[db] SCHEMA DRIFT (${table}, ${ctx.label}): stripped unknown key(s) ${unknownKeys.join(', ')} — add migration + snapshot + contract in one commit`)
    }
    rows = filtered
  }

  const { error } = await db.from(table).insert(rows)
  if (error) {
    console.error(`[db] INSERT FAILED (${table}, ${ctx.label}): ${error.message}`, {
      code: error.code, details: error.details, rowCount: rows.length, auditId: ctx.auditId ?? undefined,
    })
    if (ctx.auditId) {
      // Best-effort visibility in the product. Never let the log write
      // mask the original failure.
      try {
        await db.from('audit_logs').insert([{
          audit_id: ctx.auditId,
          event: 'db_write_failed',
          status: 'error',
          message: `${ctx.label}: failed to save ${rows.length} row(s) to ${table} — ${error.message}`,
          metadata: { table, label: ctx.label, row_count: rows.length, db_error: error.message },
        }])
      } catch { /* noop */ }
    }
    return { ok: false, saved: 0, errorMessage: error.message }
  }
  return { ok: true, saved: rows.length }
}

/**
 * For fire-and-forget log/telemetry writes: checks the error and
 * console.errors it, nothing else. Failure of a log line must never
 * fail the flow — but it must never be invisible either.
 */
export async function insertLogged(
  db: AnyDb,
  table: string,
  rowOrRows: Record<string, unknown> | Array<Record<string, unknown>>,
  label: string,
): Promise<void> {
  try {
    const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
    const { error } = await db.from(table).insert(rows)
    if (error) console.error(`[db] LOG INSERT FAILED (${table}, ${label}): ${error.message}`)
  } catch (e) {
    console.error(`[db] LOG INSERT THREW (${table}, ${label}):`, e)
  }
}
