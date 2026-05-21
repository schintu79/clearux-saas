// ============================================================
// ClearUX API — GET /api/shared/:token/pdf
// Public PDF download for shared audits (no auth required)
// A4 format, mirrors the shared audit page content
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { createServiceSupabase } from '@/lib/supabase-server'
import { CHECKPOINT_LABELS } from '@/lib/audit-checkpoints'
import type { AuditFinding } from '@/types/database'

/* ── Colors ──────────────────────────────────────────────── */
const C = {
  white: '#FFFFFF',
  bg: '#F7F8F9',
  text: '#111111',
  textBody: '#3D3D3D',
  textSec: '#5C5C5C',
  textTert: '#8A8A8A',
  border: '#D4D4D4',
  borderLight: '#E9EAEC',
  scoreGreen: '#16A34A',
  scoreYellow: '#CA8A04',
  scoreRed: '#DC2626',
  sevCritical: '#DC2626',
  sevHigh: '#EA580C',
  sevMedium: '#CA8A04',
  sevLow: '#2563EB',
  sevCriticalBg: '#FEF2F2',
  sevHighBg: '#FFF7ED',
  sevMediumBg: '#FEFCE8',
  sevLowBg: '#EFF6FF',
  signal: '#5E6B2F',
  // Pillar colors
  pillar: [
    { color: '#3B82F6', bg: '#EFF6FF' },   // Foundation
    { color: '#EC4899', bg: '#FDF2F8' },   // Human Experience
    { color: '#8B5CF6', bg: '#F5F3FF' },   // Inclusive Design
    { color: '#F59E0B', bg: '#FFFBEB' },   // Future Readiness
    { color: '#10B981', bg: '#ECFDF5' },   // SEO Structure & Rules
    { color: '#06B6D4', bg: '#ECFEFF' },   // Brand Consistency
  ],
}

const PILLAR_NAMES = ['Foundation', 'Human Experience', 'Inclusive Design', 'Future Readiness', 'SEO Structure & Rules', 'Brand Consistency']
const PILLAR_RANGES: [number, number][] = [[0, 4], [4, 8], [8, 12], [12, 16], [16, 20], [20, 24]]

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

function sevLabel(sev: string): string {
  switch (sev) {
    case 'critical': return 'Critical'
    case 'high': return 'High'
    case 'medium': return 'Medium'
    case 'low': return 'Low'
    default: return sev
  }
}

/* ── Main route ───────────────────────────────────────────── */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params

    const db = createServiceSupabase()

    // Fetch audit by share token (no auth — public)
    const { data: audit, error: auditErr } = await db
      .from('audits')
      .select('*')
      .eq('share_token', token)
      .eq('share_enabled', true)
      .single()

    if (auditErr || !audit)
      return NextResponse.json({ error: 'Shared audit not found or sharing disabled' }, { status: 404 })

    if ((audit as any).status !== 'completed')
      return NextResponse.json({ error: 'Audit is not yet completed' }, { status: 400 })

    const [reportRes, findingsRes] = await Promise.all([
      db.from('reports').select('*').eq('audit_id', audit.id).single(),
      db.from('audit_findings').select('*').eq('audit_id', audit.id).order('sort_order'),
    ])

    if (reportRes.error || !reportRes.data)
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const a = audit as any
    const r = reportRes.data as any
    const findings = (findingsRes.data || []) as AuditFinding[]

    const rawJson = r.raw_json || {}
    const categoryScores: Array<{ name: string; score: number; summary: string }> = rawJson?.categoryScores || []
    const topRecs: string[] = rawJson.topRecommendations || (rawJson.keyRecommendation ? [rawJson.keyRecommendation] : [])

    let domain = 'audit'
    try { domain = new URL(a.product_url).hostname.replace(/^www\./, '') } catch {}

    const dateStr = new Date(a.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

    const scoredCats = categoryScores.filter(c => c.score > 0 || c.summary)
    const overall = scoredCats.length > 0
      ? Math.round(scoredCats.reduce((s, c) => s + c.score, 0) / scoredCats.length)
      : (r.overall_score ?? 0)

    const activeFindings = findings.filter(f => !f.dismissed)

    const severityCounts = {
      critical: activeFindings.filter(f => f.severity === 'critical').length,
      high: activeFindings.filter(f => f.severity === 'high').length,
      medium: activeFindings.filter(f => f.severity === 'medium').length,
      low: activeFindings.filter(f => f.severity === 'low').length,
    }

    // Group findings by pillar
    const findingsByPillar: Record<string, AuditFinding[]> = {}
    for (const name of PILLAR_NAMES) findingsByPillar[name] = []
    for (const f of activeFindings) {
      const catIdx = (f as any).category_index
      if (catIdx != null) {
        const pillarIdx = Math.floor(catIdx / 4)
        if (pillarIdx >= 0 && pillarIdx < PILLAR_NAMES.length) {
          findingsByPillar[PILLAR_NAMES[pillarIdx]].push(f)
          continue
        }
      }
      // Fallback: keyword match
      const text = `${f.title} ${f.description}`.toLowerCase()
      let matched = false
      for (let pi = 0; pi < PILLAR_NAMES.length; pi++) {
        const words = PILLAR_NAMES[pi].toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3)
        if (words.some(w => text.includes(w))) {
          findingsByPillar[PILLAR_NAMES[pi]].push(f)
          matched = true
          break
        }
      }
      if (!matched) findingsByPillar[PILLAR_NAMES[0]].push(f)
    }

    // Pillar averages
    const pillarScores = PILLAR_NAMES.map((name, idx) => {
      const [start, end] = PILLAR_RANGES[idx]
      const cats = categoryScores.filter((_, i) => i >= start && i < end)
      const avg = cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 0
      return { name, avg, start, end, cats }
    })

    // AI Visibility
    const aiVis = rawJson?.aiVisibilityBreakdown

    // ── Build PDF ─────────────────────────────────────────
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
      info: {
        Title: `ClearUX Audit — ${domain}`,
        Author: 'ClearUX',
        Subject: `UX audit report for ${domain}`,
      },
    })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    const pageW = 595.28 // A4 width in points
    const leftM = 56
    const contentW = pageW - 112
    const pageBottom = 841.89 - 56 - 20 // A4 height minus margins

    let pageNum = 0

    const ensureSpace = (needed: number) => {
      if (doc.y > pageBottom - needed) {
        doc.addPage()
        pageNum++
        drawHeader()
      }
    }

    const drawHeader = () => {
      doc.save()
      doc.fontSize(7).font('Helvetica').fillColor(C.textTert)
        .text(`ClearUX Audit — ${domain}`, leftM, 20, { width: contentW / 2 })
      doc.fontSize(7).font('Helvetica').fillColor(C.textTert)
        .text(dateStr, leftM + contentW / 2, 20, { width: contentW / 2, align: 'right' })
      doc.moveTo(leftM, 35).lineTo(leftM + contentW, 35).strokeColor(C.borderLight).lineWidth(0.5).stroke()
      doc.restore()
      doc.y = 56
    }

    const sectionHead = (title: string, fontSize: number = 16) => {
      ensureSpace(40)
      const sy = doc.y
      doc.rect(leftM, sy, 3, 18).fill(C.text)
      doc.fontSize(fontSize).font('Helvetica-Bold').fillColor(C.text)
        .text(title, leftM + 12, sy + 1, { width: contentW - 12 })
      doc.moveDown(0.4)
    }

    // ═══════════════════════════════════════════════════════
    // PAGE 1 — HERO SCORE
    // ═══════════════════════════════════════════════════════

    drawHeader()

    // Shared badge
    doc.fontSize(8).font('Helvetica').fillColor(C.textTert)
      .text(`Shared audit report  |  ${domain}  |  ${dateStr}`, leftM, doc.y + 4, { width: contentW })
    doc.moveDown(1.5)

    // Score
    const scoreY = doc.y
    doc.fontSize(60).font('Helvetica-Bold').fillColor(scoreColor(overall))
      .text(`${overall}`, leftM, scoreY, { width: 120 })
    doc.fontSize(12).font('Helvetica').fillColor(C.textTert)
      .text('/100', leftM + 85, scoreY + 40)

    // Domain and meta next to score
    doc.fontSize(18).font('Helvetica-Bold').fillColor(C.text)
      .text(domain, leftM + 140, scoreY, { width: contentW - 140 })
    doc.fontSize(9).font('Helvetica').fillColor(C.textSec)
      .text(`${activeFindings.length} findings  ·  ${PILLAR_NAMES.length} modules`, leftM + 140, scoreY + 24, { width: contentW - 140 })

    // Severity counts
    const sevY = scoreY + 42
    let sevX = leftM + 140
    if (severityCounts.critical > 0) {
      doc.fontSize(8).font('Helvetica-Bold').fillColor(C.sevCritical)
        .text(`${severityCounts.critical} critical`, sevX, sevY)
      sevX += 60
    }
    if (severityCounts.high > 0) {
      doc.fontSize(8).font('Helvetica-Bold').fillColor(C.sevHigh)
        .text(`${severityCounts.high} high`, sevX, sevY)
      sevX += 45
    }
    if ((severityCounts.medium + severityCounts.low) > 0) {
      doc.fontSize(8).font('Helvetica').fillColor(C.textSec)
        .text(`${severityCounts.medium + severityCounts.low} more`, sevX, sevY)
    }

    doc.y = scoreY + 70

    // Pillar mini-scores row
    doc.moveDown(0.5)
    const colW = contentW / pillarScores.length
    const pillarY = doc.y
    for (let i = 0; i < pillarScores.length; i++) {
      const p = pillarScores[i]
      const x = leftM + i * colW
      doc.rect(x + 2, pillarY, 6, 6).fill(C.pillar[i].color)
      doc.fontSize(7).font('Helvetica').fillColor(C.textSec)
        .text(p.name, x + 12, pillarY - 1, { width: colW - 30 })
      doc.fontSize(8).font('Helvetica-Bold').fillColor(scoreColor(p.avg))
        .text(`${p.avg}`, x + colW - 22, pillarY - 1, { width: 20, align: 'right' })
    }
    doc.y = pillarY + 18
    doc.moveDown(1)

    // Separator
    doc.moveTo(leftM, doc.y).lineTo(leftM + contentW, doc.y).strokeColor(C.borderLight).lineWidth(0.5).stroke()
    doc.moveDown(1)

    // ═══════════════════════════════════════════════════════
    // TOP PRIORITY RECOMMENDATIONS
    // ═══════════════════════════════════════════════════════

    if (topRecs.length > 0) {
      sectionHead('Top priority recommendations', 14)

      for (let i = 0; i < topRecs.length; i++) {
        ensureSpace(50)
        const recY = doc.y
        const textH = doc.fontSize(9.5).font('Helvetica').heightOfString(topRecs[i], { width: contentW - 45 })
        const boxH = Math.max(30, textH + 16)
        doc.rect(leftM, recY, contentW, boxH).fill(C.bg)
        doc.fontSize(11).font('Helvetica-Bold').fillColor(C.signal)
          .text(`${i + 1}`, leftM + 10, recY + 8)
        doc.fontSize(9.5).font('Helvetica').fillColor(C.textBody)
          .text(topRecs[i], leftM + 32, recY + 8, { width: contentW - 48 })
        doc.y = recY + boxH + 4
      }
      doc.moveDown(0.8)
    }

    // ═══════════════════════════════════════════════════════
    // EXECUTIVE SUMMARY
    // ═══════════════════════════════════════════════════════

    if (r.executive_summary) {
      sectionHead('Executive summary', 14)
      const summaryText = r.executive_summary || ''
      for (const para of summaryText.split('\n').filter((s: string) => s.trim())) {
        ensureSpace(30)
        doc.fontSize(9.5).font('Helvetica').fillColor(C.textBody)
          .text(para.trim(), leftM, undefined, { width: contentW, lineGap: 2 })
        doc.moveDown(0.4)
      }
      doc.moveDown(0.8)
    }

    // ═══════════════════════════════════════════════════════
    // MODULE GRID (score breakdown by pillar)
    // ═══════════════════════════════════════════════════════

    if (categoryScores.length > 0) {
      sectionHead('Score breakdown', 14)
      doc.fontSize(8.5).font('Helvetica').fillColor(C.textSec)
        .text('Scores across 6 pillars and 24 categories, rated 0 to 100.', leftM)
      doc.moveDown(0.8)

      for (const pillar of pillarScores) {
        if (pillar.cats.length === 0) continue
        ensureSpace(50 + pillar.cats.length * 20)

        // Pillar header bar
        const phy = doc.y
        doc.rect(leftM, phy, contentW, 34).fill(C.pillar[PILLAR_NAMES.indexOf(pillar.name)]?.bg || C.bg)
        doc.fontSize(11).font('Helvetica-Bold').fillColor(C.pillar[PILLAR_NAMES.indexOf(pillar.name)]?.color || C.text)
          .text(pillar.name, leftM + 10, phy + 5, { width: contentW - 70 })
        const pFindings = findingsByPillar[pillar.name] || []
        if (pFindings.length > 0) {
          doc.fontSize(7.5).font('Helvetica').fillColor(C.textSec)
            .text(`${pFindings.length} finding${pFindings.length !== 1 ? 's' : ''}`, leftM + 10, phy + 20)
        }
        doc.fontSize(18).font('Helvetica-Bold').fillColor(scoreColor(pillar.avg))
          .text(`${pillar.avg}`, leftM + contentW - 55, phy + 7, { width: 45, align: 'right' })
        doc.y = phy + 38

        // Category rows
        for (const cat of pillar.cats) {
          if (doc.y > pageBottom - 18) { doc.addPage(); pageNum++; drawHeader() }
          const cy = doc.y
          doc.fontSize(8.5).font('Helvetica').fillColor(C.textBody)
            .text(cat.name, leftM + 14, cy + 2, { width: 180 })
          // Progress bar
          const barX = leftM + 210
          const barW = contentW - 270
          const barH = 4
          doc.rect(barX, cy + 5, barW, barH).fill(C.borderLight)
          const pillarColor = C.pillar[PILLAR_NAMES.indexOf(pillar.name)]?.color || C.scoreGreen
          doc.rect(barX, cy + 5, Math.max(1, (cat.score / 100) * barW), barH).fill(pillarColor)
          doc.fontSize(9).font('Helvetica-Bold').fillColor(scoreColor(cat.score))
            .text(`${cat.score}`, leftM + contentW - 30, cy + 1, { width: 28, align: 'right' })
          doc.y = cy + 16
        }
        doc.moveDown(0.6)
      }
    }

    // ═══════════════════════════════════════════════════════
    // CHECKPOINT HEALTH
    // ═══════════════════════════════════════════════════════

    if (categoryScores.length > 0) {
      ensureSpace(60)
      sectionHead(`${categoryScores.length * 4}-Checkpoint health`, 14)

      for (let catIdx = 0; catIdx < categoryScores.length; catIdx++) {
        const cat = categoryScores[catIdx]
        const checkpoints = CHECKPOINT_LABELS[cat.name] || ['Check 1', 'Check 2', 'Check 3', 'Check 4']

        // Count findings for this category
        const catFindings: AuditFinding[] = []
        for (const f of activeFindings) {
          if ((f as any).category_index === catIdx) catFindings.push(f)
        }
        // Also match by keyword
        if (catFindings.length === 0) {
          const words = cat.name.toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3)
          for (const f of activeFindings) {
            const text = `${f.title} ${f.description}`.toLowerCase()
            if (words.some(w => text.includes(w)) && !catFindings.includes(f)) {
              catFindings.push(f)
              if (catFindings.length >= checkpoints.length) break
            }
          }
        }
        const failCount = Math.min(catFindings.length, checkpoints.length)

        ensureSpace(20 + checkpoints.length * 14)

        // Category header
        const chY = doc.y
        doc.fontSize(8).font('Helvetica-Bold').fillColor(scoreColor(cat.score))
          .text(`${cat.score}`, leftM, chY + 1, { width: 22, align: 'right' })
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.text)
          .text(cat.name, leftM + 28, chY + 1, { width: contentW - 100 })
        const passCount = checkpoints.length - failCount
        if (passCount > 0) {
          doc.fontSize(7).font('Helvetica-Bold').fillColor(C.scoreGreen)
            .text(`${passCount} pass`, leftM + contentW - 70, chY + 1)
        }
        if (failCount > 0) {
          doc.fontSize(7).font('Helvetica-Bold').fillColor(C.sevCritical)
            .text(`${failCount} fail`, leftM + contentW - 30, chY + 1)
        }
        doc.y = chY + 14

        // Checkpoints
        for (let i = 0; i < checkpoints.length; i++) {
          if (doc.y > pageBottom - 14) { doc.addPage(); pageNum++; drawHeader() }
          const hasFinding = i < failCount
          const cpY = doc.y
          doc.rect(leftM + 10, cpY, contentW - 10, 12).fill(hasFinding ? '#FEF2F2' : '#F0FDF4')
          const marker = hasFinding ? '!' : '✓'
          doc.fontSize(7).font('Helvetica-Bold').fillColor(hasFinding ? C.sevCritical : C.scoreGreen)
            .text(marker, leftM + 14, cpY + 2, { width: 10 })
          doc.fontSize(7.5).font('Helvetica').fillColor(hasFinding ? C.sevCritical : C.scoreGreen)
            .text(checkpoints[i], leftM + 28, cpY + 2, { width: contentW - 80 })
          doc.fontSize(7).font('Helvetica-Bold').fillColor(hasFinding ? C.sevCritical : C.scoreGreen)
            .text(hasFinding ? 'Fail' : 'Pass', leftM + contentW - 35, cpY + 2, { width: 30, align: 'right' })
          doc.y = cpY + 13
        }
        doc.moveDown(0.3)
      }
    }

    // ═══════════════════════════════════════════════════════
    // AI VISIBILITY BREAKDOWN
    // ═══════════════════════════════════════════════════════

    if (aiVis) {
      ensureSpace(100)
      sectionHead('AI visibility breakdown', 14)

      const aiOverall = aiVis.overall || 0
      doc.fontSize(9).font('Helvetica').fillColor(C.textSec)
        .text('Composite AI visibility score:', leftM)
      doc.fontSize(20).font('Helvetica-Bold').fillColor(scoreColor(aiOverall))
        .text(`${aiOverall}`, leftM + 180, doc.y - 14, { continued: true })
      doc.fontSize(9).font('Helvetica').fillColor(C.textTert).text('/100')
      doc.moveDown(0.6)

      const bars = [
        { label: 'LLM knowledge accuracy', value: aiVis.llmAccuracy, desc: 'How accurately AI describes your site' },
        { label: 'Structured data coverage', value: aiVis.structuredData, desc: 'JSON-LD completeness for rich results' },
        { label: 'Content extractability', value: aiVis.contentExtractability, desc: 'How well AI can read your pages' },
        { label: 'Crawl infrastructure', value: aiVis.crawlInfrastructure, desc: 'robots.txt, llms.txt, ai-plugin.json' },
      ]

      for (const bar of bars) {
        ensureSpace(30)
        const barY = doc.y
        doc.fontSize(8).font('Helvetica').fillColor(C.textSec)
          .text(bar.label, leftM, barY)
        doc.fontSize(8).font('Helvetica-Bold').fillColor(C.text)
          .text(`${bar.value}`, leftM + contentW - 25, barY, { width: 25, align: 'right' })
        // Bar
        const bY = barY + 12
        doc.rect(leftM, bY, contentW, 4).fill(C.borderLight)
        doc.rect(leftM, bY, Math.max(1, (bar.value / 100) * contentW), 4).fill(scoreColor(bar.value))
        doc.fontSize(7).font('Helvetica').fillColor(C.textTert)
          .text(bar.desc, leftM, bY + 6)
        doc.y = bY + 18
      }
      doc.moveDown(0.8)
    }

    // ═══════════════════════════════════════════════════════
    // ALL FINDINGS (grouped by pillar)
    // ═══════════════════════════════════════════════════════

    if (activeFindings.length > 0) {
      sectionHead('All findings', 14)

      // Severity summary
      const sumY = doc.y
      doc.rect(leftM, sumY, contentW, 24).fill(C.bg)
      const sevItems = [
        { label: 'Critical', count: severityCounts.critical, color: C.sevCritical },
        { label: 'High', count: severityCounts.high, color: C.sevHigh },
        { label: 'Medium', count: severityCounts.medium, color: C.sevMedium },
        { label: 'Low', count: severityCounts.low, color: C.sevLow },
      ]
      const sevColW = contentW / 4
      for (let i = 0; i < sevItems.length; i++) {
        const si = sevItems[i]
        const sx = leftM + i * sevColW
        doc.fontSize(13).font('Helvetica-Bold').fillColor(si.count > 0 ? si.color : C.textTert)
          .text(`${si.count}`, sx + 8, sumY + 2, { width: 25 })
        doc.fontSize(7).font('Helvetica-Bold').fillColor(si.count > 0 ? si.color : C.textTert)
          .text(si.label.toUpperCase(), sx + 36, sumY + 6)
      }
      doc.y = sumY + 30

      // Findings by pillar
      for (let pi = 0; pi < PILLAR_NAMES.length; pi++) {
        const pillarName = PILLAR_NAMES[pi]
        const pFindings = findingsByPillar[pillarName]
        if (!pFindings || pFindings.length === 0) continue

        ensureSpace(40)
        const phY = doc.y
        doc.rect(leftM, phY, 4, 14).fill(C.pillar[pi].color)
        doc.fontSize(10).font('Helvetica-Bold').fillColor(C.text)
          .text(pillarName, leftM + 10, phY, { width: contentW - 80 })
        doc.fontSize(8).font('Helvetica').fillColor(C.textSec)
          .text(`${pFindings.length} finding${pFindings.length !== 1 ? 's' : ''}`, leftM + contentW - 70, phY + 2)
        doc.y = phY + 20

        for (const finding of pFindings) {
          // Measure needed space
          const titleH = doc.fontSize(9.5).font('Helvetica-Bold').heightOfString(finding.title || '', { width: contentW - 30 })
          const descH = finding.description ? doc.fontSize(8.5).font('Helvetica').heightOfString(finding.description, { width: contentW - 30 }) : 0
          const recH = finding.recommendation ? doc.fontSize(8).font('Helvetica').heightOfString(finding.recommendation, { width: contentW - 40 }) : 0
          const totalH = 18 + titleH + (descH > 0 ? descH + 4 : 0) + (recH > 0 ? recH + 16 : 0) + 8
          ensureSpace(Math.min(totalH, 150))

          const fy = doc.y

          // Severity + category
          doc.rect(leftM + 4, fy + 2, 5, 5).fill(sevColor(finding.severity))
          doc.fontSize(7).font('Helvetica-Bold').fillColor(sevColor(finding.severity))
            .text(sevLabel(finding.severity).toUpperCase(), leftM + 14, fy + 1)

          const catName = finding.category_index != null && categoryScores[finding.category_index]
            ? categoryScores[finding.category_index].name
            : null
          if (catName) {
            doc.fontSize(7).font('Helvetica').fillColor(C.textSec)
              .text(catName, leftM + 60, fy + 1, { width: contentW - 60 })
          }
          doc.y = fy + 12

          // Title
          doc.fontSize(9.5).font('Helvetica-Bold').fillColor(C.text)
            .text(finding.title || 'Untitled', leftM + 4, undefined, { width: contentW - 12 })

          // Description
          if (finding.description) {
            doc.fontSize(8.5).font('Helvetica').fillColor(C.textSec)
              .text(finding.description, leftM + 4, undefined, { width: contentW - 12, lineGap: 1 })
          }

          // Recommendation
          if (finding.recommendation) {
            doc.moveDown(0.2)
            const recBoxY = doc.y
            const measuredRecH = doc.fontSize(8).font('Helvetica').heightOfString(finding.recommendation, { width: contentW - 40 })
            doc.rect(leftM + 8, recBoxY, contentW - 16, measuredRecH + 10).fill('#F0FDF4')
            doc.fontSize(7).font('Helvetica-Bold').fillColor(C.signal)
              .text('Recommendation:', leftM + 14, recBoxY + 3)
            doc.fontSize(8).font('Helvetica').fillColor(C.textBody)
              .text(finding.recommendation, leftM + 14, recBoxY + 12, { width: contentW - 36 })
            doc.y = recBoxY + measuredRecH + 14
          }

          doc.moveDown(0.4)
          // Thin separator
          doc.moveTo(leftM + 10, doc.y).lineTo(leftM + contentW - 10, doc.y)
            .strokeColor(C.borderLight).lineWidth(0.3).stroke()
          doc.moveDown(0.4)
        }
        doc.moveDown(0.4)
      }
    }

    // ═══════════════════════════════════════════════════════
    // AI TRANSPARENCY NOTE
    // ═══════════════════════════════════════════════════════

    ensureSpace(50)
    doc.moveDown(0.5)
    const noteY = doc.y
    doc.rect(leftM, noteY, contentW, 40).fill(C.bg)
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.textSec)
      .text('About this audit', leftM + 10, noteY + 6)
    doc.fontSize(7).font('Helvetica').fillColor(C.textTert)
      .text(
        'This report was generated by AI analysing publicly visible page content across up to 6 modules and 24 categories. It cannot test JavaScript interactions, real load times, or content behind authentication. For accessibility compliance and security-critical findings, we recommend pairing these results with manual review.',
        leftM + 10, noteY + 18, { width: contentW - 20, lineGap: 1 }
      )

    // ── Finalize ──────────────────────────────────────────
    doc.end()

    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="clearux-audit-${domain}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (err: any) {
    console.error('[shared-pdf]', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
