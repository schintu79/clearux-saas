// ============================================================
// Fixpath — Surgical Fix Engine
// ============================================================
// Reads a live page from FTP, uses AI to locate the exact spot
// that corresponds to a finding, and produces a minimal patch
// that modifies ONLY the relevant code. The full modified file
// is returned for user approval before deployment.
//
// Three operation types:
//   replace — swap broken code with the fix
//   insert  — add new code at the correct location
//   create  — create a new file (no AI merge needed)
//
// PROPRIETARY — do not distribute outside the Fixpath codebase.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import { diffLines, type Change } from 'diff'

// ── Types ────────────────────────────────────────────────────

export type SurgicalOperation = 'replace' | 'insert' | 'create'

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
}

export interface DiffHunk {
  /** Line number in original where this hunk starts (1-based) */
  startLineOriginal: number
  /** Line number in patched where this hunk starts (1-based) */
  startLinePatched: number
  /** Lines removed from original */
  linesRemoved: string[]
  /** Lines added in patched */
  linesAdded: string[]
  /** Context lines surrounding the change (for display) */
  contextBefore: string[]
  contextAfter: string[]
}

export interface SurgicalFixResult {
  operation: SurgicalOperation
  /** Original file content (empty string for create) */
  originalContent: string
  /** Full file with the fix applied */
  patchedContent: string
  /** Diff hunks for the preview UI */
  changes: DiffHunk[]
  /** AI confidence in the fix placement */
  confidence: 'high' | 'medium' | 'low'
  /** One-line AI explanation of what was changed */
  aiExplanation: string
  /** Warning if something is off (minified, truncated, etc.) */
  warning?: string
}

// ── Operation classifier ─────────────────────────────────────

/** File extensions that indicate "create new file" operations */
const CREATE_FILE_PATTERNS = [
  'llms.txt', 'robots.txt', 'sitemap.xml', 'ai-plugin.json',
  '.well-known/', 'manifest.json',
]

/** Keywords that suggest insertion (adding something new) */
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

  // Check if this is a standalone file creation
  if (CREATE_FILE_PATTERNS.some((p) => pathLower.includes(p))) {
    return 'create'
  }

  // Check for insertion patterns
  const allText = `${recLower} ${titleLower} ${descLower}`
  if (INSERT_KEYWORDS.some((kw) => allText.includes(kw))) {
    // If the recommendation contains a full HTML tag to add, it's insert
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

  // Default to replace
  return 'replace'
}

// ── AI prompt builders ───────────────────────────────────────

const SHARED_RULES = `
RULES:
- Never remove or reformat code that is not part of the fix.
- Preserve all whitespace, indentation, and formatting of untouched lines.
- If the file is minified, apply the fix in-place without reformatting.
- If this is a PHP file, preserve all PHP blocks unchanged.
- Return ONLY the file content. No preamble, no explanation, no markdown fences, no \`\`\`.
- On the very FIRST line of your response, write a one-sentence explanation comment: <!-- SURGICAL-FIX: your explanation here -->
- If you cannot confidently locate the fix point, return the original file unchanged with <!-- SURGICAL-FIX-FAILED: reason --> on the first line instead.
`.trim()

function buildReplacePrompt(
  originalContent: string,
  recommendation: string,
  findingTitle: string,
  findingDescription: string,
): string {
  return `You are a surgical code editor. You must modify an existing file to fix a specific issue.

FINDING: ${findingTitle}
DESCRIPTION: ${findingDescription}

THE FIX TO APPLY:
"""
${recommendation}
"""

CURRENT FILE CONTENT:
"""
${truncateForAI(originalContent)}
"""

INSTRUCTIONS:
1. Find the exact location in the file that corresponds to this finding.
2. Replace ONLY the problematic code with the fix. Do not change anything else.
3. Return the COMPLETE modified file — every single line, including unchanged ones.
4. The output must be a valid, deployable file identical to the input except for the fix.

${SHARED_RULES}`
}

function buildInsertPrompt(
  originalContent: string,
  recommendation: string,
  findingTitle: string,
  findingDescription: string,
): string {
  return `You are a surgical code editor. You must INSERT new code into an existing file at the correct location.

FINDING: ${findingTitle}
DESCRIPTION: ${findingDescription}

CODE TO INSERT:
"""
${recommendation}
"""

CURRENT FILE CONTENT:
"""
${truncateForAI(originalContent)}
"""

INSTRUCTIONS:
1. Determine the correct insertion point based on the code type:
   - JSON-LD / <script type="application/ld+json">: inside <head>, before </head>
   - Meta tags: inside <head>, after existing meta tags
   - <link> tags: inside <head>, with other link elements
   - Aria attributes: on the specific element described in the finding
   - New HTML elements: at the semantically correct position
2. Insert the code at that point. Do not modify any existing code.
3. Return the COMPLETE modified file — every single line, including unchanged ones.
4. Every line of the original file must appear unchanged in the output. Only ADD new lines.

${SHARED_RULES}`
}

function truncateForAI(content: string, maxChars = 50000): string {
  if (content.length <= maxChars) return content
  // Truncate at a tag boundary if possible
  const truncated = content.substring(0, maxChars)
  const lastClose = truncated.lastIndexOf('>')
  const cutPoint = lastClose > maxChars * 0.8 ? lastClose + 1 : maxChars
  return content.substring(0, cutPoint) + '\n<!-- FILE TRUNCATED AT ' + cutPoint + ' CHARS -->'
}

export function buildPrompt(
  operation: SurgicalOperation,
  originalContent: string,
  recommendation: string,
  findingTitle: string,
  findingDescription: string,
): string {
  switch (operation) {
    case 'replace':
      return buildReplacePrompt(originalContent, recommendation, findingTitle, findingDescription)
    case 'insert':
      return buildInsertPrompt(originalContent, recommendation, findingTitle, findingDescription)
    case 'create':
      // No prompt needed for create — return recommendation as-is
      return ''
  }
}

// ── AI call ──────────────────────────────────────────────────

export async function callSurgicalAI(prompt: string): Promise<{
  patchedContent: string
  explanation: string
  failed: boolean
  failReason?: string
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16384,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  // Check for failure sentinel
  const failMatch = text.match(/<!--\s*SURGICAL-FIX-FAILED:\s*(.+?)\s*-->/)
  if (failMatch) {
    return {
      patchedContent: text,
      explanation: '',
      failed: true,
      failReason: failMatch[1],
    }
  }

  // Extract explanation from first line
  const explainMatch = text.match(/<!--\s*SURGICAL-FIX:\s*(.+?)\s*-->/)
  const explanation = explainMatch?.[1] || 'Fix applied.'

  // Remove the explanation comment from the content
  const patchedContent = text.replace(/<!--\s*SURGICAL-FIX:\s*.+?\s*-->\n?/, '').trimStart()

  return { patchedContent, explanation, failed: false }
}

// ── Diff computation ─────────────────────────────────────────

const CONTEXT_LINES = 3

export function computeDiff(original: string, patched: string): DiffHunk[] {
  const changes: Change[] = diffLines(original, patched)
  const hunks: DiffHunk[] = []

  const originalLines = original.split('\n')
  const patchedLines = patched.split('\n')

  let origLine = 0
  let patchLine = 0

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    const lines = change.value.replace(/\n$/, '').split('\n')

    if (!change.added && !change.removed) {
      // Context — skip
      origLine += lines.length
      patchLine += lines.length
      continue
    }

    // Collect the full change (removed + added together)
    const removed: string[] = []
    const added: string[] = []
    let hunkOrigStart = origLine
    let hunkPatchStart = patchLine

    if (change.removed) {
      removed.push(...lines)
      origLine += lines.length
    }
    if (change.added) {
      added.push(...lines)
      patchLine += lines.length
    }

    // Check if next change is the complementary add/remove
    if (i + 1 < changes.length) {
      const next = changes[i + 1]
      const nextLines = next.value.replace(/\n$/, '').split('\n')
      if (change.removed && next.added) {
        added.push(...nextLines)
        patchLine += nextLines.length
        i++ // skip next
      } else if (change.added && next.removed) {
        removed.push(...nextLines)
        origLine += nextLines.length
        i++
      }
    }

    // Grab context
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

  // For create, no validation against original
  if (operation === 'create') {
    if (!patched.trim()) warnings.push('Generated file is empty.')
    return { valid: warnings.length === 0, warnings }
  }

  // Check patched isn't dramatically shorter (AI truncated the file)
  if (patched.length < original.length * 0.5) {
    warnings.push(
      `Patched file is ${Math.round((1 - patched.length / original.length) * 100)}% shorter than original. AI may have truncated the file.`,
    )
  }

  // For insert, original content should be fully preserved
  if (operation === 'insert') {
    // Check that the patched version is at least as long
    if (patched.length < original.length) {
      warnings.push('Insert operation produced a shorter file — original content may have been modified.')
    }
  }

  // Check structural integrity for HTML
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
  }

  // Detect minified input
  const lineCount = original.split('\n').length
  if (lineCount < 10 && original.length > 5000) {
    warnings.push('Source file appears to be minified. Diff preview may show the entire file as changed.')
  }

  return { valid: warnings.filter((w) => w.includes('missing') || w.includes('truncated')).length === 0, warnings }
}
