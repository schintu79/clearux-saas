// ============================================================
// ClearUX API — GET /api/reports/:id/pdf
// Premium UX audit report — Light & Minimal (Apple/Sketch inspired)
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { createServiceSupabase } from '@/lib/supabase-server'
import { getReportLabels, getLocale } from '@/lib/languages'

/* ── Premium color palette — light & minimal ──────────────────── */
const C = {
  // Core
  white: '#FFFFFF',
  bg: '#FAFAFA',
  text: '#1D1D1F',
  textSec: '#6E6E73',
  textTert: '#86868B',
  border: '#D2D2D7',
  borderLight: '#E5E5EA',

  // Brand
  accent: '#8B5CF6',
  accentLight: '#EDE9FE',

  // Scores
  scoreGreen: '#34C759',
  scoreYellow: '#FF9500',
  scoreRed: '#FF3B30',

  // Severity
  sevCritical: '#FF3B30',
  sevHigh: '#FF9500',
  sevMedium: '#FFCC00',
  sevLow: '#007AFF',

  // Pillars
  pillarFoundation: '#8B5CF6',
  pillarHuman: '#EC4899',
  pillarTech: '#F59E0B',
  pillarFuture: '#10B981',

  // Recommendation
  recBg: '#F5F3FF',
}

const SEV: Record<string, { hex: string; label: string }> = {
  critical: { hex: C.sevCritical, label: 'CRITICAL' },
  high: { hex: C.sevHigh, label: 'HIGH' },
  medium: { hex: C.sevMedium, label: 'MEDIUM' },
  low: { hex: C.sevLow, label: 'LOW' },
}

function scoreHex(s: number): string {
  if (s >= 70) return C.scoreGreen
  if (s >= 40) return C.scoreYellow
  return C.scoreRed
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
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.text)
  doc.text(title, ML + 14, y + 2, { lineBreak: false })
  y += 24
  if (subtitle) {
    doc.font('Helvetica').fontSize(8.5).fillColor(C.textSec)
    doc.text(subtitle, ML, y, { lineBreak: false })
    y += 12
  }
  drawLine(doc, y, C.borderLight, 0.5)
  y += 10
  return y
}

/** Draw 4-axis radar chart with data polygon and axis labels */
function drawRadarChart(doc: PDFKit.PDFDocument, cx: number, cy: number, radius: number,
  data: Array<{ name: string; score: number; color: string }>) {
  const n = data.length
  const step = (2 * Math.PI) / n
  const start = -Math.PI / 2 // Start from top

  // Gridlines at 25%, 50%, 75%, 100%
  for (const pct of [0.25, 0.5, 0.75, 1.0]) {
    const r = radius * pct
    doc.save()
    for (let i = 0; i <= n; i++) {
      const angle = start + i * step
      const x = cx + r * Math.cos(angle)
      const y = cy + r * Math.sin(angle)
      if (i === 0) doc.moveTo(x, y)
      else doc.lineTo(x, y)
    }
    doc.strokeColor(C.borderLight).lineWidth(0.5).stroke()
    doc.restore()
  }

  // Axis lines
  for (let i = 0; i < n; i++) {
    const angle = start + i * step
    doc.save().moveTo(cx, cy)
      .lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle))
      .strokeColor(C.border).lineWidth(0.3).stroke().restore()
  }

  // Data polygon - fill (semi-transparent accent)
  doc.save()
  for (let i = 0; i <= n; i++) {
    const idx = i % n
    const angle = start + idx * step
    const r = (data[idx].score / 100) * radius
    const x = cx + r * Math.cos(angle)
    const y = cy + r * Math.sin(angle)
    if (i === 0) doc.moveTo(x, y)
    else doc.lineTo(x, y)
  }
  doc.fillColor(C.accent).opacity(0.12).fill()
  doc.restore()

  // Data polygon - stroke
  doc.save()
  for (let i = 0; i <= n; i++) {
    const idx = i % n
    const angle = start + idx * step
    const r = (data[idx].score / 100) * radius
    const x = cx + r * Math.cos(angle)
    const y = cy + r * Math.sin(angle)
    if (i === 0) doc.moveTo(x, y)
    else doc.lineTo(x, y)
  }
  doc.strokeColor(C.accent).lineWidth(1.5).stroke()
  doc.restore()

  // Data points (colored dots)
  for (let i = 0; i < n; i++) {
    const angle = start + i * step
    const r = (data[i].score / 100) * radius
    const px = cx + r * Math.cos(angle)
    const py = cy + r * Math.sin(angle)
    doc.save().circle(px, py, 4).fill(data[i].color).restore()
  }

  // Labels at each axis
  for (let i = 0; i < n; i++) {
    const angle = start + i * step
    const lx = cx + (radius + 25) * Math.cos(angle)
    const ly = cy + (radius + 25) * Math.sin(angle)
    const label = `${data[i].name} — ${data[i].score}`
    doc.font('Helvetica-Bold').fontSize(8).fillColor(data[i].color)

    // Position label based on quadrant
    if (i === 0) { // Top
      doc.text(label, lx - 70, ly - 14, { width: 140, align: 'center' })
    } else if (i === 1) { // Right
      doc.text(label, lx + 4, ly - 5)
    } else if (i === 2) { // Bottom
      doc.text(label, lx - 70, ly + 2, { width: 140, align: 'center' })
    } else { // Left
      const tw = doc.widthOfString(label)
      doc.text(label, lx - tw - 4, ly - 5)
    }
  }
}

/** Draw horizontal bar chart for sub-scores */
function drawSubScoreBars(doc: PDFKit.PDFDocument, x: number, y: number, scores: Array<{ label: string; score: number }>) {
  const barMaxW = 160
  const barH = 8
  const rowH = 28

  for (let i = 0; i < scores.length; i++) {
    const sy = y + i * rowH
    const s = scores[i]
    const barW = (s.score / 100) * barMaxW

    // Label
    doc.font('Helvetica').fontSize(8.5).fillColor(C.textSec)
    doc.text(s.label, x, sy + 1, { width: 100 })

    // Bar track (light gray)
    doc.save()
    doc.roundedRect(x + 105, sy + 2, barMaxW, barH, 4).fill(C.borderLight)
    doc.restore()

    // Bar fill
    if (barW > 0) {
      doc.save()
      doc.roundedRect(x + 105, sy + 2, barW, barH, 4).fill(scoreHex(s.score))
      doc.restore()
    }

    // Score number
    doc.font('Helvetica-Bold').fontSize(9).fillColor(scoreHex(s.score))
    doc.text(`${s.score}`, x + 105 + barMaxW + 10, sy, { lineBreak: false })
  }
}

/** Draw donut chart for severity distribution */
function drawDonutChart(doc: PDFKit.PDFDocument, cx: number, cy: number, outerR: number, innerR: number,
  segments: Array<{ count: number; color: string; label: string }>) {
  const total = segments.reduce((sum, s) => sum + s.count, 0)
  if (total === 0) return

  let currentAngle = -Math.PI / 2 // Start from top

  for (const seg of segments) {
    if (seg.count === 0) continue
    const sliceAngle = (seg.count / total) * 2 * Math.PI
    const endAngle = currentAngle + sliceAngle

    // Draw pie slice
    doc.save()
    const steps = Math.max(20, Math.ceil(sliceAngle / 0.05))

    // Outer arc
    doc.moveTo(
      cx + outerR * Math.cos(currentAngle),
      cy + outerR * Math.sin(currentAngle),
    )
    for (let j = 1; j <= steps; j++) {
      const a = currentAngle + (sliceAngle * j) / steps
      doc.lineTo(cx + outerR * Math.cos(a), cy + outerR * Math.sin(a))
    }
    // Line to inner arc end
    doc.lineTo(
      cx + innerR * Math.cos(endAngle),
      cy + innerR * Math.sin(endAngle),
    )
    // Inner arc (reverse)
    for (let j = steps - 1; j >= 0; j--) {
      const a = currentAngle + (sliceAngle * j) / steps
      doc.lineTo(cx + innerR * Math.cos(a), cy + innerR * Math.sin(a))
    }
    doc.closePath()
    doc.fillColor(seg.color).fill()
    doc.restore()

    currentAngle = endAngle
  }

  // Center text: total issues
  doc.font('Helvetica-Bold').fontSize(18).fillColor(C.text)
  const totalStr = `${total}`
  const tw = doc.widthOfString(totalStr)
  doc.text(totalStr, cx - tw / 2, cy - 10, { lineBreak: false })
  doc.font('Helvetica').fontSize(7).fillColor(C.textTert)
  doc.text('issues', cx - 14, cy + 8, { lineBreak: false })
}

/* ── Pillar mapping ──────────────────────────────────────── */
const PILLAR_DEFS = [
  { name: 'Foundation', color: C.pillarFoundation, categories: ['First Impression & Visual Design', 'Value Proposition & Messaging', 'Navigation & Information Architecture', 'Visual Hierarchy & Layout', 'Content Quality & Readability', 'Calls-to-Action & Conversion'] },
  { name: 'Human Experience', color: C.pillarHuman, categories: ['Trust & Credibility', 'Ethical UX & Dark Pattern Detection', 'Emotional Intelligence & Psychological Safety', 'Cognitive Accessibility & Neurodiversity', 'Digital Wellbeing & Responsible Design', 'Age Inclusivity & Digital Literacy'] },
  { name: 'Technical Excellence', color: C.pillarTech, categories: ['Performance & Page Speed', 'Mobile Experience', 'Accessibility & Inclusive Design', 'Technical SEO & Accessibility'] },
  { name: 'Future Readiness', color: C.pillarFuture, categories: ['AI Discoverability & LLM Readiness', 'AI Agent Readiness', 'Cultural Sensitivity & Global Readiness'] },
]

const PILLAR_MAP: Record<string, { pillar: string; color: string }> = {}
for (const p of PILLAR_DEFS) {
  for (const cat of p.categories) {
    PILLAR_MAP[cat] = { pillar: p.name, color: p.color }
  }
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
        Subject: 'Human-Centered Digital Audit',
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
      doc.font('Helvetica').fontSize(7).fillColor(C.textTert)
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
    //  PAGE 1: COVER PAGE — minimal, generous whitespace
    // ════════════════════════════════════════════════════════
    addPage()

    // Top accent gradient line (3px)
    doc.rect(0, 0, PAGE_W, 3).fill(C.accent)

    // Logo: "Clear" dark + "UX" accent
    doc.font('Helvetica-Bold').fontSize(16).fillColor(C.text)
    doc.text('Clear', ML, 40, { continued: true, lineBreak: false })
    doc.fillColor(C.accent).text('UX', { lineBreak: false })

    // Centered overall score
    const scoreCx = PAGE_W / 2
    const scoreCy = 180

    // Score ring (stroke only)
    doc.save()
    doc.circle(scoreCx, scoreCy, 45).lineWidth(2.5).strokeColor(scoreHex(overall)).stroke()
    doc.restore()

    // Score number (48pt bold)
    doc.font('Helvetica-Bold').fontSize(48).fillColor(scoreHex(overall))
    const scoreStr = `${overall}`
    const scoreW = doc.widthOfString(scoreStr)
    doc.text(scoreStr, scoreCx - scoreW / 2, scoreCy - 26, { lineBreak: false })

    // Score label
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.text)
    doc.text(scoreLabel(overall), 0, scoreCy + 20, { align: 'center', width: PAGE_W, lineBreak: false })

    // "/ 100" in muted text
    doc.font('Helvetica').fontSize(10).fillColor(C.textTert)
    doc.text('/ 100', 0, scoreCy + 38, { align: 'center', width: PAGE_W, lineBreak: false })

    // Website URL in accent color
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.accent)
    doc.text(a.product_url, 0, scoreCy + 62, { align: 'center', width: PAGE_W, lineBreak: false })

    // Date and tagline
    doc.font('Helvetica').fontSize(9).fillColor(C.textSec)
    doc.text(dateStr, 0, scoreCy + 82, { align: 'center', width: PAGE_W, lineBreak: false })
    doc.font('Helvetica').fontSize(9).fillColor(C.textSec)
    doc.text('Human-Centered Digital Audit', 0, scoreCy + 96, { align: 'center', width: PAGE_W, lineBreak: false })

    // Issue summary with severity breakdown
    const summaryY = scoreCy + 130
    doc.font('Helvetica-Bold').fontSize(12).fillColor(C.text)
    doc.text(`${total} Issues Identified`, 0, summaryY, { align: 'center', width: PAGE_W, lineBreak: false })

    const severityParts: string[] = []
    if (critical > 0) severityParts.push(`${critical} Critical`)
    if (high > 0) severityParts.push(`${high} High`)
    if (medium > 0) severityParts.push(`${medium} Medium`)
    if (low > 0) severityParts.push(`${low} Low`)

    if (severityParts.length) {
      doc.font('Helvetica').fontSize(8.5).fillColor(C.textTert)
      doc.text(severityParts.join('  •  '), 0, summaryY + 18, { align: 'center', width: PAGE_W, lineBreak: false })
    }

    // "Confidential" at bottom
    doc.font('Helvetica').fontSize(6).fillColor(C.textTert)
    doc.text('Confidential', 0, PAGE_H - 35, { align: 'center', width: PAGE_W, lineBreak: false })

    // ════════════════════════════════════════════════════════
    //  PAGE 2: EXECUTIVE DASHBOARD — radar + bars + donut
    // ════════════════════════════════════════════════════════
    let y2 = addPage()
    y2 = sectionHeader(doc, y2, 'Executive Dashboard', 'Pillar performance, score breakdown & issue distribution')

    // Radar chart (top, centered)
    const radarCx = PAGE_W / 2
    const radarCy = y2 + 80
    const radarRadius = 70

    // Calculate pillar averages from category scores
    // If catScores is empty (fallback), use the top-level report scores to approximate
    const pillarScores = PILLAR_DEFS.map((pillar, pIdx) => {
      const catIndices = pillar.categories.map((cat) => {
        return catScores.findIndex(cs => cs.name === cat)
      }).filter(idx => idx !== -1)

      const scores = catIndices.map(idx => catScores[idx]?.score ?? 0)
      let avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

      // Fallback: if no category scores matched, use report-level scores
      if (avgScore === 0 && catScores.length === 0) {
        const fallbacks = [r.ux_score, r.conversion_score, r.mobile_score, r.ai_discoverability_score]
        avgScore = fallbacks[pIdx] ?? overall
      }

      return { name: pillar.name, score: avgScore, color: pillar.color }
    })

    drawRadarChart(doc, radarCx, radarCy, radarRadius, pillarScores)

    // Sub-scores bars (bottom left) — use report-level scores, NOT category indices
    const subScores = [
      { label: 'UX & Design', score: r.ux_score ?? overall },
      { label: 'Conversion', score: r.conversion_score ?? overall },
      { label: 'Mobile', score: r.mobile_score ?? overall },
      { label: 'AI Discoverability', score: r.ai_discoverability_score ?? overall },
      { label: 'Content Quality', score: r.content_score ?? overall },
    ]

    const barsY = radarCy + radarRadius + 90
    drawSubScoreBars(doc, ML, barsY, subScores)

    // Severity donut (bottom right)
    const donutCx = MR - 80
    const donutCy = barsY + 45
    const donutSegments = [
      { count: critical, color: C.sevCritical, label: 'Critical' },
      { count: high, color: C.sevHigh, label: 'High' },
      { count: medium, color: C.sevMedium, label: 'Medium' },
      { count: low, color: C.sevLow, label: 'Low' },
    ]

    drawDonutChart(doc, donutCx, donutCy, 35, 18, donutSegments)

    // ════════════════════════════════════════════════════════
    //  PAGE 3: SCORE BREAKDOWN — categories grouped by pillar
    // ════════════════════════════════════════════════════════
    let y = addPage()
    y = sectionHeader(doc, y, 'Score Breakdown')

    for (const pillar of PILLAR_DEFS) {
      // Pillar heading
      y = ensureSpace(y, 18)
      doc.rect(ML, y - 2, PW, 18).fill(pillar.color)
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.white)
      doc.text(pillar.name, ML + 12, y + 3, { lineBreak: false })
      y += 18

      // Categories in this pillar
      const pillarCats = catScores.filter(cs => pillar.categories.includes(cs.name))
      for (let i = 0; i < pillarCats.length; i++) {
        const cat = pillarCats[i]
        const catScore = cat.score ?? 0
        const summaryText = cat.summary || ''
        const summaryH = summaryText ? measure(doc, summaryText, 'Helvetica', 7.5, PW - 100, 2) : 0
        const rowH = Math.max(18, summaryH + 8)

        y = ensureSpace(y, rowH + 2)

        // Alternating subtle background
        if (i % 2 === 1) {
          doc.rect(ML, y - 2, PW, rowH + 2).fill(C.bg)
        }

        // Category name
        doc.font('Helvetica').fontSize(8.5).fillColor(C.text)
        doc.text(cat.name, ML + 8, y + 1, { width: 200 })

        // Mini bar chart
        const barW = (catScore / 100) * 100
        doc.save()
        doc.roundedRect(ML + 220, y + 2, 100, 6, 3).fill(C.borderLight)
        if (barW > 0) {
          doc.roundedRect(ML + 220, y + 2, barW, 6, 3).fill(scoreHex(catScore))
        }
        doc.restore()

        // Score number
        doc.font('Helvetica-Bold').fontSize(9).fillColor(scoreHex(catScore))
        doc.text(`${catScore}`, ML + 325, y + 1, { lineBreak: false })

        // Summary text (if available)
        if (summaryText) {
          doc.font('Helvetica').fontSize(7.5).fillColor(C.textSec)
          doc.text(summaryText, ML + 360, y + 1, { width: PW - 360 + ML - 8, lineGap: 2 })
        }

        y += rowH + 2
      }

      // Space between pillars
      y += 6
    }

    // ════════════════════════════════════════════════════════
    //  PAGE 4: EXECUTIVE SUMMARY
    // ════════════════════════════════════════════════════════
    y = addPage()
    y = sectionHeader(doc, y, 'Executive Summary')

    const summaryText = r.executive_summary || 'No summary available.'
    const summaryParagraphs = summaryText.split(/\n+/).filter((p: string) => p.trim())

    for (const para of summaryParagraphs) {
      const paraH = measure(doc, para.trim(), 'Helvetica', 10, PW, 3)
      y = ensureSpace(y, paraH + 6)
      doc.font('Helvetica').fontSize(10).fillColor(C.textSec)
      doc.text(para.trim(), ML, y, { width: PW, lineGap: 3 })
      y = doc.y + 6
    }

    // Key Recommendation box
    if (r.key_recommendation) {
      const recText = r.key_recommendation as string
      const recH = measure(doc, recText, 'Helvetica', 9.5, PW - 34, 3)
      const boxH = 36 + recH

      y = ensureSpace(y, boxH + 10)
      y += 4

      // Light purple background with accent border
      doc.save()
      doc.roundedRect(ML, y, PW, boxH, 4).fill(C.recBg)
      doc.roundedRect(ML, y, PW, boxH, 4).lineWidth(0.5).strokeColor(C.accent).stroke()
      doc.restore()

      // Accent left bar
      doc.rect(ML, y, 4, boxH).fill(C.accent)

      // Label
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.accent)
      doc.text('Key Recommendation', ML + 18, y + 10, { lineBreak: false })

      // Text
      doc.font('Helvetica').fontSize(9.5).fillColor(C.textSec)
      doc.text(recText, ML + 18, y + 26, { width: PW - 34, lineGap: 3 })

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
    //  PAGE 5: PAGE OVERVIEW (if screenshot exists)
    // ════════════════════════════════════════════════════════
    if (pageOverviewBuffer) {
      y = addPage()
      y = sectionHeader(doc, y, 'Page Overview')

      const imgW = PW - 20
      const imgH = imgW * (900 / 1280)
      y = ensureSpace(y, imgH + 10)

      // Border around screenshot
      doc.save()
      doc.roundedRect(ML + 10, y, imgW, imgH, 3).lineWidth(0.5).strokeColor(C.border).stroke()
      doc.restore()
      doc.image(pageOverviewBuffer, ML + 10, y, { width: imgW, height: imgH })
      y += imgH + 6

      doc.font('Helvetica').fontSize(7).fillColor(C.textTert)
      doc.text('Captured during audit — viewport 1280×900', ML, y, { width: PW, align: 'center' })
      y += 14
    }

    // ════════════════════════════════════════════════════════
    //  PAGES 6+: FINDINGS BY PILLAR
    // ════════════════════════════════════════════════════════
    if (findings.length > 0) {
      // Group findings by severity (most impactful first)
      const sevOrder = ['critical', 'high', 'medium', 'low']
      const sevGroups: Array<{ key: string; label: string; color: string; findings: any[] }> = []

      for (const sKey of sevOrder) {
        const grouped = findings.filter((f: any) => f.severity === sKey)
        if (grouped.length === 0) continue
        const sevInfo = SEV[sKey] || SEV.medium
        sevGroups.push({ key: sKey, label: sevInfo.label, color: sevInfo.hex, findings: grouped })
      }

      // Render findings grouped by severity
      for (const group of sevGroups) {
        y = addPage()

        // Severity header with color accent bar
        doc.rect(ML, y, 4, 20).fill(group.color)
        doc.font('Helvetica-Bold').fontSize(14).fillColor(C.text)
        doc.text(`${group.label} Issues`, ML + 14, y + 2, { lineBreak: false })
        doc.font('Helvetica').fontSize(9).fillColor(C.textTert)
        doc.text(`${group.findings.length} finding${group.findings.length !== 1 ? 's' : ''}`, ML + 14 + doc.widthOfString(`${group.label} Issues  `) + 10, y + 4, { lineBreak: false })
        y += 24
        drawLine(doc, y, C.borderLight, 0.5)
        y += 10

        // Render each finding in this severity group
        for (let i = 0; i < group.findings.length; i++) {
          const fi = group.findings[i]
          const sev = SEV[fi.severity] || SEV.medium
          const titleText = fi.title || 'Untitled'
          const descText = fi.description || ''
          const recText = fi.recommendation || ''
          const pageUrl = fi.page_url || a.product_url

          const titleH = measure(doc, titleText, 'Helvetica-Bold', 10, PW - 80)
          const descH = descText ? measure(doc, descText, 'Helvetica', 9, PW - 8, 2) : 0
          const findRecH = recText ? measure(doc, recText, 'Helvetica', 8.5, PW - 28, 2) + 22 : 0
          const findingH = Math.max(titleH, 14) + 6 + descH + 6 + findRecH + 10

          y = ensureSpace(y, Math.min(findingH, 180))

          // Finding number + severity + title
          doc.font('Helvetica').fontSize(8).fillColor(C.textTert)
          doc.text(`Finding ${i + 1}`, ML, y + 2, { lineBreak: false })

          doc.font('Helvetica-Bold').fontSize(8).fillColor(sev.hex)
          doc.text(`[${sev.label}]`, ML + 60, y + 2, { lineBreak: false })

          const titleX = ML + 130
          doc.font('Helvetica-Bold').fontSize(10).fillColor(C.text)
          doc.text(titleText, titleX, y, { width: MR - titleX, lineBreak: true })
          y = Math.max(y + 16, doc.y) + 3

          // Page URL as small muted link
          doc.font('Helvetica').fontSize(7).fillColor(C.accent)
          doc.text(pageUrl, ML, y, { width: PW, lineBreak: false })
          y += 10

          // Description
          if (descText) {
            y = ensureSpace(y, 20)
            doc.font('Helvetica').fontSize(9).fillColor(C.textSec)
            doc.text(descText, ML + 4, y, { width: PW - 8, lineGap: 2 })
            y = doc.y + 4
          }

          // Recommendation block
          if (recText) {
            const thisRecH = measure(doc, recText, 'Helvetica', 8.5, PW - 28, 2) + 20
            y = ensureSpace(y, thisRecH + 4)

            doc.save()
            doc.roundedRect(ML, y - 2, PW, thisRecH + 2, 3).fill(C.recBg)
            doc.restore()
            doc.rect(ML, y - 2, 3, thisRecH + 2).fill(C.accent)

            doc.font('Helvetica-Bold').fontSize(8).fillColor(C.accent)
            doc.text('Recommendation', ML + 12, y + 1, { lineBreak: false })

            doc.font('Helvetica').fontSize(8.5).fillColor(C.textSec)
            doc.text(recText, ML + 12, y + 13, { width: PW - 28, lineGap: 2 })
            y = doc.y + 6
          }

          // Screenshot for this finding
          const screenshotBuf = screenshotBuffers.get(findings.indexOf(fi))
          if (screenshotBuf) {
            const screenshotW = PW - 40
            const screenshotH = screenshotW * (900 / 1280)
            y = ensureSpace(y, screenshotH + 24)

            y += 4
            doc.font('Helvetica-Bold').fontSize(7).fillColor(C.textTert)
            doc.text('Screenshot — highlighted area of concern', ML + 20, y, { lineBreak: false })
            y += 12

            doc.save()
            doc.roundedRect(ML + 20, y, screenshotW, screenshotH, 2).lineWidth(0.5).strokeColor(C.border).stroke()
            doc.restore()
            doc.image(screenshotBuf, ML + 20, y, { width: screenshotW, height: screenshotH })
            y += screenshotH + 6
          }

          // Separator
          y += 2
          if (i < group.findings.length - 1) {
            drawLine(doc, y, C.borderLight, 0.3)
            y += 8
          }
        }
      }
    }

    // ════════════════════════════════════════════════════════
    //  PAGES ANALYSED
    // ════════════════════════════════════════════════════════
    if (pages.length > 0) {
      y = addPage()
      y = sectionHeader(doc, y, 'Pages Analysed')

      // Table header
      const colIdx = ML
      const colUrl = ML + 28
      const colStatus = ML + 390
      const colTime = ML + 440

      doc.save()
      doc.rect(ML, y - 4, PW, 18).fill(C.bg)
      doc.restore()

      doc.font('Helvetica-Bold').fontSize(8).fillColor(C.text)
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
          doc.save()
          doc.rect(ML, y - 2, PW, rowH + 2).fill(C.bg)
          doc.restore()
        }

        // Row number
        doc.font('Helvetica').fontSize(7.5).fillColor(C.textTert)
        doc.text(`${i + 1}`, colIdx + 6, y + 2, { lineBreak: false })

        // Title + URL
        if (pgTitle) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor(C.text)
          doc.text(pgTitle, colUrl + 4, y, { width: 340, lineBreak: false })
          doc.font('Helvetica').fontSize(7).fillColor(C.accent)
          doc.text(pgUrl, colUrl + 4, y + 11, { width: 340, lineBreak: false })
        } else {
          doc.font('Helvetica').fontSize(8).fillColor(C.accent)
          doc.text(pgUrl, colUrl + 4, y + 2, { width: 340, lineBreak: false })
        }

        // Status code
        const statusCode = pg.status_code || 0
        const statusColor = statusCode >= 200 && statusCode < 300 ? C.scoreGreen : statusCode >= 400 ? C.scoreRed : C.textTert
        doc.font('Helvetica-Bold').fontSize(8).fillColor(statusColor)
        doc.text(statusCode ? `${statusCode}` : '—', colStatus, y + 2, { lineBreak: false })

        // Load time
        doc.font('Helvetica').fontSize(7.5).fillColor(C.textSec)
        doc.text(pg.load_time_ms ? `${pg.load_time_ms}ms` : '—', colTime, y + 2, { lineBreak: false })

        y += rowH + 2
      }
    }

    // ════════════════════════════════════════════════════════
    //  BACK COVER — white, minimal
    // ════════════════════════════════════════════════════════
    y = addPage()

    // Top accent line
    doc.rect(0, 0, PAGE_W, 3).fill(C.accent)

    const backY = 280

    doc.font('Helvetica-Bold').fontSize(22).fillColor(C.text)
    doc.text('Ready to improve', 0, backY, { align: 'center', width: PAGE_W, lineBreak: false })
    doc.text('your user experience?', 0, backY + 32, { align: 'center', width: PAGE_W, lineBreak: false })

    // Subtle accent divider
    doc.rect((PAGE_W - 50) / 2, backY + 70, 50, 2).fill(C.accent)

    doc.font('Helvetica').fontSize(9).fillColor(C.textSec)
    doc.text('Human-Centered Digital Audit by ClearUX', 0, backY + 90, {
      align: 'center', width: PAGE_W, lineBreak: false,
    })

    // CTA button
    const btnW = 160
    const btnX = (PAGE_W - btnW) / 2
    const btnY = backY + 120
    doc.save()
    doc.roundedRect(btnX, btnY, btnW, 32, 6).fill(C.accent)
    doc.restore()

    doc.font('Helvetica-Bold').fontSize(12).fillColor(C.white)
    doc.text('clearux.ai', 0, btnY + 8, { align: 'center', width: PAGE_W, lineBreak: false })

    // Report ID and date at bottom
    doc.font('Helvetica').fontSize(7).fillColor(C.textTert)
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
