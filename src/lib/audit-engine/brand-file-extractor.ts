// ============================================================
// ClearUX — Brand File Content Extractor
// Extracts text + visual descriptions from uploaded brand files.
// Supports: PDF (text via pdf-parse + optional vision), DOCX
// (xml parsing), TXT, and images (PNG, JPG, SVG, WebP via
// Claude vision).
// ============================================================

import Anthropic from '@anthropic-ai/sdk'

let _anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')
    _anthropic = new Anthropic({ apiKey, timeout: 120_000 })
  }
  return _anthropic
}

export interface ExtractedContent {
  fileName: string
  fileType: string
  textContent: string
  visualDescription: string | null
  pageCount: number | null
  extractionMethod: 'text' | 'vision' | 'hybrid'
  error: string | null
}

// ── Helpers ────────────────────────────────────────────────────

/** Fetch a file from a URL and return it as a Buffer + detected media type */
async function fetchFile(url: string): Promise<{ buffer: Buffer; mediaType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status} ${res.statusText}`)
  const arrayBuffer = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  return { buffer: Buffer.from(arrayBuffer), mediaType: contentType }
}

/** Use Claude vision to describe an image */
async function describeImage(
  imageBuffer: Buffer,
  mediaType: string,
  fileName: string,
): Promise<string> {
  const client = getAnthropicClient()
  const base64 = imageBuffer.toString('base64')

  // Map media types to what Claude accepts
  const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const
  type ValidMediaType = typeof validTypes[number]
  let safeMediaType: ValidMediaType = 'image/png'
  if (validTypes.includes(mediaType as ValidMediaType)) {
    safeMediaType = mediaType as ValidMediaType
  } else if (mediaType === 'image/svg+xml') {
    // SVG needs to be handled differently — extract text or describe as generic
    return `[SVG file: ${fileName}] — Vector graphic; text content should be extracted separately.`
  }

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: safeMediaType, data: base64 },
          },
          {
            type: 'text',
            text: `You are analyzing brand identity materials. Describe this image in detail for a brand audit:

1. **Visual elements**: Colors used (with approximate hex values if possible), typography styles, logo presence and design, imagery style, layout structure.
2. **Text content**: Transcribe ALL visible text exactly as it appears.
3. **Brand impression**: What professional impression does this material give? What industry/audience does it seem targeted at?
4. **Quality assessment**: Note any quality issues (low resolution, inconsistent spacing, alignment problems, etc.).

File name: ${fileName}

Be thorough — this description will be used by another AI to evaluate design consistency against brand standards.`,
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  return textBlock?.text || '[No description generated]'
}

/** Extract raw text from a PDF using pdf-parse (fast, no API call) */
async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const { PDFParse } = await import('pdf-parse')
  // pdf-parse v5 requires Uint8Array, not Buffer
  const uint8 = new Uint8Array(buffer)
  const parser = new PDFParse(uint8)
  const result = await parser.getText()
  // Clean null characters from font encoding issues (common in PDF text extraction)
  const cleanText = (result.text || '').replace(/\x00/g, '')
  return { text: cleanText, pageCount: result.total || 0 }
}

/** Use Claude to generate a visual/brand description from PDF text content */
async function describePdfContent(
  textContent: string,
  fileName: string,
): Promise<string> {
  const client = getAnthropicClient()

  // Send the extracted text to Claude for brand-focused analysis
  // Much faster than sending the full PDF binary
  const truncatedText = textContent.slice(0, 30_000)

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: `You are analyzing extracted text from a brand identity document for a brand audit.

Document: "${fileName}"

--- EXTRACTED TEXT ---
${truncatedText}
--- END ---

Based on this text, provide a structured brand analysis:

1. **Brand elements found**: Logo descriptions, taglines, value propositions, mission/vision statements.
2. **Visual design references**: Any mentions of colors (with hex values if stated), typography choices, spacing/layout rules, imagery guidelines.
3. **Tone of voice**: Communication style, language patterns, brand personality traits.
4. **Brand guidelines**: Any rules, do's/don'ts, usage specifications found.
5. **Document structure**: How well-organized is this document? What sections does it contain?

Be thorough — this will be used for automated design consistency analysis.`,
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  return textBlock?.text || ''
}

// ── Extractors ─────────────────────────────────────────────────

/** Extract content from a plain text file */
async function extractText(url: string, fileName: string): Promise<ExtractedContent> {
  try {
    const { buffer } = await fetchFile(url)
    const text = buffer.toString('utf-8')
    return {
      fileName,
      fileType: 'txt',
      textContent: text.slice(0, 50_000), // cap at 50k chars
      visualDescription: null,
      pageCount: null,
      extractionMethod: 'text',
      error: null,
    }
  } catch (err) {
    return {
      fileName,
      fileType: 'txt',
      textContent: '',
      visualDescription: null,
      pageCount: null,
      extractionMethod: 'text',
      error: `Text extraction failed: ${(err as Error).message}`,
    }
  }
}

/** Extract content from a DOCX file by parsing its XML content */
async function extractDocx(url: string, fileName: string): Promise<ExtractedContent> {
  try {
    const { buffer } = await fetchFile(url)

    // DOCX is a ZIP archive — extract text from word/document.xml
    // Use a simple XML text extraction approach
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(buffer)
    const docXml = await zip.file('word/document.xml')?.async('string')

    if (!docXml) {
      return {
        fileName,
        fileType: 'docx',
        textContent: '',
        visualDescription: null,
        pageCount: null,
        extractionMethod: 'text',
        error: 'Could not find document.xml in DOCX archive',
      }
    }

    // Strip XML tags and extract text content
    const textContent = docXml
      .replace(/<w:br[^>]*\/>/gi, '\n')
      .replace(/<\/w:p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x2019;/g, '’')
      .replace(/&#x201C;/g, '“')
      .replace(/&#x201D;/g, '”')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return {
      fileName,
      fileType: 'docx',
      textContent: textContent.slice(0, 50_000),
      visualDescription: null,
      pageCount: null,
      extractionMethod: 'text',
      error: null,
    }
  } catch (err) {
    return {
      fileName,
      fileType: 'docx',
      textContent: '',
      visualDescription: null,
      pageCount: null,
      extractionMethod: 'text',
      error: `DOCX extraction failed: ${(err as Error).message}`,
    }
  }
}

/** Extract content from a PDF: fast text via pdf-parse, then Claude for brand analysis */
async function extractPdf(url: string, fileName: string): Promise<ExtractedContent> {
  try {
    const { buffer } = await fetchFile(url)

    // Step 1: Fast text extraction with pdf-parse (no API call, milliseconds)
    let textContent = ''
    let pageCount: number | null = null
    try {
      const parsed = await extractPdfText(buffer)
      textContent = parsed.text.slice(0, 50_000)
      pageCount = parsed.pageCount
    } catch (parseErr) {
      // pdf-parse can fail on heavily visual/scanned PDFs — continue anyway
      console.warn(`[brand-extractor] pdf-parse failed for ${fileName}:`, (parseErr as Error).message)
    }

    // Step 2: If we got text, send it to Claude for brand-focused analysis
    // This is much faster than sending the raw PDF binary
    let visualDescription: string | null = null
    if (textContent.trim().length > 100) {
      try {
        visualDescription = await describePdfContent(textContent, fileName)
      } catch (descErr) {
        console.warn(`[brand-extractor] Brand analysis failed for ${fileName}:`, (descErr as Error).message)
        // Still have text content — proceed without visual description
      }
    }

    // Step 3: If pdf-parse got no text (scanned/image-heavy PDF), fall back to
    // Claude document block for direct PDF reading
    if (textContent.trim().length < 100) {
      try {
        const client = getAnthropicClient()
        const base64 = buffer.toString('base64')
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 6000,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'document' as any,
                  source: { type: 'base64', media_type: 'application/pdf', data: base64 },
                } as any,
                {
                  type: 'text' as const,
                  text: `You are analyzing this PDF as part of a brand identity audit. Extract and describe:
1. ALL text content — transcribe everything, preserving section structure.
2. Visual design — describe colors, typography, layout, imagery, logos.
3. Brand elements — taglines, value propositions, tone of voice, brand guidelines.
4. Document quality — formatting consistency, professional polish, any issues.

Document: ${fileName}
Be thorough — this will be used for automated brand analysis.`,
                },
              ],
            },
          ],
        })
        const textBlock = response.content.find((b) => b.type === 'text')
        const content = textBlock?.text || ''
        textContent = content
        visualDescription = 'Extracted via Claude document understanding (image-heavy PDF)'
      } catch (fallbackErr) {
        console.warn(`[brand-extractor] Claude PDF fallback also failed for ${fileName}:`, (fallbackErr as Error).message)
        // If both methods failed, return what we have (possibly empty)
      }
    }

    return {
      fileName,
      fileType: 'pdf',
      textContent,
      visualDescription,
      pageCount,
      extractionMethod: 'hybrid',
      error: textContent.trim().length < 10 ? 'PDF text extraction produced minimal content' : null,
    }
  } catch (err) {
    return {
      fileName,
      fileType: 'pdf',
      textContent: '',
      visualDescription: null,
      pageCount: null,
      extractionMethod: 'hybrid',
      error: `PDF extraction failed: ${(err as Error).message}`,
    }
  }
}

/** Extract content from an image file */
async function extractImage(
  url: string,
  fileName: string,
  fileType: string,
): Promise<ExtractedContent> {
  try {
    const { buffer, mediaType } = await fetchFile(url)
    const description = await describeImage(buffer, mediaType, fileName)

    return {
      fileName,
      fileType,
      textContent: '',
      visualDescription: description,
      pageCount: null,
      extractionMethod: 'vision',
      error: null,
    }
  } catch (err) {
    return {
      fileName,
      fileType,
      textContent: '',
      visualDescription: null,
      pageCount: null,
      extractionMethod: 'vision',
      error: `Image extraction failed: ${(err as Error).message}`,
    }
  }
}

// ── Main Entry ─────────────────────────────────────────────────

/** Determine file type from extension and extract content accordingly */
export async function extractBrandFileContent(
  fileUrl: string,
  fileName: string,
  fileType: string | null,
): Promise<ExtractedContent> {
  const ext = (fileType || fileName.split('.').pop() || '').toLowerCase()

  switch (ext) {
    case 'txt':
      return extractText(fileUrl, fileName)

    case 'doc':
    case 'docx':
      return extractDocx(fileUrl, fileName)

    case 'pdf':
      return extractPdf(fileUrl, fileName)

    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'svg':
      return extractImage(fileUrl, fileName, ext)

    default:
      return {
        fileName,
        fileType: ext,
        textContent: '',
        visualDescription: null,
        pageCount: null,
        extractionMethod: 'text',
        error: `Unsupported file type: ${ext}`,
      }
  }
}

/** Extract content from multiple brand files in parallel (with concurrency limit) */
export async function extractAllBrandFiles(
  files: Array<{ file_name: string; file_url: string; file_type: string | null }>,
  concurrency = 3,
): Promise<ExtractedContent[]> {
  const results: ExtractedContent[] = []
  const queue = [...files]

  async function worker() {
    while (queue.length > 0) {
      const file = queue.shift()!
      const content = await extractBrandFileContent(file.file_url, file.file_name, file.file_type)
      results.push(content)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, files.length) }, () => worker())
  await Promise.all(workers)

  return results
}

// ── Content-based file classification ─────────────────────────
// Classifies files by CONTENT, not filename. Detects what brand
// information a file contains and extracts structured fields.

export interface BrandFieldDetection {
  /** Whether this file contains voice / tone guidance */
  hasVoice: boolean
  /** Extracted voice description, if found */
  voice: string | null
  /** Extracted tone keywords, if found */
  toneKeywords: string[]
  /** Whether this file contains brand colour definitions */
  hasColours: boolean
  /** Extracted colour hex values, if found */
  colours: string[]
  /** Whether this file contains a brand promise or positioning statement */
  hasPromise: boolean
  /** Extracted promise / positioning text, if found */
  promise: string | null
  /** Whether this file is likely the primary logo asset */
  isLogo: boolean
  /** Whether this file is likely an icon / mark (not the full logo) */
  isIcon: boolean
  /** Whether this file is a comprehensive brand identity guide */
  isBrandGuide: boolean
  /** Short label describing what kind of file this is */
  classificationLabel: string
  /** Confidence: 'high' | 'medium' | 'low' */
  confidence: 'high' | 'medium' | 'low'
}

export interface ClassifiedFile {
  fileName: string
  fileType: string
  detection: BrandFieldDetection
}

export interface BrandProfileSuggestion {
  /** Voice description aggregated from all files */
  brand_voice: string | null
  /** Tone keywords aggregated from all files */
  tone_keywords: string[]
  /** Primary/secondary/accent colours aggregated from all files */
  primary_colors: string[]
  /** Brand promise / positioning aggregated from all files */
  description: string | null
  /** Which file was identified as the brand guide */
  brandGuideFile: string | null
  /** Which file was identified as the logo */
  logoFile: string | null
  /** Per-file classifications */
  files: ClassifiedFile[]
}

/** Classify a single file's extracted content to detect brand information */
async function classifyFileContent(
  extracted: ExtractedContent,
): Promise<BrandFieldDetection> {
  const content = (extracted.textContent || '') + '\n' + (extracted.visualDescription || '')
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(extracted.fileType)

  // For images, use a simpler heuristic + any vision description
  if (isImage && content.trim().length < 50) {
    // Minimal content — likely a logo or icon image
    const nameLower = extracted.fileName.toLowerCase()
    const looksLikeLogo = /logo|logotype|wordmark|brand.?mark/i.test(nameLower) || /logo|logotype|wordmark/i.test(content)
    const looksLikeIcon = /icon|favicon|mark|symbol/i.test(nameLower) || /icon|favicon|app.?icon/i.test(content)
    return {
      hasVoice: false, voice: null, toneKeywords: [],
      hasColours: false, colours: [],
      hasPromise: false, promise: null,
      isLogo: looksLikeLogo && !looksLikeIcon,
      isIcon: looksLikeIcon,
      isBrandGuide: false,
      classificationLabel: looksLikeLogo ? 'Logo' : looksLikeIcon ? 'Icon / mark' : 'Image asset',
      confidence: 'medium',
    }
  }

  // For images with vision descriptions, classify from the description
  if (isImage && content.trim().length >= 50) {
    const hasLogo = /logo|logotype|wordmark|brand.?mark/i.test(content)
    const hasIcon = /icon|favicon|app.?icon|symbol/i.test(content)
    const hexMatches = content.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) || []
    return {
      hasVoice: false, voice: null, toneKeywords: [],
      hasColours: hexMatches.length > 0,
      colours: [...new Set(hexMatches.map(c => c.toUpperCase()))].slice(0, 12),
      hasPromise: false, promise: null,
      isLogo: hasLogo && !hasIcon,
      isIcon: hasIcon,
      isBrandGuide: false,
      classificationLabel: hasLogo ? 'Logo' : hasIcon ? 'Icon / mark' : 'Image asset',
      confidence: hexMatches.length > 0 ? 'medium' : 'low',
    }
  }

  // For documents (PDF, DOCX, TXT), use Claude to classify content
  if (content.trim().length < 20) {
    return {
      hasVoice: false, voice: null, toneKeywords: [],
      hasColours: false, colours: [],
      hasPromise: false, promise: null,
      isLogo: false, isIcon: false, isBrandGuide: false,
      classificationLabel: 'Empty or unreadable',
      confidence: 'low',
    }
  }

  try {
    const client = getAnthropicClient()
    const truncated = content.slice(0, 15_000)

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Analyze this document content and classify what brand identity information it contains. Respond ONLY with valid JSON matching this exact schema — no markdown, no explanation:

{
  "hasVoice": boolean,
  "voice": "extracted voice/tone description or null",
  "toneKeywords": ["keyword1", "keyword2"],
  "hasColours": boolean,
  "colours": ["#HEX1", "#HEX2"],
  "hasPromise": boolean,
  "promise": "extracted brand promise/positioning statement or null",
  "isBrandGuide": boolean,
  "classificationLabel": "short label like: Brand identity guide, Voice guidelines, Colour palette, Messaging document, Style guide, Mission statement, etc.",
  "confidence": "high" | "medium" | "low"
}

Rules:
- hasVoice: true if the document defines brand voice, tone, communication style, or personality traits.
- voice: if hasVoice, extract a concise description of the voice (1-3 sentences). Null otherwise.
- toneKeywords: if hasVoice, extract 3-5 tone keywords (e.g. "confident", "approachable"). Empty array otherwise.
- hasColours: true if the document specifies brand colours with hex values, RGB, or named colours.
- colours: extract ONLY hex colour values (#RRGGBB format). Include primary, secondary, accent only. Max 6. Empty if no colours found.
- hasPromise: true if the document contains a brand promise, positioning statement, mission, vision, or value proposition.
- promise: if hasPromise, extract the most concise version (1-2 sentences). Null otherwise.
- isBrandGuide: true if this is a comprehensive brand identity guide covering multiple brand elements (logo usage, colours, typography, voice, etc.)
- classificationLabel: a short human-readable label for what this document is.
- confidence: "high" if the content clearly and explicitly defines brand elements, "medium" if it contains some brand info mixed with other content, "low" if brand info is inferred or sparse.

Document file name (use as a WEAK hint only — classify primarily by content):
"${extracted.fileName}"

--- DOCUMENT CONTENT ---
${truncated}
--- END ---`,
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const raw = (textBlock?.text || '').trim()

    // Parse JSON — handle cases where Claude wraps in markdown code blocks
    let jsonStr = raw
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim()

    const parsed = JSON.parse(jsonStr)

    return {
      hasVoice: !!parsed.hasVoice,
      voice: typeof parsed.voice === 'string' ? parsed.voice.trim() || null : null,
      toneKeywords: Array.isArray(parsed.toneKeywords) ? parsed.toneKeywords.filter((k: unknown) => typeof k === 'string').slice(0, 8) : [],
      hasColours: !!parsed.hasColours,
      colours: Array.isArray(parsed.colours) ? parsed.colours.filter((c: unknown) => typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c as string)).slice(0, 12) : [],
      hasPromise: !!parsed.hasPromise,
      promise: typeof parsed.promise === 'string' ? parsed.promise.trim() || null : null,
      isLogo: false,
      isIcon: false,
      isBrandGuide: !!parsed.isBrandGuide,
      classificationLabel: typeof parsed.classificationLabel === 'string' ? parsed.classificationLabel : 'Document',
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium',
    }
  } catch (err) {
    console.warn(`[brand-classifier] Classification failed for ${extracted.fileName}:`, (err as Error).message)
    // Fallback: use basic heuristic from content
    const hexMatches = content.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) || []
    return {
      hasVoice: false, voice: null, toneKeywords: [],
      hasColours: hexMatches.length > 0,
      colours: [...new Set(hexMatches.map(c => c.toUpperCase()))].slice(0, 12),
      hasPromise: false, promise: null,
      isLogo: false, isIcon: false, isBrandGuide: false,
      classificationLabel: 'Document',
      confidence: 'low',
    }
  }
}

/**
 * Classify all brand files by content and build a brand profile suggestion.
 * Aggregates detected fields across all files into a single suggestion.
 */
export async function classifyAndSuggestProfile(
  files: Array<{ file_name: string; file_url: string; file_type: string | null }>,
): Promise<BrandProfileSuggestion> {
  // Step 1: Extract content from all files
  const extractions = await extractAllBrandFiles(files, 3)

  // Step 2: Classify each file by content
  const classifications: ClassifiedFile[] = []
  for (const ext of extractions) {
    const detection = await classifyFileContent(ext)
    classifications.push({ fileName: ext.fileName, fileType: ext.fileType, detection })
  }

  // Step 3: Aggregate — pick the highest-confidence data for each field
  let bestVoice: string | null = null
  let bestVoiceConf = 0
  const allToneKeywords: string[] = []
  const allColours: string[] = []
  let bestPromise: string | null = null
  let bestPromiseConf = 0
  let brandGuideFile: string | null = null
  let logoFile: string | null = null

  const confScore = (c: string) => c === 'high' ? 3 : c === 'medium' ? 2 : 1

  for (const cf of classifications) {
    const d = cf.detection
    const cs = confScore(d.confidence)

    if (d.hasVoice && d.voice && cs > bestVoiceConf) {
      bestVoice = d.voice
      bestVoiceConf = cs
    }
    if (d.toneKeywords.length > 0) allToneKeywords.push(...d.toneKeywords)
    if (d.hasColours && d.colours.length > 0) allColours.push(...d.colours)
    if (d.hasPromise && d.promise && cs > bestPromiseConf) {
      bestPromise = d.promise
      bestPromiseConf = cs
    }
    if (d.isBrandGuide && !brandGuideFile) brandGuideFile = cf.fileName
    if (d.isLogo && !logoFile) logoFile = cf.fileName
  }

  // Dedupe tone keywords and colours
  const uniqueKeywords = [...new Set(allToneKeywords.map(k => k.toLowerCase()))].slice(0, 8)
  const uniqueColours = [...new Set(allColours.map(c => c.toUpperCase()))].slice(0, 6)

  return {
    brand_voice: bestVoice,
    tone_keywords: uniqueKeywords,
    primary_colors: uniqueColours,
    description: bestPromise,
    brandGuideFile,
    logoFile,
    files: classifications,
  }
}
