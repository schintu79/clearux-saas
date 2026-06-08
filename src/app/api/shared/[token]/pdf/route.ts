// ============================================================
// Fixpath API — GET /api/shared/:token/pdf
// Public PDF download for shared audits (no auth required)
//
// Print-first report design — no dashboard cards, no widget
// grids, no fragile 2-column layouts. Every section flows
// top-to-bottom with predictable page breaks.
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { createServiceSupabase } from '@/lib/supabase-server'
import { CHECKPOINT_LABELS } from '@/lib/audit-checkpoints'
import { getDisplayTitle, getWhatFound, getWhyMatters, getFixPlain } from '@/lib/finding-communication-helpers'
import type { AuditFinding } from '@/types/database'

// ─── Design tokens ──────────────────────────────────────────
// Resolved from the app's CSS variables. Pure hex — no rgba,
// no opacity, no mix-blend. PDFKit renders these directly.
const T = {
  ink:       '#14130F',
  body:      '#3B3830',
  muted:     '#6B6759',
  faint:     '#9B9585',
  rule:      '#E5E3DE',
  ruleFaint: '#E8E3D6',
  pageBg:    '#FFFFFF',
  offWhite:  '#F8F6F2',
  signal:    '#5E6B2F',
  signalBg:  '#F4F5EE',
  severe:    '#8B3A2C',
  severeBg:  '#F8F0EE',
  warn:      '#9A7A2C',
  warnBg:    '#F8F5ED',
  ok:        '#3F6B3F',
  okBg:      '#EFF5EF',
} as const

const SEV_CFG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: T.severe,  bg: T.severeBg },
  high:     { label: 'High',     color: T.warn,    bg: T.warnBg },
  medium:   { label: 'Medium',   color: T.signal,  bg: T.signalBg },
  low:      { label: 'Low',      color: T.ok,      bg: T.okBg },
}

const PILLAR_COLORS = [
  '#3B82F6', // Foundation
  '#EC4899', // Human Experience
  '#8B5CF6', // Inclusive Design
  '#F59E0B', // Future Readiness
  '#10B981', // SEO Structure & Rules
  '#14B8A6', // Accessibility Readiness
  '#06B6D4', // Design Consistency
]

const PILLAR_NAMES = [
  'Foundation', 'Human Experience', 'Inclusive Design',
  'Future Readiness', 'SEO Structure & Rules', 'Accessibility Readiness', 'Design Consistency',
]
const PILLAR_RANGES: [number, number][] = [
  [0, 4], [4, 8], [8, 12], [12, 16], [16, 20], [20, 24], [24, 28],
]

function scoreColor(s: number): string {
  if (s >= 70) return T.ok
  if (s >= 40) return T.warn
  return T.severe
}

// ─── Main route ─────────────────────────────────────────────

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
      .is('deleted_at', null)
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
    const categoryScores: Array<{ name: string; score: number; summary: string }> =
      rawJson?.categoryScores || []
    const topRecs: string[] =
      rawJson.topRecommendations ||
      (rawJson.keyRecommendation ? [rawJson.keyRecommendation] : [])

    let domain = 'audit'
    try { domain = new URL(a.product_url).hostname.replace(/^www\./, '') } catch {}

    const dateStr = new Date(a.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

    const scoredCats = categoryScores.filter(c => c.score >= 0)
    const overall = scoredCats.length > 0
      ? Math.round(scoredCats.reduce((s, c) => s + c.score, 0) / scoredCats.length)
      : (r.overall_score ?? 0)

    const activeFindings = findings.filter(f => !f.dismissed)
    const sevCounts = {
      critical: activeFindings.filter(f => f.severity === 'critical').length,
      high:     activeFindings.filter(f => f.severity === 'high').length,
      medium:   activeFindings.filter(f => f.severity === 'medium').length,
      low:      activeFindings.filter(f => f.severity === 'low').length,
    }

    // Group findings by pillar
    const findingsByPillar: Record<string, AuditFinding[]> = {}
    for (const n of PILLAR_NAMES) findingsByPillar[n] = []
    for (const f of activeFindings) {
      const ci = (f as any).category_index
      if (ci != null) {
        const pi = Math.floor(ci / 4)
        if (pi >= 0 && pi < PILLAR_NAMES.length) {
          findingsByPillar[PILLAR_NAMES[pi]].push(f)
          continue
        }
      }
      const txt = `${f.title} ${f.description}`.toLowerCase()
      let hit = false
      for (let pi = 0; pi < PILLAR_NAMES.length; pi++) {
        const words = PILLAR_NAMES[pi].toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3)
        if (words.some(w => txt.includes(w))) {
          findingsByPillar[PILLAR_NAMES[pi]].push(f)
          hit = true
          break
        }
      }
      if (!hit) findingsByPillar[PILLAR_NAMES[0]].push(f)
    }

    // Pillar averages
    const pillarScores = PILLAR_NAMES.map((name, idx) => {
      const [start, end] = PILLAR_RANGES[idx]
      const cats = categoryScores.filter((_, i) => i >= start && i < end).filter(c => c.score >= 0)
      const avg = cats.length > 0
        ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 0
      return { name, avg, cats, findings: findingsByPillar[name] || [] }
    })

    const aiVis = rawJson?.aiVisibilityBreakdown

    // ─── PDF DOCUMENT ─────────────────────────────────────
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      bufferPages: true,    // needed for page numbering
      info: {
        Title: `Fixpath Audit — ${domain}`,
        Author: 'Fixpath.ai',
        Subject: `Website health audit for ${domain}`,
      },
    })

    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))

    const PW = 595.28   // A4 width pts
    const PH = 841.89   // A4 height pts
    const M  = 60       // margins
    const CW = PW - M * 2 // content width = 475.28
    const BOTTOM = PH - M - 30 // leave room for footer

    // ─── Print utilities ────────────────────────────────
    /** Add a new page and reset Y */
    const newPage = () => { doc.addPage(); doc.y = M }

    /** If we can't fit `needed` pts, start a new page */
    const ensure = (needed: number) => {
      if (doc.y + needed > BOTTOM) newPage()
    }

    /** Horizontal rule */
    const hr = (y?: number) => {
      const ly = y ?? doc.y
      doc.moveTo(M, ly).lineTo(M + CW, ly)
        .strokeColor(T.rule).lineWidth(0.5).stroke()
    }

    /** Section title — large, with a colored underline */
    const sectionTitle = (title: string, color?: string) => {
      ensure(40)
      if (doc.y > M + 20) doc.moveDown(0.8)
      doc.fontSize(14).font('Helvetica-Bold').fillColor(T.ink)
        .text(title, M, undefined, { width: CW })
      const underY = doc.y + 3
      doc.moveTo(M, underY).lineTo(M + CW, underY)
        .strokeColor(color || T.rule).lineWidth(1).stroke()
      doc.y = underY + 8
    }

    /** Sub-heading inside a section */
    const subHead = (title: string, right?: string) => {
      ensure(24)
      doc.fontSize(10).font('Helvetica-Bold').fillColor(T.ink)
        .text(title, M, undefined, { width: CW - 80 })
      if (right) {
        doc.fontSize(9).font('Helvetica').fillColor(T.muted)
          .text(right, M + CW - 80, doc.y - 13, { width: 80, align: 'right' })
      }
      doc.moveDown(0.2)
    }

    /** Body paragraph */
    const bodyText = (text: string) => {
      doc.fontSize(9.5).font('Helvetica').fillColor(T.body)
        .text(text, M, undefined, { width: CW, lineGap: 2.5 })
      doc.moveDown(0.3)
    }

    /** Small muted label */
    const label = (text: string, x?: number, y?: number) => {
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(T.muted)
        .text(text.toUpperCase(), x ?? M, y ?? undefined, { width: CW, characterSpacing: 0.4 })
    }

    // ═════════════════════════════════════════════════════
    // 1. COVER PAGE
    // ═════════════════════════════════════════════════════

    // Fixpath wordmark
    doc.fontSize(22).font('Helvetica-Bold').fillColor(T.ink)
      .text('Fixpath', M, M)
    doc.fontSize(9).font('Helvetica').fillColor(T.muted)
      .text('.ai', M + doc.widthOfString('Fixpath') + 2, M + 8)

    doc.y = M + 50

    // Title block
    label('WEBSITE HEALTH AUDIT')
    doc.moveDown(0.4)
    doc.fontSize(28).font('Helvetica-Bold').fillColor(T.ink)
      .text(domain, M, undefined, { width: CW })
    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica').fillColor(T.muted)
      .text(dateStr)
    doc.moveDown(0.2)
    doc.fontSize(10).font('Helvetica').fillColor(T.muted)
      .text(`${activeFindings.length} findings across ${PILLAR_NAMES.length} modules and ${PILLAR_NAMES.length * 4} categories`)

    // Horizontal divider
    doc.moveDown(1.5)
    hr()
    doc.moveDown(1.5)

    // ── Overall score ──────────────────────────────────
    const scoreY = doc.y
    doc.fontSize(72).font('Helvetica-Bold').fillColor(scoreColor(overall))
      .text(`${overall}`, M, scoreY, { lineBreak: false })
    const scoreW = doc.widthOfString(`${overall}`)
    doc.fontSize(16).font('Helvetica').fillColor(T.faint)
      .text('/100', M + scoreW + 4, scoreY + 48, { lineBreak: false })
    doc.fontSize(11).font('Helvetica').fillColor(T.muted)
      .text('Website Health Score', M + scoreW + 4, scoreY + 6, { lineBreak: false })

    doc.y = scoreY + 95

    // ── Severity summary ───────────────────────────────
    const sevOrder = ['critical', 'high', 'medium', 'low'] as const
    let sx = M
    for (const key of sevOrder) {
      const cfg = SEV_CFG[key]
      const count = sevCounts[key]
      if (count === 0) continue
      doc.circle(sx + 4, doc.y + 4, 3).fill(cfg.color)
      doc.fontSize(9).font('Helvetica-Bold').fillColor(cfg.color)
        .text(`${count} ${cfg.label}`, sx + 12, doc.y, { width: 80, lineBreak: false })
      sx += 80
    }
    if (sx > M) doc.moveDown(1)

    // ── Module summary row ─────────────────────────────
    doc.moveDown(0.5)
    label('MODULE SCORES')
    doc.moveDown(0.4)
    for (let i = 0; i < pillarScores.length; i++) {
      const p = pillarScores[i]
      if (p.cats.length === 0) continue
      const rowY = doc.y
      // Color bar
      doc.rect(M, rowY, 3, 14).fill(PILLAR_COLORS[i])
      doc.fontSize(9.5).font('Helvetica').fillColor(T.ink)
        .text(p.name, M + 10, rowY + 1, { width: CW - 80 })
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor(scoreColor(p.avg))
        .text(`${p.avg}`, M + CW - 30, rowY + 1, { width: 30, align: 'right' })
      // Finding count
      if (p.findings.length > 0) {
        doc.fontSize(8).font('Helvetica').fillColor(T.faint)
          .text(`${p.findings.length} findings`, M + CW - 100, rowY + 2, { width: 60, align: 'right' })
      }
      doc.y = rowY + 18
    }

    // ═════════════════════════════════════════════════════
    // 2. EXECUTIVE SUMMARY  (new page)
    // ═════════════════════════════════════════════════════

    if (r.executive_summary || topRecs.length > 0) {
      newPage()
      sectionTitle('Executive summary')

      if (r.executive_summary) {
        const paras = r.executive_summary.split('\n').filter((s: string) => s.trim())
        for (const p of paras) {
          ensure(20)
          bodyText(p.trim())
        }
      }

      if (topRecs.length > 0) {
        doc.moveDown(0.6)
        subHead('Top priority recommendations')
        for (let i = 0; i < topRecs.length; i++) {
          ensure(30)
          const recY = doc.y
          // Number
          doc.fontSize(9).font('Helvetica-Bold').fillColor(T.signal)
            .text(`${i + 1}.`, M, recY, { width: 16 })
          // Text
          doc.fontSize(9.5).font('Helvetica').fillColor(T.body)
            .text(topRecs[i], M + 20, recY, { width: CW - 20, lineGap: 2 })
          doc.moveDown(0.4)
          // Thin separator
          if (i < topRecs.length - 1) {
            doc.moveTo(M + 20, doc.y).lineTo(M + CW, doc.y)
              .strokeColor(T.ruleFaint).lineWidth(0.3).stroke()
            doc.moveDown(0.4)
          }
        }
      }
    }

    // ═════════════════════════════════════════════════════
    // 3. MODULE SUMMARIES  (one per pillar, single-column)
    // ═════════════════════════════════════════════════════

    if (categoryScores.length > 0) {
      newPage()
      sectionTitle('Module breakdown')
      doc.fontSize(9).font('Helvetica').fillColor(T.muted)
        .text(`Scores across ${PILLAR_NAMES.length} modules and ${PILLAR_NAMES.length * 4} categories, rated 0 to 100.`, M, undefined, { width: CW })
      doc.moveDown(0.8)

      for (let pi = 0; pi < pillarScores.length; pi++) {
        const pillar = pillarScores[pi]
        if (pillar.cats.length === 0) continue
        const neededH = 30 + pillar.cats.length * 16 + 10
        ensure(neededH)

        // Pillar header row
        const phY = doc.y
        doc.rect(M, phY, CW, 26).fill(T.offWhite)
        doc.rect(M, phY, 4, 26).fill(PILLAR_COLORS[pi])
        doc.fontSize(11).font('Helvetica-Bold').fillColor(T.ink)
          .text(pillar.name, M + 14, phY + 6, { width: CW - 100 })
        if (pillar.findings.length > 0) {
          doc.fontSize(8).font('Helvetica').fillColor(T.faint)
            .text(`${pillar.findings.length} finding${pillar.findings.length !== 1 ? 's' : ''}`,
              M + CW - 120, phY + 8, { width: 60, align: 'right' })
        }
        doc.fontSize(16).font('Helvetica-Bold').fillColor(scoreColor(pillar.avg))
          .text(`${pillar.avg}`, M + CW - 40, phY + 4, { width: 36, align: 'right' })
        doc.y = phY + 30

        // Category rows — simple table
        for (const cat of pillar.cats) {
          if (doc.y > BOTTOM - 14) { newPage() }
          const cy = doc.y
          doc.fontSize(9).font('Helvetica').fillColor(T.body)
            .text(cat.name, M + 14, cy, { width: CW - 140 })
          // Score bar
          const barX = M + CW - 100
          const barW = 60
          doc.rect(barX, cy + 4, barW, 3).fill(T.ruleFaint)
          if (cat.score > 0) {
            doc.rect(barX, cy + 4, Math.max(1, (cat.score / 100) * barW), 3).fill(PILLAR_COLORS[pi])
          }
          doc.fontSize(9).font('Helvetica-Bold').fillColor(scoreColor(cat.score))
            .text(`${cat.score}`, M + CW - 28, cy, { width: 28, align: 'right' })
          doc.y = cy + 16
        }
        doc.moveDown(0.5)
      }
    }

    // ═════════════════════════════════════════════════════
    // 4. CHECKPOINT HEALTH
    // ═════════════════════════════════════════════════════

    if (categoryScores.length > 0) {
      newPage()
      sectionTitle(`${categoryScores.length * 4}-Checkpoint health`)
      doc.fontSize(9).font('Helvetica').fillColor(T.muted)
        .text(
          `${activeFindings.length} issues found across ${categoryScores.length} categories. ` +
          'Each category has 4 checkpoints representing key quality signals.',
          M, undefined, { width: CW },
        )
      doc.moveDown(0.8)

      for (let catIdx = 0; catIdx < categoryScores.length; catIdx++) {
        const cat = categoryScores[catIdx]
        const checkpoints = CHECKPOINT_LABELS[cat.name] || ['Check 1', 'Check 2', 'Check 3', 'Check 4']

        // Count failures for this category
        const catFindings: AuditFinding[] = []
        for (const f of activeFindings) {
          if ((f as any).category_index === catIdx) catFindings.push(f)
        }
        if (catFindings.length === 0) {
          const words = cat.name.toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3)
          for (const f of activeFindings) {
            const txt = `${f.title} ${f.description}`.toLowerCase()
            if (words.some(w => txt.includes(w)) && !catFindings.includes(f)) {
              catFindings.push(f)
              if (catFindings.length >= checkpoints.length) break
            }
          }
        }
        const failCount = Math.min(catFindings.length, checkpoints.length)
        const passCount = checkpoints.length - failCount

        ensure(20 + checkpoints.length * 15)

        // Category header
        const chY = doc.y
        hr(chY)
        doc.y = chY + 4
        doc.fontSize(9).font('Helvetica-Bold').fillColor(scoreColor(cat.score))
          .text(`${cat.score}`, M, chY + 6, { width: 22, align: 'right' })
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor(T.ink)
          .text(cat.name, M + 28, chY + 6, { width: CW - 120 })
        // Pass/fail badges
        if (passCount > 0) {
          doc.fontSize(8).font('Helvetica-Bold').fillColor(T.ok)
            .text(`${passCount} pass`, M + CW - 80, chY + 7, { width: 35 })
        }
        if (failCount > 0) {
          doc.fontSize(8).font('Helvetica-Bold').fillColor(T.severe)
            .text(`${failCount} fail`, M + CW - 38, chY + 7, { width: 35 })
        }
        doc.y = chY + 22

        // Individual checkpoints
        for (let i = 0; i < checkpoints.length; i++) {
          if (doc.y > BOTTOM - 14) { newPage() }
          const isFail = i < failCount
          const cpY = doc.y
          const bgCol = isFail ? T.severeBg : T.okBg
          const fgCol = isFail ? T.severe : T.ok

          doc.rect(M + 28, cpY, CW - 28, 13).fill(bgCol)
          doc.fontSize(8).font('Helvetica-Bold').fillColor(fgCol)
            .text(isFail ? '!' : '✓', M + 32, cpY + 2, { width: 10, lineBreak: false })
          doc.fontSize(8).font('Helvetica').fillColor(fgCol)
            .text(checkpoints[i], M + 46, cpY + 2, { width: CW - 120 })
          doc.fontSize(7.5).font('Helvetica-Bold').fillColor(fgCol)
            .text(isFail ? 'Fail' : 'Pass', M + CW - 30, cpY + 2, { width: 26, align: 'right' })
          doc.y = cpY + 14
        }
        doc.moveDown(0.3)
      }
    }

    // ═════════════════════════════════════════════════════
    // 5. AI VISIBILITY
    // ═════════════════════════════════════════════════════

    if (aiVis) {
      newPage()
      sectionTitle('AI visibility breakdown')

      const aiOverall = aiVis.overall || 0
      doc.fontSize(10).font('Helvetica').fillColor(T.muted)
        .text('Composite AI visibility score:', M, undefined, { continued: true })
      doc.fontSize(14).font('Helvetica-Bold').fillColor(scoreColor(aiOverall))
        .text(` ${aiOverall}`, { continued: true })
      doc.fontSize(10).font('Helvetica').fillColor(T.faint)
        .text('/100')
      doc.moveDown(0.8)

      const bars = [
        { label: 'LLM knowledge accuracy',   value: aiVis.llmAccuracy,          desc: 'How accurately AI models describe your website' },
        { label: 'Structured data coverage',  value: aiVis.structuredData,       desc: 'JSON-LD completeness for search and AI rich results' },
        { label: 'Content extractability',    value: aiVis.contentExtractability, desc: 'How effectively AI can parse and understand your pages' },
        { label: 'Crawl infrastructure',      value: aiVis.crawlInfrastructure,  desc: 'robots.txt, llms.txt, ai-plugin.json configuration' },
      ]

      for (const bar of bars) {
        ensure(36)
        doc.fontSize(9.5).font('Helvetica').fillColor(T.ink)
          .text(bar.label, M, undefined, { width: CW - 40 })
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor(scoreColor(bar.value))
          .text(`${bar.value}`, M + CW - 30, doc.y - 13, { width: 30, align: 'right' })
        const bY = doc.y + 2
        doc.rect(M, bY, CW, 4).fill(T.ruleFaint)
        doc.rect(M, bY, Math.max(1, (bar.value / 100) * CW), 4).fill(scoreColor(bar.value))
        doc.y = bY + 8
        doc.fontSize(8).font('Helvetica').fillColor(T.faint)
          .text(bar.desc, M)
        doc.moveDown(0.6)
      }
    }

    // ═════════════════════════════════════════════════════
    // 6. ALL FINDINGS
    // ═════════════════════════════════════════════════════

    if (activeFindings.length > 0) {
      newPage()
      sectionTitle('All findings')

      // Severity summary line
      let sumX = M
      doc.fontSize(9).font('Helvetica').fillColor(T.muted)
        .text(`${activeFindings.length} active findings: `, sumX, undefined, { continued: true, lineBreak: false })
      for (const key of sevOrder) {
        const count = sevCounts[key]
        if (count === 0) continue
        const cfg = SEV_CFG[key]
        doc.fontSize(9).font('Helvetica-Bold').fillColor(cfg.color)
          .text(`${count} ${cfg.label.toLowerCase()}`, { continued: true, lineBreak: false })
        doc.fontSize(9).font('Helvetica').fillColor(T.muted)
          .text('  ', { continued: true, lineBreak: false })
      }
      doc.text('') // end the continued line
      doc.moveDown(0.8)

      // Findings grouped by pillar
      for (let pi = 0; pi < PILLAR_NAMES.length; pi++) {
        const pillarName = PILLAR_NAMES[pi]
        const pFindings = findingsByPillar[pillarName]
        if (!pFindings || pFindings.length === 0) continue

        ensure(30)

        // Pillar group header
        const gY = doc.y
        doc.rect(M, gY, 4, 16).fill(PILLAR_COLORS[pi])
        doc.fontSize(11).font('Helvetica-Bold').fillColor(T.ink)
          .text(pillarName, M + 12, gY + 1, { width: CW - 100 })
        doc.fontSize(8).font('Helvetica').fillColor(T.faint)
          .text(`${pFindings.length} finding${pFindings.length !== 1 ? 's' : ''}`,
            M + CW - 80, gY + 3, { width: 76, align: 'right' })
        doc.y = gY + 22

        // Individual findings
        for (const finding of pFindings) {
          const sev = SEV_CFG[finding.severity] || SEV_CFG.medium
          const displayTitle = getDisplayTitle(finding)
          const whatFound = getWhatFound(finding)
          const fixPlain = getFixPlain(finding)
          const whyMatters = getWhyMatters(finding)

          // Measure to predict height
          const titleH = doc.fontSize(10).font('Helvetica-Bold')
            .heightOfString(displayTitle || '', { width: CW - 20 })
          const descH = whatFound
            ? doc.fontSize(9).font('Helvetica').heightOfString(whatFound, { width: CW - 20 })
            : 0
          const recH = fixPlain
            ? doc.fontSize(9).font('Helvetica').heightOfString(fixPlain, { width: CW - 40 })
            : 0
          const totalH = 16 + titleH + (descH > 0 ? descH + 6 : 0) + (recH > 0 ? recH + 24 : 0) + 12
          ensure(Math.min(totalH, 120))

          const fy = doc.y

          // Top border
          doc.moveTo(M, fy).lineTo(M + CW, fy)
            .strokeColor(T.ruleFaint).lineWidth(0.5).stroke()
          doc.y = fy + 6

          // Severity badge + category
          doc.circle(M + 5, doc.y + 3, 3).fill(sev.color)
          doc.fontSize(7.5).font('Helvetica-Bold').fillColor(sev.color)
            .text(sev.label.toUpperCase(), M + 14, doc.y, {
              width: 60, characterSpacing: 0.3, lineBreak: false,
            })
          const catName = finding.category_index != null && categoryScores[finding.category_index]
            ? categoryScores[finding.category_index].name : null
          if (catName) {
            doc.fontSize(7.5).font('Helvetica').fillColor(T.faint)
              .text(catName, M + 72, doc.y, { width: CW - 80, lineBreak: false })
          }
          doc.moveDown(0.4)

          // Title
          doc.fontSize(10).font('Helvetica-Bold').fillColor(T.ink)
            .text(displayTitle || 'Untitled', M, undefined, { width: CW })

          // Description
          if (whatFound) {
            doc.moveDown(0.15)
            doc.fontSize(9).font('Helvetica').fillColor(T.muted)
              .text(whatFound, M, undefined, { width: CW, lineGap: 1.5 })
          }

          // Recommendation box
          if (fixPlain) {
            doc.moveDown(0.3)
            const boxY = doc.y
            const measuredH = doc.fontSize(9).font('Helvetica')
              .heightOfString(fixPlain, { width: CW - 34 })
            const boxH = measuredH + 18
            doc.rect(M + 4, boxY, CW - 8, boxH).fill(T.signalBg)
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor(T.signal)
              .text('RECOMMENDATION', M + 12, boxY + 5, { characterSpacing: 0.3 })
            doc.fontSize(9).font('Helvetica').fillColor(T.body)
              .text(fixPlain, M + 12, boxY + 16, { width: CW - 34, lineGap: 1.5 })
            doc.y = boxY + boxH + 2
          }

          doc.moveDown(0.5)
        }

        doc.moveDown(0.6)
      }
    }

    // ═════════════════════════════════════════════════════
    // 7. METHODOLOGY & TRANSPARENCY
    // ═════════════════════════════════════════════════════

    ensure(80)
    doc.moveDown(1)
    sectionTitle('Methodology')
    bodyText(
      'This report was generated by Fixpath.ai using AI analysis of publicly visible page content. ' +
      `The audit evaluates up to ${PILLAR_NAMES.length} modules and ${PILLAR_NAMES.length * 4} categories covering UX, accessibility, SEO, brand ` +
      'consistency, and AI readiness.',
    )
    bodyText(
      'Limitations: The audit cannot test JavaScript-dependent interactions, measure real user load ' +
      'times, or access content behind authentication or paywalls. For WCAG compliance and ' +
      'security-critical findings, we recommend supplementing these results with manual expert review.',
    )
    bodyText(
      'Scores reflect point-in-time analysis and may change as your website evolves. ' +
      'Findings are ranked by severity and business impact to help prioritize remediation.',
    )

    // ─── Page numbers (added after all pages exist) ────
    const pageRange = doc.bufferedPageRange()
    const totalPages = pageRange.count
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i)

      // Footer rule
      doc.moveTo(M, PH - M + 8).lineTo(M + CW, PH - M + 8)
        .strokeColor(T.ruleFaint).lineWidth(0.5).stroke()

      // "Fixpath Audit — domain" left
      doc.fontSize(7).font('Helvetica').fillColor(T.faint)
        .text(`Fixpath Audit — ${domain}`, M, PH - M + 14, { width: CW / 2, lineBreak: false })

      // Page number right
      doc.fontSize(7).font('Helvetica').fillColor(T.faint)
        .text(`Page ${i + 1} of ${totalPages}`, M + CW / 2, PH - M + 14, {
          width: CW / 2, align: 'right', lineBreak: false,
        })
    }

    // ─── Finalize ─────────────────────────────────────
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
