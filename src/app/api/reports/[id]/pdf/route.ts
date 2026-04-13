// ============================================================
// ClearUX API — GET /api/reports/:id/pdf
// Generates DOCX via buildDocx(), then converts to PDF via LibreOffice
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fsPromises from 'fs/promises'
import path from 'path'
import os from 'os'
import { buildDocx } from '../docx/route'

const execFileAsync = promisify(execFile)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: auditId } = await params

  try {
    // Step 1: Generate DOCX buffer directly (no HTTP round-trip)
    console.log('[PDF] Generating DOCX for audit:', auditId)
    const { buffer: docxBuffer, safeDomain } = await buildDocx(auditId)
    console.log('[PDF] DOCX generated:', docxBuffer.byteLength, 'bytes')

    // Step 2: Convert DOCX → PDF using LibreOffice
    const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'clearux-pdf-'))
    const docxPath = path.join(tmpDir, 'report.docx')
    const pdfPath = path.join(tmpDir, 'report.pdf')

    try {
      await fsPromises.writeFile(docxPath, docxBuffer)

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

        const pdfBuffer = await fsPromises.readFile(pdfPath)
        console.log('[PDF] Conversion successful:', pdfBuffer.byteLength, 'bytes')

        const baseName = `ClearUX-Audit-${safeDomain}`

        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${baseName}.pdf"`,
            'Cache-Control': 'no-store',
          },
        })
      } catch (loErr) {
        console.warn('[PDF] LibreOffice conversion failed:', loErr instanceof Error ? loErr.message : loErr)

        // Fallback: return the DOCX directly so the user still gets something
        return new NextResponse(docxBuffer as unknown as BodyInit, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="ClearUX-Audit-${safeDomain}.docx"`,
            'Cache-Control': 'no-store',
            'X-PDF-Fallback': 'true',
          },
        })
      }
    } finally {
      try {
        await fsPromises.rm(tmpDir, { recursive: true, force: true })
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
