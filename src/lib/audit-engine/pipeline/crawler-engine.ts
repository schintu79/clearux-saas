// ============================================================
// ClearUX Proprietary Crawler Engine — Pipeline Reference
// ============================================================
// PROPRIETARY — do not distribute outside the ClearUX codebase.
//
// The canonical crawler implementation lives at:
//   src/lib/audit-engine/crawler.ts
//
// This file re-exports it so the pipeline folder serves as a
// single directory for all proprietary audit engine components.
// ============================================================

export { crawlPages } from '../crawler'
export type { CrawledPage } from '../crawler'
