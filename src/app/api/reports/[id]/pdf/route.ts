// ============================================================
// ClearUX API — GET /api/reports/:id/pdf
// Native PDF generation using pdfkit — matches DOCX layout
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { createServiceSupabase } from '@/lib/supabase-server'
import { getReportLabels, getLocale } from '@/lib/languages'
import fs from 'fs'
import path from 'path'

/* ── Colors ──────────────────────────────────────────────── */
const C = {
  text: '#1D1D1F',
  textBody: '#4A4A4F',
  textSec: '#6E6E73',
  textTert: '#86868B',
  accent: '#8B5CF6',
  accentLight: '#F5F3FF',
  scoreGreen: '#22C55E',
  scoreYellow: '#EAB308',
  scoreRed: '#EF4444',
  sevCritical: '#EF4444',
  sevHigh: '#F97316',
  sevMedium: '#EAB308',
  sevLow: '#3B82F6',
  pillarFoundation: '#8B5CF6',
  pillarHuman: '#EC4899',
  pillarInclusive: '#F59E0B',
  pillarFuture: '#10B981',
  recBg: '#F5F3FF',
  impactBg: '#ECFDF5',
  impactText: '#047857',
  border: '#E8E8ED',
}

const PILLARS = [
  { name: 'Foundation', start: 0, end: 4, color: C.pillarFoundation },
  { name: 'Human Experience', start: 4, end: 8, color: C.pillarHuman },
  { name: 'Inclusive Design', start: 8, end: 12, color: C.pillarInclusive },
  { name: 'Future Readiness', start: 12, end: 16, color: C.pillarFuture },
]

function scoreColor(s: number): string {
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
    const db = createServiceSupabase()

    const [auditRes, reportRes, findingsRes] = await Promise.all([
      db.from('audits').select('*').eq('id', auditId).single(),
      db.from('reports').select('*').eq('audit_id', auditId).single(),
      db.from('audit_findings').select('*, screenshot_url, target_element').eq('audit_id', auditId)
        .order('severity', { ascending: true }).order('sort_order', { ascending: true }),
    ])

    if (auditRes.error || !auditRes.data)
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    if (reportRes.error || !reportRes.data)
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const a = auditRes.data as any
    const r = reportRes.data as any
    const f = (findingsRes.data || []) as any[]

    // White-label branding
    const wlCompany: string | null = a.white_label_company_name || null
    const wlLogoUrl: string | null = a.white_label_logo_url || null
    const isWhiteLabel = !!(wlCompany || wlLogoUrl)

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
    const topRecs: string[] = rawJson.topRecommendations || (rawJson.keyRecommendation ? [rawJson.keyRecommendation] : [])

    // Assign findings to pillars
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

    // Pillar scores
    const pillarScores = PILLARS.map(p => {
      const cats = catScores.slice(p.start, Math.min(p.end, catScores.length))
      return { ...p, avg: cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 0 }
    })

    // ── Build PDF ──────────────────────────────────────────
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 72, bottom: 72, left: 72, right: 72 } })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    const pageW = 612 // Letter width in points
    const contentW = pageW - 144 // 72pt margins
    const leftM = 72

    // ── COVER PAGE ─────────────────────────────────────────

    // Accent bar at top
    doc.rect(0, 0, pageW, 6).fill(C.accent)

    // Logo — white-label or ClearUX default
    let logoLoaded = false
    if (wlLogoUrl) {
      try {
        const logoRes = await fetch(wlLogoUrl)
        if (logoRes.ok) {
          const ab = await logoRes.arrayBuffer()
          const logoBuf = Buffer.from(ab)
          // fit: preserves aspect ratio within bounding box (max 200w x 80h)
          doc.image(logoBuf, (pageW - 200) / 2, 100, { fit: [200, 80], align: 'center', valign: 'center' })
          logoLoaded = true
        }
      } catch {}
    }
    if (!logoLoaded) {
      try {
        const logoPath = path.join(process.cwd(), 'public', 'logo-clearux.png')
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, (pageW - 200) / 2, 100, { fit: [200, 80], align: 'center', valign: 'center' })
          logoLoaded = true
        }
      } catch {}
    }
    if (!logoLoaded) {
      doc.fontSize(36).font('Helvetica-Bold')
      if (wlCompany) {
        doc.fillColor(C.text).text(wlCompany, leftM, 110, { align: 'center', width: contentW })
      } else {
        doc.fillColor(C.text).text('Clear', (pageW - 160) / 2, 110, { continued: true })
          .fillColor(C.accent).text('UX')
      }
    }

    // Subtitle
    const pdfSubtitle = isWhiteLabel
      ? (wlCompany ? `${wlCompany} — UX Audit Report` : 'UX Audit Report')
      : 'Human-Centered, AI-Powered Digital Audits'
    doc.fontSize(11).font('Helvetica').fillColor(C.textSec)
      .text(pdfSubtitle, leftM, logoLoaded ? 155 : 160, { align: 'center', width: contentW })

    // Large score
    doc.moveDown(3)
    doc.fontSize(72).font('Helvetica-Bold').fillColor(scoreColor(overall))
      .text(`${overall}`, leftM, undefined, { align: 'center', width: contentW, continued: true })
    doc.fontSize(16).font('Helvetica').fillColor(C.textTert).text(' / 100')

    doc.fontSize(16).font('Helvetica-Bold').fillColor(C.text)
      .text(scoreLabel(overall), leftM, undefined, { align: 'center', width: contentW })

    doc.moveDown(1)
    doc.fontSize(12).font('Helvetica').fillColor(C.accent)
      .text(a.product_url, leftM, undefined, { align: 'center', width: contentW })

    doc.fontSize(10).font('Helvetica').fillColor(C.textSec)
      .text(dateStr, leftM, undefined, { align: 'center', width: contentW })
    doc.text(`${total} ${L.issuesIdentified}`, leftM, undefined, { align: 'center', width: contentW })

    // Pillar scores row
    doc.moveDown(2)
    const colW = contentW / 4
    const pillarY = doc.y
    for (let i = 0; i < pillarScores.length; i++) {
      const p = pillarScores[i]
      const x = leftM + i * colW
      doc.fontSize(20).font('Helvetica-Bold').fillColor(p.color)
        .text(`${p.avg}`, x, pillarY, { width: colW, align: 'center' })
      doc.fontSize(8).font('Helvetica').fillColor(C.textSec)
        .text(p.name, x, pillarY + 24, { width: colW, align: 'center' })
    }

    // ── EXECUTIVE SUMMARY ──────────────────────────────────
    doc.addPage()

    // Section heading with accent left bar
    const sectionHead = (title: string, y?: number) => {
      const sy = y ?? doc.y
      doc.rect(leftM, sy, 4, 20).fill(C.accent)
      doc.fontSize(18).font('Helvetica-Bold').fillColor(C.text)
        .text(title, leftM + 14, sy, { width: contentW - 14 })
      doc.moveDown(0.5)
    }

    sectionHead(L.executiveSummary)

    const summaryText = r.executive_summary || ''
    for (const para of summaryText.split('\n').filter((s: string) => s.trim())) {
      doc.fontSize(10.5).font('Helvetica').fillColor(C.textBody)
        .text(para.trim(), leftM, undefined, { width: contentW, lineGap: 3 })
      doc.moveDown(0.5)
    }

    // Top Priority Recommendations
    if (topRecs.length > 0) {
      doc.moveDown(0.5)
      sectionHead(L.topPriorityRecommendations)

      for (let i = 0; i < topRecs.length; i++) {
        const recY = doc.y
        // Light purple background
        doc.rect(leftM, recY - 4, contentW, 36).fill(C.accentLight)
        // Number
        doc.fontSize(12).font('Helvetica-Bold').fillColor(C.accent)
          .text(`${i + 1}`, leftM + 10, recY + 4)
        // Text
        doc.fontSize(10).font('Helvetica').fillColor(C.textBody)
          .text(topRecs[i], leftM + 35, recY + 4, { width: contentW - 50 })
        doc.y = Math.max(doc.y, recY + 36) + 6
      }
    }

    // Research note
    doc.moveDown(0.5)
    doc.fontSize(9).font('Helvetica-Oblique').fillColor(C.textSec)
      .text(`For deep qualitative research (user interviews, usability testing), we recommend pairing ${wlCompany || 'ClearUX'} findings with a specialist.`, leftM, undefined, { width: contentW })

    // ── PILLAR SCORES ──────────────────────────────────────
    doc.addPage()
    sectionHead(L.scoreBreakdown)
    doc.fontSize(9.5).font('Helvetica').fillColor(C.textSec)
      .text(L.scoreSubtitle, leftM, undefined, { width: contentW })
    doc.moveDown(1)

    for (const pillar of pillarScores) {
      const cats = catScores.slice(pillar.start, Math.min(pillar.end, catScores.length))

      // Check page space
      if (doc.y > 620) doc.addPage()

      // Pillar header bar
      const phy = doc.y
      doc.rect(leftM, phy, contentW, 40).fill(pillar.color + '15')
      doc.fontSize(13).font('Helvetica-Bold').fillColor(pillar.color)
        .text(pillar.name, leftM + 12, phy + 6, { width: contentW - 80 })
      doc.fontSize(8).font('Helvetica').fillColor(C.textSec)
        .text(`${cats.length} categories evaluated`, leftM + 12, phy + 24)
      doc.fontSize(22).font('Helvetica-Bold').fillColor(pillar.color)
        .text(`${pillar.avg}`, leftM + contentW - 60, phy + 8, { width: 48, align: 'right' })
      doc.y = phy + 46

      // Category rows
      for (const cat of cats) {
        const cy = doc.y
        doc.fontSize(9).font('Helvetica').fillColor(C.textBody)
          .text(cat.name, leftM + 16, cy + 2, { width: 200 })

        // Progress bar
        const barX = leftM + 230
        const barW = contentW - 300
        const barH = 6
        doc.rect(barX, cy + 5, barW, barH).fill(C.border)
        doc.rect(barX, cy + 5, Math.max(1, (cat.score / 100) * barW), barH).fill(pillar.color)

        // Score
        doc.fontSize(10).font('Helvetica-Bold').fillColor(scoreColor(cat.score))
          .text(`${cat.score}`, leftM + contentW - 40, cy + 1, { width: 36, align: 'right' })

        doc.y = cy + 20

        if (cat.summary) {
          doc.fontSize(8).font('Helvetica-Oblique').fillColor(C.textSec)
            .text(cat.summary, leftM + 16, undefined, { width: contentW - 32 })
          doc.moveDown(0.2)
        }
      }
      doc.moveDown(0.8)
    }

    // ── DETAILED FINDINGS ──────────────────────────────────
    doc.addPage()
    sectionHead(L.detailedFindings)
    doc.fontSize(9.5).font('Helvetica').fillColor(C.textSec)
      .text(L.findingsSubtitle, leftM, undefined, { width: contentW })
    doc.moveDown(1)

    for (const pillar of pillarScores) {
      const pillarFindings = findingMap[pillar.name] || {}
      const hasFindings = Object.values(pillarFindings).some((arr: any[]) => arr.length > 0)
      if (!hasFindings) continue

      // Pillar header
      if (doc.y > 620) doc.addPage()
      doc.fontSize(14).font('Helvetica-Bold').fillColor(pillar.color)
        .text(pillar.name, leftM, undefined, { width: contentW })
      doc.moveTo(leftM, doc.y).lineTo(leftM + contentW, doc.y)
        .strokeColor(pillar.color).lineWidth(1).stroke()
      doc.moveDown(0.5)

      for (const [catName, catFindings] of Object.entries(pillarFindings)) {
        const findings = catFindings as any[]
        if (findings.length === 0) continue

        const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
        findings.sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4))

        if (doc.y > 640) doc.addPage()
        doc.fontSize(11).font('Helvetica-Bold').fillColor(C.text)
          .text(catName, leftM, undefined, { width: contentW, continued: true })
        doc.fontSize(9).font('Helvetica').fillColor(C.textTert)
          .text(`  ${findings.length} finding${findings.length !== 1 ? 's' : ''}`)
        doc.moveDown(0.3)

        for (const finding of findings) {
          if (doc.y > 660) doc.addPage()

          const sev = (finding.severity || 'medium').toLowerCase()

          // Severity + URL
          doc.fontSize(8).font('Helvetica-Bold').fillColor(sevColor(sev))
            .text(sev.toUpperCase(), leftM, undefined, { continued: true })
          if (finding.page_url) {
            let displayUrl = finding.page_url
            try { const u = new URL(finding.page_url); displayUrl = u.hostname + (u.pathname === '/' ? '' : u.pathname) } catch {}
            doc.font('Helvetica').fillColor(C.textTert).text(`    ${displayUrl}`)
          } else {
            doc.text('')
          }

          // Title
          doc.fontSize(11).font('Helvetica-Bold').fillColor(C.text)
            .text(finding.title, leftM, undefined, { width: contentW })

          // Description
          if (finding.description) {
            doc.fontSize(9.5).font('Helvetica').fillColor(C.textBody)
              .text(finding.description, leftM, undefined, { width: contentW, lineGap: 2 })
          }

          // Recommendation box
          if (finding.recommendation) {
            doc.moveDown(0.3)
            const recY = doc.y
            // Measure text height first
            const recH = doc.heightOfString(finding.recommendation, { width: contentW - 24 })
            doc.rect(leftM, recY - 4, contentW, recH + 28).fill(C.recBg)
            doc.fontSize(8).font('Helvetica-Bold').fillColor(C.text)
              .text('Recommendation', leftM + 12, recY + 2)
            doc.fontSize(9.5).font('Helvetica').fillColor(C.textBody)
              .text(finding.recommendation, leftM + 12, recY + 14, { width: contentW - 24 })
            doc.y = recY + recH + 28
          }

          // Impact box
          if (finding.estimated_impact) {
            doc.moveDown(0.2)
            const impY = doc.y
            const impH = doc.heightOfString(finding.estimated_impact, { width: contentW - 24 })
            doc.rect(leftM, impY - 4, contentW, impH + 28).fill(C.impactBg)
            doc.fontSize(8).font('Helvetica-Bold').fillColor(C.text)
              .text('Expected Impact', leftM + 12, impY + 2)
            doc.fontSize(9.5).font('Helvetica').fillColor(C.impactText)
              .text(finding.estimated_impact, leftM + 12, impY + 14, { width: contentW - 24 })
            doc.y = impY + impH + 28
          }

          doc.moveDown(0.8)
        }
      }
    }

    // ── Footer on each page ────────────────────────────────
    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i)
      doc.fontSize(7).font('Helvetica').fillColor(C.textTert)
      doc.text(L.confidential, leftM, 750, { width: contentW / 2, lineBreak: false })
      doc.text(`Page ${i + 1}`, leftM + contentW / 2, 750, { width: contentW / 2, align: 'right', lineBreak: false })
      // Header
      if (i > 0) {
        if (isWhiteLabel && wlCompany) {
          doc.fontSize(7).font('Helvetica-Bold').fillColor(C.textTert)
            .text(wlCompany, leftM + contentW - 120, 50, { continued: true })
          doc.font('Helvetica').fillColor(C.textTert).text(`  |  ${domain}`)
        } else {
          doc.fontSize(7).font('Helvetica-Bold').fillColor(C.textTert)
            .text('Clear', leftM + contentW - 80, 50, { continued: true })
          doc.fillColor(C.accent).text('UX', { continued: true })
          doc.font('Helvetica').fillColor(C.textTert).text(`  |  ${domain}`)
        }
      }
    }

    doc.end()

    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    })

    const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_')

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${wlCompany ? wlCompany.replace(/[^a-zA-Z0-9 .-]/g, '').replace(/\s+/g, '-') : 'ClearUX'}-Audit-${safeDomain}.pdf"`,
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
