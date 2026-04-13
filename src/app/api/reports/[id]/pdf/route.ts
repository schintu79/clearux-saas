// ============================================================
// ClearUX API — GET /api/reports/:id/pdf
// Generates PDF by first creating a DOCX then converting via LibreOffice
// Falls back to fetching DOCX from the docx endpoint on platforms without LibreOffice
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: auditId } = await params

  try {
    // Step 1: Generate the DOCX by calling the sibling endpoint internally
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''

    // Build the internal DOCX URL
    // On server-side we can import and call the DOCX handler directly for efficiency,
    // but for simplicity and to avoid circular deps, we call the API endpoint
    const docxUrl = `${baseUrl || request.nextUrl.origin}/api/reports/${auditId}/docx`

    console.log('[PDF] Fetching DOCX from:', docxUrl)

    const docxRes = await fetch(docxUrl, {
      headers: {
        // Forward cookies for auth if needed
        cookie: request.headers.get('cookie') || '',
      },
      signal: AbortSignal.timeout(60_000),
    })

    if (!docxRes.ok) {
      const errText = await docxRes.text().catch(() => 'Unknown error')
      console.error('[PDF] Failed to fetch DOCX:', docxRes.status, errText)
      return NextResponse.json(
        { error: 'Failed to generate DOCX for PDF conversion', detail: errText },
        { status: docxRes.status },
      )
    }

    const docxBuffer = Buffer.from(await docxRes.arrayBuffer())
    console.log('[PDF] DOCX received:', docxBuffer.byteLength, 'bytes')

    // Step 2: Convert DOCX → PDF using LibreOffice
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clearux-pdf-'))
    const docxPath = path.join(tmpDir, 'report.docx')
    const pdfPath = path.join(tmpDir, 'report.pdf')

    try {
      await fs.writeFile(docxPath, docxBuffer)

      // Try LibreOffice conversion
      try {
        await execFileAsync('libreoffice', [
          '--headless',
          '--norestore',
          '--convert-to', 'pdf',
          '--outdir', tmpDir,
          docxPath,
        ], {
          timeout: 45_000,
          env: {
            ...process.env,
            HOME: tmpDir, // Avoid profile lock issues
          },
        })

        const pdfBuffer = await fs.readFile(pdfPath)
        console.log('[PDF] Conversion successful:', pdfBuffer.byteLength, 'bytes')

        // Extract domain for filename
        // We don't have direct access to the audit data here, so parse from Content-Disposition
        const docxDisposition = docxRes.headers.get('content-disposition') || ''
        const filenameMatch = docxDisposition.match(/filename="([^"]+)\.docx"/)
        const baseName = filenameMatch ? filenameMatch[1] : `ClearUX-Audit-${auditId.slice(0, 8)}`

        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${baseName}.pdf"`,
            'Cache-Control': 'no-store',
          },
        })
      } catch (loErr) {
        console.warn('[PDF] LibreOffice conversion failed:', loErr instanceof Error ? loErr.message : loErr)
        console.warn('[PDF] LibreOffice may not be available — returning DOCX with PDF content-type fallback')

        // Fallback: return DOCX as-is with a note
        // This shouldn't happen on environments with LibreOffice installed
        return NextResponse.json(
          { error: 'PDF conversion unavailable. Please download the Word document instead.', docxUrl: `/api/reports/${auditId}/docx` },
          { status: 503 },
        )
      }
    } finally {
      // Clean up temp files
      try {
        await fs.rm(tmpDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }

  } catch (err) {
    console.error('[PDF] Error generating report:', err)
    return NextResponse.json(
      { error: 'Failed to generate PDF report', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
