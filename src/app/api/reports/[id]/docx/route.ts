// ============================================================
// ClearUX API — GET /api/reports/:id/docx
// Premium branded UX audit Word document — Dashboard-matching layout
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getReportLabels, getLocale, getUILabels, getPillarNames, getScoreLabel, getSeverityLabel } from '@/lib/languages'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  LevelFormat,
} from 'docx'
import { createServiceSupabase } from '@/lib/supabase-server'
import fs from 'fs'
import path from 'path'

/* ── Brand colors ─────────────────────────────────────────── */
const C = {
  white: 'FFFFFF',
  bg: 'F9FAFB',
  text: '1D1D1F',
  textBody: '4A4A4F',     // darker grey for readability/printing
  textSec: '6E6E73',
  textTert: '86868B',
  border: 'D2D2D7',
  borderLight: 'E8E8ED',
  accent: '8B5CF6',
  accentLight: 'F5F3FF',
  accentLighter: 'FAF8FF',
  // Scores
  scoreGreen: '22C55E',
  scoreYellow: 'EAB308',
  scoreRed: 'EF4444',
  // Severity
  sevCritical: 'EF4444',
  sevHigh: 'F97316',
  sevMedium: 'EAB308',
  sevLow: '3B82F6',
  sevCriticalBg: 'FEF2F2',
  sevHighBg: 'FFF7ED',
  sevMediumBg: 'FEFCE8',
  sevLowBg: 'EFF6FF',
  // Pillars
  pillarFoundation: '8B5CF6',
  pillarFoundationBg: 'F5F3FF',
  pillarHuman: 'EC4899',
  pillarHumanBg: 'FDF2F8',
  pillarInclusive: 'F59E0B',
  pillarInclusiveBg: 'FFFBEB',
  pillarFuture: '10B981',
  pillarFutureBg: 'ECFDF5',
  // Recommendation / Impact
  recBg: 'F5F3FF',
  impactBg: 'ECFDF5',
  impactText: '047857',
}

function scoreColor(s: number): string {
  if (s >= 70) return C.scoreGreen
  if (s >= 40) return C.scoreYellow
  return C.scoreRed
}

// scoreLabel is now imported from languages.ts as getScoreLabel(score, lang)

function sevColor(sev: string): string {
  switch (sev) {
    case 'critical': return C.sevCritical
    case 'high': return C.sevHigh
    case 'medium': return C.sevMedium
    case 'low': return C.sevLow
    default: return C.textSec
  }
}

function sevBgColor(sev: string): string {
  switch (sev) {
    case 'critical': return C.sevCriticalBg
    case 'high': return C.sevHighBg
    case 'medium': return C.sevMediumBg
    case 'low': return C.sevLowBg
    default: return C.bg
  }
}

/* ── Border presets ───────────────────────────────────────── */
const noBorder = { style: BorderStyle.NONE, size: 0, color: C.white }
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }
const cellPad = { top: 80, bottom: 80, left: 120, right: 120 }

/* ── Constants ────────────────────────────────────────────── */
const PAGE_W = 12240   // US Letter width in DXA
const MARGIN = 1440    // 1 inch
const CONTENT_W = PAGE_W - MARGIN * 2  // 9360

/* ── Pillar definitions ───────────────────────────────────── */
const PILLAR_STYLES = [
  { start: 0, end: 4, color: C.pillarFoundation, bg: C.pillarFoundationBg },
  { start: 4, end: 8, color: C.pillarHuman, bg: C.pillarHumanBg },
  { start: 8, end: 12, color: C.pillarInclusive, bg: C.pillarInclusiveBg },
  { start: 12, end: 16, color: C.pillarFuture, bg: C.pillarFutureBg },
]

function buildPillars(lang: string) {
  const names = getPillarNames(lang)
  return PILLAR_STYLES.map((s, i) => ({ ...s, name: names[i] }))
}

/* ── Helper: progress bar as a thin table ─────────────────── */
function progressBar(score: number, totalWidth: number, color: string): Table {
  const filled = Math.max(1, Math.round((score / 100) * totalWidth))
  const empty = Math.max(0, totalWidth - filled)
  const cells: TableCell[] = []
  const widths: number[] = []

  cells.push(new TableCell({
    borders: noBorders,
    width: { size: filled, type: WidthType.DXA },
    shading: { fill: color, type: ShadingType.CLEAR },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    children: [new Paragraph({ children: [] })],
  }))
  widths.push(filled)

  if (empty > 0) {
    cells.push(new TableCell({
      borders: noBorders,
      width: { size: empty, type: WidthType.DXA },
      shading: { fill: C.borderLight, type: ShadingType.CLEAR },
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      children: [new Paragraph({ children: [] })],
    }))
    widths.push(empty)
  }

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: widths,
    rows: [new TableRow({
      height: { value: 60, rule: 'exact' as any },
      children: cells,
    })],
  })
}

/* ── Core DOCX generation — exported for PDF route ────────── */

export async function buildDocx(auditId: string): Promise<{ buffer: Buffer; safeDomain: string; whitelabelCompany: string | null }> {
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
      throw new Error('Audit not found')
    if (reportRes.error || !reportRes.data)
      throw new Error('Report not found')

    const a = auditRes.data as any
    const r = reportRes.data as any
    const f = (findingsRes.data || []) as any[]
    const pages = (pagesRes.data || []) as any[]

    // White-label branding
    const wlCompany: string | null = a.white_label_company_name || null
    const wlLogoUrl: string | null = a.white_label_logo_url || null
    const isWhiteLabel = !!(wlCompany || wlLogoUrl)

    const lang = a.language || 'en'
    const L = getReportLabels(lang)
    const UI = getUILabels(lang)
    const PILLARS = buildPillars(lang)
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

    // ── Assign findings to pillars/categories ──────────────
    function assignFindings() {
      const result: Record<string, Record<string, any[]>> = {}
      for (const p of PILLARS) {
        result[p.name] = {}
        const cats = catScores.slice(p.start, Math.min(p.end, catScores.length))
        for (const cat of cats) result[p.name][cat.name] = []
      }

      for (const finding of f) {
        let matched = false
        for (const p of PILLARS) {
          const cats = catScores.slice(p.start, Math.min(p.end, catScores.length))
          for (const cat of cats) {
            const words = cat.name.toLowerCase().split(/[&,\s]+/).filter((w: string) => w.length > 3)
            const text = `${finding.title} ${finding.description}`.toLowerCase()
            if (words.some((w: string) => text.includes(w))) {
              result[p.name][cat.name].push(finding)
              matched = true
              break
            }
          }
          if (matched) break
        }
        // Distribute unmatched by sort_order
        if (!matched) {
          const catIdx = Math.min(Math.floor(finding.sort_order / Math.max(1, f.length / 16)), 15)
          const pillar = PILLARS.find(p => catIdx >= p.start && catIdx < p.end) || PILLARS[0]
          const cats = catScores.slice(pillar.start, Math.min(pillar.end, catScores.length))
          if (cats.length > 0) {
            const localIdx = catIdx - pillar.start
            const cat = cats[Math.min(localIdx, cats.length - 1)]
            if (result[pillar.name][cat.name]) {
              result[pillar.name][cat.name].push(finding)
            } else {
              result[pillar.name][cats[0].name].push(finding)
            }
          }
        }
      }
      return result
    }
    const findingMap = assignFindings()

    // ────────────────────────────────────────────────────────
    // BUILD DOCUMENT
    // ────────────────────────────────────────────────────────

    const children: (Paragraph | Table)[] = []

    // ═══════════════════════════════════════════════════════
    // COVER PAGE
    // ═══════════════════════════════════════════════════════

    // Top accent bar
    children.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [CONTENT_W],
      rows: [new TableRow({
        height: { value: 80, rule: 'exact' as any },
        children: [new TableCell({
          borders: noBorders,
          width: { size: CONTENT_W, type: WidthType.DXA },
          shading: { fill: C.accent, type: ShadingType.CLEAR },
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          children: [new Paragraph({ children: [] })],
        })],
      })],
    }))

    children.push(new Paragraph({ spacing: { after: 600 }, children: [] }))

    // Logo — white-label or ClearUX default
    let logoBuffer: Buffer | null = null
    let logoIsPng = true
    if (wlLogoUrl) {
      try {
        const logoRes = await fetch(wlLogoUrl)
        if (logoRes.ok) {
          const ab = await logoRes.arrayBuffer()
          logoBuffer = Buffer.from(ab)
          logoIsPng = wlLogoUrl.toLowerCase().endsWith('.png') || wlLogoUrl.includes('.png')
        }
      } catch { console.warn('[DOCX] Failed to fetch white-label logo') }
    }
    if (!logoBuffer) {
      try {
        const logoPath = path.join(process.cwd(), 'public', 'logo-clearux.png')
        logoBuffer = fs.readFileSync(logoPath)
      } catch { console.warn('[DOCX] Logo PNG not found, falling back to text') }
    }

    if (logoBuffer) {
      // Calculate dimensions preserving aspect ratio (max 280w x 100h)
      let imgW = 280
      let imgH = 60
      try {
        // Read image dimensions from buffer header
        if (logoIsPng && logoBuffer.length > 24) {
          // PNG: width at offset 16, height at offset 20 (big-endian uint32)
          const pngW = logoBuffer.readUInt32BE(16)
          const pngH = logoBuffer.readUInt32BE(20)
          if (pngW > 0 && pngH > 0) {
            const ratio = pngW / pngH
            const maxW = 280, maxH = 100
            if (ratio > maxW / maxH) { imgW = maxW; imgH = Math.round(maxW / ratio) }
            else { imgH = maxH; imgW = Math.round(maxH * ratio) }
          }
        } else if (!logoIsPng && logoBuffer.length > 2) {
          // JPEG: scan for SOF0/SOF2 marker to get dimensions
          let off = 2
          while (off < logoBuffer.length - 9) {
            if (logoBuffer[off] === 0xFF) {
              const marker = logoBuffer[off + 1]
              if (marker === 0xC0 || marker === 0xC2) {
                const jpgH = logoBuffer.readUInt16BE(off + 5)
                const jpgW = logoBuffer.readUInt16BE(off + 7)
                if (jpgW > 0 && jpgH > 0) {
                  const ratio = jpgW / jpgH
                  const maxW = 280, maxH = 100
                  if (ratio > maxW / maxH) { imgW = maxW; imgH = Math.round(maxW / ratio) }
                  else { imgH = maxH; imgW = Math.round(maxH * ratio) }
                }
                break
              }
              const segLen = logoBuffer.readUInt16BE(off + 2)
              off += 2 + segLen
            } else { off++ }
          }
        }
      } catch { /* fallback to defaults */ }

      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new ImageRun({
            type: logoIsPng ? 'png' : 'jpg',
            data: logoBuffer,
            transformation: { width: imgW, height: imgH },
            altText: { title: wlCompany || 'ClearUX Logo', description: wlCompany ? `${wlCompany} logo` : 'ClearUX brand logo', name: 'report-logo' },
          }),
        ],
      }))
    } else {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: wlCompany
          ? [new TextRun({ text: wlCompany, font: 'Arial', size: 80, bold: true, color: C.text })]
          : [
              new TextRun({ text: 'Clear', font: 'Arial', size: 80, bold: true, color: C.text }),
              new TextRun({ text: 'UX', font: 'Arial', size: 80, bold: true, color: C.accent }),
            ],
      }))
    }

    // Subtitle: white-label shows company name, default shows ClearUX tagline
    const subtitle = isWhiteLabel
      ? (wlCompany ? `${wlCompany} — ${UI.uxAuditReport}` : UI.uxAuditReport)
      : UI.reportSubtitle

    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: subtitle, font: 'Arial', size: 22, color: C.textSec })],
    }))

    // Large overall score
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: `${overall}`, font: 'Arial', size: 144, bold: true, color: scoreColor(overall) }),
        new TextRun({ text: ' / 100', font: 'Arial', size: 28, color: C.textTert }),
      ],
    }))

    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: getScoreLabel(overall, lang), font: 'Arial', size: 28, bold: true, color: C.text })],
    }))

    // URL
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: a.product_url, font: 'Arial', size: 22, color: C.accent })],
    }))

    // Date and issue count
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: dateStr, font: 'Arial', size: 20, color: C.textSec })],
    }))
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: `${total} ${L.issuesIdentified}`, font: 'Arial', size: 20, color: C.textSec })],
    }))

    // Pillar scores summary row on cover
    const pillarScores = PILLARS.map((p) => {
      const cats = catScores.slice(p.start, Math.min(p.end, catScores.length))
      return {
        ...p,
        avg: cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 0,
      }
    })

    const pillarSummaryCells = pillarScores.map(p => new TableCell({
      borders: noBorders,
      width: { size: Math.floor(CONTENT_W / 4), type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 60, right: 60 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [new TextRun({ text: `${p.avg}`, font: 'Arial', size: 36, bold: true, color: p.color })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: p.name, font: 'Arial', size: 16, color: C.textSec })],
        }),
      ],
    }))

    children.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: pillarScores.map(() => Math.floor(CONTENT_W / 4)),
      rows: [new TableRow({ children: pillarSummaryCells })],
    }))

    // Page break
    children.push(new Paragraph({ children: [new PageBreak()] }))

    // ═══════════════════════════════════════════════════════
    // EXECUTIVE SUMMARY + TOP PRIORITY RECOMMENDATIONS
    // ═══════════════════════════════════════════════════════

    // Section title
    children.push(new Paragraph({
      spacing: { before: 100, after: 80 },
      border: { left: { style: BorderStyle.SINGLE, size: 16, color: C.accent, space: 8 } },
      children: [new TextRun({ text: L.executiveSummary, font: 'Arial', size: 36, bold: true, color: C.text })],
    }))

    // Executive summary text
    const summaryText = r.executive_summary || ''
    const summaryParagraphs = summaryText.split('\n').filter((s: string) => s.trim())
    for (const para of summaryParagraphs) {
      children.push(new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: para.trim(), font: 'Arial', size: 21, color: C.textBody })],
      }))
    }

    children.push(new Paragraph({ spacing: { after: 200 }, children: [] }))

    // Top Priority Recommendations
    if (topRecs.length > 0) {
      children.push(new Paragraph({
        spacing: { before: 100, after: 120 },
        border: { left: { style: BorderStyle.SINGLE, size: 16, color: C.accent, space: 8 } },
        children: [new TextRun({ text: L.topPriorityRecommendations, font: 'Arial', size: 30, bold: true, color: C.text })],
      }))

      for (let i = 0; i < topRecs.length; i++) {
        // Each recommendation in an accent-tinted box
        children.push(new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [600, CONTENT_W - 600],
          rows: [new TableRow({
            children: [
              // Number badge
              new TableCell({
                borders: noBorders,
                width: { size: 600, type: WidthType.DXA },
                shading: { fill: C.accentLight, type: ShadingType.CLEAR },
                margins: { top: 120, bottom: 120, left: 120, right: 40 },
                verticalAlign: 'center' as any,
                children: [new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `${i + 1}`, font: 'Arial', size: 26, bold: true, color: C.accent })],
                })],
              }),
              // Recommendation text
              new TableCell({
                borders: noBorders,
                width: { size: CONTENT_W - 600, type: WidthType.DXA },
                shading: { fill: C.accentLight, type: ShadingType.CLEAR },
                margins: { top: 120, bottom: 120, left: 100, right: 160 },
                children: [new Paragraph({
                  children: [new TextRun({ text: topRecs[i], font: 'Arial', size: 20, color: C.textBody })],
                })],
              }),
            ],
          })],
        }))
        children.push(new Paragraph({ spacing: { after: 80 }, children: [] }))
      }
    }

    // Research note
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }))
    children.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [CONTENT_W],
      rows: [new TableRow({
        children: [new TableCell({
          borders: noBorders,
          width: { size: CONTENT_W, type: WidthType.DXA },
          shading: { fill: C.bg, type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 180, right: 180 },
          children: [new Paragraph({
            children: [
              new TextRun({ text: `For deep qualitative research (user interviews, usability testing), we recommend pairing ${wlCompany || 'ClearUX'} findings with a specialist.`, font: 'Arial', size: 18, italics: true, color: C.textSec }),
            ],
          })],
        })],
      })],
    }))

    // Page break
    children.push(new Paragraph({ children: [new PageBreak()] }))

    // ═══════════════════════════════════════════════════════
    // AUDIT PILLARS — Scores & Categories
    // ═══════════════════════════════════════════════════════

    children.push(new Paragraph({
      spacing: { before: 100, after: 60 },
      border: { left: { style: BorderStyle.SINGLE, size: 16, color: C.accent, space: 8 } },
      children: [new TextRun({ text: L.scoreBreakdown, font: 'Arial', size: 36, bold: true, color: C.text })],
    }))
    children.push(new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: L.scoreSubtitle, font: 'Arial', size: 19, color: C.textSec })],
    }))

    // Each pillar as a colored card
    for (const pillar of pillarScores) {
      const cats = catScores.slice(pillar.start, Math.min(pillar.end, catScores.length))

      // Pillar header bar
      children.push(new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W - 1500, 1500],
        rows: [new TableRow({
          children: [
            new TableCell({
              borders: noBorders,
              width: { size: CONTENT_W - 1500, type: WidthType.DXA },
              shading: { fill: pillar.bg, type: ShadingType.CLEAR },
              margins: { top: 140, bottom: 140, left: 200, right: 80 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: pillar.name, font: 'Arial', size: 26, bold: true, color: pillar.color })],
                }),
                new Paragraph({
                  spacing: { before: 40 },
                  children: [new TextRun({ text: `${cats.length} ${UI.categoriesEvaluated}`, font: 'Arial', size: 17, color: C.textSec })],
                }),
              ],
            }),
            new TableCell({
              borders: noBorders,
              width: { size: 1500, type: WidthType.DXA },
              shading: { fill: pillar.bg, type: ShadingType.CLEAR },
              margins: { top: 140, bottom: 140, left: 80, right: 200 },
              children: [new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `${pillar.avg}`, font: 'Arial', size: 44, bold: true, color: pillar.color }),
                ],
              })],
            }),
          ],
        })],
      }))

      // Category rows inside this pillar
      for (const cat of cats) {
        const barWidth = CONTENT_W - 3600
        children.push(new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [4200, barWidth, 1200],
          rows: [new TableRow({
            children: [
              // Category name
              new TableCell({
                borders: noBorders,
                width: { size: 4200, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 280, right: 80 },
                children: [new Paragraph({
                  children: [new TextRun({ text: cat.name, font: 'Arial', size: 18, color: C.textBody })],
                })],
              }),
              // Progress bar
              new TableCell({
                borders: noBorders,
                width: { size: barWidth, type: WidthType.DXA },
                margins: { top: 100, bottom: 80, left: 40, right: 40 },
                children: [progressBar(cat.score, barWidth - 80, pillar.color)],
              }),
              // Score
              new TableCell({
                borders: noBorders,
                width: { size: 1200, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 40, right: 120 },
                children: [new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: `${cat.score}`, font: 'Arial', size: 20, bold: true, color: scoreColor(cat.score) })],
                })],
              }),
            ],
          })],
        }))

        // Category summary if available
        if (cat.summary) {
          children.push(new Paragraph({
            spacing: { after: 40 },
            indent: { left: 280 },
            children: [new TextRun({ text: cat.summary, font: 'Arial', size: 16, color: C.textSec, italics: true })],
          }))
        }
      }

      children.push(new Paragraph({ spacing: { after: 240 }, children: [] }))
    }

    // Page break before detailed findings
    children.push(new Paragraph({ children: [new PageBreak()] }))

    // ═══════════════════════════════════════════════════════
    // IN DETAIL — Findings by Pillar & Category
    // ═══════════════════════════════════════════════════════

    children.push(new Paragraph({
      spacing: { before: 100, after: 60 },
      border: { left: { style: BorderStyle.SINGLE, size: 16, color: C.accent, space: 8 } },
      children: [new TextRun({ text: L.detailedFindings, font: 'Arial', size: 36, bold: true, color: C.text })],
    }))
    children.push(new Paragraph({
      spacing: { after: 280 },
      children: [new TextRun({ text: L.findingsSubtitle, font: 'Arial', size: 19, color: C.textSec })],
    }))

    // Iterate pillars → categories → findings
    for (const pillar of pillarScores) {
      const pillarFindings = findingMap[pillar.name] || {}
      const hasFindings = Object.values(pillarFindings).some((arr: any[]) => arr.length > 0)
      if (!hasFindings) continue

      // Pillar section header
      children.push(new Paragraph({
        spacing: { before: 200, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: pillar.color, space: 4 } },
        children: [new TextRun({ text: pillar.name, font: 'Arial', size: 28, bold: true, color: pillar.color })],
      }))

      for (const [catName, catFindings] of Object.entries(pillarFindings)) {
        const findings = catFindings as any[]
        if (findings.length === 0) continue

        // Sort: critical → high → medium → low
        const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
        findings.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4))

        // Category sub-header
        children.push(new Paragraph({
          spacing: { before: 160, after: 100 },
          children: [
            new TextRun({ text: catName, font: 'Arial', size: 22, bold: true, color: C.text }),
            new TextRun({ text: `  ${findings.length} finding${findings.length !== 1 ? 's' : ''}`, font: 'Arial', size: 17, color: C.textTert }),
          ],
        }))

        // Each finding
        for (const finding of findings) {
          const sev = (finding.severity || 'medium').toLowerCase()

          // Severity badge + URL line
          const badgeChildren: TextRun[] = [
            new TextRun({ text: getSeverityLabel(sev, lang).toUpperCase(), font: 'Arial', size: 16, bold: true, color: sevColor(sev) }),
          ]
          if (finding.page_url) {
            let displayUrl = finding.page_url
            try {
              const u = new URL(finding.page_url)
              const path = u.pathname + u.search
              displayUrl = u.hostname + (path === '/' ? '' : path)
            } catch {}
            badgeChildren.push(
              new TextRun({ text: '    ', font: 'Arial', size: 16 }),
              new TextRun({ text: displayUrl, font: 'Arial', size: 16, color: C.textTert }),
            )
          }

          children.push(new Paragraph({
            spacing: { before: 120, after: 40 },
            children: badgeChildren,
          }))

          // Finding title
          children.push(new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: finding.title, font: 'Arial', size: 21, bold: true, color: C.text })],
          }))

          // Description
          if (finding.description) {
            children.push(new Paragraph({
              spacing: { after: 80 },
              children: [new TextRun({ text: finding.description, font: 'Arial', size: 19, color: C.textBody })],
            }))
          }

          // Recommendation box (light purple background, no borders)
          if (finding.recommendation) {
            children.push(new Table({
              width: { size: CONTENT_W, type: WidthType.DXA },
              columnWidths: [CONTENT_W],
              rows: [new TableRow({
                children: [new TableCell({
                  borders: noBorders,
                  width: { size: CONTENT_W, type: WidthType.DXA },
                  shading: { fill: C.recBg, type: ShadingType.CLEAR },
                  margins: { top: 100, bottom: 100, left: 180, right: 180 },
                  children: [
                    new Paragraph({
                      spacing: { after: 40 },
                      children: [new TextRun({ text: L.recommendation, font: 'Arial', size: 17, bold: true, color: C.text })],
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: finding.recommendation, font: 'Arial', size: 19, color: C.textBody })],
                    }),
                  ],
                })],
              })],
            }))
          }

          // Expected Impact box (light green background, no borders)
          if (finding.estimated_impact) {
            children.push(new Paragraph({ spacing: { after: 40 }, children: [] }))
            children.push(new Table({
              width: { size: CONTENT_W, type: WidthType.DXA },
              columnWidths: [CONTENT_W],
              rows: [new TableRow({
                children: [new TableCell({
                  borders: noBorders,
                  width: { size: CONTENT_W, type: WidthType.DXA },
                  shading: { fill: C.impactBg, type: ShadingType.CLEAR },
                  margins: { top: 100, bottom: 100, left: 180, right: 180 },
                  children: [
                    new Paragraph({
                      spacing: { after: 40 },
                      children: [new TextRun({ text: 'Expected Impact', font: 'Arial', size: 17, bold: true, color: C.text })],
                    }),
                    new Paragraph({
                      children: [new TextRun({ text: finding.estimated_impact, font: 'Arial', size: 19, color: C.impactText })],
                    }),
                  ],
                })],
              })],
            }))
          }

          // Spacer between findings
          children.push(new Paragraph({ spacing: { after: 160 }, children: [] }))
        }
      }
    }

    // ═══════════════════════════════════════════════════════
    // PAGES ANALYSED
    // ═══════════════════════════════════════════════════════

    if (pages.length > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }))

      children.push(new Paragraph({
        spacing: { before: 100, after: 60 },
        border: { left: { style: BorderStyle.SINGLE, size: 16, color: C.accent, space: 8 } },
        children: [new TextRun({ text: L.pagesAnalysed, font: 'Arial', size: 36, bold: true, color: C.text })],
      }))
      children.push(new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: L.pagesSubtitle, font: 'Arial', size: 19, color: C.textSec })],
      }))

      // Header row
      const colW = [4000, 2800, 1200, 1360]
      const headerBorder = { style: BorderStyle.SINGLE, size: 1, color: C.border }
      const headerBorders = { top: noBorder, bottom: headerBorder, left: noBorder, right: noBorder }

      children.push(new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: colW,
        rows: [
          // Header
          new TableRow({
            children: [
              new TableCell({ borders: headerBorders, width: { size: colW[0], type: WidthType.DXA }, margins: cellPad,
                children: [new Paragraph({ children: [new TextRun({ text: L.title, font: 'Arial', size: 17, bold: true, color: C.textSec })] })] }),
              new TableCell({ borders: headerBorders, width: { size: colW[1], type: WidthType.DXA }, margins: cellPad,
                children: [new Paragraph({ children: [new TextRun({ text: L.url, font: 'Arial', size: 17, bold: true, color: C.textSec })] })] }),
              new TableCell({ borders: headerBorders, width: { size: colW[2], type: WidthType.DXA }, margins: cellPad,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: L.status, font: 'Arial', size: 17, bold: true, color: C.textSec })] })] }),
              new TableCell({ borders: headerBorders, width: { size: colW[3], type: WidthType.DXA }, margins: cellPad,
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: L.loadTime, font: 'Arial', size: 17, bold: true, color: C.textSec })] })] }),
            ],
          }),
          // Data rows
          ...pages.map((pg: any) => {
            let shortUrl = pg.url
            try { const u = new URL(pg.url); shortUrl = u.pathname + u.search } catch {}
            const rowBorders = { top: noBorder, bottom: { style: BorderStyle.SINGLE as any, size: 1, color: C.borderLight }, left: noBorder, right: noBorder }
            return new TableRow({
              children: [
                new TableCell({ borders: rowBorders, width: { size: colW[0], type: WidthType.DXA }, margins: cellPad,
                  children: [new Paragraph({ children: [new TextRun({ text: pg.title || 'Untitled', font: 'Arial', size: 18, color: C.text })] })] }),
                new TableCell({ borders: rowBorders, width: { size: colW[1], type: WidthType.DXA }, margins: cellPad,
                  children: [new Paragraph({ children: [new TextRun({ text: shortUrl, font: 'Arial', size: 16, color: C.textTert })] })] }),
                new TableCell({ borders: rowBorders, width: { size: colW[2], type: WidthType.DXA }, margins: cellPad,
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${pg.status_code || '—'}`, font: 'Arial', size: 18, color: pg.status_code === 200 ? C.scoreGreen : C.scoreRed })] })] }),
                new TableCell({ borders: rowBorders, width: { size: colW[3], type: WidthType.DXA }, margins: cellPad,
                  children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: pg.load_time_ms ? `${(pg.load_time_ms / 1000).toFixed(1)}s` : '—', font: 'Arial', size: 18, color: C.textBody })] })] }),
              ],
            })
          }),
        ],
      }))
    }

    // ── Build the document ────────────────────────────────
    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: 'Arial', size: 20 } },
        },
      },
      sections: [{
        properties: {
          page: {
            size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        headers: {
          default: new Header({
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: isWhiteLabel && wlCompany
                ? [
                    new TextRun({ text: wlCompany, font: 'Arial', size: 16, bold: true, color: C.textTert }),
                    new TextRun({ text: `  |  ${domain}`, font: 'Arial', size: 16, color: C.textTert }),
                  ]
                : [
                    new TextRun({ text: 'Clear', font: 'Arial', size: 16, bold: true, color: C.textTert }),
                    new TextRun({ text: 'UX', font: 'Arial', size: 16, bold: true, color: C.accent }),
                    new TextRun({ text: `  |  ${domain}`, font: 'Arial', size: 16, color: C.textTert }),
                  ],
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              border: { top: { style: BorderStyle.SINGLE, size: 1, color: C.borderLight, space: 4 } },
              children: [
                new TextRun({ text: L.confidential, font: 'Arial', size: 14, color: C.textTert }),
                new TextRun({ text: '        Page ', font: 'Arial', size: 14, color: C.textTert }),
                new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 14, color: C.textTert }),
              ],
            })],
          }),
        },
        children,
      }],
    })

    const buffer = Buffer.from(await Packer.toBuffer(doc))
    const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_')

    return { buffer, safeDomain, whitelabelCompany: wlCompany }
}

/* ── Route handler ────────────────────────────────────────── */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: auditId } = await params
    const { buffer, safeDomain, whitelabelCompany } = await buildDocx(auditId)

    const brandName = whitelabelCompany
      ? whitelabelCompany.replace(/[^a-zA-Z0-9 .-]/g, '').replace(/\s+/g, '-')
      : 'ClearUX'

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${brandName}-Audit-${safeDomain}.docx"`,
        'Cache-Control': 'no-store',
      },
    })

  } catch (err) {
    console.error('[DOCX] Error generating report:', err)
    return NextResponse.json(
      { error: 'Failed to generate DOCX report', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
