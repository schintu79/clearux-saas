// ============================================================
// Fixpath — Website Audit HTML Report Renderer v3
// "The Instrument" editorial style — DM Sans, A4, header only
// ============================================================

import { CHECKPOINT_LABELS } from '@/lib/audit-checkpoints'
import { getScoreLabel, getSeverityLabel } from '@/lib/languages'
import { CATEGORY_KEYWORDS } from '@/lib/audit-engine/pipeline/category-keywords'

/* ── Pillar definitions (matches dashboard PILLAR_STYLE) ───── */
const PILLAR_DEFS = [
  { key: 'Foundation',            color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE', cssClass: 'foundation' },
  { key: 'Human Experience',      color: '#EC4899', bg: '#FDF2F8', border: '#FBCFE8', cssClass: 'human' },
  { key: 'Inclusive Design',      color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', cssClass: 'inclusive' },
  { key: 'Future Readiness',      color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0', cssClass: 'future' },
  { key: 'SEO Structure & Rules', color: '#06B6D4', bg: '#ECFEFF', border: '#A5F3FC', cssClass: 'seo' },
  { key: 'Brand Consistency',     color: '#F43F5E', bg: '#FFF1F2', border: '#FECDD3', cssClass: 'brand' },
]

/* ── Helpers ──────────────────────────────────────────────── */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function scoreClass(s: number): string {
  if (s >= 70) return 'sc-good'
  if (s >= 40) return 'sc-mid'
  return 'sc-bad'
}

function scoreHex(s: number): string {
  if (s >= 70) return '#16A34A'
  if (s >= 40) return '#CA8A04'
  return '#DC2626'
}

/* ── Types ───────────────────────────────────────────────── */
export interface WebsiteReportData {
  domain: string
  productUrl: string
  overallScore: number
  executiveSummary: string
  totalIssues: number
  dateStr: string
  language: string
  categoryScores: Array<{ name: string; score: number; summary?: string }>
  findings: Array<{
    severity: string
    title: string
    description: string
    recommendation?: string
    estimated_impact?: string
    page_url?: string
  }>
  pages: Array<{ url: string; title: string; status_code?: number; is_mobile_friendly?: boolean | null }>
  topRecommendations: string[]
  checkpointResults?: Record<string, Array<{ label: string; status: 'pass' | 'warn' | 'fail' }>>
  whiteLabel?: {
    companyName?: string
    footerText?: string
  }
}

/* ── Main renderer ───────────────────────────────────────── */
export function renderWebsiteReport(data: WebsiteReportData): string {
  const {
    domain, productUrl, overallScore, executiveSummary, totalIssues,
    dateStr, language, categoryScores, findings, pages,
    topRecommendations, checkpointResults, whiteLabel,
  } = data

  const brandName = whiteLabel?.companyName || 'Fixpath'
  const lang = language || 'en'

  // Build pillar groups from category scores (4 categories per pillar)
  // Filter out unanalyzed categories (score = -1) from each pillar
  const pillarGroups = PILLAR_DEFS.map((def, idx) => {
    const cats = categoryScores.slice(idx * 4, idx * 4 + 4).filter(c => c.score >= 0)
    const avg = cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 0
    return { ...def, cats, avg }
  }).filter(g => g.cats.length > 0) // Skip pillars with no analyzed categories

  // Assign findings to categories
  const flatCats: Array<{ pillarKey: string; catName: string; catIdx: number }> = []
  for (const pg of pillarGroups) {
    pg.cats.forEach((cat, localIdx) => {
      const globalIdx = PILLAR_DEFS.indexOf(pg) * 4 + localIdx
      flatCats.push({ pillarKey: pg.key, catName: cat.name, catIdx: globalIdx })
    })
  }

  const findingMap: Record<string, Record<string, typeof findings>> = {}
  for (const pg of pillarGroups) {
    findingMap[pg.key] = {}
    for (const cat of pg.cats) findingMap[pg.key][cat.name] = []
  }

  for (const finding of findings) {
    // Use explicit category_index when available; fall back to keyword matching
    const catIdx = (finding as any).category_index as number | null | undefined
    if (catIdx != null && catIdx >= 0 && catIdx < flatCats.length) {
      const fc = flatCats[catIdx]
      findingMap[fc.pillarKey][fc.catName].push(finding)
    } else {
      const text = `${finding.title} ${finding.description}`.toLowerCase()
      let bestMatch = -1
      let bestScore = 0
      for (let i = 0; i < flatCats.length; i++) {
        const fc = flatCats[i]
        let score = 0
        const nameWords = fc.catName.toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3)
        for (const w of nameWords) { if (text.includes(w)) score += 2 }
        const keywords = CATEGORY_KEYWORDS[fc.catIdx] || []
        for (const kw of keywords) { if (text.includes(kw)) score += 1 }
        if (score > bestScore) { bestScore = score; bestMatch = i }
      }
      if (bestMatch >= 0 && bestScore >= 1) {
        const fc = flatCats[bestMatch]
        findingMap[fc.pillarKey][fc.catName].push(finding)
      } else if (flatCats.length > 0) {
        const fc = flatCats[0]
        findingMap[fc.pillarKey][fc.catName].push(finding)
      }
    }
  }

  // Severity counts
  const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const f of findings) {
    const s = (f.severity || 'medium').toLowerCase() as keyof typeof sevCounts
    if (s in sevCounts) sevCounts[s]++
  }

  // Build checkpoint HTML for a category
  function checkpointsHtml(catName: string): string {
    const labels = CHECKPOINT_LABELS[catName]
    if (!labels) return ''
    const results = checkpointResults?.[catName]
    const items = labels.map((label, i) => {
      const status = results?.[i]?.status || 'pass'
      const cls = status === 'pass' ? 'ck-pass' : status === 'warn' ? 'ck-warn' : 'ck-fail'
      const icon = status === 'pass' ? '&#10003;' : status === 'fail' ? '&#10007;' : '&#9679;'
      return `<div class="ck-item"><span class="ck-icon ${cls}">${icon}</span> ${esc(label)}</div>`
    })
    return `<div class="ck-grid">${items.join('\n')}</div>`
  }

  // ── Build HTML ──────────────────────────────────────────
  const css = getCss()

  let html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(brandName)} Audit Report — ${esc(domain)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<div class="report">
`

  // ═══ PAGE 1: COVER ═══
  html += `
  <div class="page">
    <div class="page-header">
      <span class="page-header-brand">${esc(brandName)}</span>
      <span>Confidential</span>
      <span class="page-header-meta">Page 1</span>
    </div>
    <div class="cover">
      <div class="cover-type">Brand Health Audit Report</div>
      <h1>${esc(domain)}</h1>
      <div class="cover-url">${esc(productUrl)}</div>
      <div class="cover-score-row">
        <span class="cover-score-num ${scoreClass(overallScore)}">${overallScore}</span>
        <div class="cover-score-details">
          <div class="cover-score-of">out of 100</div>
          <div class="cover-score-label ${scoreClass(overallScore)}">${esc(getScoreLabel(overallScore, lang))}</div>
        </div>
      </div>
      <div class="cover-score-bar">
        <div class="cover-score-bar-fill" style="width: ${overallScore}%; background: ${scoreHex(overallScore)};"></div>
      </div>
      <div class="cover-info">
        <div><strong>Date:</strong> ${esc(dateStr)}</div>
        <div><strong>Issues found:</strong> ${totalIssues}</div>
        <div><strong>Categories:</strong> ${categoryScores.filter(c => c.score >= 0).length} across ${pillarGroups.length} modules</div>
        <div><strong>Checkpoints:</strong> ${categoryScores.filter(c => c.score >= 0).length * 4} verified</div>
        <div><strong>Pages crawled:</strong> ${pages.length}</div>
        <div><strong>Language:</strong> ${esc(lang === 'en' ? 'English' : lang)}</div>
      </div>
      <div class="cover-pillars">
        ${pillarGroups.map(p => `
        <div class="cover-pillar">
          <span class="cover-pillar-score" style="color: ${p.color};">${p.avg}</span>
          <span class="cover-pillar-name">${esc(p.key)}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>
`

  // ═══ PAGE 2: EXECUTIVE SUMMARY ═══
  const summaryParas = executiveSummary.split('\n').filter(s => s.trim())
  html += `
  <div class="page">
    <div class="page-header">
      <span class="page-header-brand">${esc(domain)}</span>
      <span>Confidential</span>
      <span class="page-header-meta">Page 2</span>
    </div>
    <div class="section-marker"></div>
    <h2 class="section-title">Executive Summary</h2>
    <p class="section-sub">High-level assessment and priority actions.</p>
    <div class="exec-text">
      ${summaryParas.map(p => `<p>${esc(p.trim())}</p>`).join('\n')}
    </div>
    <div class="severity-row">
      <div class="severity-cell sev-critical">
        <div class="severity-cell-count" style="color: var(--sev-critical);">${sevCounts.critical}</div>
        <div class="severity-cell-label" style="color: var(--sev-critical);">Critical</div>
      </div>
      <div class="severity-cell sev-high">
        <div class="severity-cell-count" style="color: var(--sev-high);">${sevCounts.high}</div>
        <div class="severity-cell-label" style="color: var(--sev-high);">High</div>
      </div>
      <div class="severity-cell sev-medium">
        <div class="severity-cell-count" style="color: var(--sev-medium);">${sevCounts.medium}</div>
        <div class="severity-cell-label" style="color: var(--sev-medium);">Medium</div>
      </div>
      <div class="severity-cell sev-low">
        <div class="severity-cell-count" style="color: var(--sev-low);">${sevCounts.low}</div>
        <div class="severity-cell-label" style="color: var(--sev-low);">Low</div>
      </div>
    </div>
    <div class="rec-heading">Top Priority Recommendations</div>
    <div>
      ${topRecommendations.slice(0, 5).map((rec, i) => `
      <div class="rec-item">
        <div class="rec-num">${i + 1}</div>
        <div class="rec-text">${esc(rec)}</div>
      </div>`).join('')}
    </div>
    <div class="method-note">
      This report was generated by ${esc(brandName)}'s AI-powered audit engine. Each of the 24 categories is scored against specific checkpoints derived from WCAG 2.1, Nielsen Norman heuristics, and modern SEO best practices.
    </div>
  </div>
`

  // ═══ PAGES 3+: SCORE BREAKDOWN (2 pillars per page) ═══
  let pageNum = 3
  for (let pairIdx = 0; pairIdx < pillarGroups.length; pairIdx += 2) {
    const pair = pillarGroups.slice(pairIdx, pairIdx + 2)
    const isFirst = pairIdx === 0

    html += `
  <div class="page">
    <div class="page-header">
      <span class="page-header-brand">${esc(domain)}</span>
      <span>Confidential</span>
      <span class="page-header-meta">Page ${pageNum}</span>
    </div>
    <div class="section-marker"></div>
    <h2 class="section-title">Score Breakdown</h2>
    <p class="section-sub">${isFirst ? `Performance across ${pillarGroups.length} modules and ${categoryScores.filter(c => c.score >= 0).length} categories, evaluated against ${categoryScores.filter(c => c.score >= 0).length * 4} checkpoints.` : 'Continued.'}</p>
    ${isFirst ? `
    <div class="score-legend">
      <div class="score-legend-item"><span class="score-legend-dot" style="background: var(--score-good);"></span> 70-100: Good</div>
      <div class="score-legend-item"><span class="score-legend-dot" style="background: var(--score-mid);"></span> 40-69: Needs work</div>
      <div class="score-legend-item"><span class="score-legend-dot" style="background: var(--score-bad);"></span> 0-39: Critical</div>
    </div>` : ''}
`

    for (const pillar of pair) {
      html += `
    <div class="pillar-block">
      <div class="pillar-head" style="background: ${pillar.bg}; border-color: ${pillar.border};">
        <div class="pillar-head-left">
          <span class="pillar-head-name" style="color: ${pillar.color};">${esc(pillar.key)}</span>
          <span class="pillar-head-desc" style="color: ${pillar.color};">${pillar.cats.length} categories &middot; ${pillar.cats.length * 4} checkpoints</span>
        </div>
        <span class="pillar-head-score" style="color: ${pillar.color};">${pillar.avg}</span>
      </div>
`
      for (let ci = 0; ci < pillar.cats.length; ci++) {
        const cat = pillar.cats[ci]
        const isLast = ci === pillar.cats.length - 1
        html += `
      <div class="cat-row${isLast ? ' cat-row-last' : ''}">
        <span class="cat-name">${esc(cat.name)}</span>
        <div class="cat-bar"><div class="cat-bar-fill" style="width: ${cat.score}%; background: ${pillar.color};"></div></div>
        <span class="cat-score ${scoreClass(cat.score)}">${cat.score}</span>
      </div>
      ${checkpointsHtml(cat.name)}
`
      }
      html += `    </div>\n`
    }

    html += `  </div>\n`
    pageNum++
  }

  // ═══ FINDING PAGES ═══
  const findingBlocks: string[] = []
  const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

  for (const pillar of pillarGroups) {
    const pillarFindings = findingMap[pillar.key] || {}
    const hasFindings = Object.values(pillarFindings).some(arr => arr.length > 0)
    if (!hasFindings) continue

    findingBlocks.push(`<div class="findings-pillar-tag" style="color: ${pillar.color}; border-color: ${pillar.color};">${esc(pillar.key)}</div>`)

    for (const [catName, catFindings] of Object.entries(pillarFindings)) {
      if (catFindings.length === 0) continue
      catFindings.sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4))

      findingBlocks.push(`
    <div class="findings-cat-heading">
      ${esc(catName)}
      <span class="findings-cat-count">${catFindings.length} finding${catFindings.length !== 1 ? 's' : ''}</span>
    </div>`)

      for (const f of catFindings) {
        const sev = (f.severity || 'medium').toLowerCase()
        let pageDisplay = ''
        if (f.page_url) {
          try {
            const u = new URL(f.page_url)
            pageDisplay = u.hostname + (u.pathname === '/' ? '' : u.pathname)
          } catch { pageDisplay = f.page_url }
        }

        findingBlocks.push(`
    <div class="finding">
      <div class="finding-bar ${sev}"></div>
      <div class="finding-body">
        <div class="finding-meta">
          <span class="sev-badge ${sev}">${esc(getSeverityLabel(sev, lang))}</span>
          ${pageDisplay ? `<span class="finding-page">${esc(pageDisplay)}</span>` : ''}
        </div>
        <div class="finding-title">${esc(f.title)}</div>
        <div class="finding-desc">${esc(f.description)}</div>
        ${f.recommendation ? `
        <div class="finding-box box-rec">
          <div class="finding-box-label">Recommendation</div>
          <div>${esc(f.recommendation)}</div>
        </div>` : ''}
        ${f.estimated_impact ? `
        <div class="finding-box box-impact">
          <div class="finding-box-label">Expected impact</div>
          <div>${esc(f.estimated_impact)}</div>
        </div>` : ''}
      </div>
    </div>`)
      }
    }
  }

  // Split findings across pages (~4 findings per page)
  const FINDINGS_PER_PAGE = 4
  const findingChunks: string[][] = []
  let currentChunk: string[] = []
  let findingCount = 0
  for (const block of findingBlocks) {
    currentChunk.push(block)
    if (block.includes('class="finding"')) {
      findingCount++
      if (findingCount >= FINDINGS_PER_PAGE) {
        findingChunks.push(currentChunk)
        currentChunk = []
        findingCount = 0
      }
    }
  }
  if (currentChunk.length > 0) findingChunks.push(currentChunk)

  for (let i = 0; i < findingChunks.length; i++) {
    html += `
  <div class="page">
    <div class="page-header">
      <span class="page-header-brand">${esc(domain)}</span>
      <span>Confidential</span>
      <span class="page-header-meta">Page ${pageNum}</span>
    </div>
    <div class="section-marker"></div>
    <h2 class="section-title">Detailed Findings</h2>
    <p class="section-sub">${i === 0 ? 'All issues ranked by severity, with recommendations and expected impact.' : 'Continued.'}</p>
    ${findingChunks[i].join('\n')}
  </div>
`
    pageNum++
  }

  // ═══ LAST PAGE: PAGES ANALYSED ═══
  if (pages.length > 0) {
    const hasMobileData = pages.some(p => p.is_mobile_friendly !== undefined && p.is_mobile_friendly !== null)
    html += `
  <div class="page">
    <div class="page-header">
      <span class="page-header-brand">${esc(domain)}</span>
      <span>Confidential</span>
      <span class="page-header-meta">Page ${pageNum}</span>
    </div>
    <div class="section-marker"></div>
    <h2 class="section-title">Pages Analysed</h2>
    <p class="section-sub">All pages crawled and evaluated during this audit.</p>
    <table class="pages-table">
      <thead>
        <tr>
          <th style="width: ${hasMobileData ? '28' : '30'}%;">Page</th>
          <th style="width: ${hasMobileData ? '42' : '55'}%;">URL</th>
          <th style="width: 15%;">Status</th>
          ${hasMobileData ? '<th style="width: 15%;">Mobile</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${pages.map(pg => {
          let urlDisplay = pg.url
          try { const u = new URL(pg.url); urlDisplay = u.hostname + (u.pathname === '/' ? '/' : u.pathname) } catch {}
          const mobileCell = hasMobileData
            ? `<td>${pg.is_mobile_friendly === true
                ? '<span class="badge-mobile pass">Pass</span>'
                : pg.is_mobile_friendly === false
                  ? '<span class="badge-mobile fail">Fail</span>'
                  : '<span class="badge-mobile neutral">N/A</span>'
              }</td>`
            : ''
          return `
        <tr>
          <td>${esc(pg.title || 'Untitled')}</td>
          <td class="url-cell">${esc(urlDisplay)}</td>
          <td><span class="status-ok">${pg.status_code || 200} OK</span></td>
          ${mobileCell}
        </tr>`
        }).join('')}
      </tbody>
    </table>
    <div class="closing">
      <div class="closing-brand">${esc(brandName)}</div>
      <div class="closing-text">
        This report is confidential and intended for the recipient only.<br>
        Generated by ${esc(brandName)} &mdash; fixpath.ai<br>
        &copy; ${new Date().getFullYear()} ${esc(brandName)}. All rights reserved.
      </div>
    </div>
  </div>
`
  }

  html += `
</div>
</body>
</html>`

  return html
}

/* ── Inline CSS — v3 "The Instrument" ─────────────────────── */
function getCss(): string {
  return `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #18181B; --ink-2: #3F3F46; --muted: #71717A; --muted-2: #A1A1AA;
    --rule: #E4E4E7; --rule-2: #D4D4D8;
    --paper: #FAFAFA; --paper-2: #F4F4F5; --paper-3: #E4E4E7;
    --card: #FFFFFF;
    --signal: #5E6B2F; --signal-soft: rgba(94,107,47,0.08);
    --sev-critical: #DC2626; --sev-critical-bg: #FEF2F2;
    --sev-high: #EA580C; --sev-high-bg: #FFF7ED;
    --sev-medium: #CA8A04; --sev-medium-bg: #FEFCE8;
    --sev-low: #2563EB; --sev-low-bg: #EFF6FF;
    --score-good: #16A34A; --score-mid: #CA8A04; --score-bad: #DC2626;
    --page-w: 210mm; --page-h: 297mm; --margin: 22mm; --margin-top: 16mm;
  }
  @page { size: A4 portrait; margin: 22mm; margin-top: 16mm; }
  body { font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; color: var(--ink-2); background: #E4E4E7; line-height: 1.6; font-size: 9.5pt; -webkit-font-smoothing: antialiased; margin: 0; }
  .report { width: var(--page-w); margin: 0 auto; }
  .page { width: var(--page-w); min-height: var(--page-h); padding: var(--margin); padding-top: var(--margin-top); background: var(--card); position: relative; overflow: hidden; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  @media print { body { background: white; } .report { width: auto; } .page { width: auto; min-height: auto; padding: 0; box-shadow: none; } }
  @media screen { .page { margin-bottom: 8mm; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08); } }
  h1, h2, h3, h4 { color: var(--ink); font-weight: 700; line-height: 1.2; letter-spacing: -0.01em; }
  h1 { font-size: 28pt; letter-spacing: -0.02em; } h2 { font-size: 15pt; } h3 { font-size: 11pt; }
  p { margin-bottom: 2mm; }

  .page-header { display: flex; justify-content: space-between; align-items: center; font-size: 7pt; color: var(--muted); letter-spacing: 0.5pt; padding-bottom: 3mm; margin-bottom: 7mm; border-bottom: 1px solid var(--rule); }
  .page-header-brand { font-weight: 700; color: var(--ink); text-transform: uppercase; letter-spacing: 1.5pt; font-size: 7pt; }
  .page-header-meta { font-variant-numeric: tabular-nums; }

  .cover { padding-top: 32mm; }
  .cover-type { display: inline-block; font-size: 7.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 2pt; color: var(--signal); border: 1.5px solid var(--signal); padding: 2mm 5mm; margin-bottom: 12mm; }
  .cover h1 { font-size: 32pt; margin-bottom: 2mm; letter-spacing: -0.03em; text-align: left; }
  .cover-url { font-size: 10pt; color: var(--muted); margin-bottom: 16mm; }
  .cover-score-row { display: flex; align-items: flex-end; gap: 6mm; margin-bottom: 5mm; }
  .cover-score-num { font-size: 64pt; font-weight: 700; line-height: 1; letter-spacing: -2pt; }
  .cover-score-details { padding-bottom: 4mm; }
  .cover-score-of { font-size: 11pt; color: var(--muted-2); }
  .cover-score-label { font-size: 10pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1pt; margin-top: 1mm; }
  .cover-score-bar { width: 100%; height: 3px; background: var(--rule); margin-bottom: 14mm; overflow: hidden; }
  .cover-score-bar-fill { height: 100%; }
  .cover-info { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 12mm; font-size: 9pt; color: var(--muted); margin-bottom: 16mm; line-height: 2; }
  .cover-info strong { color: var(--ink); font-weight: 600; }
  .cover-pillars { display: grid; grid-template-columns: repeat(6, 1fr); border: 1px solid var(--rule); border-radius: 6px; overflow: hidden; }
  .cover-pillar { text-align: center; padding: 4mm 2mm; border-right: 1px solid var(--rule); }
  .cover-pillar:last-child { border-right: none; }
  .cover-pillar-score { font-size: 18pt; font-weight: 700; display: block; margin-bottom: 1mm; line-height: 1; }
  .cover-pillar-name { font-size: 6pt; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5pt; line-height: 1.3; }

  .section-marker { width: 14mm; height: 3px; background: var(--ink); margin-bottom: 4mm; }
  .section-title { margin-bottom: 1mm; }
  .section-sub { font-size: 8.5pt; color: var(--muted); margin-bottom: 6mm; }

  .exec-text { font-size: 9.5pt; line-height: 1.75; color: var(--ink-2); margin-bottom: 6mm; }
  .exec-text p { margin-bottom: 3mm; }

  .severity-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 1px solid var(--rule); border-radius: 6px; overflow: hidden; margin-bottom: 7mm; }
  .severity-cell { text-align: center; padding: 4mm 3mm; border-right: 1px solid var(--rule); }
  .severity-cell:last-child { border-right: none; }
  .severity-cell-count { font-size: 22pt; font-weight: 700; line-height: 1; margin-bottom: 1mm; }
  .severity-cell-label { font-size: 6.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8pt; }
  .sev-critical { background: var(--sev-critical-bg); } .sev-high { background: var(--sev-high-bg); }
  .sev-medium { background: var(--sev-medium-bg); } .sev-low { background: var(--sev-low-bg); }

  .rec-heading { font-size: 11pt; font-weight: 700; color: var(--ink); margin-bottom: 3mm; }
  .rec-item { display: flex; gap: 3.5mm; padding: 3mm 4mm; border-left: 2.5px solid var(--signal); background: var(--signal-soft); margin-bottom: 2mm; border-radius: 0 4px 4px 0; align-items: flex-start; }
  .rec-num { font-size: 12pt; font-weight: 700; color: var(--signal); min-width: 5mm; line-height: 1.4; }
  .rec-text { font-size: 9pt; color: var(--ink-2); line-height: 1.55; }
  .method-note { margin-top: 6mm; padding: 3mm 4mm; border-left: 2px solid var(--rule-2); font-size: 7.5pt; color: var(--muted); line-height: 1.6; }

  .score-legend { display: flex; gap: 6mm; padding: 2.5mm 4mm; background: var(--paper-2); border: 1px solid var(--rule); border-radius: 4px; margin-bottom: 6mm; font-size: 7.5pt; color: var(--muted); }
  .score-legend-item { display: flex; align-items: center; gap: 1.5mm; }
  .score-legend-dot { width: 7px; height: 7px; border-radius: 2px; display: inline-block; }

  .pillar-block { margin-bottom: 5mm; }
  .pillar-head { display: flex; align-items: center; justify-content: space-between; padding: 3.5mm 4mm; border-radius: 5px 5px 0 0; border: 1px solid transparent; }
  .pillar-head-left { display: flex; flex-direction: column; gap: 0.5mm; }
  .pillar-head-name { font-size: 11pt; font-weight: 700; }
  .pillar-head-desc { font-size: 7pt; font-weight: 400; opacity: 0.7; }
  .pillar-head-score { font-size: 22pt; font-weight: 700; line-height: 1; }
  .cat-row { display: flex; align-items: center; gap: 3mm; padding: 2.5mm 4mm; border-bottom: 1px solid var(--rule); border-left: 1px solid var(--rule); border-right: 1px solid var(--rule); }
  .cat-row-last { border-radius: 0 0 5px 5px; }
  .cat-name { flex: 1; font-size: 8.5pt; color: var(--ink-2); }
  .cat-bar { width: 28mm; height: 5px; background: var(--paper-3); border-radius: 3px; flex-shrink: 0; overflow: hidden; }
  .cat-bar-fill { height: 100%; border-radius: 3px; }
  .cat-score { font-size: 9pt; font-weight: 700; width: 8mm; text-align: right; flex-shrink: 0; }

  .ck-grid { display: flex; flex-wrap: wrap; gap: 0.5mm 5mm; padding: 2mm 4mm 2.5mm; border-left: 1px solid var(--rule); border-right: 1px solid var(--rule); border-bottom: 1px solid var(--rule); background: var(--paper-2); }
  .ck-item { display: flex; align-items: center; gap: 1.5mm; font-size: 7pt; color: var(--muted); width: calc(50% - 2.5mm); padding: 0.3mm 0; }
  .ck-icon { width: 3.5mm; text-align: center; font-weight: 700; flex-shrink: 0; font-size: 7.5pt; }
  .ck-pass { color: var(--score-good); } .ck-warn { color: var(--score-mid); } .ck-fail { color: var(--score-bad); }

  .findings-pillar-tag { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2pt; padding: 2mm 0; margin-top: 5mm; margin-bottom: 1mm; border-bottom: 2px solid currentColor; }
  .findings-pillar-tag:first-child { margin-top: 0; }
  .findings-cat-heading { font-size: 9.5pt; font-weight: 700; color: var(--ink); margin-top: 4mm; margin-bottom: 3mm; padding-bottom: 1.5mm; border-bottom: 1px solid var(--rule); display: flex; justify-content: space-between; align-items: center; }
  .findings-cat-count { font-size: 7pt; font-weight: 400; color: var(--muted); }

  .finding { border: 1px solid var(--rule); border-radius: 5px; margin-bottom: 3mm; overflow: hidden; display: flex; }
  .finding-bar { width: 4px; flex-shrink: 0; }
  .finding-bar.critical { background: var(--sev-critical); } .finding-bar.high { background: var(--sev-high); }
  .finding-bar.medium { background: var(--sev-medium); } .finding-bar.low { background: var(--sev-low); }
  .finding-body { flex: 1; padding: 3.5mm 4mm; }
  .finding-meta { display: flex; align-items: center; gap: 2.5mm; margin-bottom: 1.5mm; }
  .sev-badge { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3pt; padding: 1mm 2.5mm; border-radius: 3px; line-height: 1; }
  .sev-badge.critical { background: var(--sev-critical-bg); color: var(--sev-critical); }
  .sev-badge.high { background: var(--sev-high-bg); color: var(--sev-high); }
  .sev-badge.medium { background: var(--sev-medium-bg); color: var(--sev-medium); }
  .sev-badge.low { background: var(--sev-low-bg); color: var(--sev-low); }
  .finding-page { font-size: 7.5pt; color: var(--muted-2); }
  .finding-title { font-size: 10pt; font-weight: 600; color: var(--ink); line-height: 1.35; margin-bottom: 1.5mm; }
  .finding-desc { font-size: 8.5pt; color: var(--ink-2); line-height: 1.65; margin-bottom: 2.5mm; }
  .finding-box { padding: 2.5mm 3.5mm; margin-bottom: 2mm; font-size: 8pt; line-height: 1.55; border-radius: 4px; }
  .finding-box:last-child { margin-bottom: 0; }
  .finding-box-label { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 0.8mm; }
  .box-rec { background: var(--paper-2); border: 1px solid var(--rule); }
  .box-rec .finding-box-label { color: var(--muted); }
  .box-impact { background: #F0FDF4; border: 1px solid #BBF7D0; }
  .box-impact .finding-box-label { color: #16A34A; }

  .pages-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  .pages-table th { text-align: left; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5pt; color: var(--muted); padding: 2.5mm 3mm; border-bottom: 2px solid var(--rule-2); background: var(--paper-2); }
  .pages-table td { padding: 2.5mm 3mm; border-bottom: 1px solid var(--rule); color: var(--ink-2); }
  .pages-table tr:last-child td { border-bottom: none; }
  .url-cell { font-size: 7.5pt; color: var(--muted); }
  .status-ok { color: var(--score-good); font-weight: 600; font-size: 7.5pt; }
  .badge-mobile { display: inline-block; font-size: 6pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3pt; padding: 0.5mm 1.5mm; border-radius: 2px; }
  .badge-mobile.pass { background: #F0FDF4; color: #16A34A; }
  .badge-mobile.fail { background: #FEF2F2; color: #DC2626; }
  .badge-mobile.neutral { background: var(--paper-2); color: var(--muted); }

  .closing { text-align: center; padding-top: 20mm; }
  .closing-brand { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2pt; color: var(--ink); margin-bottom: 3mm; }
  .closing-text { font-size: 7.5pt; color: var(--muted); line-height: 1.8; }

  .sc-good { color: var(--score-good); } .sc-mid { color: var(--score-mid); } .sc-bad { color: var(--score-bad); }
  `
}
