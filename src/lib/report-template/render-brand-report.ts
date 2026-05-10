// ============================================================
// ClearUX — Brand Identity Audit HTML Report Renderer
// Takes brand audit data and returns a populated HTML string
// based on brand-identity-report-template.html.
// ============================================================

import { BRAND_AUDIT_CATEGORIES } from '@/lib/brand-audit-modules'
import { getScoreLabel, getSeverityLabel } from '@/lib/languages'

/* ── Helpers ──────────────────────────────────────────────── */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function scoreColorClass(s: number): string {
  if (s >= 70) return 'text-green'
  if (s >= 40) return 'text-yellow'
  return 'text-red'
}

function scoreColorHex(s: number): string {
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
  /** Materials analysed (brand files uploaded) */
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
      <span class="page-header-center">Confidential</span>
      <span class="page-header-right">Page 1</span>
    </div>
    <div class="cover">
      <div class="cover-badge">Brand Identity Audit</div>
      <h1>${esc(brandName)}</h1>
      <div class="cover-subtitle">Brand identity materials assessment</div>
      <div class="cover-score-block">
        <span class="cover-score-value ${scoreColorClass(overallScore)}">${overallScore}</span>
        <div class="cover-score-max">out of 100</div>
        <div class="cover-score-bar">
          <div class="cover-score-bar-fill" style="width: ${overallScore}%; background: ${scoreColorHex(overallScore)};"></div>
        </div>
        <div class="cover-score-label ${scoreColorClass(overallScore)}">${esc(getScoreLabel(overallScore, lang))}</div>
      </div>
      <div class="cover-meta">
        <strong>Date:</strong> ${esc(dateStr)}<br>
        <strong>Issues found:</strong> ${totalIssues}<br>
        <strong>Categories evaluated:</strong> ${enrichedCats.length}<br>
        <strong>Language:</strong> ${esc(lang === 'en' ? 'English' : lang)}
      </div>
      <div class="cover-categories">
        ${enrichedCats.map(cat => `
        <div class="cover-category-item">
          <span class="cover-category-name">${esc(cat.name)}</span>
          <span class="cover-category-score ${scoreColorClass(cat.score)}">${cat.score}</span>
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
      <span class="page-header-brand">${esc(brandName)}</span>
      <span class="page-header-center">Confidential</span>
      <span class="page-header-right">Page 2</span>
    </div>
    <div class="section-divider"></div>
    <h2 class="section-title">Executive Summary</h2>
    <p class="section-subtitle">High-level assessment and priority actions.</p>
    <div class="exec-summary">
      ${summaryParas.map(p => `<p>${esc(p.trim())}</p>`).join('\n')}
    </div>
    <div class="stat-row">
      <div class="stat-card stat-critical">
        <div class="stat-card-count text-red">${sevCounts.critical}</div>
        <div class="stat-card-label text-red">Critical</div>
      </div>
      <div class="stat-card stat-high">
        <div class="stat-card-count text-orange">${sevCounts.high}</div>
        <div class="stat-card-label text-orange">High</div>
      </div>
      <div class="stat-card stat-medium">
        <div class="stat-card-count text-amber">${sevCounts.medium}</div>
        <div class="stat-card-label text-amber">Medium</div>
      </div>
      <div class="stat-card stat-low">
        <div class="stat-card-count text-blue">${sevCounts.low}</div>
        <div class="stat-card-label text-blue">Low</div>
      </div>
    </div>
    <div class="rec-header">Top Priority Recommendations</div>
    <div class="rec-list">
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
      <span class="page-header-center">Confidential</span>
      <span class="page-header-right">Page 3</span>
    </div>
    <div class="section-divider"></div>
    <h2 class="section-title">Score Breakdown</h2>
    <p class="section-subtitle">Performance across ${enrichedCats.length} brand identity categories, weighted by importance.</p>
    <div class="score-legend">
      <div class="score-legend-item"><span class="score-legend-dot" style="background: var(--green);"></span> 70-100: Good</div>
      <div class="score-legend-item"><span class="score-legend-dot" style="background: var(--yellow);"></span> 40-69: Needs work</div>
      <div class="score-legend-item"><span class="score-legend-dot" style="background: var(--red);"></span> 0-39: Critical</div>
    </div>
`
  for (const cat of enrichedCats) {
    const weightPct = Math.round(cat.weight * 100)
    html += `
    <div class="category-group">
      <div class="category-header">
        <div class="category-header-left">
          <span class="category-header-name">${esc(cat.name)}</span>
          <span class="category-header-desc">${esc(cat.description.split('.')[0] || '')}</span>
        </div>
        <div>
          <span class="category-header-score ${scoreColorClass(cat.score)}">${cat.score}</span>
          <div class="category-weight">Weight: ${weightPct}%</div>
        </div>
      </div>
      <div class="category-bar-row">
        <div class="category-progress-bar"><div class="category-progress-fill" style="width: ${cat.score}%;"></div></div>
      </div>
      ${cat.summary ? `<div class="category-summary">${esc(cat.summary)}</div>` : ''}
    </div>
`
  }
  html += `  </div>\n`

  // ═══ PAGES 4+: DETAILED FINDINGS ═══
  const findingBlocks: string[] = []
  for (const cat of enrichedCats) {
    const catFindings = findingsByCategory[cat.name] || []
    if (catFindings.length === 0) continue
    catFindings.sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4))

    findingBlocks.push(`
    <div class="findings-category-label">
      ${esc(cat.name)}
      <span class="findings-category-count">${catFindings.length} finding${catFindings.length !== 1 ? 's' : ''}</span>
    </div>`)

    for (const f of catFindings) {
      const sev = (f.severity || 'medium').toLowerCase()
      findingBlocks.push(`
    <div class="finding-card">
      <div class="finding-card-top">
        <div class="finding-severity-bar ${sev}"></div>
        <div class="finding-content">
          <div class="finding-meta">
            <span class="severity-badge ${sev}">${esc(getSeverityLabel(sev, lang))}</span>
            <span class="finding-category">${esc(cat.name)}</span>
          </div>
          <div class="finding-title">${esc(f.title)}</div>
          <div class="finding-description">${esc(f.description)}</div>
          ${f.recommendation ? `
          <div class="finding-box finding-box-rec">
            <div class="finding-box-label">Recommendation</div>
            <div>${esc(f.recommendation)}</div>
          </div>` : ''}
          ${f.estimated_impact ? `
          <div class="finding-box finding-box-impact">
            <div class="finding-box-label">Expected Impact</div>
            <div>${esc(f.estimated_impact)}</div>
          </div>` : ''}
        </div>
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
    if (block.includes('finding-card')) {
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
      <span class="page-header-center">Confidential</span>
      <span class="page-header-right">Page ${pageNum}</span>
    </div>
    <div class="section-divider"></div>
    <h2 class="section-title">Detailed Findings</h2>
    <p class="section-subtitle">${i === 0 ? 'All issues ranked by severity, with recommendations and expected impact.' : 'Continued.'}</p>
    ${findingChunks[i].join('\n')}
  </div>
`
    pageNum++
  }

  // ═══ LAST PAGE: MATERIALS + FOOTER ═══
  const materialsList = materials && materials.length > 0 ? materials : []
  if (materialsList.length > 0 || true) {
    html += `
  <div class="page">
    <div class="page-header">
      <span class="page-header-brand">${esc(brandName)}</span>
      <span class="page-header-center">Confidential</span>
      <span class="page-header-right">Page ${pageNum}</span>
    </div>
`
    if (materialsList.length > 0) {
      html += `
    <div class="section-divider"></div>
    <h2 class="section-title">Materials Analysed</h2>
    <p class="section-subtitle">All documents evaluated during this brand audit.</p>
    <table class="materials-table">
      <thead>
        <tr>
          <th style="width: 50%;">Document</th>
          <th style="width: 25%;">Type</th>
          <th style="width: 25%;">Status</th>
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
    <div class="report-footer">
      <div class="footer-brand">${esc(company)}</div>
      <div class="footer-text">
        This report is confidential and intended for the recipient only.<br>
        Generated by ${esc(company)} &mdash; clearux.ai<br>
        &copy; ${new Date().getFullYear()} ${esc(company)}. All rights reserved.
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

/* ── Inline CSS ──────────────────────────────────────────── */
function getCss(): string {
  return `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --text: #111111; --text-body: #3D3D3D; --text-sec: #5C5C5C; --text-tert: #8A8A8A;
    --bg: #FFFFFF; --bg-alt: #F7F8F9; --bg-off: #F1F2F4;
    --border: #D4D4D4; --border-lt: #E9EAEC;
    --green: #16A34A; --green-bg: #F0FDF4;
    --yellow: #CA8A04; --yellow-bg: #FEFCE8;
    --red: #DC2626; --red-bg: #FEF2F2;
    --orange: #EA580C; --orange-bg: #FFF7ED;
    --blue: #2563EB; --blue-bg: #EFF6FF;
    --teal: #0D9488; --teal-bg: #F0FDFA;
    --amber: #B45309; --amber-bg: #FFFBEB;
    --brand-accent: #EA580C; --brand-accent-bg: #FFF7ED;
    --page-w: 210mm; --page-h: 297mm; --margin: 20mm; --content-w: 170mm;
  }
  @page { size: A4 portrait; margin: 20mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: var(--text-body); background: white; line-height: 1.55; font-size: 10pt; margin: 0; }
  .report { width: var(--page-w); margin: 0 auto; }
  .page { width: var(--page-w); min-height: var(--page-h); padding: var(--margin); background: var(--bg); position: relative; overflow: hidden; }
  @media print {
    .report { width: auto; padding: 0; }
    .page { width: auto; min-height: auto; padding: 0; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
  }
  h1, h2, h3, h4 { color: var(--text); font-weight: bold; line-height: 1.25; }
  h1 { font-size: 26pt; } h2 { font-size: 16pt; } h3 { font-size: 12pt; } h4 { font-size: 10pt; }
  p { margin-bottom: 2.5mm; }
  .page-header { display: flex; justify-content: space-between; align-items: center; font-size: 7.5pt; color: var(--text-tert); letter-spacing: 0.3pt; border-bottom: 0.5pt solid var(--border-lt); padding-bottom: 2.5mm; margin-bottom: 6mm; }
  .page-header-brand { font-weight: bold; color: var(--text-sec); text-transform: uppercase; letter-spacing: 1pt; font-size: 7.5pt; }
  .page-header-center { text-transform: uppercase; letter-spacing: 0.6pt; }
  .page-header-right { font-variant-numeric: tabular-nums; }
  .cover { text-align: center; padding-top: 28mm; }
  .cover-badge { display: inline-block; font-size: 8pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5pt; color: var(--brand-accent); border: 0.5pt solid var(--brand-accent); padding: 2mm 5mm; margin-bottom: 10mm; }
  .cover h1 { font-size: 28pt; margin-bottom: 1.5mm; letter-spacing: -0.5pt; }
  .cover-subtitle { font-size: 11pt; color: var(--text-sec); margin-bottom: 14mm; }
  .cover-score-block { margin-bottom: 4mm; }
  .cover-score-value { font-size: 56pt; font-weight: bold; line-height: 1; letter-spacing: -1.5pt; }
  .cover-score-max { font-size: 11pt; color: var(--text-tert); margin-top: 1mm; }
  .cover-score-bar { width: 50mm; height: 1.2mm; background: var(--bg-off); margin: 4mm auto 2.5mm; }
  .cover-score-bar-fill { height: 100%; }
  .cover-score-label { font-size: 10pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1pt; margin-bottom: 14mm; }
  .cover-meta { font-size: 9pt; color: var(--text-sec); margin-bottom: 12mm; line-height: 2; }
  .cover-meta strong { color: var(--text); }
  .cover-categories { border: 0.5pt solid var(--border); text-align: left; }
  .cover-category-item { display: flex; align-items: center; justify-content: space-between; padding: 3mm 4mm; border-bottom: 0.5pt solid var(--border-lt); }
  .cover-category-item:last-child { border-bottom: none; }
  .cover-category-name { font-size: 9pt; color: var(--text-body); }
  .cover-category-score { font-size: 12pt; font-weight: bold; line-height: 1; }
  .section-title { font-size: 16pt; font-weight: bold; color: var(--text); margin-bottom: 1.5mm; }
  .section-subtitle { font-size: 9pt; color: var(--text-sec); margin-bottom: 5mm; }
  .section-divider { height: 0.8mm; background: var(--text); margin-bottom: 4mm; width: 12mm; }
  .exec-summary { font-size: 10pt; line-height: 1.7; color: var(--text-body); margin-bottom: 6mm; }
  .exec-summary p { margin-bottom: 3mm; }
  .stat-row { display: flex; gap: 0; margin-bottom: 6mm; border: 0.5pt solid var(--border); }
  .stat-card { flex: 1; padding: 4mm 3mm; text-align: center; border-right: 0.5pt solid var(--border-lt); }
  .stat-card:last-child { border-right: none; }
  .stat-card-count { font-size: 20pt; font-weight: bold; line-height: 1; margin-bottom: 1mm; }
  .stat-card-label { font-size: 7pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5pt; }
  .stat-critical { background: var(--red-bg); } .stat-high { background: var(--orange-bg); }
  .stat-medium { background: var(--amber-bg); } .stat-low { background: var(--blue-bg); }
  .rec-header { font-size: 12pt; font-weight: bold; color: var(--text); margin-bottom: 3.5mm; }
  .rec-list { margin-bottom: 5mm; }
  .rec-item { display: flex; gap: 3mm; padding: 3.5mm 4mm; border-left: 1mm solid var(--brand-accent); background: var(--brand-accent-bg); margin-bottom: 2mm; align-items: flex-start; }
  .rec-num { flex-shrink: 0; font-size: 13pt; font-weight: bold; color: var(--text); line-height: 1.3; min-width: 5mm; }
  .rec-text { font-size: 9pt; color: var(--text-body); line-height: 1.55; }
  .score-legend { display: flex; gap: 6mm; padding: 3mm 4mm; background: var(--bg-alt); border: 0.5pt solid var(--border-lt); margin-bottom: 5mm; font-size: 8pt; color: var(--text-sec); }
  .score-legend-item { display: flex; align-items: center; gap: 1.5mm; }
  .score-legend-dot { width: 2.5mm; height: 2.5mm; display: inline-block; }
  .category-group { margin-bottom: 5mm; }
  .category-header { display: flex; align-items: center; justify-content: space-between; padding: 3.5mm 4mm; border: 0.5pt solid var(--border); background: var(--brand-accent-bg); }
  .category-header-left { display: flex; flex-direction: column; gap: 0.5mm; }
  .category-header-name { font-size: 11pt; font-weight: bold; color: var(--text); }
  .category-header-desc { font-size: 7.5pt; font-weight: normal; color: var(--text-sec); max-width: 120mm; line-height: 1.4; }
  .category-header-score { font-size: 20pt; font-weight: bold; line-height: 1; }
  .category-weight { font-size: 7pt; color: var(--text-tert); text-align: right; margin-top: 1mm; }
  .category-bar-row { padding: 3mm 4mm; border: 0.5pt solid var(--border-lt); border-top: none; }
  .category-progress-bar { width: 100%; height: 2.5mm; background: var(--bg-off); }
  .category-progress-fill { height: 100%; background: var(--brand-accent); }
  .category-summary { padding: 3mm 4mm; border: 0.5pt solid var(--border-lt); border-top: none; font-size: 8.5pt; color: var(--text-sec); line-height: 1.5; background: var(--bg-alt); }
  .findings-category-label { font-size: 10pt; font-weight: bold; color: var(--text); margin-top: 5mm; margin-bottom: 3mm; padding-bottom: 1.5mm; border-bottom: 0.6mm solid var(--brand-accent); display: flex; justify-content: space-between; align-items: center; }
  .findings-category-label:first-child { margin-top: 0; }
  .findings-category-count { font-size: 7.5pt; font-weight: normal; color: var(--text-tert); }
  .finding-card { border: 0.5pt solid var(--border); margin-bottom: 3.5mm; overflow: hidden; }
  .finding-card-top { display: flex; }
  .finding-severity-bar { width: 1.2mm; flex-shrink: 0; }
  .finding-severity-bar.critical { background: var(--red); } .finding-severity-bar.high { background: var(--orange); }
  .finding-severity-bar.medium { background: var(--yellow); } .finding-severity-bar.low { background: var(--blue); }
  .finding-content { flex: 1; padding: 3.5mm 4mm; }
  .finding-meta { display: flex; align-items: center; gap: 2.5mm; margin-bottom: 1.5mm; }
  .severity-badge { font-size: 7pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3pt; padding: 0.8mm 2mm; line-height: 1; }
  .severity-badge.critical { background: var(--red-bg); color: var(--red); }
  .severity-badge.high { background: var(--orange-bg); color: var(--orange); }
  .severity-badge.medium { background: var(--amber-bg); color: var(--amber); }
  .severity-badge.low { background: var(--blue-bg); color: var(--blue); }
  .finding-category { font-size: 8pt; color: var(--text-tert); }
  .finding-title { font-size: 10.5pt; font-weight: bold; color: var(--text); line-height: 1.35; margin-bottom: 2mm; }
  .finding-description { font-size: 9pt; color: var(--text-body); line-height: 1.6; margin-bottom: 3mm; }
  .finding-box { padding: 2.5mm 3.5mm; margin-bottom: 2mm; font-size: 8.5pt; line-height: 1.5; }
  .finding-box:last-child { margin-bottom: 0; }
  .finding-box-label { font-size: 7pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.4pt; margin-bottom: 1mm; }
  .finding-box-rec { background: var(--bg-off); border: 0.5pt solid var(--border-lt); }
  .finding-box-rec .finding-box-label { color: var(--text-sec); }
  .finding-box-impact { background: var(--teal-bg); border: 0.5pt solid #99F6E4; }
  .finding-box-impact .finding-box-label { color: var(--teal); }
  .materials-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .materials-table th { text-align: left; font-size: 7.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.4pt; color: var(--text-sec); padding: 2.5mm 3mm; border-bottom: 0.6mm solid var(--border); background: var(--bg-alt); }
  .materials-table td { padding: 2.5mm 3mm; border-bottom: 0.5pt solid var(--border-lt); color: var(--text-body); }
  .materials-table tr:last-child td { border-bottom: none; }
  .materials-table .file-type { font-size: 8pt; color: var(--text-tert); }
  .materials-table .status-ok { color: var(--green); font-weight: bold; font-size: 8pt; }
  .report-footer { text-align: center; margin-top: 15mm; }
  .footer-brand { font-size: 10pt; font-weight: bold; color: var(--text); text-transform: uppercase; letter-spacing: 1.5pt; margin-bottom: 2mm; }
  .footer-text { font-size: 8pt; color: var(--text-tert); line-height: 1.8; }
  .method-note { margin-top: 5mm; padding: 3mm 4mm; border-left: 0.8mm solid var(--border); font-size: 8pt; color: var(--text-sec); line-height: 1.6; }
  .text-green { color: var(--green); } .text-yellow { color: var(--yellow); } .text-red { color: var(--red); }
  .text-orange { color: var(--orange); } .text-blue { color: var(--blue); } .text-teal { color: var(--teal); }
  .text-amber { color: var(--amber); } .text-brand { color: var(--brand-accent); }
  `
}
