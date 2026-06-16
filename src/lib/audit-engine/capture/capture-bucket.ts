// ============================================================
// Capture→Analyze→Compose — Phase 2: read analysis input from the capture
// ============================================================
// The bridge that lets ANY analyzer be fed from an immutable PageCapture instead
// of live crawl output. Phase 2 goal (AUDIT_PIPELINE_ARCHITECTURE.md §10):
// "Analyzer input = PageCapture, not crawlResult.pageContent directly."
//
// `captureToPageContent` reproduces the EXACT block format the analyzer already
// consumes (URL: / Title: / H1: / Meta Description: / Content:, joined by
// `\n---\n`) — so an analyzer reads identically whether fed live or from a
// stored capture. This is what makes analysis re-runnable with no re-crawl.
//
// Additive + offline: nothing here is wired into the live pipeline yet.
// ============================================================

/** A capture row as analysis consumes it (subset of public.page_captures). */
export interface CaptureBucketPage {
  page_url: string
  page_status?: string | null
  title?: string | null
  h1?: string | null
  meta?: { description?: string | null; canonical?: string | null; viewport?: string | null } | null
  extracted_text?: string | null
}

/** Capture lifecycle states whose evidence is usable for analysis. */
const ANALYZABLE_STATES = new Set(['complete', 'partial'])

/** Keep only captures with enough evidence to analyze (skip failed/empty). */
export function analyzableCaptures(captures: CaptureBucketPage[]): CaptureBucketPage[] {
  return (captures || []).filter(
    (c) =>
      c &&
      typeof c.page_url === 'string' &&
      c.page_url.length > 0 &&
      (c.page_status == null || ANALYZABLE_STATES.has(c.page_status)) &&
      !!(c.extracted_text && c.extracted_text.trim().length > 0),
  )
}

/**
 * PURE: build the analyzer's page-content input from capture rows, byte-identical
 * in shape to the live pipeline's `pageContent` (process-audit.ts ~L1459).
 * One block per analyzable page; blocks joined by `\n---\n`.
 */
export function captureToPageContent(captures: CaptureBucketPage[]): string {
  return analyzableCaptures(captures)
    .map((c) => {
      let block = ''
      block += `URL: ${c.page_url}\n`
      if (c.title) block += `Title: ${c.title}\n`
      if (c.h1) block += `H1: ${c.h1}\n`
      const desc = c.meta?.description
      if (desc) block += `Meta Description: ${desc}\n`
      if (c.extracted_text) block += `Content:\n${c.extracted_text}\n`
      return block
    })
    .join('\n---\n')
}

type AnyDb = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>
    }
  }
}

export interface LoadCaptureResult {
  ok: boolean
  pages: CaptureBucketPage[]
  errorMessage?: string
}

/**
 * Load the capture bucket for an audit. Thin DB read — the analysis-shaping
 * logic lives in the pure functions above so it is fully testable.
 */
export async function loadCaptureBucket(db: AnyDb, auditId: string): Promise<LoadCaptureResult> {
  const { data, error } = await db
    .from('page_captures')
    .select('page_url, page_status, title, h1, meta, extracted_text')
    .eq('audit_id', auditId)
  if (error) return { ok: false, pages: [], errorMessage: error.message }
  return { ok: true, pages: (data as CaptureBucketPage[]) || [] }
}
