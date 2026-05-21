// ============================================================
// Fixpath API — GET /api/shared/:token/pdf
// Public PDF download for shared audits (no auth required)
// A4 format — mirrors the shared audit page design exactly
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { createServiceSupabase } from '@/lib/supabase-server'
import { CHECKPOINT_LABELS } from '@/lib/audit-checkpoints'
import type { AuditFinding } from '@/types/database'

/* ── Colors (resolved CSS variables from the shared page) ── */
const C = {
  white: '#FFFFFF',
  offWhite: '#F7F8F9',
  ink: '#14130F',
  muted: '#6B6759',
  rule: '#D4CCB8',
  ruleLight: '#E2DDD0',
  signal: '#5E6B2F',
  severe: '#8B3A2C',
  warn: '#9A7A2C',
  ok: '#3F6B3F',
}

/* Severity config matching the shared page exactly */
const SEV: Record<string, { label: string; color: string; bgHex: string }> = {
  critical: { label: 'Critical', color: C.severe, bgHex: '#F5EDEB' },
  high:     { label: 'High',     color: C.warn,   bgHex: '#F5F1E8' },
  medium:   { label: 'Medium',   color: C.signal, bgHex: '#EFF0E9' },
  low:      { label: 'Low',      color: C.ok,     bgHex: '#EBF0EB' },
}

/* Module tints matching the shared page's MODULE_TINTS */
const MODULE_TINTS = [
  { dot: '#3B82F6', bg: '#F6F9FE', border: '#DCE7FB' }, // Foundation
  { dot: '#EC4899', bg: '#FEF6FA', border: '#FADCEA' }, // Human Experience
  { dot: '#8B5CF6', bg: '#F9F7FE', border: '#E4DBFB' }, // Inclusive Design
  { dot: '#F59E0B', bg: '#FEFBF3', border: '#FBEAC2' }, // Future Readiness
  { dot: '#10B981', bg: '#F3FDF9', border: '#CCEEDE' }, // SEO Structure & Rules
  { dot: '#06B6D4', bg: '#F2FDFE', border: '#C5EDF3' }, // Brand Consistency
]

const PILLAR_NAMES = ['Foundation', 'Human Experience', 'Inclusive Design', 'Future Readiness', 'SEO Structure & Rules', 'Brand Consistency']
const PILLAR_RANGES: [number, number][] = [[0, 4], [4, 8], [8, 12], [12, 16], [16, 20], [20, 24]]

function scoreColor(s: number): string {
  if (s >= 70) return C.ok
  if (s >= 40) return C.warn
  return C.severe
}

/* Mix a hex color with white at a given percentage (for tinted backgrounds) */
function mixWithWhite(hex: string, pct: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const mix = (c: number) => Math.round(c * pct / 100 + 255 * (1 - pct / 100))
  return `#${mix(r).toString(16).padStart(2, '0')}${mix(g).toString(16).padStart(2, '0')}${mix(b).toString(16).padStart(2, '0')}`
}

/* ── Main route ───────────────────────────────────────────── */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params

    const db = createServiceSupabase()

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

    const aiVis = rawJson?.aiVisibilityBreakdown

    // ── Build PDF ─────────────────────────────────────────
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
      info: {
        Title: `Fixpath Audit — ${domain}`,
        Author: 'Fixpath.ai',
        Subject: `Website audit report for ${domain}`,
      },
    })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    const pageW = 595.28
    const leftM = 56
    const contentW = pageW - 112
    const pageBottom = 841.89 - 56 - 20

    const ensureSpace = (needed: number) => {
      if (doc.y > pageBottom - needed) {
        doc.addPage()
        drawPageHeader()
      }
    }

    /* Thin header on every page: "Fixpath Audit — domain" left, date right */
    const drawPageHeader = () => {
      doc.save()
      doc.fontSize(7).font('Helvetica').fillColor(C.muted)
        .text(`Fixpath Audit — ${domain}`, leftM, 20, { width: contentW / 2 })
      doc.fontSize(7).font('Helvetica').fillColor(C.muted)
        .text(dateStr, leftM + contentW / 2, 20, { width: contentW / 2, align: 'right' })
      doc.moveTo(leftM, 34).lineTo(leftM + contentW, 34).strokeColor(C.ruleLight).lineWidth(0.5).stroke()
      doc.restore()
      doc.y = 56
    }

    /* Card-style bordered box (matches the shared page's border cards) */
    const drawCardBorder = (x: number, y: number, w: number, h: number, opts?: { radius?: number }) => {
      const r = opts?.radius ?? 0
      if (r > 0) {
        doc.roundedRect(x, y, w, h, r).strokeColor(C.rule).lineWidth(0.75).stroke()
      } else {
        doc.rect(x, y, w, h).strokeColor(C.rule).lineWidth(0.75).stroke()
      }
    }

    /* Draw a score ring approximation (circle arc + number in center) */
    const drawScoreRing = (cx: number, cy: number, radius: number, score: number) => {
      // Background ring (light gray)
      doc.save()
      doc.circle(cx, cy, radius).lineWidth(5).strokeColor('#E8E5DE').stroke()
      // Score arc
      const color = scoreColor(score)
      const startAngle = -Math.PI / 2
      const endAngle = startAngle + (2 * Math.PI * score / 100)

      // Draw arc by creating a path
      doc.save()
      doc.strokeColor(color).lineWidth(5)
      // PDFKit doesn't have native arc, so we approximate with small line segments
      const segments = Math.max(2, Math.ceil(score / 2))
      const step = (endAngle - startAngle) / segments
      doc.moveTo(cx + radius * Math.cos(startAngle), cy + radius * Math.sin(startAngle))
      for (let i = 1; i <= segments; i++) {
        const angle = startAngle + step * i
        doc.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle))
      }
      doc.stroke()
      doc.restore()

      // Score number centered
      doc.fontSize(28).font('Helvetica-Bold').fillColor(scoreColor(score))
      const scoreText = `${score}`
      const tw = doc.widthOfString(scoreText)
      doc.text(scoreText, cx - tw / 2, cy - 12, { lineBreak: false })
      // "/100" label
      doc.fontSize(8).font('Helvetica').fillColor(C.muted)
      const subText = '/100'
      const stw = doc.widthOfString(subText)
      doc.text(subText, cx - stw / 2, cy + 16, { lineBreak: false })
      doc.restore()
    }

    // ═══════════════════════════════════════════════════════
    // PAGE 1
    // ═══════════════════════════════════════════════════════

    drawPageHeader()

    // ── Shared badge ──────────────────────────────────────
    doc.fontSize(8).font('Helvetica').fillColor(C.muted)
      .text(`Shared audit report  |  `, leftM, doc.y + 2, { continued: true })
    doc.font('Helvetica-Bold').fillColor(C.ink)
      .text(domain, { continued: true })
    doc.font('Helvetica').fillColor(C.muted)
      .text(`  |  ${dateStr}`)
    doc.moveDown(1)

    // ── Hero Score Card ─────────────────────────────────────
    const heroY = doc.y
    const heroH = 120
    doc.rect(leftM, heroY, contentW, heroH).fill(C.white)
    drawCardBorder(leftM, heroY, contentW, heroH)

    // Score ring on the left
    const ringCx = leftM + 60
    const ringCy = heroY + heroH / 2
    drawScoreRing(ringCx, ringCy, 36, overall)

    // Domain + meta on the right
    const metaX = leftM + 128
    doc.fontSize(16).font('Helvetica-Bold').fillColor(C.ink)
      .text(domain, metaX, heroY + 18, { width: contentW - 140 })
    doc.fontSize(8).font('Helvetica').fillColor(C.muted)
      .text(`${activeFindings.length} findings  ·  ${PILLAR_NAMES.length} modules`, metaX, heroY + 38, { width: contentW - 140 })

    // Pillar mini-scores
    let miniY = heroY + 54
    let miniX = metaX
    for (let i = 0; i < pillarScores.length; i++) {
      const p = pillarScores[i]
      if (p.cats.length === 0) continue
      // Wrap to next row if needed
      const itemW = doc.fontSize(7).font('Helvetica').widthOfString(p.name) + 28
      if (miniX + itemW > leftM + contentW - 10) {
        miniX = metaX
        miniY += 12
      }
      doc.circle(miniX + 3, miniY + 3, 3).fill(MODULE_TINTS[i].dot)
      doc.fontSize(7).font('Helvetica').fillColor(C.muted)
        .text(p.name, miniX + 9, miniY - 1, { width: 100, lineBreak: false })
      const nameW = doc.widthOfString(p.name)
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(scoreColor(p.avg))
        .text(`${p.avg}`, miniX + 10 + nameW + 2, miniY - 1, { width: 20, lineBreak: false })
      miniX += itemW + 4
    }

    // Severity counts
    const sevRowY = miniY + 16
    let sevX = metaX
    if (severityCounts.critical > 0) {
      doc.circle(sevX + 3, sevRowY + 3, 2.5).fill(C.severe)
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.severe)
        .text(`${severityCounts.critical} critical`, sevX + 9, sevRowY - 1, { width: 60, lineBreak: false })
      sevX += 65
    }
    if (severityCounts.high > 0) {
      doc.circle(sevX + 3, sevRowY + 3, 2.5).fill(C.warn)
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.warn)
        .text(`${severityCounts.high} high`, sevX + 9, sevRowY - 1, { width: 50, lineBreak: false })
      sevX += 50
    }
    if ((severityCounts.medium + severityCounts.low) > 0) {
      doc.fontSize(7.5).font('Helvetica').fillColor(C.muted)
        .text(`${severityCounts.medium + severityCounts.low} more`, sevX + 4, sevRowY - 1, { width: 50, lineBreak: false })
    }

    doc.y = heroY + heroH + 14

    // ── Top Priority Recommendations ────────────────────────
    if (topRecs.length > 0) {
      ensureSpace(60 + topRecs.length * 40)
      const recsStartY = doc.y

      // Measure total height for the card
      let recsH = 44 // header height
      const recHeights: number[] = []
      for (const rec of topRecs) {
        const h = doc.fontSize(9.5).font('Helvetica').heightOfString(rec, { width: contentW - 60 })
        const rowH = Math.max(28, h + 14)
        recHeights.push(rowH)
        recsH += rowH
      }

      // Card background + border
      doc.rect(leftM, recsStartY, contentW, recsH).fill(C.white)
      drawCardBorder(leftM, recsStartY, contentW, recsH)

      // Header bar with signal tint
      const signalTintBg = mixWithWhite(C.signal, 4)
      doc.rect(leftM + 0.5, recsStartY + 0.5, contentW - 1, 43).fill(signalTintBg)
      // Header border bottom
      doc.moveTo(leftM, recsStartY + 44).lineTo(leftM + contentW, recsStartY + 44)
        .strokeColor(C.ruleLight).lineWidth(0.5).stroke()

      // Zap icon placeholder (green square)
      doc.roundedRect(leftM + 14, recsStartY + 10, 22, 22, 4).fill(C.signal)
      doc.fontSize(11).font('Helvetica-Bold').fillColor(C.white)
        .text('!', leftM + 22, recsStartY + 14, { width: 8, align: 'center', lineBreak: false })

      doc.fontSize(10).font('Helvetica-Bold').fillColor(C.ink)
        .text('Top priority recommendations', leftM + 44, recsStartY + 10, { width: contentW - 100 })
      doc.fontSize(7.5).font('Helvetica').fillColor(C.muted)
        .text('Ranked by business impact, fix effort, and evidence strength.', leftM + 44, recsStartY + 24, { width: contentW - 100 })

      // Actions badge
      doc.fontSize(7).font('Helvetica-Bold').fillColor(C.signal)
        .text(`${topRecs.length} actions`, leftM + contentW - 60, recsStartY + 16, { width: 50, align: 'right' })

      // Recommendation rows
      let recY = recsStartY + 44
      for (let i = 0; i < topRecs.length; i++) {
        if (i > 0) {
          doc.moveTo(leftM + 10, recY).lineTo(leftM + contentW - 10, recY)
            .strokeColor(C.ruleLight).lineWidth(0.3).stroke()
        }

        // Number circle
        doc.circle(leftM + 22, recY + recHeights[i] / 2, 10).fill(C.signal)
        doc.fontSize(9).font('Helvetica-Bold').fillColor(C.white)
          .text(`${i + 1}`, leftM + 15, recY + recHeights[i] / 2 - 5, { width: 14, align: 'center', lineBreak: false })
        doc.fontSize(6).font('Helvetica-Bold').fillColor(C.muted)
          .text('Priority', leftM + 12, recY + recHeights[i] / 2 + 8, { width: 20, align: 'center', lineBreak: false })

        // Lightbulb label
        doc.fontSize(7).font('Helvetica-Bold').fillColor(C.signal)
          .text('RECOMMENDED FIX', leftM + 44, recY + 6)
        // Recommendation text
        doc.fontSize(9.5).font('Helvetica').fillColor(C.ink)
          .text(topRecs[i], leftM + 44, recY + 18, { width: contentW - 60 })

        recY += recHeights[i]
      }

      doc.y = recsStartY + recsH + 14
    }

    // ── Executive Summary ────────────────────────────────────
    if (r.executive_summary) {
      const summaryText = r.executive_summary || ''
      const summaryH = doc.fontSize(9.5).font('Helvetica').heightOfString(summaryText, { width: contentW - 28, lineGap: 2 })
      const cardH = 44 + summaryH + 14

      ensureSpace(Math.min(cardH, 200))
      const esY = doc.y

      doc.rect(leftM, esY, contentW, cardH).fill(C.white)
      drawCardBorder(leftM, esY, contentW, cardH)

      // Header
      doc.moveTo(leftM, esY + 36).lineTo(leftM + contentW, esY + 36)
        .strokeColor(C.ruleLight).lineWidth(0.5).stroke()
      doc.fontSize(11).font('Helvetica-Bold').fillColor(C.ink)
        .text('Executive summary', leftM + 14, esY + 12, { width: contentW - 28 })

      // Body
      doc.fontSize(9.5).font('Helvetica').fillColor(C.muted)
        .text(summaryText, leftM + 14, esY + 44, { width: contentW - 28, lineGap: 2 })

      doc.y = esY + cardH + 14
    }

    // ── Module Grid (2-column, matching shared page) ─────────
    if (categoryScores.length > 0) {
      const colGap = 12
      const colWidth = (contentW - colGap) / 2

      // Render pillars in pairs (2 per row) to match the 2x3 grid
      for (let row = 0; row < 3; row++) {
        const leftIdx = row * 2
        const rightIdx = row * 2 + 1

        // Measure heights for both columns
        const measurePillarH = (pillar: typeof pillarScores[0], idx: number): number => {
          if (pillar.cats.length === 0) return 0
          return 48 + 6 + pillar.cats.length * 18 + 12
        }

        const leftH = leftIdx < pillarScores.length ? measurePillarH(pillarScores[leftIdx], leftIdx) : 0
        const rightH = rightIdx < pillarScores.length ? measurePillarH(pillarScores[rightIdx], rightIdx) : 0
        const rowH = Math.max(leftH, rightH)

        if (rowH === 0) continue
        ensureSpace(rowH + 8)

        const rowY = doc.y

        // Draw each pillar card
        for (const side of [0, 1] as const) {
          const pIdx = row * 2 + side
          if (pIdx >= pillarScores.length) continue
          const pillar = pillarScores[pIdx]
          if (pillar.cats.length === 0) continue

          const tint = MODULE_TINTS[pIdx]
          const x = leftM + side * (colWidth + colGap)
          const h = measurePillarH(pillar, pIdx)
          const pFindings = findingsByPillar[pillar.name] || []

          // Card background + border
          doc.roundedRect(x, rowY, colWidth, h, 6).fill(tint.bg)
          doc.roundedRect(x, rowY, colWidth, h, 6).strokeColor(tint.border).lineWidth(0.75).stroke()

          // Icon placeholder (tinted square)
          const iconBg = mixWithWhite(tint.dot, 8)
          doc.roundedRect(x + 14, rowY + 12, 24, 24, 5).fill(iconBg)
          // Small dot for icon representation
          doc.circle(x + 26, rowY + 24, 4).fill(tint.dot)

          // Pillar name
          doc.fontSize(10).font('Helvetica-Bold').fillColor(C.ink)
            .text(pillar.name, x + 46, rowY + 14, { width: colWidth - 100 })
          if (pFindings.length > 0) {
            doc.fontSize(7.5).font('Helvetica').fillColor(C.muted)
              .text(`${pFindings.length} finding${pFindings.length !== 1 ? 's' : ''}`, x + 46, rowY + 28, { width: colWidth - 100 })
          }

          // Score on right
          doc.fontSize(18).font('Helvetica-Bold').fillColor(scoreColor(pillar.avg))
            .text(`${pillar.avg}`, x + colWidth - 46, rowY + 14, { width: 32, align: 'right', lineBreak: false })
          doc.fontSize(7).font('Helvetica').fillColor(C.muted)
            .text('/100', x + colWidth - 40, rowY + 34, { width: 26, align: 'right', lineBreak: false })

          // Category separator
          doc.moveTo(x + 4, rowY + 48).lineTo(x + colWidth - 4, rowY + 48)
            .strokeColor(tint.border).lineWidth(0.5).stroke()

          // Category rows with progress bars
          let catY = rowY + 54
          for (const cat of pillar.cats) {
            // Category name
            doc.fontSize(8.5).font('Helvetica').fillColor(C.ink)
              .text(cat.name, x + 14, catY, { width: colWidth - 76, lineBreak: false })

            // Progress bar
            const barX = x + colWidth - 56
            const barW = 32
            doc.rect(barX, catY + 4, barW, 3).fill(mixWithWhite(tint.dot, 8))
            doc.rect(barX, catY + 4, Math.max(1, (cat.score / 100) * barW), 3).fillOpacity(0.55).fill(tint.dot)
            doc.fillOpacity(1)

            // Score
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor(scoreColor(cat.score))
              .text(`${cat.score}`, x + colWidth - 20, catY, { width: 16, align: 'right', lineBreak: false })

            catY += 18
          }
        }

        doc.y = rowY + rowH + 10
      }
      doc.moveDown(0.3)
    }

    // ── Checkpoint Health ─────────────────────────────────────
    if (categoryScores.length > 0) {
      ensureSpace(60)

      // Card header
      const cpHeaderY = doc.y
      doc.rect(leftM, cpHeaderY, contentW, 30).fill(C.offWhite)
      drawCardBorder(leftM, cpHeaderY, contentW, 30)
      doc.fontSize(8).font('Helvetica-Bold').fillColor(C.muted)
        .text(`${categoryScores.length * 4}-CHECKPOINT HEALTH`, leftM + 14, cpHeaderY + 9, { width: contentW / 2, characterSpacing: 0.3 })
      doc.fontSize(8).font('Helvetica').fillColor(C.muted)
        .text(`${activeFindings.length} issues · ${categoryScores.length} categories`, leftM + contentW - 180, cpHeaderY + 9, { width: 166, align: 'right' })
      doc.y = cpHeaderY + 30

      // Build findings-by-category map (same logic as shared page)
      const findingsByCategory: Record<string, AuditFinding[]> = {}
      for (const cat of categoryScores) findingsByCategory[cat.name] = []
      for (const f of activeFindings) {
        let matched = false
        for (const cat of categoryScores) {
          const words = cat.name.toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3)
          const text = `${f.title} ${f.description}`.toLowerCase()
          if (words.some(w => text.includes(w))) {
            findingsByCategory[cat.name].push(f)
            matched = true
            break
          }
        }
        if (!matched && categoryScores.length > 0) {
          const catIdx = Math.min(Math.floor(f.sort_order / Math.max(1, activeFindings.length / categoryScores.length)), categoryScores.length - 1)
          findingsByCategory[categoryScores[catIdx].name]?.push(f)
        }
      }

      for (let catIdx = 0; catIdx < categoryScores.length; catIdx++) {
        const cat = categoryScores[catIdx]
        const checkpoints = CHECKPOINT_LABELS[cat.name] || ['Check 1', 'Check 2', 'Check 3', 'Check 4']
        const catFindings = findingsByCategory[cat.name] || []
        const failCount = Math.min(catFindings.length, checkpoints.length)
        const passCount = checkpoints.length - failCount

        ensureSpace(18 + checkpoints.length * 16)

        // Category row
        const chY = doc.y
        doc.moveTo(leftM, chY).lineTo(leftM + contentW, chY)
          .strokeColor(C.ruleLight).lineWidth(0.5).stroke()
        doc.fontSize(8).font('Helvetica-Bold').fillColor(scoreColor(cat.score))
          .text(`${cat.score}`, leftM + 6, chY + 4, { width: 18, align: 'right' })
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.ink)
          .text(cat.name, leftM + 30, chY + 4, { width: contentW - 120 })
        if (passCount > 0) {
          doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.ok)
            .text(`${passCount} pass`, leftM + contentW - 80, chY + 4, { width: 34 })
        }
        if (failCount > 0) {
          doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.severe)
            .text(`${failCount} fail`, leftM + contentW - 40, chY + 4, { width: 34 })
        }
        doc.y = chY + 18

        // Checkpoint rows
        for (let i = 0; i < checkpoints.length; i++) {
          if (doc.y > pageBottom - 14) { doc.addPage(); drawPageHeader() }
          const hasFinding = i < failCount
          const finding = hasFinding ? catFindings[i] : null
          const cpY = doc.y
          const bgColor = hasFinding ? mixWithWhite(C.severe, 5) : mixWithWhite(C.ok, 5)
          const textColor = hasFinding ? C.severe : C.ok
          doc.roundedRect(leftM + 14, cpY, contentW - 28, 14, 3).fill(bgColor)
          // Marker
          const marker = hasFinding ? '!' : '✓'
          doc.fontSize(7).font('Helvetica-Bold').fillColor(textColor)
            .text(marker, leftM + 18, cpY + 3, { width: 10, lineBreak: false })
          // Checkpoint label
          doc.fontSize(7.5).font('Helvetica-Bold').fillColor(textColor)
            .text(checkpoints[i], leftM + 32, cpY + 3, { width: contentW - 100 })
          // Pass/Fail label
          doc.fontSize(7).font('Helvetica-Bold').fillColor(textColor)
            .text(hasFinding ? 'Fail' : 'Pass', leftM + contentW - 44, cpY + 3, { width: 26, align: 'right' })
          doc.y = cpY + 16
        }
        doc.moveDown(0.2)
      }
      doc.moveDown(0.6)
    }

    // ── AI Visibility Breakdown ──────────────────────────────
    if (aiVis) {
      ensureSpace(110)

      const aiStartY = doc.y
      // Measure total height
      const aiH = 36 + 4 * 30 + 10
      doc.rect(leftM, aiStartY, contentW, aiH).fill(C.white)
      drawCardBorder(leftM, aiStartY, contentW, aiH)

      // Header
      doc.fontSize(10).font('Helvetica-Bold').fillColor(C.ink)
        .text('AI visibility breakdown', leftM + 28, aiStartY + 10, { width: contentW - 80 })
      // Overall score
      doc.fontSize(14).font('Helvetica-Bold').fillColor(C.ink)
        .text(`${aiVis.overall}`, leftM + contentW - 50, aiStartY + 8, { width: 30, align: 'right', continued: true, lineBreak: false })
      doc.fontSize(8).font('Helvetica').fillColor(C.muted)
        .text('/100', { lineBreak: false })

      const bars = [
        { label: 'LLM knowledge accuracy', value: aiVis.llmAccuracy, desc: 'How accurately AI describes your site' },
        { label: 'Structured data coverage', value: aiVis.structuredData, desc: 'JSON-LD completeness for rich results' },
        { label: 'Content extractability', value: aiVis.contentExtractability, desc: 'How well AI can read your pages' },
        { label: 'Crawl infrastructure', value: aiVis.crawlInfrastructure, desc: 'robots.txt, llms.txt, ai-plugin.json' },
      ]

      let barY = aiStartY + 36
      for (const bar of bars) {
        doc.fontSize(7.5).font('Helvetica').fillColor(C.muted)
          .text(bar.label, leftM + 14, barY)
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.ink)
          .text(`${bar.value}`, leftM + contentW - 30, barY, { width: 16, align: 'right' })
        // Bar track
        const bY = barY + 11
        doc.rect(leftM + 14, bY, contentW - 28, 4).fill(mixWithWhite(C.rule, 20))
        doc.rect(leftM + 14, bY, Math.max(1, (bar.value / 100) * (contentW - 28)), 4).fill(scoreColor(bar.value))
        // Description
        doc.fontSize(7).font('Helvetica').fillColor(mixWithWhite(C.muted, 60))
          .text(bar.desc, leftM + 14, bY + 6)
        barY += 28
      }

      doc.y = aiStartY + aiH + 14
    }

    // ── All Findings ─────────────────────────────────────────
    if (activeFindings.length > 0) {
      ensureSpace(70)

      // Severity summary card
      const sumStartY = doc.y
      const sumH = 50
      doc.rect(leftM, sumStartY, contentW, sumH).fill(C.white)
      drawCardBorder(leftM, sumStartY, contentW, sumH)

      // Header row
      doc.fontSize(10).font('Helvetica-Bold').fillColor(C.ink)
        .text('All findings', leftM + 24, sumStartY + 8, { width: contentW - 100 })
      doc.fontSize(8).font('Helvetica').fillColor(C.muted)
        .text(`${activeFindings.length} active`, leftM + contentW - 80, sumStartY + 10, { width: 66, align: 'right' })

      // Separator
      doc.moveTo(leftM, sumStartY + 26).lineTo(leftM + contentW, sumStartY + 26)
        .strokeColor(C.ruleLight).lineWidth(0.5).stroke()

      // Severity cells (4 columns)
      const sevColW = contentW / 4
      const sevKeys = ['critical', 'high', 'medium', 'low'] as const
      for (let i = 0; i < sevKeys.length; i++) {
        const sev = sevKeys[i]
        const cfg = SEV[sev]
        const count = severityCounts[sev]
        const sx = leftM + i * sevColW
        if (i > 0) {
          doc.moveTo(sx, sumStartY + 28).lineTo(sx, sumStartY + sumH - 4)
            .strokeColor(C.ruleLight).lineWidth(0.3).stroke()
        }
        // Dot + label
        doc.circle(sx + 10, sumStartY + 32, 2).fill(cfg.color)
        doc.fontSize(7).font('Helvetica-Bold').fillColor(cfg.color)
          .text(cfg.label.toUpperCase(), sx + 16, sumStartY + 29, { width: 50, characterSpacing: 0.3 })
        // Count
        doc.fontSize(15).font('Helvetica-Bold').fillColor(count > 0 ? cfg.color : C.muted)
          .text(`${count}`, sx + 10, sumStartY + 36, { width: 30, lineBreak: false })
      }

      doc.y = sumStartY + sumH + 10

      // Findings grouped by pillar
      for (let pi = 0; pi < PILLAR_NAMES.length; pi++) {
        const pillarName = PILLAR_NAMES[pi]
        const pFindings = findingsByPillar[pillarName]
        if (!pFindings || pFindings.length === 0) continue

        ensureSpace(40)

        // Pillar header
        const phY = doc.y
        doc.circle(leftM + 6, phY + 5, 3.5).fill(MODULE_TINTS[pi].dot)
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor(C.ink)
          .text(pillarName, leftM + 16, phY, { width: contentW - 80 })
        doc.fontSize(8).font('Helvetica').fillColor(C.muted)
          .text(`${pFindings.length} finding${pFindings.length !== 1 ? 's' : ''}`, leftM + contentW - 80, phY + 1, { width: 66, align: 'right' })
        doc.y = phY + 18

        // Individual finding cards
        for (const finding of pFindings) {
          const sev = SEV[finding.severity] || SEV.medium
          const titleH = doc.fontSize(9.5).font('Helvetica-Bold').heightOfString(finding.title || '', { width: contentW - 30 })
          const descH = finding.description ? doc.fontSize(8.5).font('Helvetica').heightOfString(finding.description, { width: contentW - 30 }) : 0
          const recH = finding.recommendation ? doc.fontSize(8).font('Helvetica').heightOfString(finding.recommendation, { width: contentW - 44 }) : 0
          const cardH = 16 + titleH + (descH > 0 ? descH + 4 : 0) + (recH > 0 ? recH + 22 : 0) + 10
          ensureSpace(Math.min(cardH, 150))

          const fy = doc.y
          doc.rect(leftM, fy, contentW, cardH).fill(C.white)
          drawCardBorder(leftM, fy, contentW, cardH)

          let curY = fy + 8

          // Severity dot + label + category
          doc.circle(leftM + 12, curY + 2, 3).fill(sev.color)
          doc.fontSize(7).font('Helvetica-Bold').fillColor(sev.color)
            .text(sev.label.toUpperCase(), leftM + 20, curY - 1, { width: 50, characterSpacing: 0.3 })
          const catName = finding.category_index != null && categoryScores[finding.category_index]
            ? categoryScores[finding.category_index].name
            : null
          if (catName) {
            doc.fontSize(7).font('Helvetica').fillColor(C.muted)
              .text(catName.toUpperCase(), leftM + 70, curY - 1, { width: contentW - 80, characterSpacing: 0.2 })
          }
          curY += 12

          // Title
          doc.fontSize(9.5).font('Helvetica-Bold').fillColor(C.ink)
            .text(finding.title || 'Untitled', leftM + 12, curY, { width: contentW - 24 })
          curY = doc.y + 2

          // Description
          if (finding.description) {
            doc.fontSize(8.5).font('Helvetica').fillColor(C.muted)
              .text(finding.description, leftM + 12, curY, { width: contentW - 24, lineGap: 1 })
            curY = doc.y + 2
          }

          // Recommendation (signal-tinted box, matching shared page)
          if (finding.recommendation) {
            curY += 2
            const recBoxBg = mixWithWhite(C.signal, 5)
            const measuredRecH = doc.fontSize(8).font('Helvetica').heightOfString(finding.recommendation, { width: contentW - 44 })
            doc.roundedRect(leftM + 12, curY, contentW - 24, measuredRecH + 14, 4).fill(recBoxBg)
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.signal)
              .text('Recommendation:', leftM + 20, curY + 4)
            doc.fontSize(8).font('Helvetica').fillColor(C.ink)
              .text(finding.recommendation, leftM + 20, curY + 14, { width: contentW - 44 })
          }

          doc.y = fy + cardH + 4
        }
        doc.moveDown(0.4)
      }
    }

    // ── AI Transparency Note ────────────────────────────────
    ensureSpace(50)
    doc.moveDown(0.5)
    const noteY = doc.y
    const noteText = 'This report was generated by AI analysing publicly visible page content across up to 6 modules and 24 categories. It cannot test JavaScript interactions, real load times, or content behind authentication. For accessibility compliance and security-critical findings, we recommend pairing these results with manual review.'
    const noteTextH = doc.fontSize(7.5).font('Helvetica').heightOfString(noteText, { width: contentW - 28, lineGap: 1 })
    const noteH = 18 + noteTextH + 10
    doc.roundedRect(leftM, noteY, contentW, noteH, 6).fill(C.offWhite)
    doc.roundedRect(leftM, noteY, contentW, noteH, 6).strokeColor(mixWithWhite(C.rule, 15)).lineWidth(0.5).stroke()
    doc.fontSize(8).font('Helvetica-Bold').fillColor(C.muted)
      .text('About this audit', leftM + 14, noteY + 8)
    doc.fontSize(7.5).font('Helvetica').fillColor(mixWithWhite(C.muted, 30))
      .text(noteText, leftM + 14, noteY + 20, { width: contentW - 28, lineGap: 1 })

    // ── Finalize ──────────────────────────────────────────
    doc.end()

    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="fixpath-audit-${domain}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (err: any) {
    console.error('[shared-pdf]', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
