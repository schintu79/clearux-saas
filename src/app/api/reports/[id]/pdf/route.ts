// ============================================================
// ClearUX API — GET /api/reports/:id/pdf
// PDFKit generation — mirrors DOCX layout exactly
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { getReportLabels, getLocale, getUILabels, getPillarNames, getScoreLabel, getSeverityLabel } from '@/lib/languages'
import fs from 'fs'
import path from 'path'

/* ── Colors — identical to DOCX route ────────────────────── */
const C = {
  white: '#FFFFFF',
  bg: '#F9FAFB',
  text: '#1D1D1F',
  textBody: '#4A4A4F',
  textSec: '#6E6E73',
  textTert: '#86868B',
  border: '#D2D2D7',
  borderLight: '#E8E8ED',
  // Scores
  scoreGreen: '#22C55E',
  scoreYellow: '#EAB308',
  scoreRed: '#EF4444',
  // Severity
  sevCritical: '#EF4444',
  sevHigh: '#F97316',
  sevMedium: '#EAB308',
  sevLow: '#3B82F6',
  sevCriticalBg: '#FEF2F2',
  sevHighBg: '#FFF7ED',
  sevMediumBg: '#FEFCE8',
  sevLowBg: '#EFF6FF',
  // Pillars
  pillarFoundation: '#8B5CF6',
  pillarFoundationBg: '#F5F3FF',
  pillarHuman: '#EC4899',
  pillarHumanBg: '#FDF2F8',
  pillarInclusive: '#F59E0B',
  pillarInclusiveBg: '#FFFBEB',
  pillarFuture: '#10B981',
  pillarFutureBg: '#ECFDF5',
  // Boxes
  impactBg: '#ECFDF5',
  impactText: '#047857',
}

const PILLAR_STYLES = [
  { start: 0, end: 4, color: C.pillarFoundation, bg: C.pillarFoundationBg },
  { start: 4, end: 8, color: C.pillarHuman, bg: C.pillarHumanBg },
  { start: 8, end: 12, color: C.pillarInclusive, bg: C.pillarInclusiveBg },
  { start: 12, end: 16, color: C.pillarFuture, bg: C.pillarFutureBg },
]

function scoreColor(s: number): string {
  if (s >= 70) return C.scoreGreen
  if (s >= 40) return C.scoreYellow
  return C.scoreRed
}

function sevColor(sev: string): string {
  switch (sev) {
    case 'critical': return C.sevCritical
    case 'high': return C.sevHigh
    case 'medium': return C.sevMedium
    case 'low': return C.sevLow
    default: return C.textSec
  }
}

/* ── Main route ───────────────────────────────────────────── */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: auditId } = await params

    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()
    const { data: ownerCheck } = await db.from('audits').select('user_id').eq('id', auditId).single()
    if (!ownerCheck || ((ownerCheck as any).user_id !== user.id && user.email !== 's.schintu@gmail.com'))
      return NextResponse.json({ error: 'Not authorized to access this report' }, { status: 403 })

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

    const wlCompany: string | null = a.white_label_company_name || null
    const wlLogoUrl: string | null = a.white_label_logo_url || null
    const isWhiteLabel = !!(wlCompany || wlLogoUrl)

    const lang = a.language || 'en'
    const L = getReportLabels(lang)
    const UI = getUILabels(lang)
    const pillarNames = getPillarNames(lang)
    const PILLARS = PILLAR_STYLES.map((s, i) => ({ ...s, name: pillarNames[i] }))
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
    const topRecs: string[] = rawJson.topRecommendations || (rawJson.keyRecommendation ? [rawJson.keyRecommendation] : [])

    // Assign findings to pillars (same logic as DOCX)
    const findingMap: Record<string, Record<string, any[]>> = {}
    for (const p of PILLARS) {
      findingMap[p.name] = {}
      const cats = catScores.slice(p.start, Math.min(p.end, catScores.length))
      for (const cat of cats) findingMap[p.name][cat.name] = []
    }
    for (const finding of f) {
      let matched = false
      for (const p of PILLARS) {
        const cats = catScores.slice(p.start, Math.min(p.end, catScores.length))
        for (const cat of cats) {
          const words = cat.name.toLowerCase().split(/[&,\s]+/).filter((w: string) => w.length > 3)
          const text = `${finding.title} ${finding.description}`.toLowerCase()
          if (words.some((w: string) => text.includes(w))) {
            findingMap[p.name][cat.name].push(finding)
            matched = true
            break
          }
        }
        if (matched) break
      }
      if (!matched) {
        const catIdx = Math.min(Math.floor(finding.sort_order / Math.max(1, f.length / 16)), 15)
        const pillar = PILLARS.find(p => catIdx >= p.start && catIdx < p.end) || PILLARS[0]
        const cats = catScores.slice(pillar.start, Math.min(pillar.end, catScores.length))
        if (cats.length > 0) {
          const localIdx = catIdx - pillar.start
          const cat = cats[Math.min(localIdx, cats.length - 1)]
          if (findingMap[pillar.name][cat.name]) findingMap[pillar.name][cat.name].push(finding)
          else findingMap[pillar.name][cats[0].name].push(finding)
        }
      }
    }

    const pillarScores = PILLARS.map(p => {
      const cats = catScores.slice(p.start, Math.min(p.end, catScores.length))
      return { ...p, avg: cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 0 }
    })

    // ── Build PDF ──────────────────────────────────────────
    // Font: Helvetica (closest to Arial available in PDFKit without embedding)
    // Size mapping: DOCX half-points / 2 = PDF points
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 72, bottom: 72, left: 72, right: 72 } })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    const pageW = 612
    const contentW = pageW - 144
    const leftM = 72
    const pageBottom = 740 // usable area bottom

    // Helper: ensure enough space, else new page
    const ensureSpace = (needed: number) => {
      if (doc.y > pageBottom - needed) doc.addPage()
    }

    // Helper: section heading with dark left bar (matches DOCX border-left)
    const sectionHead = (title: string, fontSize: number = 18) => {
      ensureSpace(40)
      const sy = doc.y
      doc.rect(leftM, sy, 4, 22).fill(C.text)
      doc.fontSize(fontSize).font('Helvetica-Bold').fillColor(C.text)
        .text(title, leftM + 14, sy + 1, { width: contentW - 14 })
      doc.moveDown(0.4)
    }

    // ═══════════════════════════════════════════════════════
    // COVER PAGE
    // ═══════════════════════════════════════════════════════

    doc.y = 120 // generous top spacing (matches DOCX spacing: { after: 800 })

    // Logo
    let logoLoaded = false
    if (wlLogoUrl) {
      try {
        const logoRes = await fetch(wlLogoUrl)
        if (logoRes.ok) {
          const ab = await logoRes.arrayBuffer()
          const logoBuf = Buffer.from(ab)
          doc.image(logoBuf, (pageW - 200) / 2, doc.y, { fit: [200, 80], align: 'center', valign: 'center' })
          doc.y += 85
          logoLoaded = true
        }
      } catch {}
    }
    if (!logoLoaded) {
      try {
        const logoPath = path.join(process.cwd(), 'public', 'logo-clearux.png')
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, (pageW - 200) / 2, doc.y, { fit: [200, 80], align: 'center', valign: 'center' })
          doc.y += 85
          logoLoaded = true
        }
      } catch {}
    }
    if (!logoLoaded) {
      // DOCX fallback: size 80 half-pt = 40pt
      doc.fontSize(40).font('Helvetica-Bold').fillColor(C.text)
        .text(wlCompany || 'ClearUX', leftM, doc.y, { align: 'center', width: contentW })
    }

    // Subtitle (DOCX: size 22 = 11pt)
    const subtitle = isWhiteLabel
      ? (wlCompany ? `${wlCompany} — ${UI.uxAuditReport}` : UI.uxAuditReport)
      : UI.reportSubtitle
    doc.fontSize(11).font('Helvetica').fillColor(C.textSec)
      .text(subtitle, leftM, doc.y + 2, { align: 'center', width: contentW })

    // Large overall score (DOCX: size 144 = 72pt)
    doc.moveDown(3)
    doc.fontSize(72).font('Helvetica-Bold').fillColor(scoreColor(overall))
      .text(`${overall}`, leftM, undefined, { align: 'center', width: contentW, continued: true })
    // / 100 (DOCX: size 28 = 14pt)
    doc.fontSize(14).font('Helvetica').fillColor(C.textTert).text(' / 100')

    // Score label (DOCX: size 28 = 14pt bold)
    doc.fontSize(14).font('Helvetica-Bold').fillColor(C.text)
      .text(getScoreLabel(overall, lang), leftM, undefined, { align: 'center', width: contentW })

    // URL (DOCX: size 22 = 11pt, color textSec)
    doc.moveDown(1.5)
    doc.fontSize(11).font('Helvetica').fillColor(C.textSec)
      .text(a.product_url, leftM, undefined, { align: 'center', width: contentW })

    // Date (DOCX: size 20 = 10pt)
    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica').fillColor(C.textSec)
      .text(dateStr, leftM, undefined, { align: 'center', width: contentW })
    doc.text(`${total} ${L.issuesIdentified}`, leftM, undefined, { align: 'center', width: contentW })

    // Pillar scores row (DOCX: score size 36 = 18pt, name size 16 = 8pt)
    doc.moveDown(2)
    const colW = contentW / 4
    const pillarY = doc.y
    for (let i = 0; i < pillarScores.length; i++) {
      const p = pillarScores[i]
      const x = leftM + i * colW
      doc.fontSize(18).font('Helvetica-Bold').fillColor(p.color)
        .text(`${p.avg}`, x, pillarY, { width: colW, align: 'center' })
      doc.fontSize(8).font('Helvetica').fillColor(C.textSec)
        .text(p.name, x, pillarY + 22, { width: colW, align: 'center' })
    }

    // ═══════════════════════════════════════════════════════
    // EXECUTIVE SUMMARY
    // ═══════════════════════════════════════════════════════
    doc.addPage()

    sectionHead(L.executiveSummary)

    // Summary text (DOCX: size 21 = 10.5pt)
    const summaryText = r.executive_summary || ''
    for (const para of summaryText.split('\n').filter((s: string) => s.trim())) {
      doc.fontSize(10.5).font('Helvetica').fillColor(C.textBody)
        .text(para.trim(), leftM, undefined, { width: contentW, lineGap: 2 })
      doc.moveDown(0.5)
    }

    doc.moveDown(0.5)

    // Top Priority Recommendations (DOCX: heading size 30 = 15pt)
    if (topRecs.length > 0) {
      sectionHead(L.topPriorityRecommendations, 15)

      for (let i = 0; i < topRecs.length; i++) {
        ensureSpace(50)
        const recY = doc.y
        // Measure text height for proper box sizing
        const textH = doc.fontSize(10).font('Helvetica').heightOfString(topRecs[i], { width: contentW - 50 })
        const boxH = Math.max(36, textH + 18)
        // Background (DOCX: C.bg = #F9FAFB)
        doc.rect(leftM, recY, contentW, boxH).fill(C.bg)
        // Number (DOCX: size 26 = 13pt bold, color text)
        doc.fontSize(13).font('Helvetica-Bold').fillColor(C.text)
          .text(`${i + 1}`, leftM + 10, recY + 9)
        // Text (DOCX: size 20 = 10pt)
        doc.fontSize(10).font('Helvetica').fillColor(C.textBody)
          .text(topRecs[i], leftM + 38, recY + 9, { width: contentW - 54 })
        doc.y = recY + boxH + 5
      }
    }

    // Research note (DOCX: size 18 = 9pt italic)
    doc.moveDown(0.5)
    doc.rect(leftM, doc.y, contentW, 30).fill(C.bg)
    const noteY = doc.y
    doc.fontSize(9).font('Helvetica-Oblique').fillColor(C.textSec)
      .text(`For deep qualitative research (user interviews, usability testing), we recommend pairing ${wlCompany || 'ClearUX'} findings with a specialist.`,
        leftM + 12, noteY + 8, { width: contentW - 24 })
    doc.y = noteY + 34

    // ═══════════════════════════════════════════════════════
    // SCORE BREAKDOWN
    // ═══════════════════════════════════════════════════════
    doc.addPage()

    sectionHead(L.scoreBreakdown)
    // Subtitle (DOCX: size 19 = 9.5pt)
    doc.fontSize(9.5).font('Helvetica').fillColor(C.textSec)
      .text(L.scoreSubtitle, leftM, undefined, { width: contentW })
    doc.moveDown(1)

    for (const pillar of pillarScores) {
      const cats = catScores.slice(pillar.start, Math.min(pillar.end, catScores.length))
      ensureSpace(60 + cats.length * 22)

      // Pillar header bar (DOCX: colored bg, name size 26 = 13pt, score size 44 = 22pt)
      const phy = doc.y
      const pillarBarH = 42
      doc.rect(leftM, phy, contentW, pillarBarH).fill(pillar.bg)
      doc.fontSize(13).font('Helvetica-Bold').fillColor(pillar.color)
        .text(pillar.name, leftM + 12, phy + 7, { width: contentW - 80 })
      // Categories count (DOCX: size 17 = 8.5pt)
      doc.fontSize(8.5).font('Helvetica').fillColor(C.textSec)
        .text(`${cats.length} ${UI.categoriesEvaluated}`, leftM + 12, phy + 24)
      // Score (DOCX: size 44 = 22pt bold)
      doc.fontSize(22).font('Helvetica-Bold').fillColor(pillar.color)
        .text(`${pillar.avg}`, leftM + contentW - 60, phy + 9, { width: 48, align: 'right' })
      doc.y = phy + pillarBarH + 4

      // Category rows
      for (const cat of cats) {
        if (doc.y > pageBottom - 20) doc.addPage()
        const cy = doc.y
        // Name (DOCX: size 18 = 9pt)
        doc.fontSize(9).font('Helvetica').fillColor(C.textBody)
          .text(cat.name, leftM + 18, cy + 3, { width: 180 })
        // Progress bar
        const barX = leftM + 210
        const barW = contentW - 290
        const barH = 5
        doc.rect(barX, cy + 6, barW, barH).fill(C.borderLight)
        doc.rect(barX, cy + 6, Math.max(1, (cat.score / 100) * barW), barH).fill(pillar.color)
        // Score (DOCX: size 20 = 10pt bold)
        doc.fontSize(10).font('Helvetica-Bold').fillColor(scoreColor(cat.score))
          .text(`${cat.score}`, leftM + contentW - 40, cy + 2, { width: 36, align: 'right' })
        doc.y = cy + 18

        // Category summary (DOCX: size 16 = 8pt italic)
        if (cat.summary) {
          doc.fontSize(8).font('Helvetica-Oblique').fillColor(C.textSec)
            .text(cat.summary, leftM + 18, undefined, { width: contentW - 36 })
          doc.moveDown(0.2)
        }
      }
      doc.moveDown(0.8)
    }

    // ═══════════════════════════════════════════════════════
    // DETAILED FINDINGS
    // ═══════════════════════════════════════════════════════
    doc.addPage()

    sectionHead(L.detailedFindings)
    doc.fontSize(9.5).font('Helvetica').fillColor(C.textSec)
      .text(L.findingsSubtitle, leftM, undefined, { width: contentW })
    doc.moveDown(1)

    for (const pillar of pillarScores) {
      const pillarFindings = findingMap[pillar.name] || {}
      const hasFindings = Object.values(pillarFindings).some((arr: any[]) => arr.length > 0)
      if (!hasFindings) continue

      // Pillar header (DOCX: size 28 = 14pt bold, bottom border)
      ensureSpace(30)
      doc.fontSize(14).font('Helvetica-Bold').fillColor(pillar.color)
        .text(pillar.name, leftM, undefined, { width: contentW })
      doc.moveTo(leftM, doc.y).lineTo(leftM + contentW, doc.y)
        .strokeColor(pillar.color).lineWidth(0.75).stroke()
      doc.moveDown(0.5)

      for (const [catName, catFindings] of Object.entries(pillarFindings)) {
        const findings = catFindings as any[]
        if (findings.length === 0) continue

        const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
        findings.sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4))

        // Category header (DOCX: name size 22 = 11pt, count size 17 = 8.5pt)
        ensureSpace(40)
        doc.fontSize(11).font('Helvetica-Bold').fillColor(C.text)
          .text(catName, leftM, undefined, { width: contentW, continued: true })
        doc.fontSize(8.5).font('Helvetica').fillColor(C.textTert)
          .text(`  ${findings.length} finding${findings.length !== 1 ? 's' : ''}`)
        doc.moveDown(0.3)

        for (const finding of findings) {
          ensureSpace(60)

          const sev = (finding.severity || 'medium').toLowerCase()

          // Severity badge + URL (DOCX: size 16 = 8pt)
          doc.fontSize(8).font('Helvetica-Bold').fillColor(sevColor(sev))
            .text(getSeverityLabel(sev, lang).toUpperCase(), leftM, undefined, { continued: true })
          if (finding.page_url) {
            let displayUrl = finding.page_url
            try {
              const u = new URL(finding.page_url)
              const urlPath = u.pathname + u.search
              displayUrl = u.hostname + (urlPath === '/' ? '' : urlPath)
            } catch {}
            doc.font('Helvetica').fillColor(C.textTert).text(`    ${displayUrl}`)
          } else {
            doc.text('')
          }

          // Title (DOCX: size 21 = 10.5pt bold)
          doc.fontSize(10.5).font('Helvetica-Bold').fillColor(C.text)
            .text(finding.title, leftM, undefined, { width: contentW })

          // Description (DOCX: size 19 = 9.5pt)
          if (finding.description) {
            doc.fontSize(9.5).font('Helvetica').fillColor(C.textBody)
              .text(finding.description, leftM, undefined, { width: contentW, lineGap: 1.5 })
          }

          // Recommendation box (DOCX: bg F9FAFB, label size 17 = 8.5pt, text size 19 = 9.5pt)
          if (finding.recommendation) {
            doc.moveDown(0.3)
            const recY = doc.y
            const labelH = 12
            const recTextH = doc.heightOfString(finding.recommendation, { width: contentW - 24 })
            const boxH = labelH + recTextH + 16
            ensureSpace(boxH + 5)
            const actualY = doc.y
            doc.rect(leftM, actualY, contentW, boxH).fill(C.bg)
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.text)
              .text(L.recommendation, leftM + 12, actualY + 6)
            doc.fontSize(9.5).font('Helvetica').fillColor(C.textBody)
              .text(finding.recommendation, leftM + 12, actualY + 6 + labelH + 2, { width: contentW - 24 })
            doc.y = actualY + boxH + 4
          }

          // Impact box (DOCX: bg ECFDF5, text color 047857)
          if (finding.estimated_impact) {
            const impY = doc.y
            const labelH = 12
            const impTextH = doc.heightOfString(finding.estimated_impact, { width: contentW - 24 })
            const boxH = labelH + impTextH + 16
            ensureSpace(boxH + 5)
            const actualY = doc.y
            doc.rect(leftM, actualY, contentW, boxH).fill(C.impactBg)
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.text)
              .text('Expected Impact', leftM + 12, actualY + 6)
            doc.fontSize(9.5).font('Helvetica').fillColor(C.impactText)
              .text(finding.estimated_impact, leftM + 12, actualY + 6 + labelH + 2, { width: contentW - 24 })
            doc.y = actualY + boxH + 4
          }

          doc.moveDown(0.6)
        }
      }
    }

    // ═══════════════════════════════════════════════════════
    // PAGES ANALYSED
    // ═══════════════════════════════════════════════════════
    if (pages.length > 0) {
      doc.addPage()

      sectionHead(L.pagesAnalysed)
      doc.fontSize(9.5).font('Helvetica').fillColor(C.textSec)
        .text(L.pagesSubtitle, leftM, undefined, { width: contentW })
      doc.moveDown(1)

      // Table header
      const col1W = 220
      const col2W = contentW - col1W
      const headerY = doc.y
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.textSec)
        .text(L.title, leftM, headerY, { width: col1W })
      doc.text(L.url, leftM + col1W, headerY, { width: col2W })
      doc.moveTo(leftM, doc.y + 2).lineTo(leftM + contentW, doc.y + 2)
        .strokeColor(C.border).lineWidth(0.5).stroke()
      doc.y += 6

      for (const pg of pages) {
        if (doc.y > pageBottom - 16) doc.addPage()
        let shortUrl = pg.url
        try { const u = new URL(pg.url); shortUrl = u.pathname + u.search } catch {}
        const rowY = doc.y
        doc.fontSize(9).font('Helvetica').fillColor(C.text)
          .text(pg.title || 'Untitled', leftM, rowY, { width: col1W })
        doc.fontSize(8).font('Helvetica').fillColor(C.textTert)
          .text(shortUrl, leftM + col1W, rowY + 1, { width: col2W })
        doc.y = Math.max(doc.y, rowY + 14)
        doc.moveTo(leftM, doc.y).lineTo(leftM + contentW, doc.y)
          .strokeColor(C.borderLight).lineWidth(0.25).stroke()
        doc.y += 4
      }
    }

    // ═══════════════════════════════════════════════════════
    // HEADER & FOOTER on every page
    // ═══════════════════════════════════════════════════════
    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i)

      // Footer: light line + confidential + page number
      doc.moveTo(leftM, 748).lineTo(leftM + contentW, 748)
        .strokeColor(C.borderLight).lineWidth(0.5).stroke()
      doc.fontSize(7).font('Helvetica').fillColor(C.textTert)
      doc.text(L.confidential, leftM, 752, { width: contentW / 2, lineBreak: false })
      doc.text(`Page ${i + 1}`, leftM + contentW / 2, 752, { width: contentW / 2, align: 'right', lineBreak: false })

      // Header (skip cover page)
      if (i > 0) {
        doc.fontSize(7).font('Helvetica-Bold').fillColor(C.textTert)
          .text(wlCompany || 'ClearUX', leftM, 50, { width: contentW, align: 'right', continued: true })
        doc.font('Helvetica').text(`  |  ${domain}`)
      }
    }

    doc.end()

    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    })

    const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_')
    const brandName = wlCompany
      ? wlCompany.replace(/[^a-zA-Z0-9 .-]/g, '').replace(/\s+/g, '-')
      : 'ClearUX'

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${brandName}-Audit-${safeDomain}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })

  } catch (err) {
    console.error('[PDF] Error generating report:', err)
    return NextResponse.json(
      { error: 'Failed to generate PDF report', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
