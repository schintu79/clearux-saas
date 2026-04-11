// ============================================================
// ClearUX API — GET /api/reports/:id/pdf
// Professional UX audit report — white background, print-friendly
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { createServiceSupabase } from '@/lib/supabase-server'
import { getReportLabels, getLocale } from '@/lib/languages'

/* ── Brand palette — light/print-friendly ──────────────────── */
const C = {
  accent:     '#3ECF8E',
  accentDk:   '#2BA56E',
  navy:       '#0F172A',
  text:       '#0F172A',
  textSub:    '#334155',
  muted:      '#64748B',
  mutedLight: '#94A3B8',
  border:     '#CBD5E1',
  borderLight:'#E2E8F0',
  bgCard:     '#F1F5F9',
  bgPage:     '#F8FAFC',
  white:      '#FFFFFF',
  recBg:      '#F0FDF4',
}

const SEV: Record<string, { hex: string; label: string }> = {
  critical: { hex: '#DC2626', label: 'CRITICAL' },
  high:     { hex: '#EA580C', label: 'HIGH' },
  medium:   { hex: '#D97706', label: 'MEDIUM' },
  low:      { hex: '#2563EB', label: 'LOW' },
}

function scoreHex(s: number): string {
  if (s >= 70) return '#16A34A'
  if (s >= 40) return '#D97706'
  return '#DC2626'
}

function scoreLabel(s: number): string {
  if (s >= 90) return 'Excellent'
  if (s >= 75) return 'Good'
  if (s >= 60) return 'Decent'
  if (s >= 40) return 'Needs Work'
  return 'Poor'
}

/** Fetch a screenshot from URL and return as Buffer, or null on failure */
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  } catch {
    return null
  }
}

/* ── Page constants ──────────────────────────────────────── */
const ML = 50           // left margin
const MR = 545          // right edge
const PW = MR - ML      // printable width
const PAGE_W = 595
const PAGE_H = 842
const CONTENT_TOP = 60
const CONTENT_BOTTOM = 790
const FOOTER_Y = PAGE_H - 28

/* ── Helpers ─────────────────────────────────────────────── */
function drawLine(doc: PDFKit.PDFDocument, y: number, color = C.border, w = 0.5) {
  doc.save().moveTo(ML, y).lineTo(MR, y).strokeColor(color).lineWidth(w).stroke().restore()
}

function measure(doc: PDFKit.PDFDocument, text: string, font: string, size: number, width: number, lineGap = 0): number {
  doc.save()
  doc.font(font).fontSize(size)
  const h = doc.heightOfString(text, { width, lineGap })
  doc.restore()
  return h
}

/** Section header with accent left bar */
function sectionHeader(doc: PDFKit.PDFDocument, y: number, title: string, subtitle?: string): number {
  doc.rect(ML, y, 4, 20).fill(C.accent)
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.navy)
  doc.text(title, ML + 14, y + 2, { lineBreak: false })
  y += 24
  if (subtitle) {
    doc.font('Helvetica').fontSize(8.5).fillColor(C.muted)
    doc.text(subtitle, ML, y, { lineBreak: false })
    y += 12
  }
  drawLine(doc, y, C.borderLight, 0.5)
  y += 10
  return y
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
    const findings = (findingsRes.data || []) as any[]
    const pages = (pagesRes.data || []) as any[]

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: ML, right: 50 },
      autoFirstPage: false,
      info: {
        Title: `UX Audit Report — ${a.product_url}`,
        Author: 'ClearUX (clearux.ai)',
        Subject: 'UX Audit Report',
      },
    })

    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    const pdfReady = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    })

    let pageNum = 0

    function addPage(): number {
      if (pageNum > 0) drawFooter()
      doc.addPage({ size: 'A4', margins: { top: 50, bottom: 50, left: ML, right: 50 } })
      pageNum++
      return CONTENT_TOP
    }

    function drawFooter() {
      doc.save()
      drawLine(doc, FOOTER_Y - 6, C.borderLight, 0.3)
      doc.font('Helvetica').fontSize(7).fillColor(C.mutedLight)
      doc.text('Confidential  |  clearux.ai', ML, FOOTER_Y, { lineBreak: false })
      doc.text(`Page ${pageNum}`, 0, FOOTER_Y, { width: MR, align: 'right', lineBreak: false })
      doc.restore()
    }

    function ensureSpace(y: number, needed: number): number {
      if (y + needed > CONTENT_BOTTOM) return addPage()
      return y
    }

    // Data prep
    const lang = a.language || 'en'
    const L = getReportLabels(lang)
    const overall = r.overall_score ?? 0
    const dateStr = new Date(a.created_at).toLocaleDateString(getLocale(lang), {
      year: 'numeric', month: 'long', day: 'numeric',
    })
    const critical = r.critical_count || 0
    const high = r.high_count || 0
    const medium = r.medium_count || 0
    const low = r.low_count || 0
    const total = r.total_issues || 0
    const rawJson = r.raw_json || {}
    const catScores: Array<{ name: string; score: number; summary: string }> =
      Array.isArray(rawJson?.categoryScores) ? rawJson.categoryScores : []

    let hostname = 'website'
    try { hostname = new URL(a.product_url).hostname.replace(/^www\./, '') } catch {}

    // ════════════════════════════════════════════════════════
    //  COVER PAGE — white background, compact layout
    // ════════════════════════════════════════════════════════
    addPage()

    // Top accent bar
    doc.rect(0, 0, PAGE_W, 4).fill(C.accent)

    // Logo
    doc.font('Helvetica-Bold').fontSize(28).fillColor(C.navy)
    doc.text('Clear', ML, 40, { continued: true, lineBreak: false })
    doc.fillColor(C.accent).text('UX', { lineBreak: false })

    // Subtitle
    doc.font('Helvetica').fontSize(11).fillColor(C.muted)
    doc.text('Deep AI-Powered UX Audit Report', ML, 74, { lineBreak: false })

    // Thin separator
    drawLine(doc, 95, C.borderLight, 0.5)

    // Date + Audit ID (right aligned)
    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
    doc.text(dateStr, 0, 44, { width: MR, align: 'right', lineBreak: false })
    doc.text(`Audit ID: ${auditId.substring(0, 8)}...`, 0, 56, { width: MR, align: 'right', lineBreak: false })

    // Score — centered
    const cx = PAGE_W / 2
    const cy = 200

    // Score circle outline
    const circleR = 50
    doc.save()
    doc.circle(cx, cy, circleR).lineWidth(4).strokeColor(scoreHex(overall)).stroke()
    doc.restore()

    doc.font('Helvetica-Bold').fontSize(42).fillColor(scoreHex(overall))
    const scoreStr = `${overall}`
    const scoreW = doc.widthOfString(scoreStr)
    doc.text(scoreStr, cx - scoreW / 2, cy - 18, { lineBreak: false })

    doc.font('Helvetica').fontSize(10).fillColor(C.muted)
    doc.text('/ 100', 0, cy + 32, { align: 'center', width: PAGE_W, lineBreak: false })

    doc.font('Helvetica-Bold').fontSize(14).fillColor(C.navy)
    doc.text(scoreLabel(overall), 0, cy + 50, { align: 'center', width: PAGE_W, lineBreak: false })

    // URL
    doc.font('Helvetica-Bold').fontSize(12).fillColor(C.accent)
    doc.text(a.product_url, 0, cy + 74, { align: 'center', width: PAGE_W, lineBreak: false })

    // Issue summary — light card instead of dark pill
    const chipY = cy + 104
    const chipW = 380
    const chipX = (PAGE_W - chipW) / 2

    doc.roundedRect(chipX, chipY, chipW, 44, 6).lineWidth(1).strokeColor(C.border).stroke()

    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.navy)
    doc.text(`${total} ${L.issuesIdentified}`, 0, chipY + 8, { align: 'center', width: PAGE_W, lineBreak: false })

    const chipParts: string[] = []
    if (critical > 0) chipParts.push(`${critical} Critical`)
    if (high > 0) chipParts.push(`${high} High`)
    if (medium > 0) chipParts.push(`${medium} Medium`)
    if (low > 0) chipParts.push(`${low} Low`)
    if (chipParts.length) {
      doc.font('Helvetica').fontSize(9).fillColor(C.muted)
      doc.text(chipParts.join('  |  '), 0, chipY + 26, { align: 'center', width: PAGE_W, lineBreak: false })
    }

    // ── Category scores directly on cover page (saves a page) ──
    let y = chipY + 64

    if (catScores.length > 0) {
      drawLine(doc, y, C.borderLight, 0.5)
      y += 12

      doc.rect(ML, y - 2, 4, 18).fill(C.accent)
      doc.font('Helvetica-Bold').fontSize(13).fillColor(C.navy)
      doc.text(L.scoreBreakdown, ML + 14, y, { lineBreak: false })
      y += 24

      // Table header — light gray background (print-friendly)
      const colName = ML
      const colScore = ML + 260
      const colSummary = ML + 310

      doc.rect(ML, y - 4, PW, 18).fill(C.bgCard)
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C.navy)
      doc.text(L.category, colName + 8, y, { lineBreak: false })
      doc.text(L.score, colScore + 4, y, { lineBreak: false })
      doc.text(L.summary, colSummary + 8, y, { lineBreak: false })
      y += 18

      for (let i = 0; i < catScores.length; i++) {
        const cat = catScores[i]
        const val = cat.score ?? 0
        const summary = cat.summary || ''
        const summaryH = summary ? measure(doc, summary, 'Helvetica', 7.5, PW - colSummary + ML - 16, 2) : 0
        const rowH = Math.max(18, summaryH + 8)

        y = ensureSpace(y, rowH + 2)

        // Alternating row — very light gray
        if (i % 2 === 1) {
          doc.rect(ML, y - 2, PW, rowH + 2).fill(C.bgPage)
        }

        // Category name
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.navy)
        doc.text(cat.name, colName + 8, y + 1, { width: 240, lineBreak: false })

        // Score
        doc.font('Helvetica-Bold').fontSize(11).fillColor(scoreHex(val))
        doc.text(`${val}`, colScore + 4, y, { lineBreak: false })

        // Summary
        if (summary) {
          doc.font('Helvetica').fontSize(7.5).fillColor(C.textSub)
          doc.text(summary, colSummary + 8, y + 1, { width: PW - (colSummary - ML) - 16, lineGap: 2, lineBreak: true })
        }

        y += rowH + 2
      }
      drawLine(doc, y, C.borderLight, 0.3)
    }

    // Confidential footer on cover
    doc.font('Helvetica').fontSize(7).fillColor(C.mutedLight)
    doc.text(L.confidential, 0, PAGE_H - 35, {
      align: 'center', width: PAGE_W, lineBreak: false,
    })

    // ════════════════════════════════════════════════════════
    //  EXECUTIVE SUMMARY
    // ════════════════════════════════════════════════════════
    const summaryText = r.executive_summary || 'No summary available.'

    y = addPage()

    y = sectionHeader(doc, y, L.executiveSummary)

    // Summary paragraphs
    const summaryParagraphs = summaryText.split(/\n+/).filter((p: string) => p.trim())
    for (const para of summaryParagraphs) {
      const paraH = measure(doc, para.trim(), 'Helvetica', 10, PW, 3)
      y = ensureSpace(y, paraH + 6)
      doc.font('Helvetica').fontSize(10).fillColor(C.textSub)
      doc.text(para.trim(), ML, y, { width: PW, lineGap: 3, lineBreak: true })
      y = doc.y + 6
    }

    // Key Recommendation — light accent card (NOT dark navy)
    if (r.key_recommendation) {
      const recText = r.key_recommendation as string
      const thisRecH = measure(doc, recText, 'Helvetica', 9.5, PW - 34, 3)
      const boxH = 36 + thisRecH

      y = ensureSpace(y, boxH + 10)
      y += 4

      // Light green background with border (print-friendly)
      doc.roundedRect(ML, y, PW, boxH, 4).fill(C.recBg)
      doc.roundedRect(ML, y, PW, boxH, 4).lineWidth(0.5).strokeColor(C.accent).stroke()
      // Accent left bar
      doc.rect(ML, y, 4, boxH).fill(C.accent)

      // Label
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.accentDk)
      doc.text(L.keyRecommendation, ML + 18, y + 10, { lineBreak: false })

      // Recommendation text — dark text on light background
      doc.font('Helvetica').fontSize(9.5).fillColor(C.textSub)
      doc.text(recText, ML + 18, y + 26, { width: PW - 34, lineGap: 3, lineBreak: true })

      y = y + boxH + 10
    }

    // ════════════════════════════════════════════════════════
    //  Pre-fetch screenshot buffers for findings
    // ════════════════════════════════════════════════════════
    const screenshotBuffers = new Map<number, Buffer>()
    const screenshotPromises = findings.map(async (fi: any, idx: number) => {
      if (fi.screenshot_url) {
        const buf = await fetchImageBuffer(fi.screenshot_url)
        if (buf) screenshotBuffers.set(idx, buf)
      }
    })
    await Promise.all(screenshotPromises)

    // Also fetch page overview screenshot
    let pageOverviewBuffer: Buffer | null = null
    const pageWithScreenshot = pages.find((p: any) => p.screenshot_url)
    if (pageWithScreenshot?.screenshot_url) {
      pageOverviewBuffer = await fetchImageBuffer(pageWithScreenshot.screenshot_url)
    }

    // ════════════════════════════════════════════════════════
    //  PAGE OVERVIEW SCREENSHOT
    // ════════════════════════════════════════════════════════
    if (pageOverviewBuffer) {
      if (y + 280 > CONTENT_BOTTOM) {
        y = addPage()
      } else {
        y += 10
      }

      y = sectionHeader(doc, y, 'Page Overview')

      // Render screenshot, scaled to fit width
      const imgW = PW - 20
      const imgH = imgW * (900 / 1280) // maintain 1280x900 aspect ratio
      y = ensureSpace(y, imgH + 10)

      // Border around screenshot
      doc.roundedRect(ML + 10, y, imgW, imgH, 3).lineWidth(0.5).strokeColor(C.border).stroke()
      doc.image(pageOverviewBuffer, ML + 10, y, { width: imgW, height: imgH })
      y += imgH + 6

      doc.font('Helvetica').fontSize(7).fillColor(C.muted)
      doc.text('Captured during audit — viewport 1280×900', ML, y, { width: PW, align: 'center', lineBreak: false })
      y += 14
    }

    // ════════════════════════════════════════════════════════
    //  DETAILED FINDINGS
    // ════════════════════════════════════════════════════════
    if (findings.length > 0) {
      if (y + 80 > CONTENT_BOTTOM) {
        y = addPage()
      } else {
        y += 14
      }

      y = sectionHeader(doc, y, L.detailedFindings, `${total} ${L.issuesIdentified}`)

      for (let i = 0; i < findings.length; i++) {
        const fi = findings[i]
        const sev = SEV[fi.severity] || SEV.medium
        const titleText = fi.title || 'Untitled'
        const descText = fi.description || ''
        const recText = fi.recommendation || ''

        const titleH = measure(doc, titleText, 'Helvetica-Bold', 10, PW - 80)
        const descH = descText ? measure(doc, descText, 'Helvetica', 9, PW - 8, 2) : 0
        const findRecH = recText ? measure(doc, recText, 'Helvetica', 8.5, PW - 28, 2) + 22 : 0
        const findingH = Math.max(titleH, 14) + 6 + descH + 6 + findRecH + 10

        y = ensureSpace(y, Math.min(findingH, 180))

        // Finding header: #N  [SEVERITY]  Title
        doc.font('Helvetica').fontSize(8).fillColor(C.mutedLight)
        doc.text(`#${i + 1}`, ML, y + 2, { lineBreak: false })

        const numW = doc.widthOfString(`#${i + 1}`) + 6

        // Severity badge
        doc.font('Helvetica-Bold').fontSize(8).fillColor(sev.hex)
        doc.text(`[${sev.label}]`, ML + numW, y + 2, { lineBreak: false })
        const sevW = doc.widthOfString(`[${sev.label}]`) + 6

        // Title
        const titleX = ML + numW + sevW
        doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy)
        doc.text(titleText, titleX, y, { width: MR - titleX, lineBreak: true })
        y = Math.max(y + 16, doc.y) + 3

        // Description
        if (descText) {
          y = ensureSpace(y, 20)
          doc.font('Helvetica').fontSize(9).fillColor(C.textSub)
          doc.text(descText, ML + 4, y, { width: PW - 8, lineGap: 2, lineBreak: true })
          y = doc.y + 4
        }

        // Recommendation block — light green bg + accent left bar
        if (recText) {
          const thisRecH = measure(doc, recText, 'Helvetica', 8.5, PW - 28, 2) + 20
          y = ensureSpace(y, thisRecH + 4)

          doc.roundedRect(ML, y - 2, PW, thisRecH + 2, 3).fill(C.recBg)
          doc.rect(ML, y - 2, 3, thisRecH + 2).fill(C.accent)

          // Label
          doc.font('Helvetica-Bold').fontSize(8).fillColor(C.accentDk)
          doc.text(L.recommendation, ML + 12, y + 1, { lineBreak: false })

          // Text
          doc.font('Helvetica').fontSize(8.5).fillColor(C.textSub)
          doc.text(recText, ML + 12, y + 13, { width: PW - 28, lineGap: 2, lineBreak: true })
          y = doc.y + 6
        }

        // Screenshot for this finding (if available)
        const screenshotBuf = screenshotBuffers.get(i)
        if (screenshotBuf) {
          const screenshotW = PW - 40
          const screenshotH = screenshotW * (900 / 1280) // maintain aspect ratio
          y = ensureSpace(y, screenshotH + 24)

          y += 4
          doc.font('Helvetica-Bold').fontSize(7).fillColor(C.muted)
          doc.text('Screenshot — highlighted area of concern', ML + 20, y, { lineBreak: false })
          y += 12

          doc.roundedRect(ML + 20, y, screenshotW, screenshotH, 2)
            .lineWidth(0.5).strokeColor(C.border).stroke()
          doc.image(screenshotBuf, ML + 20, y, { width: screenshotW, height: screenshotH })
          y += screenshotH + 6
        }

        // Separator between findings
        y += 2
        if (i < findings.length - 1) {
          drawLine(doc, y, C.borderLight, 0.3)
          y += 8
        }
      }
    }

    // ════════════════════════════════════════════════════════
    //  PAGES ANALYSED
    // ════════════════════════════════════════════════════════
    if (pages.length > 0) {
      if (y + 60 > CONTENT_BOTTOM) {
        y = addPage()
      } else {
        y += 14
      }

      y = sectionHeader(doc, y, L.pagesAnalysed, L.pagesSubtitle)

      // Table header — light gray (print-friendly)
      const colIdx = ML
      const colUrl = ML + 28
      const colStatus = ML + 390
      const colTime = ML + 440

      doc.rect(ML, y - 4, PW, 18).fill(C.bgCard)
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C.navy)
      doc.text('#', colIdx + 6, y, { lineBreak: false })
      doc.text('Page URL', colUrl + 4, y, { lineBreak: false })
      doc.text('Status', colStatus, y, { lineBreak: false })
      doc.text('Load', colTime, y, { lineBreak: false })
      y += 18

      for (let i = 0; i < pages.length; i++) {
        const pg = pages[i]
        const pgUrl = pg.url || ''
        const pgTitle = pg.title || ''
        const rowH = pgTitle ? 24 : 16

        y = ensureSpace(y, rowH + 4)

        // Alternating subtle background
        if (i % 2 === 1) {
          doc.rect(ML, y - 2, PW, rowH + 2).fill(C.bgPage)
        }

        // Row number
        doc.font('Helvetica').fontSize(7.5).fillColor(C.mutedLight)
        doc.text(`${i + 1}`, colIdx + 6, y + 2, { lineBreak: false })

        // Title + URL
        if (pgTitle) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor(C.navy)
          doc.text(pgTitle, colUrl + 4, y, { width: 340, lineBreak: false })
          doc.font('Helvetica').fontSize(7).fillColor(C.accent)
          doc.text(pgUrl, colUrl + 4, y + 11, { width: 340, lineBreak: false })
        } else {
          doc.font('Helvetica').fontSize(8).fillColor(C.accent)
          doc.text(pgUrl, colUrl + 4, y + 2, { width: 340, lineBreak: false })
        }

        // Status code
        const statusCode = pg.status_code || 0
        const statusColor = statusCode >= 200 && statusCode < 300 ? '#16A34A' : statusCode >= 400 ? '#DC2626' : C.muted
        doc.font('Helvetica-Bold').fontSize(8).fillColor(statusColor)
        doc.text(statusCode ? `${statusCode}` : '—', colStatus, y + 2, { lineBreak: false })

        // Load time
        doc.font('Helvetica').fontSize(7.5).fillColor(C.textSub)
        doc.text(pg.load_time_ms ? `${pg.load_time_ms}ms` : '—', colTime, y + 2, { lineBreak: false })

        y += rowH + 2
      }
    }

    // ════════════════════════════════════════════════════════
    //  BACK COVER — light, print-friendly
    // ════════════════════════════════════════════════════════
    y = addPage()

    // Top accent bar
    doc.rect(0, 0, PAGE_W, 4).fill(C.accent)

    // Centered content
    const backY = 300

    doc.font('Helvetica-Bold').fontSize(24).fillColor(C.navy)
    doc.text('Ready to improve', 0, backY, { align: 'center', width: PAGE_W, lineBreak: false })
    doc.text('your user experience?', 0, backY + 34, { align: 'center', width: PAGE_W, lineBreak: false })

    // Accent divider
    doc.rect((PAGE_W - 60) / 2, backY + 76, 60, 3).fill(C.accent)

    doc.font('Helvetica').fontSize(10).fillColor(C.muted)
    doc.text('This report was generated by ClearUX — Deep AI-Powered UX Audits.', 0, backY + 96, {
      align: 'center', width: PAGE_W, lineBreak: false,
    })
    doc.text('Use these findings to prioritize improvements and boost conversions.', 0, backY + 112, {
      align: 'center', width: PAGE_W, lineBreak: false,
    })

    // CTA button — accent with white text
    const btnW = 180
    const btnX = (PAGE_W - btnW) / 2
    const btnY = backY + 146
    doc.roundedRect(btnX, btnY, btnW, 36, 8).fill(C.accent)
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.white)
    doc.text('clearux.ai', 0, btnY + 10, { align: 'center', width: PAGE_W, lineBreak: false })

    // Logo at bottom
    doc.font('Helvetica-Bold').fontSize(20).fillColor(C.navy)
    doc.text('Clear', (PAGE_W / 2) - 36, PAGE_H - 90, { continued: true, lineBreak: false })
    doc.fillColor(C.accent).text('UX', { lineBreak: false })

    doc.font('Helvetica').fontSize(7).fillColor(C.mutedLight)
    doc.text(`Report ID: ${auditId}`, 0, PAGE_H - 55, { align: 'center', width: PAGE_W, lineBreak: false })
    doc.text(`Generated ${dateStr}`, 0, PAGE_H - 43, { align: 'center', width: PAGE_W, lineBreak: false })

    doc.end()
    const pdfBuffer = await pdfReady

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ClearUX-Audit-${hostname}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('PDF generation error:', msg, err instanceof Error ? err.stack : '')
    return NextResponse.json({ error: 'Failed to generate PDF', detail: msg }, { status: 500 })
  }
}
