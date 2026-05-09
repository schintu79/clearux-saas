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

Be thorough — this description will be used by another AI to evaluate brand consistency.`,
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

Be thorough — this will be used for automated brand consistency analysis.`,
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
