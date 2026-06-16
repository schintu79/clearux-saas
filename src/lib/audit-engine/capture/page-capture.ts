// ============================================================
// Capture→Analyze→Compose — Phase 1: PageCapture writer (SHADOW MODE)
// ============================================================
// Builds and persists the immutable per-page capture artifact ALONGSIDE the
// current pipeline. Nothing reads it yet (shadow). Behind FEATURE_CAPTURE_SHADOW,
// paid audits only, and wired non-fatally so it can NEVER affect an audit.
//
// Architecture: docs/AUDIT_PIPELINE_ARCHITECTURE.md
//   • This holds NORMALIZED deterministic structure + blob KEYS only.
//   • Raw blobs (rendered HTML, screenshots, axe-raw) → object storage later;
//     their key columns are null in Phase 1 (screenshot_keys reuses the URL we
//     already store, as a free starting point).
//   • Interpretation (FAQ/pricing/section type) is NOT captured here — derived.
//
// The mapper is PURE and unit-tested. The writer uses insertChecked so a failed
// write is LOUD (logged + Sentry + audit_logs), never silent.
// ============================================================

import type { DomFacts } from '@/lib/audit-engine/pipeline/dom-verification'
import { insertChecked, type InsertCheckedResult } from '@/lib/db/checked-write'
import { isUpstreamErrorBody } from '@/lib/audit-engine/error-body'

/** Bump when the capture row SHAPE changes. Analyzers declare which they support. */
export const CAPTURE_SCHEMA_VERSION = 'v1'
/** Identifies the acquisition/renderer that produced the capture. */
export const CAPTURE_RENDERER_VERSION = 'crawler-v1'

/** The subset of an audit_pages row this mapper reads (already-persisted evidence). */
export interface AuditPageRow {
  url: string
  title?: string | null
  h1?: string | null
  meta_description?: string | null
  content_text?: string | null
  status_code?: number | null
  crawl_status?: string | null
  fetch_strategy?: string | null
  screenshot_url?: string | null
  canonical_url?: string | null
  viewport_meta?: string | null
  has_structured_data?: boolean | null
  crawled_at?: string | null
}

/** Insert payload for public.page_captures (keys match INSERT_CONTRACTS.page_captures). */
export interface PageCaptureRow {
  audit_id: string
  workspace_id: string | null
  user_id: string | null
  page_url: string
  page_status: 'pending' | 'partial' | 'complete' | 'failed'
  http_status: number | null
  capture_schema_version: string
  capture_renderer_version: string
  fetch_strategy: string | null
  rendered_html_key: string | null
  screenshot_keys: string[] | null
  axe_raw_key: string | null
  title: string | null
  h1: string | null
  headings: unknown
  links: unknown
  form_presence: unknown
  lang: string | null
  meta: unknown
  dom_facts: unknown
  extracted_text: string | null
  viewport_results: unknown
  captured_at: string
}

/** Map a crawl_status to a capture lifecycle state. */
export function captureStatusFromCrawl(crawlStatus: string | null | undefined): PageCaptureRow['page_status'] {
  switch (crawlStatus) {
    case 'success': return 'complete'
    case 'blocked':
    case 'failed': return 'failed'
    case null:
    case undefined: return 'partial'
    default: return 'partial'
  }
}

/** Normalize a URL for matching audit_pages.url against domFacts keys (trailing slash tolerant). */
function urlKey(u: string): string {
  return (u || '').replace(/\/+$/, '')
}

/**
 * PURE: build immutable capture rows from already-persisted audit_pages rows +
 * the rendered-DOM facts captured in the WCAG pass. No IO. Fully unit-tested.
 */
export function buildPageCaptureRows(args: {
  auditId: string
  workspaceId: string | null
  userId: string | null
  pages: AuditPageRow[]
  domFactsByUrl: Record<string, DomFacts> | null | undefined
}): PageCaptureRow[] {
  const { auditId, workspaceId, userId, pages } = args
  // Build a trailing-slash-tolerant lookup for DOM facts.
  const domByKey = new Map<string, DomFacts>()
  for (const [u, facts] of Object.entries(args.domFactsByUrl || {})) {
    domByKey.set(urlKey(u), facts)
  }

  return (pages || [])
    .filter((p) => p && typeof p.url === 'string' && p.url.length > 0)
    .map((p) => {
      const dom = domByKey.get(urlKey(p.url)) || null
      // Defense in depth: if a proxy/upstream error body slipped through as
      // content, the capture is not a real page — mark it failed so no analyzer
      // ever treats it as content.
      const isErrorBody = isUpstreamErrorBody(p.content_text)
      return {
        audit_id: auditId,
        workspace_id: workspaceId,
        user_id: userId,
        page_url: p.url,
        page_status: isErrorBody ? 'failed' : captureStatusFromCrawl(p.crawl_status),
        http_status: p.status_code ?? null,
        capture_schema_version: CAPTURE_SCHEMA_VERSION,
        capture_renderer_version: CAPTURE_RENDERER_VERSION,
        fetch_strategy: p.fetch_strategy ?? null,
        // Raw blob keys deferred to a later phase; reuse the screenshot URL we
        // already store so screenshot evidence is referenced from day one.
        rendered_html_key: null,
        screenshot_keys: p.screenshot_url ? [p.screenshot_url] : null,
        axe_raw_key: null,
        title: p.title ?? null,
        h1: p.h1 ?? null,
        headings: dom?.headings ?? null,
        links: dom?.links ?? null,
        form_presence: dom?.forms ?? null,
        lang: dom?.langAttr ?? null,
        meta: {
          description: p.meta_description ?? null,
          canonical: p.canonical_url ?? null,
          viewport: p.viewport_meta ?? null,
          has_structured_data: p.has_structured_data ?? null,
          viewport_meta_present: dom?.viewportMeta ?? null,
        },
        dom_facts: dom ?? null,
        extracted_text: p.content_text ?? null,
        viewport_results: null,
        captured_at: p.crawled_at || new Date().toISOString(),
      }
    })
}

type AnyDb = Parameters<typeof insertChecked>[0]

/** Persist capture rows with a checked write (failures are loud, never silent). */
export async function writePageCaptures(
  db: AnyDb,
  rows: PageCaptureRow[],
  auditId: string,
): Promise<InsertCheckedResult> {
  if (!rows.length) return { ok: true, saved: 0 }
  return insertChecked(db, 'page_captures', rows as unknown as Record<string, unknown>[], {
    label: 'shadow-capture page_captures',
    auditId,
  })
}
