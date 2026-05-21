// ============================================================
// Fixpath — Surgical Fix Engine (v3 — deterministic + AI patch)
// ============================================================
// Two-tier fix system:
//
//   Tier 1 — Deterministic fixes (no AI, instant)
//     For known patterns like lang attribute, meta charset,
//     viewport meta, canonical URLs. Uses regex-based detection
//     and string replacement. Supports batch mode across all
//     crawled pages. Zero latency, zero cost, 100% reliable.
//
//   Tier 2 — AI-assisted patches (Haiku, 2-4 seconds)
//     For complex fixes requiring contextual understanding.
//     AI returns a tiny JSON patch {action, find, content},
//     applied programmatically via string ops.
//
// Four operation types:
//   replace — swap broken code with the fix
//   insert  — add new code at the correct location
//   create  — create a new file (no AI needed)
//   batch-replace — deterministic multi-page string swap (no AI)
//
// Key design decisions for speed:
//   - Deterministic fixes bypass AI entirely (Tier 1)
//   - AI fixes use Haiku (fast, cheap) instead of Sonnet
//   - Sends only a WINDOW of the file around likely fix points
//   - AI returns a tiny JSON patch, not the whole file
//   - Block-aware replacement for <script> tags
//   - Truncation detection and recovery for large patches
//
// PROPRIETARY — do not distribute outside the Fixpath codebase.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import { diffLines, type Change } from 'diff'
import { validateHtmlCss } from '@/lib/pipeline/code-quality-checker'

// ── Types ────────────────────────────────────────────────────

export type SurgicalOperation = 'replace' | 'insert' | 'create' | 'batch-replace'

export interface SurgicalFixRequest {
  /** FTP connection to read from */
  connectionId: string
  /** Remote file path on server */
  filePath: string
  /** Finding metadata */
  findingId: string
  findingTitle: string
  findingDescription: string
  findingCategory: string
  pageUrl: string | null
  /** The recommended fix code */
  recommendation: string
  /** Page language (e.g. 'Italian', 'English', 'Default') */
  language?: string
}

export interface DiffHunk {
  startLineOriginal: number
  startLinePatched: number
  linesRemoved: string[]
  linesAdded: string[]
  contextBefore: string[]
  contextAfter: string[]
}

export interface SurgicalFixResult {
  operation: SurgicalOperation
  originalContent: string
  patchedContent: string
  changes: DiffHunk[]
  confidence: 'high' | 'medium' | 'low'
  aiExplanation: string
  warning?: string
}

// ── Deterministic fix patterns (Tier 1 — no AI needed) ──────
// Known, well-defined fixes that can be applied as simple string
// replacements without any AI call. Each pattern defines:
//   - detect: does this finding match this pattern?
//   - extract: pull the wrong value from the file
//   - fix: return the corrected string
//   - scope: 'all-pages' if the fix should apply site-wide
//
// These patterns are the core competitive advantage — they make
// fixes instant, reliable, and batch-capable across all pages.
// ─────────────────────────────────────────────────────────────

export interface DeterministicFix {
  /** Human-readable pattern name */
  name: string
  /** Does this finding + recommendation match this pattern? */
  detect: (finding: { title: string; description: string; recommendation: string }) => boolean
  /** Given file content, return { find, replace } or null if already correct */
  apply: (content: string, finding: { title: string; description: string; recommendation: string }) => {
    find: string
    replace: string
    explanation: string
  } | null
  /** Should this fix be applied to all crawled pages? */
  scope: 'single-page' | 'all-pages'
}

/**
 * Registry of deterministic fix patterns.
 * Order matters — first match wins.
 */
export const DETERMINISTIC_PATTERNS: DeterministicFix[] = [
  // ── Lang attribute fix ──────────────────────────────────────
  // Detects: <html ... lang="en-US"> on a page that should be lang="it" (or other)
  // Scope: all pages — static sites repeat this on every page
  {
    name: 'html-lang-attribute',
    detect: ({ title, description }) => {
      const t = `${title} ${description}`.toLowerCase()
      return (t.includes('lang=') || t.includes('lang attribute') || t.includes('language') || t.includes('language identification'))
        && (t.includes('html') || t.includes('page'))
    },
    apply: (content, { title, description, recommendation }) => {
      // Extract what the lang SHOULD be from the finding text
      const allText = `${title} ${description} ${recommendation}`
      const targetLangMatch = allText.match(/lang=["']([a-z]{2}(?:-[A-Z]{2})?)["']/i)
        || allText.match(/correct.*?to\s+["']?([a-z]{2}(?:-[A-Z]{2})?)["']?/i)
        || allText.match(/should\s+be\s+["']?([a-z]{2}(?:-[A-Z]{2})?)["']?/i)

      // Extract the current lang from the file
      const currentLangMatch = content.match(/<html[^>]*\slang=["']([^"']+)["']/i)
      if (!currentLangMatch) return null // No lang attribute found

      const currentLang = currentLangMatch[1]
      let targetLang = targetLangMatch?.[1] || null

      // If we can't determine target from text, infer from common patterns
      if (!targetLang) {
        // If description mentions "Italian" and current is "en-US", target is "it"
        const descLower = `${title} ${description}`.toLowerCase()
        if (descLower.includes('italian')) targetLang = 'it'
        else if (descLower.includes('german')) targetLang = 'de'
        else if (descLower.includes('french')) targetLang = 'fr'
        else if (descLower.includes('spanish')) targetLang = 'es'
        else if (descLower.includes('portuguese')) targetLang = 'pt'
        else if (descLower.includes('dutch')) targetLang = 'nl'
        else if (descLower.includes('japanese')) targetLang = 'ja'
        else if (descLower.includes('chinese')) targetLang = 'zh'
        else if (descLower.includes('korean')) targetLang = 'ko'
        else if (descLower.includes('russian')) targetLang = 'ru'
        else if (descLower.includes('arabic')) targetLang = 'ar'
        else return null // Can't determine target language
      }

      // Already correct?
      if (currentLang.toLowerCase() === targetLang.toLowerCase()) return null

      // Build the exact find/replace strings
      const fullMatch = currentLangMatch[0] // e.g. <html xmlns="..." lang="en-US"
      const fixed = fullMatch.replace(`lang="${currentLang}"`, `lang="${targetLang}"`)
        .replace(`lang='${currentLang}'`, `lang='${targetLang}'`)

      return {
        find: fullMatch,
        replace: fixed,
        explanation: `Change lang="${currentLang}" to lang="${targetLang}" on the <html> tag`,
      }
    },
    scope: 'all-pages',
  },

  // ── Missing viewport meta ───────────────────────────────────
  {
    name: 'missing-viewport-meta',
    detect: ({ title, description }) => {
      const t = `${title} ${description}`.toLowerCase()
      return t.includes('viewport') && (t.includes('missing') || t.includes('add'))
    },
    apply: (content, _finding) => {
      // Already has viewport?
      if (content.match(/<meta[^>]*name=["']viewport["']/i)) return null

      const headClose = content.indexOf('</head')
      if (headClose === -1) return null

      // Find the line before </head> to insert
      const insertBefore = content.slice(Math.max(0, headClose - 1), headClose + 7)
      return {
        find: insertBefore,
        replace: `  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n${insertBefore}`,
        explanation: 'Add viewport meta tag before </head>',
      }
    },
    scope: 'all-pages',
  },

  // ── Meta charset fix ────────────────────────────────────────
  {
    name: 'meta-charset',
    detect: ({ title, description }) => {
      const t = `${title} ${description}`.toLowerCase()
      return t.includes('charset') && (t.includes('missing') || t.includes('incorrect') || t.includes('utf'))
    },
    apply: (content, _finding) => {
      // Already has correct charset?
      if (content.match(/<meta\s+charset=["']utf-8["']/i)) return null

      // Has wrong charset?
      const wrongCharset = content.match(/<meta[^>]*charset=["'][^"']+["'][^>]*>/i)
      if (wrongCharset) {
        return {
          find: wrongCharset[0],
          replace: '<meta charset="utf-8">',
          explanation: 'Correct charset to UTF-8',
        }
      }

      // Missing entirely — insert at top of <head>
      const headOpen = content.match(/<head[^>]*>/i)
      if (!headOpen) return null
      return {
        find: headOpen[0],
        replace: `${headOpen[0]}\n  <meta charset="utf-8">`,
        explanation: 'Add UTF-8 charset meta tag',
      }
    },
    scope: 'all-pages',
  },
]

/**
 * Try to apply a deterministic fix pattern.
 * Returns the fix result if a pattern matches, or null to fall through to AI.
 */
export function tryDeterministicFix(
  content: string,
  finding: { title: string; description: string; recommendation: string },
): {
  pattern: DeterministicFix
  find: string
  replace: string
  explanation: string
} | null {
  for (const pattern of DETERMINISTIC_PATTERNS) {
    if (!pattern.detect(finding)) continue
    const result = pattern.apply(content, finding)
    if (result) return { pattern, ...result }
    // Pattern matched but file already correct — return special signal
    // (caller should check for null and handle "already fixed")
  }
  return null
}

/**
 * Check if a deterministic pattern matches this finding.
 * Used by the UI to decide whether to show "Fix all pages" button.
 */
export function detectBatchPattern(
  finding: { title: string; description: string; recommendation: string },
): { patternName: string; scope: 'single-page' | 'all-pages' } | null {
  for (const pattern of DETERMINISTIC_PATTERNS) {
    if (pattern.detect(finding)) {
      return { patternName: pattern.name, scope: pattern.scope }
    }
  }
  return null
}

/**
 * Check if a finding's fix target is already correct in the file.
 * Returns a human-readable message if already fixed, or null.
 */
export function checkAlreadyFixed(
  content: string,
  finding: { title: string; description: string; recommendation: string },
): string | null {
  for (const pattern of DETERMINISTIC_PATTERNS) {
    if (!pattern.detect(finding)) continue
    const result = pattern.apply(content, finding)
    if (result === null) {
      // Pattern matched but nothing to fix — already correct
      return `This page already has the correct value. No change needed.`
    }
    return null // Pattern matched and there IS something to fix
  }
  return null
}

// ── Operation classifier ─────────────────────────────────────

const CREATE_FILE_PATTERNS = [
  'llms.txt', 'robots.txt', 'sitemap.xml', 'ai-plugin.json',
  '.well-known/', 'manifest.json',
]

const INSERT_KEYWORDS = [
  'add ', 'insert ', 'include ', 'append ',
  'json-ld', 'schema markup', 'structured data',
  'aria-', 'alt=', 'lang=', 'hreflang',
  '<script type="application/ld+json"',
  'add the following', 'place this',
]

export function classifyOperation(
  recommendation: string,
  findingTitle: string,
  findingDescription: string,
  filePath: string,
): SurgicalOperation {
  const recLower = recommendation.toLowerCase()
  const titleLower = findingTitle.toLowerCase()
  const descLower = findingDescription.toLowerCase()
  const pathLower = filePath.toLowerCase()

  if (CREATE_FILE_PATTERNS.some((p) => pathLower.includes(p))) {
    return 'create'
  }

  const allText = `${recLower} ${titleLower} ${descLower}`
  if (INSERT_KEYWORDS.some((kw) => allText.includes(kw))) {
    if (
      recLower.includes('<script') ||
      recLower.includes('<meta') ||
      recLower.includes('<link') ||
      recLower.includes('aria-') ||
      titleLower.includes('add ') ||
      titleLower.includes('missing ')
    ) {
      return 'insert'
    }
  }

  return 'replace'
}

// ── Smart context window ─────────────────────────────────────
// Instead of sending the whole file, extract only the relevant
// section (e.g. <head> for meta fixes, specific tag for attr fixes).

function extractRelevantWindow(
  content: string,
  recommendation: string,
  findingTitle: string,
  operation: SurgicalOperation,
): { window: string; startLine: number; fullFile: boolean } {
  const lines = content.split('\n')
  const titleLower = findingTitle.toLowerCase()
  const recLower = recommendation.toLowerCase()

  // For <head> related fixes (meta, title, JSON-LD, link tags), just send <head>
  const isHeadFix = recLower.includes('<meta') ||
    recLower.includes('<title') ||
    recLower.includes('<link') ||
    recLower.includes('json-ld') ||
    recLower.includes('application/ld+json') ||
    titleLower.includes('meta ') ||
    titleLower.includes('title tag') ||
    titleLower.includes('canonical') ||
    titleLower.includes('hreflang') ||
    titleLower.includes('favicon')

  if (isHeadFix) {
    const headStart = lines.findIndex(l => l.toLowerCase().includes('<head'))
    const headEnd = lines.findIndex(l => l.toLowerCase().includes('</head'))
    if (headStart >= 0 && headEnd >= 0) {
      // Include a few lines before/after for context
      const start = Math.max(0, headStart - 2)
      const end = Math.min(lines.length, headEnd + 3)
      return {
        window: lines.slice(start, end).join('\n'),
        startLine: start,
        fullFile: false,
      }
    }
  }

  // For small files (< 300 lines), just send everything
  if (lines.length < 300) {
    return { window: content, startLine: 0, fullFile: true }
  }

  // For larger files, send the first 200 lines (covers head + top of body)
  // plus search for any obvious match points
  return {
    window: lines.slice(0, 200).join('\n'),
    startLine: 0,
    fullFile: lines.length <= 200,
  }
}

// ── AI prompt (fast patch mode) ──────────────────────────────

interface PatchInstruction {
  action: 'replace' | 'insert_before' | 'insert_after'
  /** The exact string to find in the file */
  find: string
  /** The replacement or insertion content */
  content: string
  /** Short explanation */
  explanation: string
}

function buildPatchPrompt(
  operation: SurgicalOperation,
  fileWindow: string,
  recommendation: string,
  findingTitle: string,
  findingDescription: string,
  language?: string,
): string {
  const opInstructions = operation === 'insert'
    ? `You need to INSERT new code. Return action "insert_before" or "insert_after" with "find" set to the exact line where the code should go.
For <head> insertions: insert_before "</head>".
For <body> insertions: use the semantically correct anchor.`
    : `You need to REPLACE existing code. Return action "replace" with "find" set to the exact broken code and "content" set to the fixed version.
Only include the minimum lines needed — don't return the whole file.`

  // Language-aware instruction for non-English pages
  const isNonDefault = language && language !== 'Default' && language.toLowerCase() !== 'english'
  const languageInstruction = isNonDefault
    ? `\nLANGUAGE RULE (CRITICAL): The page is in ${language}. ALL text content in "content" (visible copy, headings, CTAs, alt text, meta descriptions, titles) MUST be written in ${language}. Do NOT use English for any user-visible text. Only HTML tags, attributes, and code syntax remain in English.`
    : ''

  return `You are a surgical code patcher. Given a finding and fix, return a JSON patch instruction.

FINDING: ${findingTitle}
DESCRIPTION: ${findingDescription}

FIX TO APPLY:
"""
${recommendation}
"""

FILE CONTENT:
"""
${fileWindow}
"""

${opInstructions}${languageInstruction}

RESPOND WITH ONLY valid JSON, no markdown, no fences:
{"action":"replace|insert_before|insert_after","find":"exact string from file","content":"new/fixed code","explanation":"one sentence"}

CRITICAL RULES:
- "find" must be an EXACT substring from the file (copy-paste, preserve whitespace)
- Keep "find" as SHORT as possible — 1-3 lines max. Use just enough to be unique in the file
- For JSON-LD / <script type="application/ld+json"> blocks: use "find" to match just the opening tag (e.g. '<script type="application/ld+json">') and replace the ENTIRE block including closing </script>
- "content" is the replacement (for replace) or new code to insert (for insert)${isNonDefault ? `\n- ALL user-visible text in "content" MUST be in ${language} — never English` : ''}
- If you cannot locate the fix point, return: {"action":"failed","find":"","content":"","explanation":"reason"}`
}

// ── AI call (Haiku — fast) ───────────────────────────────────

export async function callSurgicalAI(prompt: string): Promise<{
  patchedContent: string
  explanation: string
  failed: boolean
  failReason?: string
  patch?: PatchInstruction
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  // Check if the response was truncated (hit max_tokens)
  const wasTruncated = response.stop_reason === 'max_tokens'

  // Parse the JSON response
  let patch: PatchInstruction
  try {
    // Strip markdown fences — handle ```json, ``` , with or without newlines
    let cleaned = text
      .replace(/^```\w*\s*\n?/, '')  // opening fence
      .replace(/\n?\s*```\s*$/, '')   // closing fence
      .trim()

    // If truncated, try to recover by closing the JSON
    if (wasTruncated && !cleaned.endsWith('}')) {
      // Find the last complete key-value pair and close the object
      const lastExplanation = cleaned.lastIndexOf('"explanation"')
      if (lastExplanation > 0) {
        // Truncated after explanation started — trim and close
        cleaned = cleaned.slice(0, lastExplanation) + '"explanation":"Fix applied."}'
      } else {
        // Can't recover — report truncation
        return {
          patchedContent: '',
          explanation: '',
          failed: true,
          failReason: 'AI response was truncated (content too large for token limit). Try applying this fix manually.',
        }
      }
    }

    patch = JSON.parse(cleaned)
  } catch {
    if (wasTruncated) {
      return {
        patchedContent: '',
        explanation: '',
        failed: true,
        failReason: 'AI response was truncated (content too large). Try applying this fix manually.',
      }
    }
    return {
      patchedContent: '',
      explanation: '',
      failed: true,
      failReason: 'AI returned invalid JSON. Raw response: ' + text.slice(0, 200),
    }
  }

  if ((patch as any).action === 'failed') {
    return {
      patchedContent: '',
      explanation: '',
      failed: true,
      failReason: patch.explanation || 'Could not locate fix point.',
    }
  }

  return {
    patchedContent: '', // Will be filled by applyPatch
    explanation: patch.explanation || 'Fix applied.',
    failed: false,
    patch,
  }
}

// ── Patch application ────────────────────────────────────────

export function applyPatch(
  originalContent: string,
  patch: PatchInstruction,
): { patchedContent: string; applied: boolean; warning?: string } {
  const { action, find, content } = patch

  if (!find) {
    return { patchedContent: originalContent, applied: false, warning: 'Empty find string.' }
  }

  // No-op detection: if find and content are identical, the file is already correct
  if (action === 'replace' && find.trim() === content.trim()) {
    return {
      patchedContent: originalContent,
      applied: false,
      warning: 'This file already has the correct value. No change needed.',
    }
  }

  // Block-aware replacement: if "find" is just an opening tag (e.g. <script ...>)
  // and the content includes the closing tag, extend the match to the full block
  let effectiveFind = find
  if (action === 'replace') {
    const findTrim = find.trim()
    // Match opening <script> tag that AI used as anchor for a full block replace
    if (findTrim.match(/^<script\b[^>]*>\s*$/i) && content.includes('</script>')) {
      const startIdx = originalContent.indexOf(find)
      if (startIdx >= 0) {
        const closeTag = '</script>'
        const closeIdx = originalContent.indexOf(closeTag, startIdx)
        if (closeIdx >= 0) {
          effectiveFind = originalContent.slice(startIdx, closeIdx + closeTag.length)
        }
      }
    }
  }

  // Check that the find string actually exists in the file
  const idx = originalContent.indexOf(effectiveFind)
  if (idx === -1) {
    // Try a fuzzy match — trim whitespace from each line
    const findTrimmed = find.split('\n').map(l => l.trim()).join('\n')
    const lines = originalContent.split('\n')
    let fuzzyIdx = -1
    const findLines = findTrimmed.split('\n')

    for (let i = 0; i <= lines.length - findLines.length; i++) {
      const slice = lines.slice(i, i + findLines.length).map(l => l.trim()).join('\n')
      if (slice === findTrimmed) {
        // Found it — use the original lines for replacement
        const origSlice = lines.slice(i, i + findLines.length).join('\n')
        fuzzyIdx = originalContent.indexOf(origSlice)
        if (fuzzyIdx >= 0) {
          if (action === 'replace') {
            return {
              patchedContent: originalContent.slice(0, fuzzyIdx) + content + originalContent.slice(fuzzyIdx + origSlice.length),
              applied: true,
            }
          } else if (action === 'insert_before') {
            return {
              patchedContent: originalContent.slice(0, fuzzyIdx) + content + '\n' + originalContent.slice(fuzzyIdx),
              applied: true,
            }
          } else {
            // insert_after
            const afterPos = fuzzyIdx + origSlice.length
            return {
              patchedContent: originalContent.slice(0, afterPos) + '\n' + content + originalContent.slice(afterPos),
              applied: true,
            }
          }
        }
        break
      }
    }

    return {
      patchedContent: originalContent,
      applied: false,
      warning: `Could not find the target code in the file. The AI-suggested anchor was not found.`,
    }
  }

  // Exact match found — apply the patch
  if (action === 'replace') {
    return {
      patchedContent: originalContent.slice(0, idx) + content + originalContent.slice(idx + effectiveFind.length),
      applied: true,
    }
  } else if (action === 'insert_before') {
    return {
      patchedContent: originalContent.slice(0, idx) + content + '\n' + originalContent.slice(idx),
      applied: true,
    }
  } else {
    // insert_after
    const afterPos = idx + effectiveFind.length
    return {
      patchedContent: originalContent.slice(0, afterPos) + '\n' + content + originalContent.slice(afterPos),
      applied: true,
    }
  }
}

// ── Public orchestrator (used by route.ts) ───────────────────

export function buildPrompt(
  operation: SurgicalOperation,
  originalContent: string,
  recommendation: string,
  findingTitle: string,
  findingDescription: string,
  language?: string,
): string {
  if (operation === 'create') return ''

  const { window: fileWindow } = extractRelevantWindow(
    originalContent, recommendation, findingTitle, operation,
  )

  return buildPatchPrompt(operation, fileWindow, recommendation, findingTitle, findingDescription, language)
}

// ── Diff computation ─────────────────────────────────────────

const CONTEXT_LINES = 3

export function computeDiff(original: string, patched: string): DiffHunk[] {
  const changes: Change[] = diffLines(original, patched)
  const hunks: DiffHunk[] = []

  const originalLines = original.split('\n')

  let origLine = 0
  let patchLine = 0

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    const lines = change.value.replace(/\n$/, '').split('\n')

    if (!change.added && !change.removed) {
      origLine += lines.length
      patchLine += lines.length
      continue
    }

    const removed: string[] = []
    const added: string[] = []
    const hunkOrigStart = origLine
    const hunkPatchStart = patchLine

    if (change.removed) {
      removed.push(...lines)
      origLine += lines.length
    }
    if (change.added) {
      added.push(...lines)
      patchLine += lines.length
    }

    if (i + 1 < changes.length) {
      const next = changes[i + 1]
      const nextLines = next.value.replace(/\n$/, '').split('\n')
      if (change.removed && next.added) {
        added.push(...nextLines)
        patchLine += nextLines.length
        i++
      } else if (change.added && next.removed) {
        removed.push(...nextLines)
        origLine += nextLines.length
        i++
      }
    }

    const ctxBefore = originalLines.slice(
      Math.max(0, hunkOrigStart - CONTEXT_LINES),
      hunkOrigStart,
    )
    const afterStart = change.removed ? hunkOrigStart + removed.length : hunkOrigStart
    const ctxAfter = originalLines.slice(afterStart, afterStart + CONTEXT_LINES)

    hunks.push({
      startLineOriginal: hunkOrigStart + 1,
      startLinePatched: hunkPatchStart + 1,
      linesRemoved: removed,
      linesAdded: added,
      contextBefore: ctxBefore,
      contextAfter: ctxAfter,
    })
  }

  return hunks
}

// ── Validation ───────────────────────────────────────────────

export function validatePatch(
  original: string,
  patched: string,
  operation: SurgicalOperation,
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = []

  if (operation === 'create') {
    if (!patched.trim()) warnings.push('Generated file is empty.')
    return { valid: warnings.length === 0, warnings }
  }

  if (patched.length < original.length * 0.5) {
    warnings.push(
      `Patched file is ${Math.round((1 - patched.length / original.length) * 100)}% shorter than original.`,
    )
  }

  if (operation === 'insert' && patched.length < original.length) {
    warnings.push('Insert operation produced a shorter file.')
  }

  const isHtml = original.includes('<!DOCTYPE') || original.includes('<html')
  if (isHtml) {
    if (original.includes('<html') && !patched.includes('<html')) {
      warnings.push('Patched file is missing <html> tag.')
    }
    if (original.includes('<head') && !patched.includes('<head')) {
      warnings.push('Patched file is missing <head> tag.')
    }
    if (original.includes('<body') && !patched.includes('<body')) {
      warnings.push('Patched file is missing <body> tag.')
    }

    // Run code quality checks on the patched HTML — catch syntax issues before deploy
    try {
      const cq = validateHtmlCss(patched)
      // Only surface NEW errors not present in the original
      if (cq.errors.length > 0) {
        const origCq = validateHtmlCss(original)
        const origErrs = new Set(origCq.errors.map((e) => e.message))
        const newErrors = cq.errors.filter((e) => !origErrs.has(e.message))
        for (const err of newErrors.slice(0, 3)) {
          warnings.push(`Code quality: ${err.message}`)
        }
      }
    } catch {
      // Non-fatal — validation continues without code quality checks
    }
  }

  return { valid: warnings.filter((w) => w.includes('missing')).length === 0, warnings }
}
