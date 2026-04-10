// ============================================================
// ClearUX Audit Engine — PDF Report Generator
// Generates a professional UX audit PDF report
// ============================================================

import type { Audit, AuditFinding } from '@/types/database'
import type { ReportData } from './analyzer'
import type { CrawledPage } from './crawler'

/**
 * Generate PDF report and return a URL to access it.
 * Since we don't have file storage set up, we return a URL
 * to an API route that generates the PDF on demand.
 */
export async function generatePdfReport(
  auditId: string,
  audit: Audit,
  reportData: ReportData,
  findings: AuditFinding[],
  crawledPages: CrawledPage[],
): Promise<string> {
  // Return relative URL to the on-demand PDF API endpoint
  // Using relative path ensures it works on any domain (localhost, staging, prod)
  return `/api/reports/${auditId}/pdf`
}
