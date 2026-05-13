// ============================================================
// ClearUX — Brand Identity Audit HTML Report Renderer v3
// "The Instrument" editorial style — DM Sans, A4, header only
// ============================================================

import { BRAND_AUDIT_CATEGORIES } from '@/lib/brand-audit-modules'
import { getScoreLabel, getSeverityLabel } from '@/lib/languages'

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
export interface BrandReportData {
  brandName: string
  overallScore: number
  executiveSummary: string
  totalIssues: number
  dateStr: string
  language: string
  categoryResults: Array<{
    name: string
    slug?: string
    score: number
    summary?: string
    weight?: number
  }>
  findings: Array<{
    severity: string
    title: string
    description: string
    recommendation?: string
    estimated_impact?: string
    page_url?: string
  }>
  topRecommendations: string[]
  materials?: Array<{ name: string; type: string }>
  whiteLabel?: {
    companyName?: string
    footerText?: string
  }
}

/* ── Main renderer ───────────────────────────────────────── */
export function renderBrandReport(data: BrandReportData): string {
  const {
    brandName, overallScore, executiveSummary, totalIssues,
    dateStr, language, categoryResults, findings,
    topRecommendations, materials, whiteLabel,
  } = data

  const company = whiteLabel?.companyName || 'ClearUX'
  const lang = language || 'en'

  // Build category map with descriptions from module definitions
  const catMap = new Map(BRAND_AUDIT_CATEGORIES.map(c => [c.slug, c]))
  const enrichedCats = categoryResults.map(cr => {
    const def = catMap.get(cr.slug || '')
    return {
      ...cr,
      description: def?.description || '',
      weight: cr.weight ?? def?.weight ?? 0,
    }
  })

  // Severity counts
  const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const f of findings) {
    const s = (f.severity || 'medium').toLowerCase() as keyof typeof sevCounts
    if (s in sevCounts) sevCounts[s]++
  }

  // Assign findings to categories by keyword matching
  const findingsByCategory: Record<string, typeof findings> = {}
  for (const cat of enrichedCats) findingsByCategory[cat.name] = []

  for (const finding of findings) {
    const text = `${finding.title} ${finding.description}`.toLowerCase()
    let bestCat = enrichedCats[0]?.name || ''
    let bestScore = 0
    for (const cat of enrichedCats) {
      let score = 0
      const words = cat.name.toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3)
      for (const w of words) { if (text.includes(w)) score += 2 }
      const descWords = (cat.description || '').toLowerCase().split(/[&,\s]+/).filter(w => w.length > 4)
      for (const w of descWords) { if (text.includes(w)) score += 1 }
      if (score > bestScore) { bestScore = score; bestCat = cat.name }
    }
    if (findingsByCategory[bestCat]) findingsByCategory[bestCat].push(finding)
    else if (enrichedCats.length > 0) findingsByCategory[enrichedCats[0].name].push(finding)
  }

  const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

  // ── Build HTML ──────────────────────────────────────────
  const css = getCss()

  let html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(company)} Brand Identity Audit — ${esc(brandName)}</title>
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
      <span class="page-header-brand">${esc(company)}</span>
      <span>Confidential</span>
      <span>Page 1</span>
    </div>
    <div class="cover">
      <div class="cover-type">Brand Identity Audit</div>
      <h1>${esc(brandName)}</h1>
      <div class="cover-sub">Brand identity materials assessment</div>
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
        <div><strong>Categories:</strong> ${enrichedCats.length}</div>
        <div><strong>Language:</strong> ${esc(lang === 'en' ? 'English' : lang)}</div>
      </div>
      <div class="cover-categories">
        ${enrichedCats.map(cat => {
          const weightPct = Math.round(cat.weight * 100)
          return `
        <div class="cover-cat-item">
          <span class="cover-cat-name">${esc(cat.name)}</span>
          <div class="cover-cat-right">
            <span class="cover-cat-weight">${weightPct}%</span>
            <span class="cover-cat-score ${scoreClass(cat.score)}">${cat.score}</span>
          </div>
        </div>`
        }).join('')}
      </div>
    </div>
  </div>
`

  // ═══ PAGE 2: EXECUTIVE SUMMARY ═══
  const summaryParas = executiveSummary.split('\n').filter(s => s.trim())
  html += `
  <div class="page">
    <div class="page-header">
      <span class="page-header-brand">${esc(brandName)}</span>
      <span>Confidential</span>
      <span>Page 2</span>
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
      This report was generated by ${esc(company)}'s AI-powered brand audit engine. Each category is scored by analysing uploaded brand materials against professional brand standards.
    </div>
  </div>
`

  // ═══ PAGE 3: SCORE BREAKDOWN ═══
  html += `
  <div class="page">
    <div class="page-header">
      <span class="page-header-brand">${esc(brandName)}</span>
      <span>Confidential</span>
      <span>Page 3</span>
    </div>
    <div class="section-marker"></div>
    <h2 class="section-title">Score Breakdown</h2>
    <p class="section-sub">Performance across ${enrichedCats.length} brand identity categories, weighted by importance.</p>
    <div class="score-legend">
      <div class="score-legend-item"><span class="score-legend-dot" style="background: var(--score-good);"></span> 70-100: Good</div>
      <div class="score-legend-item"><span class="score-legend-dot" style="background: var(--score-mid);"></span> 40-69: Needs work</div>
      <div class="score-legend-item"><span class="score-legend-dot" style="background: var(--score-bad);"></span> 0-39: Critical</div>
    </div>
`
  for (const cat of enrichedCats) {
    const weightPct = Math.round(cat.weight * 100)
    html += `
    <div class="cat-block">
      <div class="cat-head">
        <div class="cat-head-left">
          <span class="cat-head-name">${esc(cat.name)}</span>
          <span class="cat-head-desc">${esc(cat.description.split('.')[0] || '')}</span>
        </div>
        <div class="cat-head-right">
          <span class="cat-head-score ${scoreClass(cat.score)}">${cat.score}</span>
          <div class="cat-head-weight">Weight: ${weightPct}%</div>
        </div>
      </div>
      <div class="cat-bar-row"><div class="cat-progress"><div class="cat-progress-fill" style="width: ${cat.score}%;"></div></div></div>
      ${cat.summary ? `<div class="cat-summary">${esc(cat.summary)}</div>` : ''}
    </div>
`
  }
  html += `  </div>\n`

  // ═══ FINDING PAGES ═══
  const findingBlocks: string[] = []
  for (const cat of enrichedCats) {
    const catFindings = findingsByCategory[cat.name] || []
    if (catFindings.length === 0) continue
    catFindings.sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4))

    findingBlocks.push(`
    <div class="findings-cat-heading">
      ${esc(cat.name)}
      <span class="findings-cat-count">${catFindings.length} finding${catFindings.length !== 1 ? 's' : ''}</span>
    </div>`)

    for (const f of catFindings) {
      const sev = (f.severity || 'medium').toLowerCase()
      findingBlocks.push(`
    <div class="finding">
      <div class="finding-bar ${sev}"></div>
      <div class="finding-body">
        <div class="finding-meta">
          <span class="sev-badge ${sev}">${esc(getSeverityLabel(sev, lang))}</span>
          <span class="finding-cat">${esc(cat.name)}</span>
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

  // Split findings into pages
  const FINDINGS_PER_PAGE = 4
  const findingChunks: string[][] = []
  let currentChunk: string[] = []
  let fCount = 0
  for (const block of findingBlocks) {
    currentChunk.push(block)
    if (block.includes('class="finding"')) {
      fCount++
      if (fCount >= FINDINGS_PER_PAGE) {
        findingChunks.push(currentChunk)
        currentChunk = []
        fCount = 0
      }
    }
  }
  if (currentChunk.length > 0) findingChunks.push(currentChunk)

  let pageNum = 4
  for (let i = 0; i < findingChunks.length; i++) {
    html += `
  <div class="page">
    <div class="page-header">
      <span class="page-header-brand">${esc(brandName)}</span>
      <span>Confidential</span>
      <span>Page ${pageNum}</span>
    </div>
    <div class="section-marker"></div>
    <h2 class="section-title">Detailed Findings</h2>
    <p class="section-sub">${i === 0 ? 'All issues ranked by severity, with recommendations and expected impact.' : 'Continued.'}</p>
    ${findingChunks[i].join('\n')}
  </div>
`
    pageNum++
  }

  // ═══ LAST PAGE: MATERIALS + CLOSING ═══
  const materialsList = materials && materials.length > 0 ? materials : []
  html += `
  <div class="page">
    <div class="page-header">
      <span class="page-header-brand">${esc(brandName)}</span>
      <span>Confidential</span>
      <span>Page ${pageNum}</span>
    </div>
`
  if (materialsList.length > 0) {
    html += `
    <div class="section-marker"></div>
    <h2 class="section-title">Materials Analysed</h2>
    <p class="section-sub">All documents evaluated during this brand audit.</p>
    <table class="materials-table">
      <thead>
        <tr>
          <th style="width: 45%;">Document</th>
          <th style="width: 25%;">Type</th>
          <th style="width: 30%;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${materialsList.map(m => `
        <tr>
          <td>${esc(m.name)}</td>
          <td class="file-type">${esc(m.type.toUpperCase())}</td>
          <td><span class="status-ok">Analysed</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
`
  }
  html += `
    <div class="closing">
      <div class="closing-brand">${esc(company)}</div>
      <div class="closing-text">
        This report is confidential and intended for the recipient only.<br>
        Generated by ${esc(company)} &mdash; clearux.ai<br>
        &copy; ${new Date().getFullYear()} ${esc(company)}. All rights reserved.
      </div>
    </div>
  </div>
`

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
    --signal: #5E6B2F; --signal-soft: rgba(94,107,47,0.08); --signal-border: rgba(94,107,47,0.25);
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

  .cover { padding-top: 32mm; }
  .cover-type { display: inline-block; font-size: 7.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 2pt; color: var(--signal); border: 1.5px solid var(--signal); padding: 2mm 5mm; margin-bottom: 12mm; }
  .cover h1 { font-size: 32pt; margin-bottom: 2mm; letter-spacing: -0.03em; }
  .cover-sub { font-size: 10pt; color: var(--muted); margin-bottom: 16mm; }
  .cover-score-row { display: flex; align-items: flex-end; gap: 6mm; margin-bottom: 5mm; }
  .cover-score-num { font-size: 64pt; font-weight: 700; line-height: 1; letter-spacing: -2pt; }
  .cover-score-details { padding-bottom: 4mm; }
  .cover-score-of { font-size: 11pt; color: var(--muted-2); }
  .cover-score-label { font-size: 10pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1pt; margin-top: 1mm; }
  .cover-score-bar { width: 100%; height: 3px; background: var(--rule); margin-bottom: 14mm; overflow: hidden; }
  .cover-score-bar-fill { height: 100%; }
  .cover-info { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 12mm; font-size: 9pt; color: var(--muted); margin-bottom: 16mm; line-height: 2; }
  .cover-info strong { color: var(--ink); font-weight: 600; }
  .cover-categories { border: 1px solid var(--rule); border-radius: 6px; overflow: hidden; }
  .cover-cat-item { display: flex; align-items: center; justify-content: space-between; padding: 3mm 4mm; border-bottom: 1px solid var(--rule); }
  .cover-cat-item:last-child { border-bottom: none; }
  .cover-cat-name { font-size: 9pt; color: var(--ink-2); }
  .cover-cat-right { display: flex; align-items: center; gap: 3mm; }
  .cover-cat-weight { font-size: 7pt; color: var(--muted-2); }
  .cover-cat-score { font-size: 13pt; font-weight: 700; }

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

  .cat-block { margin-bottom: 5mm; }
  .cat-head { display: flex; align-items: center; justify-content: space-between; padding: 3.5mm 4mm; background: var(--signal-soft); border: 1px solid var(--signal-border); border-radius: 5px 5px 0 0; }
  .cat-head-left { display: flex; flex-direction: column; gap: 0.5mm; }
  .cat-head-name { font-size: 11pt; font-weight: 700; color: var(--ink); }
  .cat-head-desc { font-size: 7.5pt; color: var(--muted); max-width: 120mm; line-height: 1.4; }
  .cat-head-right { text-align: right; }
  .cat-head-score { font-size: 22pt; font-weight: 700; line-height: 1; }
  .cat-head-weight { font-size: 6.5pt; color: var(--muted); margin-top: 1mm; }
  .cat-bar-row { padding: 3mm 4mm; border: 1px solid var(--rule); border-top: none; }
  .cat-progress { width: 100%; height: 6px; background: var(--paper-3); border-radius: 3px; overflow: hidden; }
  .cat-progress-fill { height: 100%; border-radius: 3px; background: var(--signal); }
  .cat-summary { padding: 3mm 4mm; border: 1px solid var(--rule); border-top: none; border-radius: 0 0 5px 5px; font-size: 8.5pt; color: var(--muted); line-height: 1.55; background: var(--paper-2); }

  .findings-cat-heading { font-size: 9.5pt; font-weight: 700; color: var(--ink); margin-top: 5mm; margin-bottom: 3mm; padding-bottom: 1.5mm; border-bottom: 2px solid var(--signal); display: flex; justify-content: space-between; align-items: center; }
  .findings-cat-heading:first-child { margin-top: 0; }
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
  .finding-cat { font-size: 7.5pt; color: var(--muted-2); }
  .finding-title { font-size: 10pt; font-weight: 600; color: var(--ink); line-height: 1.35; margin-bottom: 1.5mm; }
  .finding-desc { font-size: 8.5pt; color: var(--ink-2); line-height: 1.65; margin-bottom: 2.5mm; }
  .finding-box { padding: 2.5mm 3.5mm; margin-bottom: 2mm; font-size: 8pt; line-height: 1.55; border-radius: 4px; }
  .finding-box:last-child { margin-bottom: 0; }
  .finding-box-label { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 0.8mm; }
  .box-rec { background: var(--paper-2); border: 1px solid var(--rule); }
  .box-rec .finding-box-label { color: var(--muted); }
  .box-impact { background: #F0FDF4; border: 1px solid #BBF7D0; }
  .box-impact .finding-box-label { color: #16A34A; }

  .materials-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  .materials-table th { text-align: left; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5pt; color: var(--muted); padding: 2.5mm 3mm; border-bottom: 2px solid var(--rule-2); background: var(--paper-2); }
  .materials-table td { padding: 2.5mm 3mm; border-bottom: 1px solid var(--rule); color: var(--ink-2); }
  .materials-table tr:last-child td { border-bottom: none; }
  .file-type { font-size: 7.5pt; color: var(--muted-2); text-transform: uppercase; }
  .status-ok { color: var(--score-good); font-weight: 600; font-size: 7.5pt; }

  .closing { text-align: center; padding-top: 20mm; }
  .closing-brand { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2pt; color: var(--ink); margin-bottom: 3mm; }
  .closing-text { font-size: 7.5pt; color: var(--muted); line-height: 1.8; }

  .sc-good { color: var(--score-good); } .sc-mid { color: var(--score-mid); } .sc-bad { color: var(--score-bad); }
  `
}
