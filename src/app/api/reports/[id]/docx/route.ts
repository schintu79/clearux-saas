// ============================================================
// ClearUX API — GET /api/reports/:id/docx
// Professional branded UX audit Word document — technical design
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

/* ── Brand colors — technical / dark-accented ───────────── */
const B = {
  accent:   '3ECF8E',
  accentDk: '2BA56E',
  navy:     '0F172A',
  navyMid:  '1E293B',
  text:     '0F172A',
  textSub:  '334155',
  muted:    '64748B',
  mutedLt:  '94A3B8',
  border:   'CBD5E1',
  borderLt: 'E2E8F0',
  bgCard:   'F1F5F9',
  bgPage:   'F8FAFC',
  white:    'FFFFFF',
}

const SEV_COLORS: Record<string, string> = {
  critical: 'DC2626',
  high:     'EA580C',
  medium:   'D97706',
  low:      '2563EB',
}

function scoreColor(s: number): string {
  if (s >= 70) return '16A34A'
  if (s >= 40) return 'D97706'
  return 'DC2626'
}

function scoreLabel(s: number): string {
  if (s >= 90) return 'Excellent'
  if (s >= 75) return 'Good'
  if (s >= 60) return 'Decent'
  if (s >= 40) return 'Needs Work'
  return 'Poor'
}

/* ── Reusable border configs ────────────────────────────── */
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: B.borderLt }
const noBorder = { style: BorderStyle.NONE, size: 0, color: B.white }
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }
const cellPad = { top: 80, bottom: 80, left: 120, right: 120 }

/* ── Helper: section heading with accent bar ────────────── */
function sectionHeading(title: string, subtitle?: string): Paragraph[] {
  const items: Paragraph[] = [
    new Paragraph({
      spacing: { before: 120, after: 80 },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: B.accent, space: 8 } },
      children: [new TextRun({ text: title, font: 'Arial', size: 30, bold: true, color: B.navy })],
    }),
  ]
  if (subtitle) {
    items.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: subtitle, font: 'Arial', size: 18, color: B.muted })],
      }),
    )
  }
  items.push(
    new Paragraph({
      spacing: { after: 160 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: B.borderLt, space: 1 } },
      children: [],
    }),
  )
  return items
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
      db.from('audit_findings').select('*').eq('audit_id', auditId)
        .order('severity', { ascending: true }).order('sort_order', { ascending: true }),
      db.from('audit_pages').select('url, title, status_code, load_time_ms')
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

    // ── COVER SECTION ──────────────────────────────────

    // Dark header block (simulated with table)
    children.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: noBorders,
                width: { size: 9360, type: WidthType.DXA },
                shading: { fill: B.navy, type: ShadingType.CLEAR },
                margins: { top: 300, bottom: 300, left: 300, right: 300 },
                children: [
                  new Paragraph({
                    spacing: { after: 60 },
                    children: [
                      new TextRun({ text: 'Clear', font: 'Arial', size: 48, bold: true, color: B.white }),
                      new TextRun({ text: 'UX', font: 'Arial', size: 48, bold: true, color: B.accent }),
                    ],
                  }),
                  new Paragraph({
                    spacing: { after: 40 },
                    children: [
                      new TextRun({ text: 'Deep AI-Powered UX Audit Report', font: 'Arial', size: 22, color: B.mutedLt }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: dateStr, font: 'Arial', size: 18, color: B.mutedLt }),
                      new TextRun({ text: `   |   Audit ID: ${auditId.substring(0, 8)}...`, font: 'Arial', size: 18, color: B.mutedLt }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    )

    // Accent divider
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
                children: [new Paragraph({ children: [] })],
              }),
            ],
          }),
        ],
      }),
    )

    children.push(new Paragraph({ spacing: { after: 300 }, children: [] }))

    // Score
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({ text: `${overall}`, font: 'Arial', size: 88, bold: true, color: scoreColor(overall) }),
          new TextRun({ text: ' / 100', font: 'Arial', size: 24, color: B.muted }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({ text: scoreLabel(overall), font: 'Arial', size: 28, bold: true, color: B.navy }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({ text: a.product_url, font: 'Arial', size: 22, bold: true, color: B.accent }),
        ],
      }),
    )

    // Issue summary in dark pill
    const issueParts: string[] = []
    if (critical > 0) issueParts.push(`${critical} Critical`)
    if (high > 0) issueParts.push(`${high} High`)
    if (medium > 0) issueParts.push(`${medium} Medium`)
    if (low > 0) issueParts.push(`${low} Low`)

    children.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: noBorders,
                width: { size: 9360, type: WidthType.DXA },
                shading: { fill: B.navy, type: ShadingType.CLEAR },
                margins: { top: 120, bottom: 120, left: 200, right: 200 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 40 },
                    children: [new TextRun({ text: `${total} ${L.issuesIdentified}`, font: 'Arial', size: 22, bold: true, color: B.white })],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: issueParts.join('  |  '), font: 'Arial', size: 17, color: B.mutedLt })],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    )

    // Page break before scores
    children.push(new Paragraph({ children: [new PageBreak()] }))

    // ── SCORE BREAKDOWN ────────────────────────────────
    children.push(...sectionHeading(L.scoreBreakdown, L.scoreSubtitle))

    if (catScores.length > 0) {
      const headerRow = new TableRow({
        children: [
          new TableCell({
            borders,
            width: { size: 4200, type: WidthType.DXA },
            shading: { fill: B.navy, type: ShadingType.CLEAR },
            margins: cellPad,
            children: [new Paragraph({ children: [new TextRun({ text: L.category, font: 'Arial', size: 17, bold: true, color: B.white })] })],
          }),
          new TableCell({
            borders,
            width: { size: 1200, type: WidthType.DXA },
            shading: { fill: B.navy, type: ShadingType.CLEAR },
            margins: cellPad,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: L.score, font: 'Arial', size: 17, bold: true, color: B.white })] })],
          }),
          new TableCell({
            borders,
            width: { size: 3960, type: WidthType.DXA },
            shading: { fill: B.navy, type: ShadingType.CLEAR },
            margins: cellPad,
            children: [new Paragraph({ children: [new TextRun({ text: L.summary, font: 'Arial', size: 17, bold: true, color: B.white })] })],
          }),
        ],
      })

      const dataRows = catScores.map((cat, i) => {
        const rowBg = i % 2 === 0 ? B.white : B.bgCard
        return new TableRow({
          children: [
            new TableCell({
              borders,
              width: { size: 4200, type: WidthType.DXA },
              shading: { fill: rowBg, type: ShadingType.CLEAR },
              margins: cellPad,
              children: [new Paragraph({ children: [new TextRun({ text: cat.name, font: 'Arial', size: 19, bold: true, color: B.navy })] })],
            }),
            new TableCell({
              borders,
              width: { size: 1200, type: WidthType.DXA },
              shading: { fill: rowBg, type: ShadingType.CLEAR },
              margins: cellPad,
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `${cat.score}`, font: 'Arial', size: 22, bold: true, color: scoreColor(cat.score) })],
              })],
            }),
            new TableCell({
              borders,
              width: { size: 3960, type: WidthType.DXA },
              shading: { fill: rowBg, type: ShadingType.CLEAR },
              margins: cellPad,
              children: [new Paragraph({ children: [new TextRun({ text: cat.summary || '', font: 'Arial', size: 17, color: B.textSub })] })],
            }),
          ],
        })
      })

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
    children.push(...sectionHeading(L.executiveSummary))

    const summaryText = r.executive_summary || 'No summary available.'
    for (const para of summaryText.split(/\n+/)) {
      if (para.trim()) {
        children.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: para.trim(), font: 'Arial', size: 21, color: B.textSub })],
          }),
        )
      }
    }

    // Key recommendation — dark card
    if (r.key_recommendation) {
      children.push(
        new Paragraph({ spacing: { after: 80 }, children: [] }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [9360],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: B.navy },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: B.navy },
                    left: { style: BorderStyle.SINGLE, size: 12, color: B.accent },
                    right: { style: BorderStyle.SINGLE, size: 1, color: B.navy },
                  },
                  width: { size: 9360, type: WidthType.DXA },
                  shading: { fill: B.navy, type: ShadingType.CLEAR },
                  margins: { top: 140, bottom: 140, left: 200, right: 200 },
                  children: [
                    new Paragraph({
                      spacing: { after: 60 },
                      children: [new TextRun({ text: L.keyRecommendation, font: 'Arial', size: 20, bold: true, color: B.accent })],
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: r.key_recommendation, font: 'Arial', size: 19, color: 'CBD5E1' })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      )
    }

    // ── DETAILED FINDINGS ──────────────────────────────
    if (f.length > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
      children.push(...sectionHeading(L.detailedFindings, `${total} ${L.issuesIdentified}`))

      for (let i = 0; i < f.length; i++) {
        const finding = f[i]
        const severity = finding.severity || 'medium'
        const sevColor = SEV_COLORS[severity] || SEV_COLORS.medium
        const sevLabel = (severity as string).toUpperCase()

        // Finding header
        children.push(
          new Paragraph({
            spacing: { before: i > 0 ? 180 : 0, after: 60 },
            children: [
              new TextRun({ text: `#${i + 1}  `, font: 'Arial', size: 17, color: B.mutedLt }),
              new TextRun({ text: `[${sevLabel}]  `, font: 'Arial', size: 17, bold: true, color: sevColor }),
              new TextRun({ text: finding.title || '', font: 'Arial', size: 21, bold: true, color: B.navy }),
            ],
          }),
        )

        // Description
        if (finding.description) {
          children.push(
            new Paragraph({
              spacing: { after: 60 },
              children: [new TextRun({ text: finding.description, font: 'Arial', size: 19, color: B.textSub })],
            }),
          )
        }

        // Recommendation — accent left border
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
                        top: { style: BorderStyle.SINGLE, size: 1, color: 'ECFDF5' },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'ECFDF5' },
                        left: { style: BorderStyle.SINGLE, size: 12, color: B.accent },
                        right: { style: BorderStyle.SINGLE, size: 1, color: 'ECFDF5' },
                      },
                      width: { size: 9360, type: WidthType.DXA },
                      shading: { fill: 'F0FDF4', type: ShadingType.CLEAR },
                      margins: { top: 80, bottom: 80, left: 160, right: 160 },
                      children: [
                        new Paragraph({
                          spacing: { after: 40 },
                          children: [new TextRun({ text: L.recommendation, font: 'Arial', size: 17, bold: true, color: B.accent })],
                        }),
                        new Paragraph({
                          children: [new TextRun({ text: finding.recommendation, font: 'Arial', size: 18, color: B.textSub })],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          )
        }

        // Separator
        if (i < f.length - 1) {
          children.push(
            new Paragraph({
              spacing: { before: 80 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: B.borderLt, space: 1 } },
              children: [],
            }),
          )
        }
      }
    }

    // ── PAGES ANALYSED ─────────────────────────────────
    if (pages.length > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
      children.push(...sectionHeading(L.pagesAnalysed, L.pagesSubtitle))

      const pgHeaderRow = new TableRow({
        children: [
          new TableCell({
            borders,
            width: { size: 600, type: WidthType.DXA },
            shading: { fill: B.navy, type: ShadingType.CLEAR },
            margins: cellPad,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '#', font: 'Arial', size: 16, bold: true, color: B.white })] })],
          }),
          new TableCell({
            borders,
            width: { size: 6360, type: WidthType.DXA },
            shading: { fill: B.navy, type: ShadingType.CLEAR },
            margins: cellPad,
            children: [new Paragraph({ children: [new TextRun({ text: 'Page URL', font: 'Arial', size: 16, bold: true, color: B.white })] })],
          }),
          new TableCell({
            borders,
            width: { size: 1200, type: WidthType.DXA },
            shading: { fill: B.navy, type: ShadingType.CLEAR },
            margins: cellPad,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: L.status, font: 'Arial', size: 16, bold: true, color: B.white })] })],
          }),
          new TableCell({
            borders,
            width: { size: 1200, type: WidthType.DXA },
            shading: { fill: B.navy, type: ShadingType.CLEAR },
            margins: cellPad,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Load', font: 'Arial', size: 16, bold: true, color: B.white })] })],
          }),
        ],
      })

      const pgDataRows = pages.map((pg: any, i: number) => {
        const rowBg = i % 2 === 0 ? B.white : B.bgCard
        const statusCode = pg.status_code || 0
        const statusColor = statusCode >= 200 && statusCode < 300 ? '16A34A' : statusCode >= 400 ? 'DC2626' : B.muted
        const urlChildren: Paragraph[] = []

        if (pg.title) {
          urlChildren.push(
            new Paragraph({
              spacing: { after: 20 },
              children: [new TextRun({ text: pg.title, font: 'Arial', size: 17, bold: true, color: B.navy })],
            }),
          )
        }
        urlChildren.push(
          new Paragraph({
            children: [new TextRun({ text: pg.url || '', font: 'Arial', size: 15, color: B.accent })],
          }),
        )

        return new TableRow({
          children: [
            new TableCell({
              borders,
              width: { size: 600, type: WidthType.DXA },
              shading: { fill: rowBg, type: ShadingType.CLEAR },
              margins: cellPad,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${i + 1}`, font: 'Arial', size: 16, color: B.mutedLt })] })],
            }),
            new TableCell({
              borders,
              width: { size: 6360, type: WidthType.DXA },
              shading: { fill: rowBg, type: ShadingType.CLEAR },
              margins: cellPad,
              children: urlChildren,
            }),
            new TableCell({
              borders,
              width: { size: 1200, type: WidthType.DXA },
              shading: { fill: rowBg, type: ShadingType.CLEAR },
              margins: cellPad,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: statusCode ? `${statusCode}` : '—', font: 'Arial', size: 17, bold: true, color: statusColor })] })],
            }),
            new TableCell({
              borders,
              width: { size: 1200, type: WidthType.DXA },
              shading: { fill: rowBg, type: ShadingType.CLEAR },
              margins: cellPad,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: pg.load_time_ms ? `${pg.load_time_ms}ms` : '—', font: 'Arial', size: 16, color: B.textSub })] })],
            }),
          ],
        })
      })

      children.push(
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [600, 6360, 1200, 1200],
          rows: [pgHeaderRow, ...pgDataRows],
        }),
      )
    }

    // ── BACK PAGE — dark branded ───────────────────────
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
                shading: { fill: B.navy, type: ShadingType.CLEAR },
                margins: { top: 3000, bottom: 1000, left: 400, right: 400 },
                verticalAlign: 'center' as any,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 60 },
                    children: [
                      new TextRun({ text: 'Ready to improve', font: 'Arial', size: 40, bold: true, color: B.white }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 },
                    children: [
                      new TextRun({ text: 'your user experience?', font: 'Arial', size: 40, bold: true, color: B.white }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 },
                    children: [
                      new TextRun({ text: '————', font: 'Arial', size: 20, color: B.accent }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 40 },
                    children: [
                      new TextRun({ text: 'This report was generated by ClearUX — Deep AI-Powered UX Audits.', font: 'Arial', size: 20, color: B.mutedLt }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 300 },
                    children: [
                      new TextRun({ text: 'Use these findings to prioritize improvements and boost conversions.', font: 'Arial', size: 20, color: B.mutedLt }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 },
                    children: [
                      new TextRun({ text: 'clearux.net', font: 'Arial', size: 28, bold: true, color: B.accent }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 60 },
                    children: [
                      new TextRun({ text: 'Clear', font: 'Arial', size: 36, bold: true, color: B.white }),
                      new TextRun({ text: 'UX', font: 'Arial', size: 36, bold: true, color: B.accent }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 20 },
                    children: [
                      new TextRun({ text: `Report ID: ${auditId}`, font: 'Arial', size: 14, color: B.mutedLt }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: `Generated ${dateStr}`, font: 'Arial', size: 14, color: B.mutedLt }),
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
          document: { run: { font: 'Arial', size: 20 } },
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
                  new TextRun({ text: 'Clear', font: 'Arial', size: 15, bold: true, color: B.navy }),
                  new TextRun({ text: 'UX', font: 'Arial', size: 15, bold: true, color: B.accent }),
                  new TextRun({ text: `  |  UX Audit Report  |  ${domain}`, font: 'Arial', size: 15, color: B.muted }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 1, color: B.borderLt, space: 4 } },
                children: [
                  new TextRun({ text: 'Confidential  |  clearux.net  |  Page ', font: 'Arial', size: 14, color: B.muted }),
                  new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 14, color: B.muted }),
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
