// ============================================================
// ClearUX API — GET /api/reports/:id/docx
// Premium branded UX audit Word document — Apple/Sketch design
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getReportLabels, getLocale } from '@/lib/languages'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  PageBreak,
  Header,
  Footer,
  PageNumber,
} from 'docx'
import { createServiceSupabase } from '@/lib/supabase-server'

/** Fetch a screenshot from URL and return as Buffer, or null on failure.
 *  If the public URL fails, tries signed URL and direct download via Supabase. */
async function fetchImageBuffer(url: string, db?: ReturnType<typeof createServiceSupabase>): Promise<Buffer | null> {
  try {
    console.log('[DOCX] Fetching screenshot:', url)
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) {
      console.warn('[DOCX] Public URL failed:', res.status, res.statusText, url)
      // Try signed URL fallback via Supabase storage
      if (db && url.includes('/audit-screenshots/')) {
        const path = url.split('/audit-screenshots/').pop()
        if (path) {
          console.log('[DOCX] Trying signed URL for:', path)
          const { data: signedData, error: signErr } = await db.storage
            .from('audit-screenshots')
            .createSignedUrl(decodeURIComponent(path), 120)
          if (!signErr && signedData?.signedUrl) {
            const sRes = await fetch(signedData.signedUrl, { signal: AbortSignal.timeout(30_000) })
            if (sRes.ok) {
              const buf = await sRes.arrayBuffer()
              console.log('[DOCX] Signed URL worked:', path, `(${buf.byteLength} bytes)`)
              return Buffer.from(buf)
            }
          }
        }
      }
      // Try direct download as last resort
      if (db && url.includes('/audit-screenshots/')) {
        const path = url.split('/audit-screenshots/').pop()
        if (path) {
          console.log('[DOCX] Trying direct download for:', path)
          const { data: dlData, error: dlErr } = await db.storage
            .from('audit-screenshots')
            .download(decodeURIComponent(path))
          if (!dlErr && dlData) {
            const buf = await dlData.arrayBuffer()
            console.log('[DOCX] Direct download worked:', path, `(${buf.byteLength} bytes)`)
            return Buffer.from(buf)
          }
        }
      }
      return null
    }
    const arrayBuf = await res.arrayBuffer()
    console.log('[DOCX] Screenshot fetched OK:', url, `(${arrayBuf.byteLength} bytes)`)
    return Buffer.from(arrayBuf)
  } catch (err) {
    console.error('[DOCX] Screenshot fetch error:', url, err instanceof Error ? err.message : err)
    return null
  }
}

/* ── Brand colors — Apple/Sketch inspired, light & minimal ── */
const B = {
  white: 'FFFFFF',
  bg: 'FAFAFA',
  text: '1D1D1F',
  textSec: '6E6E73',
  textTert: '86868B',
  border: 'D2D2D7',
  borderLight: 'E5E5EA',
  accent: '8B5CF6',
  accentLight: 'EDE9FE',
  scoreGreen: '34C759',
  scoreYellow: 'FF9500',
  scoreRed: 'FF3B30',
  sevCritical: 'FF3B30',
  sevHigh: 'FF9500',
  sevMedium: 'FFCC00',
  sevLow: '007AFF',
  pillarFoundation: '8B5CF6',
  pillarHuman: 'EC4899',
  pillarTech: 'F59E0B',
  pillarFuture: '10B981',
  recBg: 'F5F3FF',
}

function scoreColor(s: number): string {
  if (s >= 70) return B.scoreGreen
  if (s >= 40) return B.scoreYellow
  return B.scoreRed
}

function scoreLabel(s: number): string {
  if (s >= 90) return 'Excellent'
  if (s >= 75) return 'Good'
  if (s >= 60) return 'Decent'
  if (s >= 40) return 'Needs Work'
  return 'Poor'
}

/* ── Reusable border configs ────────────────────────────── */
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: B.border }
const thinBorderLight = { style: BorderStyle.SINGLE, size: 1, color: B.borderLight }
const noBorder = { style: BorderStyle.NONE, size: 0, color: B.white }
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
const bordersLight = { top: thinBorderLight, bottom: thinBorderLight, left: thinBorderLight, right: thinBorderLight }
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }
const cellPad = { top: 100, bottom: 100, left: 140, right: 140 }
const cellPadLarge = { top: 160, bottom: 160, left: 180, right: 180 }

/* ── Helper: section heading with accent left border ────── */
function sectionHeading(title: string, subtitle?: string): Paragraph[] {
  const items: Paragraph[] = [
    new Paragraph({
      spacing: { before: 300, after: 120 },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: B.accent, space: 8 } },
      children: [new TextRun({ text: title, font: 'Arial', size: 40, bold: true, color: B.text })],
    }),
  ]
  if (subtitle) {
    items.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: subtitle, font: 'Arial', size: 19, color: B.textSec })],
      }),
    )
  }
  return items
}

/* ── Helper: create a visual progress bar (nested table) ──– */
function progressBar(score: number, totalWidth: number, color: string): Table {
  const filledWidth = Math.round((score / 100) * totalWidth)
  const emptyWidth = Math.max(0, totalWidth - filledWidth)

  const barCells: TableCell[] = []

  if (filledWidth > 0) {
    barCells.push(
      new TableCell({
        borders: noBorders,
        width: { size: filledWidth, type: WidthType.DXA },
        shading: { fill: color, type: ShadingType.CLEAR },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        children: [new Paragraph({ children: [] })],
      }),
    )
  }

  if (emptyWidth > 0) {
    barCells.push(
      new TableCell({
        borders: noBorders,
        width: { size: emptyWidth, type: WidthType.DXA },
        shading: { fill: B.borderLight, type: ShadingType.CLEAR },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        children: [new Paragraph({ children: [] })],
      }),
    )
  }

  const widths: number[] = []
  if (filledWidth > 0) widths.push(filledWidth)
  if (emptyWidth > 0) widths.push(emptyWidth)

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: widths.length > 0 ? widths : [totalWidth],
    rows: [
      new TableRow({
        height: { value: 40, rule: 'exact' as any },
        children: barCells.length > 0 ? barCells : [
          new TableCell({
            borders: noBorders,
            width: { size: totalWidth, type: WidthType.DXA },
            shading: { fill: B.borderLight, type: ShadingType.CLEAR },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [new Paragraph({ children: [] })],
          }),
        ],
      }),
    ],
  })
}

/* ── Main route ──────────────────────────────────────────── */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: auditId } = await params
    const db = createServiceSupabase()

    const [auditRes, reportRes, findingsRes, pagesRes] = await Promise.all([
      db.from('audits').select('*').eq('id', auditId).single(),
      db.from('reports').select('*').eq('audit_id', auditId).single(),
      db.from('audit_findings').select('*, screenshot_url, target_element').eq('audit_id', auditId)
        .order('severity', { ascending: true }).order('sort_order', { ascending: true }),
      db.from('audit_pages').select('url, title, status_code, load_time_ms, screenshot_url')
        .eq('audit_id', auditId).order('crawled_at', { ascending: true }),
    ])

    if (auditRes.error || !auditRes.data)
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    if (reportRes.error || !reportRes.data)
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const a = auditRes.data as any
    const r = reportRes.data as any
    const f = (findingsRes.data || []) as any[]
    const pages = (pagesRes.data || []) as any[]

    const lang = a.language || 'en'
    const L = getReportLabels(lang)
    const dateStr = new Date(a.created_at).toLocaleDateString(getLocale(lang), {
      year: 'numeric', month: 'long', day: 'numeric',
    })

    let domain = 'audit'
    try { domain = new URL(a.product_url).hostname.replace(/^www\./, '') } catch {}

    const overall = r.overall_score ?? 0
    const rawJson = r.raw_json || {}
    const catScores: Array<{ name: string; score: number; summary: string }> =
      rawJson?.categoryScores && Array.isArray(rawJson.categoryScores) ? rawJson.categoryScores : []

    const total = r.total_issues || 0
    const critical = r.critical_count || 0
    const high = r.high_count || 0
    const medium = r.medium_count || 0
    const low = r.low_count || 0

    const children: (Paragraph | Table)[] = []

    // ── COVER PAGE ─────────────────────────────────────

    // Thin accent bar at top
    children.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [
          new TableRow({
            height: { value: 80, rule: 'exact' as any },
            children: [
              new TableCell({
                borders: noBorders,
                width: { size: 9360, type: WidthType.DXA },
                shading: { fill: B.accent, type: ShadingType.CLEAR },
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                children: [new Paragraph({ children: [] })],
              }),
            ],
          }),
        ],
      }),
    )

    children.push(new Paragraph({ spacing: { after: 400 }, children: [] }))

    // Logo and subtitle
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({ text: 'Clear', font: 'Arial', size: 96, bold: true, color: B.text }),
          new TextRun({ text: 'UX', font: 'Arial', size: 96, bold: true, color: B.accent }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [
          new TextRun({ text: 'Human-Centered Digital Audit', font: 'Arial', size: 24, color: B.textSec }),
        ],
      }),
    )

    // Large overall score
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({ text: `${overall}`, font: 'Arial', size: 176, bold: true, color: scoreColor(overall) }),
          new TextRun({ text: ' / 100', font: 'Arial', size: 32, color: B.textTert }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [
          new TextRun({ text: scoreLabel(overall), font: 'Arial', size: 32, bold: true, color: B.text }),
        ],
      }),
    )

    // Website URL in accent
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [
          new TextRun({ text: a.product_url, font: 'Arial', size: 24, bold: true, color: B.accent }),
        ],
      }),
    )

    // Issue summary in bordered card
    const issueParts: string[] = []
    if (critical > 0) issueParts.push(`${critical} Critical`)
    if (high > 0) issueParts.push(`${high} High`)
    if (medium > 0) issueParts.push(`${medium} Medium`)
    if (low > 0) issueParts.push(`${low} Low`)

    children.push(
      new Table({
        width: { size: 6000, type: WidthType.DXA },
        columnWidths: [6000],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: bordersLight,
                width: { size: 6000, type: WidthType.DXA },
                shading: { fill: B.accentLight, type: ShadingType.CLEAR },
                margins: { top: 140, bottom: 140, left: 160, right: 160 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 60 },
                    children: [
                      new TextRun({ text: `${total} issues identified`, font: 'Arial', size: 22, bold: true, color: B.text }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: issueParts.join('  |  '), font: 'Arial', size: 18, color: B.textSec }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    )

    // Page break before executive dashboard
    children.push(new Paragraph({ children: [new PageBreak()] }))

    // ── EXECUTIVE DASHBOARD ────────────────────────────

    children.push(...sectionHeading('Executive Dashboard', 'Visual overview of audit results'))

    // ── Pillar Overview — 2x2 visual cards ──────
    const pillarDefs = [
      { name: 'Foundation', start: 0, end: 4, color: B.pillarFoundation },
      { name: 'Human Experience', start: 4, end: 8, color: B.pillarHuman },
      { name: 'Inclusive Design', start: 8, end: 12, color: B.pillarTech },
      { name: 'Future Readiness', start: 12, end: 16, color: B.pillarFuture },
    ]

    const pillarScores = pillarDefs.map((p) => {
      const cats = catScores.slice(p.start, Math.min(p.end, catScores.length))
      const avg = cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 0
      return { ...p, score: avg }
    })

    // Create 2x2 pillar grid
    const pillarGridRows: TableRow[] = [
      new TableRow({
        children: [
          // Top left: Foundation
          new TableCell({
            borders: bordersLight,
            width: { size: 4500, type: WidthType.DXA },
            shading: { fill: B.white, type: ShadingType.CLEAR },
            margins: cellPadLarge,
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({ text: pillarScores[0].name, font: 'Arial', size: 24, bold: true, color: B.pillarFoundation }),
                ],
              }),
              new Paragraph({
                spacing: { after: 100 },
                children: [
                  new TextRun({ text: `${pillarScores[0].score}`, font: 'Arial', size: 56, bold: true, color: B.pillarFoundation }),
                ],
              }),
              progressBar(pillarScores[0].score, 3500, B.pillarFoundation),
              new Paragraph({
                spacing: { before: 80 },
                children: [
                  new TextRun({ text: `${Math.min(6, catScores.length)} categories`, font: 'Arial', size: 16, color: B.textTert }),
                ],
              }),
            ],
          }),
          // Top right: Human Experience
          new TableCell({
            borders: bordersLight,
            width: { size: 4500, type: WidthType.DXA },
            shading: { fill: B.white, type: ShadingType.CLEAR },
            margins: cellPadLarge,
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({ text: pillarScores[1].name, font: 'Arial', size: 24, bold: true, color: B.pillarHuman }),
                ],
              }),
              new Paragraph({
                spacing: { after: 100 },
                children: [
                  new TextRun({ text: `${pillarScores[1].score}`, font: 'Arial', size: 56, bold: true, color: B.pillarHuman }),
                ],
              }),
              progressBar(pillarScores[1].score, 3500, B.pillarHuman),
              new Paragraph({
                spacing: { before: 80 },
                children: [
                  new TextRun({ text: `${Math.min(12, catScores.length) - 6} categories`, font: 'Arial', size: 16, color: B.textTert }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          // Bottom left: Technical Excellence
          new TableCell({
            borders: bordersLight,
            width: { size: 4500, type: WidthType.DXA },
            shading: { fill: B.white, type: ShadingType.CLEAR },
            margins: cellPadLarge,
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({ text: pillarScores[2].name, font: 'Arial', size: 24, bold: true, color: B.pillarTech }),
                ],
              }),
              new Paragraph({
                spacing: { after: 100 },
                children: [
                  new TextRun({ text: `${pillarScores[2].score}`, font: 'Arial', size: 56, bold: true, color: B.pillarTech }),
                ],
              }),
              progressBar(pillarScores[2].score, 3500, B.pillarTech),
              new Paragraph({
                spacing: { before: 80 },
                children: [
                  new TextRun({ text: `${Math.min(16, catScores.length) - 12} categories`, font: 'Arial', size: 16, color: B.textTert }),
                ],
              }),
            ],
          }),
          // Bottom right: Future Readiness
          new TableCell({
            borders: bordersLight,
            width: { size: 4500, type: WidthType.DXA },
            shading: { fill: B.white, type: ShadingType.CLEAR },
            margins: cellPadLarge,
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({ text: pillarScores[3].name, font: 'Arial', size: 24, bold: true, color: B.pillarFuture }),
                ],
              }),
              new Paragraph({
                spacing: { after: 100 },
                children: [
                  new TextRun({ text: `${pillarScores[3].score}`, font: 'Arial', size: 56, bold: true, color: B.pillarFuture }),
                ],
              }),
              progressBar(pillarScores[3].score, 3500, B.pillarFuture),
              new Paragraph({
                spacing: { before: 80 },
                children: [
                  new TextRun({ text: `${Math.max(0, catScores.length - 16)} categories`, font: 'Arial', size: 16, color: B.textTert }),
                ],
              }),
            ],
          }),
        ],
      }),
    ]

    children.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [4500, 4500],
        rows: pillarGridRows,
      }),
    )

    children.push(new Paragraph({ spacing: { after: 300 }, children: [] }))

    // ── Severity Breakdown Table ───────────────────────
    const sevHeaderRow = new TableRow({
      children: [
        new TableCell({
          borders,
          width: { size: 2340, type: WidthType.DXA },
          shading: { fill: B.sevCritical, type: ShadingType.CLEAR },
          margins: cellPad,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Critical', font: 'Arial', size: 18, bold: true, color: B.white })],
            }),
          ],
        }),
        new TableCell({
          borders,
          width: { size: 2340, type: WidthType.DXA },
          shading: { fill: B.sevHigh, type: ShadingType.CLEAR },
          margins: cellPad,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'High', font: 'Arial', size: 18, bold: true, color: B.white })],
            }),
          ],
        }),
        new TableCell({
          borders,
          width: { size: 2340, type: WidthType.DXA },
          shading: { fill: B.sevMedium, type: ShadingType.CLEAR },
          margins: cellPad,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Medium', font: 'Arial', size: 18, bold: true, color: B.text })],
            }),
          ],
        }),
        new TableCell({
          borders,
          width: { size: 2340, type: WidthType.DXA },
          shading: { fill: B.sevLow, type: ShadingType.CLEAR },
          margins: cellPad,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Low', font: 'Arial', size: 18, bold: true, color: B.white })],
            }),
          ],
        }),
      ],
    })

    const sevDataRow = new TableRow({
      children: [
        new TableCell({
          borders,
          width: { size: 2340, type: WidthType.DXA },
          shading: { fill: B.white, type: ShadingType.CLEAR },
          margins: cellPad,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `${critical}`, font: 'Arial', size: 32, bold: true, color: B.sevCritical })],
            }),
          ],
        }),
        new TableCell({
          borders,
          width: { size: 2340, type: WidthType.DXA },
          shading: { fill: B.white, type: ShadingType.CLEAR },
          margins: cellPad,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `${high}`, font: 'Arial', size: 32, bold: true, color: B.sevHigh })],
            }),
          ],
        }),
        new TableCell({
          borders,
          width: { size: 2340, type: WidthType.DXA },
          shading: { fill: B.white, type: ShadingType.CLEAR },
          margins: cellPad,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `${medium}`, font: 'Arial', size: 32, bold: true, color: B.sevMedium })],
            }),
          ],
        }),
        new TableCell({
          borders,
          width: { size: 2340, type: WidthType.DXA },
          shading: { fill: B.white, type: ShadingType.CLEAR },
          margins: cellPad,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `${low}`, font: 'Arial', size: 32, bold: true, color: B.sevLow })],
            }),
          ],
        }),
      ],
    })

    children.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2340, 2340, 2340, 2340],
        rows: [sevHeaderRow, sevDataRow],
      }),
    )

    // Page break before score breakdown
    children.push(new Paragraph({ children: [new PageBreak()] }))

    // ── SCORE BREAKDOWN ────────────────────────────────
    children.push(...sectionHeading(L.scoreBreakdown, 'Detailed category performance'))

    if (catScores.length > 0) {
      const headerRow = new TableRow({
        children: [
          new TableCell({
            borders,
            width: { size: 4200, type: WidthType.DXA },
            shading: { fill: B.text, type: ShadingType.CLEAR },
            margins: cellPad,
            children: [new Paragraph({ children: [new TextRun({ text: L.category, font: 'Arial', size: 18, bold: true, color: B.white })] })],
          }),
          new TableCell({
            borders,
            width: { size: 1200, type: WidthType.DXA },
            shading: { fill: B.text, type: ShadingType.CLEAR },
            margins: cellPad,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: L.score, font: 'Arial', size: 18, bold: true, color: B.white })] })],
          }),
          new TableCell({
            borders,
            width: { size: 3960, type: WidthType.DXA },
            shading: { fill: B.text, type: ShadingType.CLEAR },
            margins: cellPad,
            children: [new Paragraph({ children: [new TextRun({ text: L.summary, font: 'Arial', size: 18, bold: true, color: B.white })] })],
          }),
        ],
      })

      const dataRows: TableRow[] = []
      for (const pillar of pillarDefs) {
        // Pillar heading row
        dataRows.push(
          new TableRow({
            children: [
              new TableCell({
                borders,
                columnSpan: 3,
                width: { size: 9360, type: WidthType.DXA },
                shading: { fill: pillar.color, type: ShadingType.CLEAR },
                margins: cellPad,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: pillar.name,
                        font: 'Arial',
                        size: 21,
                        bold: true,
                        color: B.white,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        )

        // Category rows for this pillar
        for (let i = pillar.start; i < pillar.end && i < catScores.length; i++) {
          const cat = catScores[i]
          const rowBg = i % 2 === 0 ? B.white : B.bg
          dataRows.push(
            new TableRow({
              children: [
                new TableCell({
                  borders,
                  width: { size: 4200, type: WidthType.DXA },
                  shading: { fill: rowBg, type: ShadingType.CLEAR },
                  margins: cellPad,
                  children: [new Paragraph({ children: [new TextRun({ text: cat.name, font: 'Arial', size: 19, bold: true, color: B.text })] })],
                }),
                new TableCell({
                  borders,
                  width: { size: 1200, type: WidthType.DXA },
                  shading: { fill: rowBg, type: ShadingType.CLEAR },
                  margins: cellPad,
                  children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: `${cat.score}`, font: 'Arial', size: 24, bold: true, color: scoreColor(cat.score) })],
                  })],
                }),
                new TableCell({
                  borders,
                  width: { size: 3960, type: WidthType.DXA },
                  shading: { fill: rowBg, type: ShadingType.CLEAR },
                  margins: cellPad,
                  children: [new Paragraph({ children: [new TextRun({ text: cat.summary || '', font: 'Arial', size: 18, color: B.textSec })] })],
                }),
              ],
            }),
          )
        }
      }

      children.push(
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [4200, 1200, 3960],
          rows: [headerRow, ...dataRows],
        }),
      )
    }

    // ── EXECUTIVE SUMMARY ──────────────────────────────
    children.push(new Paragraph({ children: [new PageBreak()] }))
    children.push(...sectionHeading(L.executiveSummary, 'Key findings and recommendations'))

    const summaryText = r.executive_summary || 'No summary available.'
    for (const para of summaryText.split(/\n+/)) {
      if (para.trim()) {
        children.push(
          new Paragraph({
            spacing: { after: 140 },
            children: [new TextRun({ text: para.trim(), font: 'Arial', size: 21, color: B.textSec })],
          }),
        )
      }
    }

    // Key recommendation box
    if (r.key_recommendation) {
      children.push(
        new Paragraph({ spacing: { after: 200 }, children: [] }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [9360],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: B.borderLight },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: B.borderLight },
                    left: { style: BorderStyle.SINGLE, size: 18, color: B.accent },
                    right: { style: BorderStyle.SINGLE, size: 1, color: B.borderLight },
                  },
                  width: { size: 9360, type: WidthType.DXA },
                  shading: { fill: B.recBg, type: ShadingType.CLEAR },
                  margins: { top: 140, bottom: 140, left: 180, right: 180 },
                  children: [
                    new Paragraph({
                      spacing: { after: 60 },
                      children: [new TextRun({ text: L.keyRecommendation, font: 'Arial', size: 20, bold: true, color: B.accent })],
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: r.key_recommendation, font: 'Arial', size: 19, color: B.textSec })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      )
    }

    // ── Pre-fetch screenshot buffers for findings ──────
    const screenshotBuffers = new Map<number, Buffer>()
    const screenshotPromises = f.map(async (fi: any, idx: number) => {
      if (fi.screenshot_url) {
        const buf = await fetchImageBuffer(fi.screenshot_url, db)
        if (buf) screenshotBuffers.set(idx, buf)
      }
    })
    await Promise.all(screenshotPromises)

    // Also fetch page overview screenshot
    let pageOverviewBuffer: Buffer | null = null
    const pageWithScreenshot = pages.find((p: any) => p.screenshot_url)
    if (pageWithScreenshot?.screenshot_url) {
      pageOverviewBuffer = await fetchImageBuffer(pageWithScreenshot.screenshot_url, db)
    }

    // ── PAGE OVERVIEW SCREENSHOT ──────────────────────
    if (pageOverviewBuffer) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
      children.push(...sectionHeading('Page Overview', 'Audit capture at 1280×900 viewport'))
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [
            new ImageRun({
              data: pageOverviewBuffer,
              transformation: { width: 600, height: Math.round(600 * (900 / 1280)) },
              type: 'png',
            }),
          ],
        }),
      )
    }

    // ── FINDINGS BY PILLAR ─────────────────────────────
    if (f.length > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
      children.push(...sectionHeading(L.detailedFindings, `${total} issues identified`))

      // Pillar mapping for findings
      const PILLAR_DEFS = [
        {
          name: 'Foundation',
          color: B.pillarFoundation,
          categories: ['Visual Design & First Impression', 'Value Proposition & Messaging', 'Navigation & Information Architecture', 'Content Quality & Readability'],
        },
        {
          name: 'Human Experience',
          color: B.pillarHuman,
          categories: ['Calls-to-Action & Conversion Path', 'Trust, Credibility & Social Proof', 'Ethical UX & Dark Pattern Detection', 'Emotional Design & Psychological Safety'],
        },
        {
          name: 'Inclusive Design',
          color: B.pillarTech,
          categories: ['Accessibility & WCAG Compliance', 'Cognitive Accessibility & Neurodiversity', 'Digital Wellbeing & Responsible Design', 'Mobile Experience & Responsive Design'],
        },
        {
          name: 'Future Readiness',
          color: B.pillarFuture,
          categories: ['Performance & Technical Health', 'AI Discoverability & LLM Readiness', 'AI Agent Readiness', 'Cultural Sensitivity & Global Readiness'],
        },
      ]

      // Group findings by pillar
      const findingsByPillar: Record<string, any[]> = {}
      const otherFindings: any[] = []

      for (const finding of f) {
        const category = finding.category || ''
        let assigned = false
        for (const pillar of PILLAR_DEFS) {
          if (pillar.categories.some((cat) => cat.toLowerCase() === category.toLowerCase())) {
            if (!findingsByPillar[pillar.name]) findingsByPillar[pillar.name] = []
            findingsByPillar[pillar.name].push(finding)
            assigned = true
            break
          }
        }
        if (!assigned) {
          otherFindings.push(finding)
        }
      }

      let globalFindingIdx = 1

      // Render findings grouped by pillar
      for (const pillarDef of PILLAR_DEFS) {
        const pillarFindings = findingsByPillar[pillarDef.name] || []
        if (pillarFindings.length === 0) continue

        children.push(
          new Paragraph({
            spacing: { before: 200, after: 120 },
            border: { left: { style: BorderStyle.SINGLE, size: 18, color: pillarDef.color, space: 8 } },
            children: [new TextRun({ text: pillarDef.name, font: 'Arial', size: 32, bold: true, color: pillarDef.color })],
          }),
        )

        for (const finding of pillarFindings) {
          const severity = finding.severity || 'medium'
          const sevColorMap: Record<string, string> = {
            critical: B.sevCritical,
            high: B.sevHigh,
            medium: B.sevMedium,
            low: B.sevLow,
          }
          const sevColor = sevColorMap[severity] || B.sevMedium
          const sevLabel = (severity as string).toUpperCase()

          // Finding header
          children.push(
            new Paragraph({
              spacing: { before: 160, after: 60 },
              children: [
                new TextRun({ text: `#${globalFindingIdx}  `, font: 'Arial', size: 18, color: B.textTert }),
                new TextRun({ text: `[${sevLabel}]  `, font: 'Arial', size: 18, bold: true, color: sevColor }),
                new TextRun({ text: finding.title || '', font: 'Arial', size: 22, bold: true, color: B.text }),
              ],
            }),
          )

          // Description
          if (finding.description) {
            children.push(
              new Paragraph({
                spacing: { after: 80 },
                children: [new TextRun({ text: finding.description, font: 'Arial', size: 19, color: B.textSec })],
              }),
            )
          }

          // Recommendation box
          if (finding.recommendation) {
            children.push(
              new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [9360],
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        borders: {
                          top: { style: BorderStyle.SINGLE, size: 1, color: B.borderLight },
                          bottom: { style: BorderStyle.SINGLE, size: 1, color: B.borderLight },
                          left: { style: BorderStyle.SINGLE, size: 18, color: B.accent },
                          right: { style: BorderStyle.SINGLE, size: 1, color: B.borderLight },
                        },
                        width: { size: 9360, type: WidthType.DXA },
                        shading: { fill: B.recBg, type: ShadingType.CLEAR },
                        margins: { top: 140, bottom: 140, left: 180, right: 180 },
                        children: [
                          new Paragraph({
                            spacing: { after: 60 },
                            children: [new TextRun({ text: L.recommendation, font: 'Arial', size: 19, bold: true, color: B.accent })],
                          }),
                          new Paragraph({
                            children: [new TextRun({ text: finding.recommendation, font: 'Arial', size: 18, color: B.textSec })],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            )
          }

          // Screenshot
          const screenshotBuf = screenshotBuffers.get(globalFindingIdx - 1)
          if (screenshotBuf) {
            children.push(
              new Paragraph({
                spacing: { before: 100, after: 20 },
                children: [new TextRun({ text: 'Screenshot — area of concern', font: 'Arial', size: 17, bold: true, color: B.textTert })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
                children: [
                  new ImageRun({
                    data: screenshotBuf,
                    transformation: { width: 560, height: Math.round(560 * (900 / 1280)) },
                    type: 'png',
                  }),
                ],
              }),
            )
          }

          // Separator
          if (globalFindingIdx < f.length) {
            children.push(
              new Paragraph({
                spacing: { before: 100, after: 0 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: B.borderLight, space: 1 } },
                children: [],
              }),
            )
          }

          globalFindingIdx++
        }
      }

      // Render "Other" findings if any
      if (otherFindings.length > 0) {
        children.push(
          new Paragraph({
            spacing: { before: 200, after: 120 },
            border: { left: { style: BorderStyle.SINGLE, size: 18, color: B.textTert, space: 8 } },
            children: [new TextRun({ text: 'Other Findings', font: 'Arial', size: 32, bold: true, color: B.textTert })],
          }),
        )

        for (const finding of otherFindings) {
          const severity = finding.severity || 'medium'
          const sevColorMap: Record<string, string> = {
            critical: B.sevCritical,
            high: B.sevHigh,
            medium: B.sevMedium,
            low: B.sevLow,
          }
          const sevColor = sevColorMap[severity] || B.sevMedium
          const sevLabel = (severity as string).toUpperCase()

          children.push(
            new Paragraph({
              spacing: { before: 160, after: 60 },
              children: [
                new TextRun({ text: `#${globalFindingIdx}  `, font: 'Arial', size: 18, color: B.textTert }),
                new TextRun({ text: `[${sevLabel}]  `, font: 'Arial', size: 18, bold: true, color: sevColor }),
                new TextRun({ text: finding.title || '', font: 'Arial', size: 22, bold: true, color: B.text }),
              ],
            }),
          )

          if (finding.description) {
            children.push(
              new Paragraph({
                spacing: { after: 80 },
                children: [new TextRun({ text: finding.description, font: 'Arial', size: 19, color: B.textSec })],
              }),
            )
          }

          if (finding.recommendation) {
            children.push(
              new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [9360],
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        borders: {
                          top: { style: BorderStyle.SINGLE, size: 1, color: B.borderLight },
                          bottom: { style: BorderStyle.SINGLE, size: 1, color: B.borderLight },
                          left: { style: BorderStyle.SINGLE, size: 18, color: B.accent },
                          right: { style: BorderStyle.SINGLE, size: 1, color: B.borderLight },
                        },
                        width: { size: 9360, type: WidthType.DXA },
                        shading: { fill: B.recBg, type: ShadingType.CLEAR },
                        margins: { top: 140, bottom: 140, left: 180, right: 180 },
                        children: [
                          new Paragraph({
                            spacing: { after: 60 },
                            children: [new TextRun({ text: L.recommendation, font: 'Arial', size: 19, bold: true, color: B.accent })],
                          }),
                          new Paragraph({
                            children: [new TextRun({ text: finding.recommendation, font: 'Arial', size: 18, color: B.textSec })],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            )
          }

          const screenshotBuf = screenshotBuffers.get(globalFindingIdx - 1)
          if (screenshotBuf) {
            children.push(
              new Paragraph({
                spacing: { before: 100, after: 20 },
                children: [new TextRun({ text: 'Screenshot — area of concern', font: 'Arial', size: 17, bold: true, color: B.textTert })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
                children: [
                  new ImageRun({
                    data: screenshotBuf,
                    transformation: { width: 560, height: Math.round(560 * (900 / 1280)) },
                    type: 'png',
                  }),
                ],
              }),
            )
          }

          if (globalFindingIdx < f.length) {
            children.push(
              new Paragraph({
                spacing: { before: 100, after: 0 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: B.borderLight, space: 1 } },
                children: [],
              }),
            )
          }

          globalFindingIdx++
        }
      }
    }

    // ── PAGES ANALYSED ─────────────────────────────────
    if (pages.length > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
      children.push(...sectionHeading(L.pagesAnalysed, `${pages.length} pages captured`))

      const pgHeaderRow = new TableRow({
        children: [
          new TableCell({
            borders,
            width: { size: 600, type: WidthType.DXA },
            shading: { fill: B.text, type: ShadingType.CLEAR },
            margins: cellPad,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '#', font: 'Arial', size: 17, bold: true, color: B.white })] })],
          }),
          new TableCell({
            borders,
            width: { size: 8760, type: WidthType.DXA },
            shading: { fill: B.text, type: ShadingType.CLEAR },
            margins: cellPad,
            children: [new Paragraph({ children: [new TextRun({ text: 'Page URL', font: 'Arial', size: 17, bold: true, color: B.white })] })],
          }),
        ],
      })

      const pgDataRows = pages.map((pg: any, i: number) => {
        const rowBg = i % 2 === 0 ? B.white : B.bg
        const urlChildren: Paragraph[] = []

        if (pg.title) {
          urlChildren.push(
            new Paragraph({
              spacing: { after: 20 },
              children: [new TextRun({ text: pg.title, font: 'Arial', size: 18, bold: true, color: B.text })],
            }),
          )
        }
        urlChildren.push(
          new Paragraph({
            children: [new TextRun({ text: pg.url || '', font: 'Arial', size: 16, color: B.accent })],
          }),
        )

        return new TableRow({
          children: [
            new TableCell({
              borders,
              width: { size: 600, type: WidthType.DXA },
              shading: { fill: rowBg, type: ShadingType.CLEAR },
              margins: cellPad,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${i + 1}`, font: 'Arial', size: 17, color: B.textTert })] })],
            }),
            new TableCell({
              borders,
              width: { size: 8760, type: WidthType.DXA },
              shading: { fill: rowBg, type: ShadingType.CLEAR },
              margins: cellPad,
              children: urlChildren,
            }),
          ],
        })
      })

      children.push(
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [600, 8760],
          rows: [pgHeaderRow, ...pgDataRows],
        }),
      )
    }

    // ── BACK COVER ─────────────────────────────────────
    children.push(new Paragraph({ children: [new PageBreak()] }))

    children.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [
          new TableRow({
            height: { value: 12000, rule: 'atLeast' as any },
            children: [
              new TableCell({
                borders: noBorders,
                width: { size: 9360, type: WidthType.DXA },
                shading: { fill: B.white, type: ShadingType.CLEAR },
                margins: { top: 3000, bottom: 1000, left: 400, right: 400 },
                verticalAlign: 'center' as any,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 100 },
                    children: [
                      new TextRun({ text: 'Ready to improve your', font: 'Arial', size: 44, bold: true, color: B.text }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 300 },
                    children: [
                      new TextRun({ text: 'user experience?', font: 'Arial', size: 44, bold: true, color: B.accent }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 240 },
                    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: B.borderLight, space: 1 } },
                    children: [],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 60 },
                    children: [
                      new TextRun({ text: 'Human-Centered Digital Audit by ClearUX', font: 'Arial', size: 21, color: B.textSec }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 },
                    children: [
                      new TextRun({ text: 'clearux.ai', font: 'Arial', size: 32, bold: true, color: B.accent }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 40 },
                    children: [
                      new TextRun({ text: `Report ID: ${auditId}`, font: 'Arial', size: 16, color: B.textTert }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: `Generated ${dateStr}`, font: 'Arial', size: 16, color: B.textTert }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    )

    // ── Assemble document ──────────────────────────────
    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: 'Arial', size: 21 } },
        },
      },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: B.accent, space: 4 } },
                children: [
                  new TextRun({ text: 'Clear', font: 'Arial', size: 16, bold: true, color: B.text }),
                  new TextRun({ text: 'UX', font: 'Arial', size: 16, bold: true, color: B.accent }),
                  new TextRun({ text: `  |  Human-Centered Digital Audit  |  ${domain}`, font: 'Arial', size: 16, color: B.textSec }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 1, color: B.borderLight, space: 4 } },
                children: [
                  new TextRun({ text: 'Confidential  |  clearux.ai  |  Page ', font: 'Arial', size: 15, color: B.textTert }),
                  new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 15, color: B.textTert }),
                ],
              }),
            ],
          }),
        },
        children,
      }],
    })

    const buffer = await Packer.toBuffer(doc)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="ClearUX-Audit-${domain}.docx"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Error generating DOCX:', message, err instanceof Error ? err.stack : '')
    return NextResponse.json(
      { error: 'Failed to generate DOCX', detail: message },
      { status: 500 },
    )
  }
}
