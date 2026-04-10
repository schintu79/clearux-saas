// ============================================================
// ClearUX API — GET /api/reports/:id/pdf
// Professional branded UX audit report — matches DOCX exactly
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { createServiceSupabase } from '@/lib/supabase-server'
import { getReportLabels, getLocale } from '@/lib/languages'

/* ── Brand palette — matches DOCX constants ─────────────── */
const C = {
  accent:     '#3ECF8E',
  accentDk:   '#2BA56E',
  navy:       '#0F172A',
  navyMid:    '#1E293B',
  navyLight:  '#334155',
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
  recBorder:  '#ECFDF5',
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

/* ── Page constants ──────────────────────────────────────── */
const ML = 50           // left margin
const MR = 545          // right edge
const PW = MR - ML      // printable width
const PAGE_W = 595
const PAGE_H = 842
const CONTENT_TOP = 70
const CONTENT_BOTTOM = 785
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

/** Section header with accent left bar — matches DOCX sectionHeading */
function sectionHeader(doc: PDFKit.PDFDocument, y: number, title: string, subtitle?: string): number {
  doc.rect(ML, y, 4, 22).fill(C.accent)
  doc.font('Helvetica-Bold').fontSize(16).fillColor(C.navy)
  doc.text(title, ML + 14, y + 2, { lineBreak: false })
  y += 28
  if (subtitle) {
    doc.font('Helvetica').fontSize(8.5).fillColor(C.muted)
    doc.text(subtitle, ML, y, { lineBreak: false })
    y += 14
  }
  drawLine(doc, y, C.borderLight, 0.5)
  y += 14
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
    const findings = (findingsRes.data || []) as any[]
    const pages = (pagesRes.data || []) as any[]

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: ML, right: 50 },
      autoFirstPage: false,
      info: {
        Title: `UX Audit Report — ${a.product_url}`,
        Author: 'ClearUX (clearux.net)',
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
      doc.text('Confidential  |  clearux.net', ML, FOOTER_Y, { lineBreak: false })
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
    //  COVER PAGE — matches DOCX: dark header block + score + issues
    // ════════════════════════════════════════════════════════
    addPage()

    // Dark header block with grid (matches DOCX navy header table)
    doc.rect(0, 0, PAGE_W, 180).fill(C.navy)

    doc.save()
    doc.strokeColor(C.navyMid).lineWidth(0.3)
    for (let gx = 0; gx < PAGE_W; gx += 40) doc.moveTo(gx, 0).lineTo(gx, 180).stroke()
    for (let gy = 0; gy < 180; gy += 40) doc.moveTo(0, gy).lineTo(PAGE_W, gy).stroke()
    doc.restore()

    // Accent bar (matches DOCX accent divider table)
    doc.rect(0, 180, PAGE_W, 4).fill(C.accent)

    // Logo in header
    doc.font('Helvetica-Bold').fontSize(28).fillColor(C.white)
    doc.text('Clear', ML, 40, { continued: true, lineBreak: false })
    doc.fillColor(C.accent).text('UX', { lineBreak: false })

    // Subtitle
    doc.font('Helvetica').fontSize(11).fillColor(C.mutedLight)
    doc.text('Deep AI-Powered UX Audit Report', ML, 76, { lineBreak: false })

    // Date + Audit ID (right aligned, matching DOCX)
    doc.font('Helvetica').fontSize(8).fillColor(C.mutedLight)
    doc.text(dateStr, 0, 44, { width: MR, align: 'right', lineBreak: false })
    doc.text(`Audit ID: ${auditId.substring(0, 8)}...`, 0, 58, { width: MR, align: 'right', lineBreak: false })

    // Score — centered (matches DOCX large score + label)
    const cx = PAGE_W / 2
    const cy = 320

    doc.font('Helvetica-Bold').fontSize(56).fillColor(scoreHex(overall))
    const scoreStr = `${overall}`
    const scoreW = doc.widthOfString(scoreStr)
    doc.text(scoreStr, cx - scoreW / 2, cy - 20, { lineBreak: false })

    doc.font('Helvetica').fontSize(11).fillColor(C.muted)
    doc.text('/ 100', 0, cy + 36, { align: 'center', width: PAGE_W, lineBreak: false })

    doc.font('Helvetica-Bold').fontSize(15).fillColor(C.navy)
    doc.text(scoreLabel(overall), 0, cy + 56, { align: 'center', width: PAGE_W, lineBreak: false })

    // URL (matches DOCX accent URL)
    doc.font('Helvetica-Bold').fontSize(12).fillColor(C.accent)
    doc.text(a.product_url, 0, cy + 86, { align: 'center', width: PAGE_W, lineBreak: false })

    // Issue summary — dark pill (matches DOCX navy issue card)
    const chipY = cy + 120
    const chipW = 400
    const chipX = (PAGE_W - chipW) / 2

    doc.roundedRect(chipX, chipY, chipW, 50, 6).fill(C.navy)

    doc.font('Helvetica-Bold').fontSize(12).fillColor(C.white)
    doc.text(`${total} ${L.issuesIdentified}`, 0, chipY + 8, { align: 'center', width: PAGE_W, lineBreak: false })

    const chipParts: string[] = []
    if (critical > 0) chipParts.push(`${critical} Critical`)
    if (high > 0) chipParts.push(`${high} High`)
    if (medium > 0) chipParts.push(`${medium} Medium`)
    if (low > 0) chipParts.push(`${low} Low`)
    if (chipParts.length) {
      doc.font('Helvetica').fontSize(9).fillColor(C.mutedLight)
      doc.text(chipParts.join('  |  '), 0, chipY + 30, { align: 'center', width: PAGE_W, lineBreak: false })
    }

    // Confidential footer on cover
    doc.font('Helvetica').fontSize(7).fillColor(C.mutedLight)
    doc.text(L.confidential, 0, PAGE_H - 35, {
      align: 'center', width: PAGE_W, lineBreak: false,
    })

    // ════════════════════════════════════════════════════════
    //  SCORE BREAKDOWN — matches DOCX table with navy header
    // ════════════════════════════════════════════════════════
    let y = addPage()

    y = sectionHeader(doc, y, L.scoreBreakdown, L.scoreSubtitle)

    if (catScores.length > 0) {
      // Table header row — navy background (matches DOCX)
      const colName = ML
      const colScore = ML + 260
      const colSummary = ML + 310

      doc.rect(ML, y - 4, PW, 20).fill(C.navy)
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.white)
      doc.text(L.category, colName + 8, y, { lineBreak: false })
      doc.text(L.score, colScore + 4, y, { lineBreak: false })
      doc.text(L.summary, colSummary + 8, y, { lineBreak: false })
      y += 20

      for (let i = 0; i < catScores.length; i++) {
        const cat = catScores[i]
        const val = cat.score ?? 0
        const summary = cat.summary || ''
        const summaryH = summary ? measure(doc, summary, 'Helvetica', 8, PW - colSummary + ML - 16, 2) : 0
        const rowH = Math.max(22, summaryH + 10)

        y = ensureSpace(y, rowH + 2)

        // Alternating row background (matches DOCX)
        const rowBg = i % 2 === 0 ? C.white : C.bgCard
        doc.rect(ML, y - 2, PW, rowH + 4).fill(rowBg)

        // Thin borders
        drawLine(doc, y - 2, C.borderLight, 0.3)

        // Category name — bold navy (matches DOCX)
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.navy)
        doc.text(cat.name, colName + 8, y + 2, { width: 240, lineBreak: false })

        // Score — colored (matches DOCX)
        doc.font('Helvetica-Bold').fontSize(12).fillColor(scoreHex(val))
        doc.text(`${val}`, colScore + 4, y + 1, { lineBreak: false })

        // Summary — muted text (matches DOCX)
        if (summary) {
          doc.font('Helvetica').fontSize(8).fillColor(C.textSub)
          doc.text(summary, colSummary + 8, y + 2, { width: PW - (colSummary - ML) - 16, lineGap: 2, lineBreak: true })
        }

        y += rowH + 4
      }
      drawLine(doc, y - 2, C.borderLight, 0.3)
    } else {
      // Fallback: individual score rows
      const scores = [
        { label: 'Overall Score', v: r.overall_score },
        { label: 'User Experience', v: r.ux_score },
        { label: 'Conversion', v: r.conversion_score },
        { label: 'Mobile Experience', v: r.mobile_score },
        { label: 'AI Discoverability', v: r.ai_discoverability_score },
        { label: 'Content Quality', v: r.content_score },
      ]
      for (let i = 0; i < scores.length; i++) {
        const val = scores[i].v ?? 0
        y = ensureSpace(y, 28)

        const rowBg = i % 2 === 0 ? C.white : C.bgCard
        doc.rect(ML, y - 2, PW, 24).fill(rowBg)

        doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy)
        doc.text(scores[i].label, ML + 8, y + 4, { lineBreak: false })
        doc.font('Helvetica-Bold').fontSize(14).fillColor(scoreHex(val))
        doc.text(`${val}`, 0, y + 2, { width: MR - 8, align: 'right', lineBreak: false })
        y += 26
      }
    }

    // ════════════════════════════════════════════════════════
    //  EXECUTIVE SUMMARY — matches DOCX
    // ════════════════════════════════════════════════════════
    const summaryText = r.executive_summary || 'No summary available.'
    const recH = r.key_recommendation ? measure(doc, r.key_recommendation, 'Helvetica', 9, PW - 30, 3) + 44 : 0

    if (y + 120 > CONTENT_BOTTOM) {
      y = addPage()
    } else {
      y += 20
    }

    y = sectionHeader(doc, y, L.executiveSummary)

    // Summary paragraphs (matches DOCX paragraph layout)
    const summaryParagraphs = summaryText.split(/\n+/).filter((p: string) => p.trim())
    for (const para of summaryParagraphs) {
      const paraH = measure(doc, para.trim(), 'Helvetica', 10, PW, 4)
      y = ensureSpace(y, paraH + 8)
      doc.font('Helvetica').fontSize(10).fillColor(C.textSub)
      doc.text(para.trim(), ML, y, { width: PW, lineGap: 4, lineBreak: true })
      y = doc.y + 8
    }

    // Key Recommendation — dark card with accent left border (matches DOCX)
    if (r.key_recommendation) {
      const recText = r.key_recommendation as string
      const thisRecH = measure(doc, recText, 'Helvetica', 9.5, PW - 34, 3)
      const boxH = 40 + thisRecH

      y = ensureSpace(y, boxH + 12)
      y += 4

      // Navy background (matches DOCX navy shading)
      doc.roundedRect(ML, y, PW, boxH, 4).fill(C.navy)
      // Accent left bar (matches DOCX left border accent)
      doc.rect(ML, y, 4, boxH).fill(C.accent)

      // Label (matches DOCX "Key Recommendation" text)
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.accent)
      doc.text(L.keyRecommendation, ML + 18, y + 10, { lineBreak: false })

      // Recommendation text (matches DOCX light grey on navy)
      doc.font('Helvetica').fontSize(9.5).fillColor('#CBD5E1')
      doc.text(recText, ML + 18, y + 28, { width: PW - 34, lineGap: 3, lineBreak: true })

      y = y + boxH + 14
    }

    // ════════════════════════════════════════════════════════
    //  DETAILED FINDINGS — matches DOCX finding layout exactly
    // ════════════════════════════════════════════════════════
    if (findings.length > 0) {
      if (y + 140 > CONTENT_BOTTOM) {
        y = addPage()
      } else {
        y += 20
      }

      y = sectionHeader(doc, y, L.detailedFindings, `${total} ${L.issuesIdentified}`)

      for (let i = 0; i < findings.length; i++) {
        const fi = findings[i]
        const sev = SEV[fi.severity] || SEV.medium
        const titleText = fi.title || 'Untitled'
        const descText = fi.description || ''
        const recText = fi.recommendation || ''

        const titleH = measure(doc, titleText, 'Helvetica-Bold', 10.5, PW - 90)
        const descH = descText ? measure(doc, descText, 'Helvetica', 9.5, PW - 8, 3) : 0
        const findRecH = recText ? measure(doc, recText, 'Helvetica', 9, PW - 30, 2) + 28 : 0
        const findingH = Math.max(titleH, 16) + 8 + descH + 8 + findRecH + 16

        y = ensureSpace(y, Math.min(findingH, 200))

        // Finding header line: #N  [SEVERITY]  Title  (matches DOCX layout)
        doc.font('Helvetica').fontSize(8).fillColor(C.mutedLight)
        doc.text(`#${i + 1}`, ML, y + 3, { lineBreak: false })

        const numW = doc.widthOfString(`#${i + 1}`) + 8

        // Severity badge
        doc.font('Helvetica-Bold').fontSize(8).fillColor(sev.hex)
        doc.text(`[${sev.label}]`, ML + numW, y + 3, { lineBreak: false })
        const sevW = doc.widthOfString(`[${sev.label}]`) + 8

        // Title
        const titleX = ML + numW + sevW
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.navy)
        doc.text(titleText, titleX, y + 1, { width: MR - titleX, lineBreak: true })
        y = Math.max(y + 20, doc.y) + 4

        // Description (matches DOCX description paragraph)
        if (descText) {
          y = ensureSpace(y, 24)
          doc.font('Helvetica').fontSize(9.5).fillColor(C.textSub)
          doc.text(descText, ML + 4, y, { width: PW - 8, lineGap: 3, lineBreak: true })
          y = doc.y + 6
        }

        // Recommendation block — light green bg + accent left bar (matches DOCX)
        if (recText) {
          const thisRecH = measure(doc, recText, 'Helvetica', 9, PW - 30, 2) + 24
          y = ensureSpace(y, thisRecH + 4)

          // Light green background (matches DOCX F0FDF4 shading)
          doc.roundedRect(ML, y - 2, PW, thisRecH + 4, 4).fill(C.recBg)
          // Accent left bar (matches DOCX accent left border)
          doc.rect(ML, y - 2, 3, thisRecH + 4).fill(C.accent)

          // Label
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.accent)
          doc.text(L.recommendation, ML + 14, y + 2, { lineBreak: false })

          // Text
          doc.font('Helvetica').fontSize(9).fillColor(C.textSub)
          doc.text(recText, ML + 14, y + 16, { width: PW - 30, lineGap: 2, lineBreak: true })
          y = doc.y + 8
        }

        // Separator between findings (matches DOCX border-bottom)
        y += 4
        if (i < findings.length - 1) {
          drawLine(doc, y, C.borderLight, 0.3)
          y += 12
        }
      }
    }

    // ════════════════════════════════════════════════════════
    //  PAGES ANALYSED — table matching DOCX exactly
    // ════════════════════════════════════════════════════════
    if (pages.length > 0) {
      if (y + 100 > CONTENT_BOTTOM) {
        y = addPage()
      } else {
        y += 20
      }

      y = sectionHeader(doc, y, L.pagesAnalysed, L.pagesSubtitle)

      // Table header (matches DOCX navy header row)
      const colIdx = ML
      const colUrl = ML + 30
      const colStatus = ML + 390
      const colTime = ML + 440

      doc.rect(ML, y - 4, PW, 20).fill(C.navy)
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C.white)
      doc.text('#', colIdx + 6, y, { lineBreak: false })
      doc.text('Page URL', colUrl + 4, y, { lineBreak: false })
      doc.text('Status', colStatus, y, { lineBreak: false })
      doc.text('Load', colTime, y, { lineBreak: false })
      y += 20

      for (let i = 0; i < pages.length; i++) {
        const pg = pages[i]
        const pgUrl = pg.url || ''
        const pgTitle = pg.title || ''
        const rowH = pgTitle ? 26 : 18

        y = ensureSpace(y, rowH + 4)

        // Alternating row background (matches DOCX)
        const rowBg = i % 2 === 0 ? C.white : C.bgCard
        doc.rect(ML, y - 2, PW, rowH + 4).fill(rowBg)

        // Row number
        doc.font('Helvetica').fontSize(7.5).fillColor(C.mutedLight)
        doc.text(`${i + 1}`, colIdx + 6, y + 2, { lineBreak: false })

        // Title + URL (matches DOCX: title bold navy, URL accent)
        if (pgTitle) {
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.navy)
          doc.text(pgTitle, colUrl + 4, y, { width: 340, lineBreak: false })
          doc.font('Helvetica').fontSize(7.5).fillColor(C.accent)
          doc.text(pgUrl, colUrl + 4, y + 12, { width: 340, lineBreak: false })
        } else {
          doc.font('Helvetica').fontSize(8.5).fillColor(C.accent)
          doc.text(pgUrl, colUrl + 4, y + 2, { width: 340, lineBreak: false })
        }

        // Status code (matches DOCX colored status)
        const statusCode = pg.status_code || 0
        const statusColor = statusCode >= 200 && statusCode < 300 ? '#16A34A' : statusCode >= 400 ? '#DC2626' : C.muted
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(statusColor)
        doc.text(statusCode ? `${statusCode}` : '—', colStatus, y + 2, { lineBreak: false })

        // Load time
        doc.font('Helvetica').fontSize(8).fillColor(C.textSub)
        doc.text(pg.load_time_ms ? `${pg.load_time_ms}ms` : '—', colTime, y + 2, { lineBreak: false })

        y += rowH + 4
      }
    }

    // ════════════════════════════════════════════════════════
    //  BACK COVER — dark branded (matches DOCX back page)
    // ════════════════════════════════════════════════════════
    y = addPage()

    // Full dark background
    doc.rect(0, 0, PAGE_W, PAGE_H).fill(C.navy)

    // Subtle grid
    doc.save()
    doc.strokeColor(C.navyMid).lineWidth(0.3)
    for (let gx = 0; gx < PAGE_W; gx += 50) doc.moveTo(gx, 0).lineTo(gx, PAGE_H).stroke()
    for (let gy = 0; gy < PAGE_H; gy += 50) doc.moveTo(0, gy).lineTo(PAGE_W, gy).stroke()
    doc.restore()

    // Centered content (matches DOCX back page layout)
    const backY = 300

    doc.font('Helvetica-Bold').fontSize(28).fillColor(C.white)
    doc.text('Ready to improve', 0, backY, { align: 'center', width: PAGE_W, lineBreak: false })
    doc.text('your user experience?', 0, backY + 38, { align: 'center', width: PAGE_W, lineBreak: false })

    // Accent divider
    doc.rect((PAGE_W - 60) / 2, backY + 82, 60, 3).fill(C.accent)

    doc.font('Helvetica').fontSize(10).fillColor(C.mutedLight)
    doc.text('This report was generated by ClearUX — Deep AI-Powered UX Audits.', 0, backY + 102, {
      align: 'center', width: PAGE_W, lineBreak: false,
    })
    doc.text('Use these findings to prioritize improvements and boost conversions.', 0, backY + 118, {
      align: 'center', width: PAGE_W, lineBreak: false,
    })

    // CTA button
    const btnW = 180
    const btnX = (PAGE_W - btnW) / 2
    const btnY = backY + 152
    doc.roundedRect(btnX, btnY, btnW, 40, 8).fill(C.accent)
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.white)
    doc.text('clearux.net', 0, btnY + 11, { align: 'center', width: PAGE_W, lineBreak: false })

    // Logo at bottom
    doc.font('Helvetica-Bold').fontSize(20).fillColor(C.white)
    doc.text('Clear', (PAGE_W / 2) - 36, PAGE_H - 90, { continued: true, lineBreak: false })
    doc.fillColor(C.accent).text('UX', { lineBreak: false })

    doc.font('Helvetica').fontSize(7).fillColor('#475569')
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
