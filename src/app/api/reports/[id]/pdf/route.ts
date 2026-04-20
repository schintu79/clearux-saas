// ============================================================
// ClearUX API — GET /api/reports/:id/pdf
// Generates PDF by converting DOCX via LibreOffice — identical layout
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { buildDocx } from '../docx/route'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: auditId } = await params

    // Auth check — user must own this audit
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()

    // Verify ownership (or admin)
    const { data: ownerCheck } = await db
      .from('audits')
      .select('user_id')
      .eq('id', auditId)
      .single()
    if (!ownerCheck || ((ownerCheck as any).user_id !== user.id && user.email !== 's.schintu@gmail.com'))
      return NextResponse.json({ error: 'Not authorized to access this report' }, { status: 403 })

    // Generate DOCX using the shared builder
    const { buffer: docxBuffer, safeDomain, whitelabelCompany } = await buildDocx(auditId)

    // Write DOCX to temp file, convert to PDF with LibreOffice
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'clearux-pdf-'))
    const docxPath = path.join(tmpDir, 'report.docx')
    const pdfPath = path.join(tmpDir, 'report.pdf')

    try {
      await fs.promises.writeFile(docxPath, docxBuffer)

      // Convert DOCX → PDF using LibreOffice
      await execFileAsync('libreoffice', [
        '--headless',
        '--convert-to', 'pdf',
        '--outdir', tmpDir,
        docxPath,
      ], { timeout: 30000 })

      // Read the generated PDF
      const pdfBuffer = await fs.promises.readFile(pdfPath)

      const brandName = whitelabelCompany
        ? whitelabelCompany.replace(/[^a-zA-Z0-9 .-]/g, '').replace(/\s+/g, '-')
        : 'ClearUX'

      return new NextResponse(pdfBuffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${brandName}-Audit-${safeDomain}.pdf"`,
          'Cache-Control': 'no-store',
        },
      })
    } finally {
      // Clean up temp files
      try {
        await fs.promises.rm(tmpDir, { recursive: true, force: true })
      } catch {}
    }

  } catch (err) {
    console.error('[PDF] Error generating report:', err)
    return NextResponse.json(
      { error: 'Failed to generate PDF report', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
