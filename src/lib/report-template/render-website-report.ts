// ============================================================
// ClearUX — Website Audit HTML Report Renderer
// Takes audit data and returns a populated HTML string
// based on the canonical report-template.html.
// ============================================================

import { CHECKPOINT_LABELS } from '@/lib/audit-checkpoints'
import { getScoreLabel, getSeverityLabel } from '@/lib/languages'

/* ── Pillar definitions ────────────────────────────────────── */
const PILLAR_DEFS = [
  { key: 'Foundation',            color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', textClass: 'text-purple' },
  { key: 'Human Experience',      color: '#DB2777', bg: '#FDF2F8', border: '#FBCFE8', textClass: 'text-pink' },
  { key: 'Inclusive Design',      color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', textClass: 'text-amber' },
  { key: 'Future Readiness',      color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4', textClass: 'text-teal' },
  { key: 'SEO Structure & Rules', color: '#4338CA', bg: '#EEF2FF', border: '#C7D2FE', textClass: 'text-indigo' },
  { key: 'Brand Consistency',     color: '#475569', bg: '#F8FAFC', border: '#CBD5E1', textClass: 'text-slate' },
]

/* ── Category-to-finding keyword matching (same as PDF/DOCX) ─ */
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
  9: ['cognitive', 'neurodiversity', 'plain language', 'simple', 'cognitive load', 'learning', 'attention', 'memory', 'dyslexia'],
  10: ['wellbeing', 'well-being', 'responsible', 'addictive', 'dark pattern', 'notification overload', 'screen time', 'digital health', 'consent fatigue'],
  11: ['responsive', 'mobile', 'tablet', 'breakpoint', 'viewport', 'touch', 'adaptive', 'device'],
  12: ['performance', 'speed', 'page load', 'core web vital', 'lcp', 'cls', 'fid', 'optimize', 'compress', 'lazy', 'loading'],
  13: ['ai', 'llm', 'discoverability', 'machine-readable', 'chatbot', 'generative', 'ai-ready', 'llm-friendly'],
  14: ['ai agent', 'agent-ready', 'automation', 'tool use', 'api', 'programmatic', 'structured action'],
  15: ['cultural', 'global', 'localization', 'i18n', 'internationalization', 'rtl', 'translation', 'regional', 'diverse'],
  16: ['seo', 'search engine', 'meta', 'title tag', 'description', 'heading structure', 'h1', 'h2', 'schema', 'structured data', 'canonical'],
  17: ['local seo', 'schema markup', 'rich snippet', 'open graph', 'social media', 'twitter card', 'og:'],
  18: ['keyword', 'search intent', 'content gap', 'long-tail', 'topic cluster', 'semantic'],
  19: ['link', 'backlink', 'internal link', 'anchor text', 'broken link', '404', 'redirect', 'crawl'],
  20: ['brand consistency', 'brand identity', 'logo', 'brand color', 'brand voice', 'brand guideline'],
  21: ['brand experience', 'brand story', 'mission', 'about page', 'company value'],
  22: ['brand visual', 'icon style', 'illustration', 'imagery', 'photo style', 'brand asset'],
  23: ['brand communication', 'brand tone', 'brand language', 'brand message', 'tagline'],
}

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
  pages: Array<{ url: string; title: string; status_code?: number }>
  topRecommendations: string[]
  /** Checkpoint results keyed by category name → array of { label, status } */
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

  const brandName = whiteLabel?.companyName || 'ClearUX'
  const lang = language || 'en'

  // Build pillar groups from category scores (4 categories per pillar)
  const pillarGroups = PILLAR_DEFS.map((def, idx) => {
    const cats = categoryScores.slice(idx * 4, idx * 4 + 4)
    const avg = cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 0
    return { ...def, cats, avg }
  })

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

  // Severity counts
  const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const f of findings) {
    const s = (f.severity || 'medium').toLowerCase() as keyof typeof sevCounts
    if (s in sevCounts) sevCounts[s]++
  }

  // Build checkpoint HTML for a category
  function checkpointsHtml(catName: string, pillarColor: string): string {
    const labels = CHECKPOINT_LABELS[catName]
    if (!labels) return ''
    const results = checkpointResults?.[catName]
    const items = labels.map((label, i) => {
      const status = results?.[i]?.status || 'pass'
      const iconClass = status === 'pass' ? 'ck-pass' : status === 'warn' ? 'ck-warn' : 'ck-fail'
      const icon = status === 'pass' ? '&#10003;' : status === 'fail' ? '&#10007;' : '&#9679;'
      return `<div class="checkpoint"><span class="ck-icon ${iconClass}">${icon}</span> ${esc(label)}</div>`
    })
    return `<div class="checkpoint-row">${items.join('\n')}</div>`
  }

  // ── Build pages ──────────────────────────────────────────

  // CSS (read from the template file, embedded inline)
  const css = getCss()

  let html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(brandName)} Audit Report — ${esc(domain)}</title>
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
      <span class="page-header-center">Confidential</span>
      <span class="page-header-right">Page 1</span>
    </div>
    <div class="cover">
      <div class="cover-badge">UX Audit Report</div>
      <h1>${esc(domain)}</h1>
      <div class="cover-url">${esc(productUrl)}</div>
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
        <strong>Categories evaluated:</strong> ${categoryScores.length} across ${pillarGroups.length} pillars<br>
        <strong>Checkpoints verified:</strong> ${categoryScores.length * 4}<br>
        <strong>Language:</strong> ${esc(lang === 'en' ? 'English' : lang)}
      </div>
      <div class="cover-pillars">
        ${pillarGroups.map(p => `
        <div class="cover-pillar">
          <span class="cover-pillar-score ${p.textClass}">${p.avg}</span>
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
      This report was generated by ${esc(brandName)}'s AI-powered audit engine. Each category is scored against specific checkpoints derived from industry standards including WCAG 2.1, Nielsen Norman heuristics, and modern SEO best practices.
    </div>
  </div>
`

  // ═══ PAGES 3-5: SCORE BREAKDOWN (2 pillars per page) ═══
  let pageNum = 3
  for (let pairIdx = 0; pairIdx < pillarGroups.length; pairIdx += 2) {
    const pair = pillarGroups.slice(pairIdx, pairIdx + 2)
    const isFirst = pairIdx === 0

    html += `
  <div class="page">
    <div class="page-header">
      <span class="page-header-brand">${esc(domain)}</span>
      <span class="page-header-center">Confidential</span>
      <span class="page-header-right">Page ${pageNum}</span>
    </div>
    <div class="section-divider"></div>
    <h2 class="section-title">Score Breakdown</h2>
    <p class="section-subtitle">${isFirst ? `Performance across ${pillarGroups.length} UX pillars and ${categoryScores.length} categories, evaluated against ${categoryScores.length * 4} checkpoints.` : 'Continued.'}</p>
    ${isFirst ? `
    <div class="score-legend">
      <div class="score-legend-item"><span class="score-legend-dot" style="background: var(--green);"></span> 70-100: Good</div>
      <div class="score-legend-item"><span class="score-legend-dot" style="background: var(--yellow);"></span> 40-69: Needs work</div>
      <div class="score-legend-item"><span class="score-legend-dot" style="background: var(--red);"></span> 0-39: Critical</div>
    </div>` : ''}
`

    for (const pillar of pair) {
      html += `
    <div class="pillar-group">
      <div class="pillar-header" style="background: ${pillar.bg}; border-color: ${pillar.border};">
        <div class="pillar-header-left">
          <span class="pillar-header-name ${pillar.textClass}">${esc(pillar.key)}</span>
          <span class="pillar-header-desc ${pillar.textClass}">${pillar.cats.length} categories &middot; ${pillar.cats.length * 4} checkpoints</span>
        </div>
        <span class="pillar-header-score ${pillar.textClass}">${pillar.avg}</span>
      </div>
`
      for (const cat of pillar.cats) {
        html += `
      <div class="category-row">
        <span class="category-name">${esc(cat.name)}</span>
        <div class="category-bar"><div class="category-bar-fill" style="width: ${cat.score}%; background: ${pillar.color};"></div></div>
        <span class="category-score ${scoreColorClass(cat.score)}">${cat.score}</span>
      </div>
      ${checkpointsHtml(cat.name, pillar.color)}
`
      }
      html += `    </div>\n`
    }

    html += `  </div>\n`
    pageNum++
  }

  // ═══ PAGES 6+: DETAILED FINDINGS ═══
  // Collect all findings pages
  const findingBlocks: string[] = []
  const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

  for (const pillar of pillarGroups) {
    const pillarFindings = findingMap[pillar.key] || {}
    const hasFindings = Object.values(pillarFindings).some(arr => arr.length > 0)
    if (!hasFindings) continue

    findingBlocks.push(`<div class="findings-pillar-label" style="border-bottom-color: ${pillar.color}; color: ${pillar.color};">${esc(pillar.key)}</div>`)

    for (const [catName, catFindings] of Object.entries(pillarFindings)) {
      if (catFindings.length === 0) continue
      catFindings.sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4))

      findingBlocks.push(`
    <div class="findings-category-label">
      ${esc(catName)}
      <span class="findings-category-count">${catFindings.length} finding${catFindings.length !== 1 ? 's' : ''}</span>
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
    <div class="finding-card">
      <div class="finding-card-top">
        <div class="finding-severity-bar ${sev}"></div>
        <div class="finding-content">
          <div class="finding-meta">
            <span class="severity-badge ${sev}">${esc(getSeverityLabel(sev, lang))}</span>
            ${pageDisplay ? `<span class="finding-page">${esc(pageDisplay)}</span>` : ''}
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
  }

  // Split findings across pages (rough estimate: ~4-5 findings per page)
  const FINDINGS_PER_PAGE = 4
  const findingChunks: string[][] = []
  let currentChunk: string[] = []
  let findingCount = 0
  for (const block of findingBlocks) {
    currentChunk.push(block)
    if (block.includes('finding-card')) {
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

  // ═══ LAST PAGE: PAGES ANALYSED ═══
  if (pages.length > 0) {
    html += `
  <div class="page">
    <div class="page-header">
      <span class="page-header-brand">${esc(domain)}</span>
      <span class="page-header-center">Confidential</span>
      <span class="page-header-right">Page ${pageNum}</span>
    </div>
    <div class="section-divider"></div>
    <h2 class="section-title">Pages Analysed</h2>
    <p class="section-subtitle">All pages crawled and evaluated during this audit.</p>
    <table class="pages-table">
      <thead>
        <tr>
          <th style="width: 30%;">Page</th>
          <th style="width: 55%;">URL</th>
          <th style="width: 15%;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${pages.map(pg => `
        <tr>
          <td>${esc(pg.title || 'Untitled')}</td>
          <td class="page-url">${esc(pg.url)}</td>
          <td><span class="status-ok">${pg.status_code || 200} OK</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="report-footer">
      <div class="footer-brand">${esc(brandName)}</div>
      <div class="footer-text">
        This report is confidential and intended for the recipient only.<br>
        Generated by ${esc(brandName)} &mdash; clearux.ai<br>
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

/* ── Inline CSS (extracted from report-template.html) ─────── */
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
    --purple: #7C3AED; --purple-bg: #F5F3FF;
    --pink: #DB2777; --pink-bg: #FDF2F8;
    --teal: #0D9488; --teal-bg: #F0FDFA;
    --amber: #B45309; --amber-bg: #FFFBEB;
    --indigo: #4338CA; --indigo-bg: #EEF2FF;
    --slate: #475569; --slate-bg: #F8FAFC;
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
  .cover-badge { display: inline-block; font-size: 8pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5pt; color: var(--text-sec); border: 0.5pt solid var(--border); padding: 2mm 5mm; margin-bottom: 10mm; }
  .cover h1 { font-size: 28pt; margin-bottom: 1.5mm; letter-spacing: -0.5pt; }
  .cover-url { font-size: 11pt; color: var(--text-sec); margin-bottom: 14mm; }
  .cover-score-block { margin-bottom: 4mm; }
  .cover-score-value { font-size: 56pt; font-weight: bold; line-height: 1; letter-spacing: -1.5pt; }
  .cover-score-max { font-size: 11pt; color: var(--text-tert); margin-top: 1mm; }
  .cover-score-bar { width: 50mm; height: 1.2mm; background: var(--bg-off); margin: 4mm auto 2.5mm; }
  .cover-score-bar-fill { height: 100%; }
  .cover-score-label { font-size: 10pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1pt; margin-bottom: 14mm; }
  .cover-meta { font-size: 9pt; color: var(--text-sec); margin-bottom: 12mm; line-height: 2; }
  .cover-meta strong { color: var(--text); }
  .cover-pillars { display: flex; border: 0.5pt solid var(--border); }
  .cover-pillar { flex: 1; text-align: center; padding: 4mm 2mm; border-right: 0.5pt solid var(--border-lt); }
  .cover-pillar:last-child { border-right: none; }
  .cover-pillar-score { font-size: 16pt; font-weight: bold; line-height: 1; display: block; margin-bottom: 1.5mm; }
  .cover-pillar-name { font-size: 6.5pt; color: var(--text-sec); line-height: 1.3; text-transform: uppercase; letter-spacing: 0.3pt; }
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
  .rec-item { display: flex; gap: 3mm; padding: 3.5mm 4mm; border-left: 1mm solid var(--text); background: var(--bg-alt); margin-bottom: 2mm; align-items: flex-start; }
  .rec-num { flex-shrink: 0; font-size: 13pt; font-weight: bold; color: var(--text); line-height: 1.3; min-width: 5mm; }
  .rec-text { font-size: 9pt; color: var(--text-body); line-height: 1.55; }
  .score-legend { display: flex; gap: 6mm; padding: 3mm 4mm; background: var(--bg-alt); border: 0.5pt solid var(--border-lt); margin-bottom: 5mm; font-size: 8pt; color: var(--text-sec); }
  .score-legend-item { display: flex; align-items: center; gap: 1.5mm; }
  .score-legend-dot { width: 2.5mm; height: 2.5mm; display: inline-block; }
  .pillar-group { margin-bottom: 6mm; }
  .pillar-header { display: flex; align-items: center; justify-content: space-between; padding: 3mm 4mm; margin-bottom: 0; border: 0.5pt solid var(--border); }
  .pillar-header-left { display: flex; flex-direction: column; gap: 0.5mm; }
  .pillar-header-name { font-size: 11pt; font-weight: bold; }
  .pillar-header-desc { font-size: 7.5pt; font-weight: normal; }
  .pillar-header-score { font-size: 20pt; font-weight: bold; line-height: 1; }
  .category-row { display: flex; align-items: center; gap: 3mm; padding: 2.5mm 4mm; border-bottom: 0.5pt solid var(--border-lt); border-left: 0.5pt solid var(--border-lt); border-right: 0.5pt solid var(--border-lt); }
  .category-name { flex: 1; font-size: 9pt; color: var(--text-body); }
  .category-bar { width: 25mm; height: 2mm; background: var(--bg-off); flex-shrink: 0; overflow: hidden; }
  .category-bar-fill { height: 100%; }
  .category-score { font-size: 9.5pt; font-weight: bold; width: 8mm; text-align: right; flex-shrink: 0; }
  .checkpoint-row { display: flex; flex-wrap: wrap; gap: 0.5mm 5mm; padding: 1.5mm 4mm 2.5mm; border-left: 0.5pt solid var(--border-lt); border-right: 0.5pt solid var(--border-lt); border-bottom: 0.5pt solid var(--border-lt); background: var(--bg-alt); }
  .checkpoint { display: flex; align-items: center; gap: 1.5mm; font-size: 7.5pt; color: var(--text-sec); width: calc(50% - 2.5mm); padding: 0.5mm 0; }
  .ck-pass { color: var(--green); } .ck-warn { color: var(--yellow); } .ck-fail { color: var(--red); }
  .ck-icon { font-weight: bold; width: 3.5mm; flex-shrink: 0; text-align: center; }
  .findings-pillar-label { font-size: 8pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1pt; padding: 2mm 0; margin-top: 6mm; margin-bottom: 1mm; border-bottom: 0.6mm solid var(--text); }
  .findings-pillar-label:first-child { margin-top: 0; }
  .findings-category-label { font-size: 10pt; font-weight: bold; color: var(--text); margin-top: 4mm; margin-bottom: 3mm; padding-bottom: 1.5mm; border-bottom: 0.5pt solid var(--border-lt); display: flex; justify-content: space-between; align-items: center; }
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
  .finding-page { font-size: 8pt; color: var(--text-tert); }
  .finding-title { font-size: 10.5pt; font-weight: bold; color: var(--text); line-height: 1.35; margin-bottom: 2mm; }
  .finding-description { font-size: 9pt; color: var(--text-body); line-height: 1.6; margin-bottom: 3mm; }
  .finding-box { padding: 2.5mm 3.5mm; margin-bottom: 2mm; font-size: 8.5pt; line-height: 1.5; }
  .finding-box:last-child { margin-bottom: 0; }
  .finding-box-label { font-size: 7pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.4pt; margin-bottom: 1mm; }
  .finding-box-rec { background: var(--bg-off); border: 0.5pt solid var(--border-lt); }
  .finding-box-rec .finding-box-label { color: var(--text-sec); }
  .finding-box-impact { background: var(--teal-bg); border: 0.5pt solid #99F6E4; }
  .finding-box-impact .finding-box-label { color: var(--teal); }
  .pages-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .pages-table th { text-align: left; font-size: 7.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.4pt; color: var(--text-sec); padding: 2.5mm 3mm; border-bottom: 0.6mm solid var(--border); background: var(--bg-alt); }
  .pages-table td { padding: 2.5mm 3mm; border-bottom: 0.5pt solid var(--border-lt); color: var(--text-body); }
  .pages-table tr:last-child td { border-bottom: none; }
  .pages-table .page-url { font-size: 8pt; color: var(--text-tert); }
  .pages-table .status-ok { color: var(--green); font-weight: bold; font-size: 8pt; }
  .report-footer { text-align: center; margin-top: 15mm; }
  .footer-brand { font-size: 10pt; font-weight: bold; color: var(--text); text-transform: uppercase; letter-spacing: 1.5pt; margin-bottom: 2mm; }
  .footer-text { font-size: 8pt; color: var(--text-tert); line-height: 1.8; }
  .method-note { margin-top: 5mm; padding: 3mm 4mm; border-left: 0.8mm solid var(--border); font-size: 8pt; color: var(--text-sec); line-height: 1.6; }
  .text-green { color: var(--green); } .text-yellow { color: var(--yellow); } .text-red { color: var(--red); }
  .text-orange { color: var(--orange); } .text-blue { color: var(--blue); } .text-purple { color: var(--purple); }
  .text-pink { color: var(--pink); } .text-teal { color: var(--teal); } .text-amber { color: var(--amber); }
  .text-indigo { color: var(--indigo); } .text-slate { color: var(--slate); }
  `
}
