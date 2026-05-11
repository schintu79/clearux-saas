// ============================================================
// ClearUX API — GET /api/reports/:id/pdf
// PDFKit generation — colors match canonical HTML templates
// in src/lib/report-template/*.html
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { getReportLabels, getLocale, getUILabels, getPillarNames, getScoreLabel, getSeverityLabel } from '@/lib/languages'
import fs from 'fs'
import path from 'path'

/* ── Colors — match HTML template (report-template.html) ──── */
const C = {
  white: '#FFFFFF',
  bg: '#F7F8F9',
  text: '#111111',
  textBody: '#3D3D3D',
  textSec: '#5C5C5C',
  textTert: '#8A8A8A',
  border: '#D4D4D4',
  borderLight: '#E9EAEC',
  // Scores
  scoreGreen: '#16A34A',
  scoreYellow: '#CA8A04',
  scoreRed: '#DC2626',
  // Severity
  sevCritical: '#DC2626',
  sevHigh: '#EA580C',
  sevMedium: '#CA8A04',
  sevLow: '#2563EB',
  sevCriticalBg: '#FEF2F2',
  sevHighBg: '#FFF7ED',
  sevMediumBg: '#FEFCE8',
  sevLowBg: '#EFF6FF',
  // Pillars — match HTML template
  pillarFoundation: '#7C3AED',
  pillarFoundationBg: '#F5F3FF',
  pillarHuman: '#DB2777',
  pillarHumanBg: '#FDF2F8',
  pillarInclusive: '#B45309',
  pillarInclusiveBg: '#FFFBEB',
  pillarFuture: '#0D9488',
  pillarFutureBg: '#F0FDFA',
  pillarSeo: '#4338CA',
  pillarSeoBg: '#EEF2FF',
  pillarBrand: '#475569',
  pillarBrandBg: '#F8FAFC',
  // Boxes
  impactBg: '#F0FDFA',
  impactText: '#0D9488',
}

const PILLAR_STYLES = [
  { start: 0, end: 4, color: C.pillarFoundation, bg: C.pillarFoundationBg },
  { start: 4, end: 8, color: C.pillarHuman, bg: C.pillarHumanBg },
  { start: 8, end: 12, color: C.pillarInclusive, bg: C.pillarInclusiveBg },
  { start: 12, end: 16, color: C.pillarFuture, bg: C.pillarFutureBg },
  { start: 16, end: 20, color: C.pillarSeo, bg: C.pillarSeoBg },
  { start: 20, end: 24, color: C.pillarBrand, bg: C.pillarBrandBg },
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

    // Profile-level white label settings (preferred), fallback to per-audit fields
    const { data: wlSettings } = await db
      .from('white_label_settings')
      .select('*')
      .eq('user_id', a.user_id)
      .eq('is_active', true)
      .single()

    const wlCompany: string | null = (wlSettings as any)?.company_name || a.white_label_company_name || null
    const wlLogoUrl: string | null = (wlSettings as any)?.logo_url || a.white_label_logo_url || null
    const wlBrandColor: string | null = (wlSettings as any)?.brand_color || null
    const wlContactEmail: string | null = (wlSettings as any)?.contact_email || null
    const wlFooterText: string | null = (wlSettings as any)?.footer_text || null
    const isWhiteLabel = !!(wlCompany || wlLogoUrl)

    const lang = a.language || 'en'
    const L = getReportLabels(lang)
    const UI = getUILabels(lang)
    const pillarNames = getPillarNames(lang)

    const rawJson = r.raw_json || {}
    const isBrandAudit = rawJson.type === 'brand_identity'

    let domain = 'audit'
    if (isBrandAudit) {
      domain = rawJson.brandName || 'Brand Identity Audit'
    } else {
      try { domain = new URL(a.product_url).hostname.replace(/^www\./, '') } catch {}
    }

    const overall = r.overall_score ?? 0
    // Brand audits store categories in categoryResults, website audits in categoryScores
    const catScores: Array<{ name: string; score: number; summary: string }> =
      isBrandAudit
        ? (rawJson.categoryResults || rawJson._baselineCategoryScores || []).map((c: any) => ({ name: c.name, score: c.score, summary: c.summary || '' }))
        : (rawJson?.categoryScores && Array.isArray(rawJson.categoryScores) ? rawJson.categoryScores : [])

    const PILLARS = isBrandAudit
      ? [{ start: 0, end: catScores.length, color: C.pillarBrand, bg: C.pillarBrandBg, name: 'Brand Identity' }]
      : PILLAR_STYLES.map((s, i) => ({ ...s, name: pillarNames[i] }))
    const dateStr = new Date(a.created_at).toLocaleDateString(getLocale(lang), {
      year: 'numeric', month: 'long', day: 'numeric',
    })
    const total = r.total_issues || 0
    const topRecs: string[] = rawJson.topRecommendations || (rawJson.keyRecommendation ? [rawJson.keyRecommendation] : [])

    // Assign findings to pillars (same logic as DOCX)
    // Extended keyword map for category matching
    const CATEGORY_KEYWORDS: Record<number, string[]> = {
      0: ['visual', 'design', 'first impression', 'hero', 'above the fold', 'layout', 'aesthetic', 'color', 'palette', 'whitespace', 'spacing', 'typography'],
      1: ['value proposition', 'messaging', 'headline', 'subheadline', 'differentiation', 'clarity', 'benefit', 'audience', 'copy'],
      2: ['navigation', 'information architecture', 'menu', 'navbar', 'footer', 'breadcrumb', 'sitemap', 'internal link', 'page structure'],
      3: ['content quality', 'readability', 'scannability', 'writing', 'grammar', 'tone', 'voice', 'paragraph', 'media quality', 'alt text'],
      4: ['call-to-action', 'cta', 'conversion', 'button', 'sign up', 'free trial', 'conversion path', 'conversion flow'],
      5: ['trust', 'credibility', 'testimonial', 'social proof', 'security', 'privacy', 'badge', 'certificate', 'review'],
      6: ['ethical', 'transparent', 'dark pattern', 'cookie', 'consent', 'gdpr', 'manipulat', 'deceptive', 'honest'],
      7: ['emotional', 'delight', 'micro-interaction', 'animation', 'personality', 'engagement', 'reward', 'feedback'],
      8: ['accessibility', 'a11y', 'wcag', 'screen reader', 'keyboard', 'aria', 'tab order', 'focus', 'disability'],
      9: ['inclusive', 'language', 'gender', 'cultural', 'diverse', 'bias', 'representation', 'globali'],
      10: ['responsive', 'mobile', 'tablet', 'breakpoint', 'viewport', 'touch', 'adaptive', 'device'],
      11: ['loading', 'performance', 'speed', 'page load', 'core web vital', 'lcp', 'cls', 'fid', 'optimize', 'compress', 'lazy'],
      12: ['innovation', 'modern', 'trend', 'cutting-edge', 'emerging', 'fresh', 'creative', 'unique'],
      13: ['scalab', 'growth', 'modular', 'flexible', 'extensible', 'future-proof', 'maintain', 'technical debt'],
      14: ['onboarding', 'first-time', 'getting started', 'tutorial', 'walkthrough', 'wizard', 'progressive disclosure'],
      15: ['feedback', 'error', 'validation', 'loading state', 'empty state', 'notification', 'toast', 'progress', 'skeleton'],
      16: ['seo', 'search engine', 'meta', 'title tag', 'description', 'heading structure', 'h1', 'h2', 'schema', 'structured data', 'canonical'],
      17: ['local seo', 'schema markup', 'rich snippet', 'open graph', 'social media', 'twitter card', 'og:'],
      18: ['keyword', 'search intent', 'content gap', 'long-tail', 'topic cluster', 'semantic'],
      19: ['link', 'backlink', 'internal link', 'anchor text', 'broken link', '404', 'redirect', 'crawl'],
      20: ['brand consistency', 'brand identity', 'logo', 'brand color', 'brand voice', 'brand guideline'],
      21: ['brand experience', 'brand story', 'mission', 'about page', 'company value'],
      22: ['brand visual', 'icon style', 'illustration', 'imagery', 'photo style', 'brand asset'],
      23: ['brand communication', 'brand tone', 'brand language', 'brand message', 'tagline'],
    }

    const findingMap: Record<string, Record<string, any[]>> = {}
    for (const p of PILLARS) {
      findingMap[p.name] = {}
      const cats = catScores.slice(p.start, Math.min(p.end, catScores.length))
      for (const cat of cats) findingMap[p.name][cat.name] = []
    }
    // Build flat category list for index-based lookup
    const flatCats: Array<{ pillarName: string; catName: string; catIdx: number }> = []
    for (const p of PILLARS) {
      const cats = catScores.slice(p.start, Math.min(p.end, catScores.length))
      cats.forEach((cat, localIdx) => {
        flatCats.push({ pillarName: p.name, catName: cat.name, catIdx: p.start + localIdx })
      })
    }
    for (const finding of f) {
      const text = `${finding.title} ${finding.description}`.toLowerCase()
      let bestMatch = -1
      let bestScore = 0

      for (const fc of flatCats) {
        let score = 0
        const nameWords = fc.catName.toLowerCase().split(/[&,\s]+/).filter((w: string) => w.length > 3)
        for (const w of nameWords) {
          if (text.includes(w)) score += 2
        }
        const keywords = CATEGORY_KEYWORDS[fc.catIdx] || []
        for (const kw of keywords) {
          if (text.includes(kw)) score += 1
        }
        if (score > bestScore) {
          bestScore = score
          bestMatch = flatCats.indexOf(fc)
        }
      }

      if (bestMatch >= 0 && bestScore >= 1) {
        const fc = flatCats[bestMatch]
        findingMap[fc.pillarName][fc.catName].push(finding)
      } else {
        const catIdx = Math.min(finding.sort_order % Math.max(1, flatCats.length), flatCats.length - 1)
        const fc = flatCats[catIdx]
        if (findingMap[fc.pillarName]?.[fc.catName]) findingMap[fc.pillarName][fc.catName].push(finding)
        else if (flatCats.length > 0) {
          const fallback = flatCats[0]
          findingMap[fallback.pillarName][fallback.catName].push(finding)
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
    const reportTypeLabel = isBrandAudit ? 'Brand Identity Audit Report' : UI.uxAuditReport
    const subtitle = isWhiteLabel
      ? (wlCompany ? `${wlCompany} — ${reportTypeLabel}` : reportTypeLabel)
      : (isBrandAudit ? 'Brand Identity Audit Report' : UI.reportSubtitle)
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

    // URL or Brand name (DOCX: size 22 = 11pt, color textSec)
    doc.moveDown(1.5)
    doc.fontSize(11).font('Helvetica').fillColor(C.textSec)
      .text(isBrandAudit ? domain : (a.product_url || domain), leftM, undefined, { align: 'center', width: contentW })

    // Date (DOCX: size 20 = 10pt)
    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica').fillColor(C.textSec)
      .text(dateStr, leftM, undefined, { align: 'center', width: contentW })
    doc.text(`${total} ${L.issuesIdentified}`, leftM, undefined, { align: 'center', width: contentW })

    // Pillar scores row (DOCX: score size 36 = 18pt, name size 16 = 8pt)
    doc.moveDown(2)
    const colW = contentW / pillarScores.length
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
      const isIncluded = cats.length > 0
      ensureSpace(60 + cats.length * 22)

      // Pillar header bar (DOCX: colored bg, name size 26 = 13pt, score size 44 = 22pt)
      const phy = doc.y
      const pillarBarH = 42
      doc.rect(leftM, phy, contentW, pillarBarH).fill(pillar.bg)
      doc.fontSize(13).font('Helvetica-Bold').fillColor(isIncluded ? pillar.color : C.textSec)
        .text(pillar.name, leftM + 12, phy + 7, { width: contentW - 80 })
      // Categories count or "Not included" (DOCX: size 17 = 8.5pt)
      doc.fontSize(8.5).font(isIncluded ? 'Helvetica' : 'Helvetica-Oblique').fillColor(C.textSec)
        .text(isIncluded ? `${cats.length} ${UI.categoriesEvaluated}` : UI.notIncludedInAudit, leftM + 12, phy + 24)
      // Score or dash (DOCX: size 44 = 22pt bold)
      doc.fontSize(22).font('Helvetica-Bold').fillColor(isIncluded ? pillar.color : C.textSec)
        .text(isIncluded ? `${pillar.avg}` : '—', leftM + contentW - 60, phy + 9, { width: 48, align: 'right' })
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
      doc.text(wlFooterText || L.confidential, leftM, 752, { width: contentW / 2, lineBreak: false })
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
