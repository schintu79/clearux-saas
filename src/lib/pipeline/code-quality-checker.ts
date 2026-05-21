// ============================================================
// ClearUX Code Quality Checker
// ============================================================
// Lightweight HTML & CSS syntax checker. Operates on raw HTML strings
// (no external dependencies — pure regex / stack-based parsing).
//
// Two entry points:
//  1. `runCodeQualityChecks(html)` — audit-time, full-page scan
//  2. `validateHtmlCss(content)` — pre-deploy, patched file check
//
// Output is JSON-serialisable for persistence in audit_pages.
// ============================================================

/* ── Result types ──────────────────────────────────────────── */

export interface CodeIssue {
  type: 'error' | 'warning'
  category: 'html' | 'css'
  rule: string
  message: string
  /** Approximate line number (1-based), null if unknown */
  line: number | null
  /** The offending snippet (truncated) */
  snippet: string | null
}

export interface CodeQualityResult {
  url: string
  html: {
    errors: number
    warnings: number
    issues: CodeIssue[]
  }
  css: {
    errors: number
    warnings: number
    issues: CodeIssue[]
  }
  /** Overall health: good (0 errors), needs_improvement (1-3 errors), poor (4+) */
  rating: 'good' | 'needs_improvement' | 'poor'
}

export interface PreDeployValidation {
  valid: boolean
  errors: CodeIssue[]
  warnings: CodeIssue[]
}

/* ── Helpers ───────────────────────────────────────────────── */

function lineOf(html: string, idx: number): number {
  let line = 1
  for (let i = 0; i < idx && i < html.length; i++) {
    if (html[i] === '\n') line++
  }
  return line
}

function snip(html: string, idx: number, len = 60): string {
  const start = Math.max(0, idx - 10)
  const end = Math.min(html.length, idx + len)
  let s = html.slice(start, end).replace(/\s+/g, ' ').trim()
  if (s.length > 80) s = s.slice(0, 77) + '...'
  return s
}

/* ── HTML checks ───────────────────────────────────────────── */

/** Tags that are self-closing (void elements) — don't need a closing tag */
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

/** Tags we skip in nesting checks (inline, formatting, etc.) */
const SKIP_NESTING_TAGS = new Set([
  'svg', 'math', 'template', 'foreignobject',
])

function checkHtmlStructure(html: string): CodeIssue[] {
  const issues: CodeIssue[] = []

  // 1. Missing doctype
  if (html.trim().length > 100 && !html.match(/<!DOCTYPE\s+html/i)) {
    issues.push({
      type: 'warning', category: 'html', rule: 'missing-doctype',
      message: 'Missing <!DOCTYPE html> declaration.',
      line: 1, snippet: html.slice(0, 60).trim(),
    })
  }

  // 2. Unclosed / mismatched tags via stack
  const stack: { tag: string; idx: number }[] = []
  // Match opening tags, closing tags, and self-closing tags
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?\/?>/g
  let m: RegExpExecArray | null

  // Track if we're inside <script>, <style>, <pre>, <code>, <textarea> — skip inner content
  let skipUntil: string | null = null

  while ((m = tagRe.exec(html)) !== null) {
    const fullMatch = m[0]
    const tagName = m[1].toLowerCase()
    const isClosing = fullMatch.startsWith('</')
    const isSelfClosing = fullMatch.endsWith('/>') || VOID_TAGS.has(tagName)

    // Skip content inside raw text elements
    if (skipUntil) {
      if (isClosing && tagName === skipUntil) {
        skipUntil = null
        // Pop the matching opening tag
        if (stack.length > 0 && stack[stack.length - 1].tag === tagName) {
          stack.pop()
        }
      }
      continue
    }

    if (SKIP_NESTING_TAGS.has(tagName)) continue

    if (isClosing) {
      // Find matching opening tag
      let found = false
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tagName) {
          // Report any unclosed tags between this and the match
          for (let j = stack.length - 1; j > i; j--) {
            issues.push({
              type: 'error', category: 'html', rule: 'unclosed-tag',
              message: `Unclosed <${stack[j].tag}> tag (closed by </${tagName}> at line ${lineOf(html, m.index)}).`,
              line: lineOf(html, stack[j].idx),
              snippet: snip(html, stack[j].idx),
            })
          }
          stack.splice(i)
          found = true
          break
        }
      }
      if (!found) {
        issues.push({
          type: 'error', category: 'html', rule: 'unexpected-closing-tag',
          message: `Unexpected closing tag </${tagName}> — no matching opening tag found.`,
          line: lineOf(html, m.index),
          snippet: snip(html, m.index),
        })
      }
    } else if (!isSelfClosing) {
      stack.push({ tag: tagName, idx: m.index })
      // Enter raw text mode for script/style/textarea
      if (tagName === 'script' || tagName === 'style' || tagName === 'textarea' || tagName === 'pre') {
        skipUntil = tagName
      }
    }
  }

  // Remaining unclosed tags (ignore html, head, body — browsers auto-close)
  const autoClose = new Set(['html', 'head', 'body', 'p', 'li', 'td', 'th', 'tr', 'dd', 'dt', 'option', 'colgroup', 'thead', 'tbody', 'tfoot'])
  for (const item of stack) {
    if (!autoClose.has(item.tag)) {
      issues.push({
        type: 'error', category: 'html', rule: 'unclosed-tag',
        message: `Unclosed <${item.tag}> tag — no matching closing tag found.`,
        line: lineOf(html, item.idx),
        snippet: snip(html, item.idx),
      })
    }
  }

  return issues
}

function checkHtmlAttributes(html: string): CodeIssue[] {
  const issues: CodeIssue[] = []

  // 3. Duplicate IDs
  const idRe = /\bid\s*=\s*["']([^"']+)["']/gi
  const ids = new Map<string, number>()
  let m: RegExpExecArray | null
  while ((m = idRe.exec(html)) !== null) {
    const id = m[1]
    if (ids.has(id)) {
      issues.push({
        type: 'error', category: 'html', rule: 'duplicate-id',
        message: `Duplicate id="${id}" — IDs must be unique per page.`,
        line: lineOf(html, m.index),
        snippet: snip(html, m.index),
      })
    } else {
      ids.set(id, m.index)
    }
  }

  // 4. Unquoted attribute values (risky)
  const unquotedRe = /\b([a-zA-Z-]+)\s*=\s*([^\s"'>][^\s>]*)/g
  while ((m = unquotedRe.exec(html)) !== null) {
    const attr = m[1].toLowerCase()
    const val = m[2]
    // Skip common false positives (boolean attrs, etc.)
    if (['class', 'id', 'href', 'src', 'style', 'action', 'data', 'content', 'name', 'value', 'alt', 'title', 'type', 'rel'].includes(attr) && val.length > 1 && !val.startsWith('"') && !val.startsWith("'")) {
      issues.push({
        type: 'warning', category: 'html', rule: 'unquoted-attribute',
        message: `Attribute ${attr}=${val} should use quotes.`,
        line: lineOf(html, m.index),
        snippet: snip(html, m.index),
      })
    }
  }

  // 5. Deprecated tags
  const deprecated = ['font', 'center', 'marquee', 'blink', 'strike', 'big', 'tt', 'frame', 'frameset', 'applet']
  for (const tag of deprecated) {
    const re = new RegExp(`<${tag}\\b`, 'gi')
    while ((m = re.exec(html)) !== null) {
      issues.push({
        type: 'warning', category: 'html', rule: 'deprecated-tag',
        message: `Deprecated <${tag}> tag — use modern CSS/HTML instead.`,
        line: lineOf(html, m.index),
        snippet: snip(html, m.index),
      })
    }
  }

  // 6. Images without width/height (CLS risk)
  const imgRe = /<img\b([^>]*)>/gi
  while ((m = imgRe.exec(html)) !== null) {
    const attrs = m[1]
    if (!attrs.match(/\bwidth\s*=/i) && !attrs.match(/\bheight\s*=/i)) {
      issues.push({
        type: 'warning', category: 'html', rule: 'img-missing-dimensions',
        message: 'Image missing width/height attributes — causes layout shift (CLS).',
        line: lineOf(html, m.index),
        snippet: snip(html, m.index),
      })
    }
  }

  return issues
}

/* ── CSS checks ────────────────────────────────────────────── */

function extractInlineAndEmbeddedCss(html: string): { css: string; offset: number }[] {
  const blocks: { css: string; offset: number }[] = []

  // <style> blocks
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
  let m: RegExpExecArray | null
  while ((m = styleRe.exec(html)) !== null) {
    blocks.push({ css: m[1], offset: m.index })
  }

  // Inline style attributes
  const inlineRe = /\bstyle\s*=\s*"([^"]*)"/gi
  while ((m = inlineRe.exec(html)) !== null) {
    blocks.push({ css: m[1], offset: m.index })
  }

  return blocks
}

function checkCssSyntax(css: string, globalOffset: number, html: string): CodeIssue[] {
  const issues: CodeIssue[] = []

  // 1. Unclosed braces
  let depth = 0
  let lastOpenIdx = 0
  for (let i = 0; i < css.length; i++) {
    // Skip strings
    if (css[i] === '"' || css[i] === "'") {
      const q = css[i]
      i++
      while (i < css.length && css[i] !== q) {
        if (css[i] === '\\') i++ // skip escaped char
        i++
      }
      continue
    }
    // Skip comments
    if (css[i] === '/' && css[i + 1] === '*') {
      i += 2
      while (i < css.length - 1 && !(css[i] === '*' && css[i + 1] === '/')) i++
      i++ // skip the /
      continue
    }
    if (css[i] === '{') { depth++; lastOpenIdx = i }
    if (css[i] === '}') { depth-- }
    if (depth < 0) {
      issues.push({
        type: 'error', category: 'css', rule: 'unexpected-closing-brace',
        message: 'Unexpected closing brace } — no matching opening brace.',
        line: lineOf(html, globalOffset + i),
        snippet: snip(css, i),
      })
      depth = 0
    }
  }
  if (depth > 0) {
    issues.push({
      type: 'error', category: 'css', rule: 'unclosed-brace',
      message: `Unclosed CSS brace — ${depth} opening brace(s) never closed.`,
      line: lineOf(html, globalOffset + lastOpenIdx),
      snippet: snip(css, lastOpenIdx),
    })
  }

  // 2. Missing semicolons (heuristic — check for property: value\n property: pattern)
  const missingSemiRe = /:\s*[^;{}]+\n\s*[a-zA-Z-]+\s*:/g
  let sm: RegExpExecArray | null
  while ((sm = missingSemiRe.exec(css)) !== null) {
    // Only flag if it doesn't end with a semicolon before the newline
    const block = sm[0]
    const nlIdx = block.indexOf('\n')
    const beforeNl = block.slice(0, nlIdx).trimEnd()
    if (!beforeNl.endsWith(';') && !beforeNl.endsWith('{')) {
      issues.push({
        type: 'warning', category: 'css', rule: 'missing-semicolon',
        message: 'Possible missing semicolon in CSS declaration.',
        line: lineOf(html, globalOffset + sm.index),
        snippet: snip(css, sm.index),
      })
    }
  }

  // 3. Invalid property values (common typos)
  const badValues = [
    { re: /:\s*px\b/g, msg: 'Missing numeric value before px unit.' },
    { re: /:\s*(\d+)\s+(px|em|rem|%|vh|vw)\b/g, msg: 'Space between number and unit — should be joined (e.g. 10px not 10 px).' },
    { re: /color\s*:\s*#([0-9a-fA-F]{1,2}|[0-9a-fA-F]{5}|[0-9a-fA-F]{7,})\s*[;}]/g, msg: 'Invalid hex color — should be 3, 4, 6, or 8 hex digits.' },
  ]
  for (const { re, msg } of badValues) {
    while ((sm = re.exec(css)) !== null) {
      issues.push({
        type: 'warning', category: 'css', rule: 'invalid-value',
        message: msg,
        line: lineOf(html, globalOffset + sm.index),
        snippet: snip(css, sm.index),
      })
    }
  }

  return issues
}

/* ── Public API: audit-time ────────────────────────────────── */

/**
 * Full code quality scan of a page's raw HTML.
 * Called during the audit crawl step alongside `runTechnicalChecks()`.
 */
export function runCodeQualityChecks(url: string, html: string | null): CodeQualityResult {
  const empty: CodeQualityResult = {
    url,
    html: { errors: 0, warnings: 0, issues: [] },
    css: { errors: 0, warnings: 0, issues: [] },
    rating: 'good',
  }

  if (!html || html.trim().length < 20) return empty

  // HTML checks
  const htmlIssues = [
    ...checkHtmlStructure(html),
    ...checkHtmlAttributes(html),
  ]

  // CSS checks (inline + embedded)
  const cssBlocks = extractInlineAndEmbeddedCss(html)
  const cssIssues: CodeIssue[] = []
  for (const block of cssBlocks) {
    cssIssues.push(...checkCssSyntax(block.css, block.offset, html))
  }

  // Dedupe issues by rule + line (same issue can be flagged multiple ways)
  const deduped = (arr: CodeIssue[]) => {
    const seen = new Set<string>()
    return arr.filter((i) => {
      const key = `${i.rule}:${i.line}:${i.message.slice(0, 40)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  const htmlFinal = deduped(htmlIssues).slice(0, 25) // Cap at 25 per category
  const cssFinal = deduped(cssIssues).slice(0, 25)

  const totalErrors = htmlFinal.filter((i) => i.type === 'error').length +
    cssFinal.filter((i) => i.type === 'error').length

  return {
    url,
    html: {
      errors: htmlFinal.filter((i) => i.type === 'error').length,
      warnings: htmlFinal.filter((i) => i.type === 'warning').length,
      issues: htmlFinal,
    },
    css: {
      errors: cssFinal.filter((i) => i.type === 'error').length,
      warnings: cssFinal.filter((i) => i.type === 'warning').length,
      issues: cssFinal,
    },
    rating: totalErrors === 0 ? 'good' : totalErrors <= 3 ? 'needs_improvement' : 'poor',
  }
}

/* ── Public API: pre-deploy validation ─────────────────────── */

/**
 * Validate HTML/CSS before deploying a surgical fix.
 * Runs the same checks but returns a pass/fail verdict.
 */
export function validateHtmlCss(content: string): PreDeployValidation {
  const result = runCodeQualityChecks('pre-deploy', content)
  const allIssues = [...result.html.issues, ...result.css.issues]

  return {
    valid: allIssues.filter((i) => i.type === 'error').length === 0,
    errors: allIssues.filter((i) => i.type === 'error'),
    warnings: allIssues.filter((i) => i.type === 'warning'),
  }
}
