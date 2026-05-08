// ============================================================
// ClearUX — Brand File Content Extractor
// Extracts text + visual descriptions from uploaded brand files.
// Supports: PDF (via Claude vision), DOCX (xml parsing), TXT,
// and images (PNG, JPG, SVG, WebP via Claude vision).
// ============================================================

import Anthropic from '@anthropic-ai/sdk'

let _anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')
    _anthropic = new Anthropic({ apiKey, timeout: 60_000 })
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

/** Use Claude vision to extract text from a PDF page image */
async function describePdfPage(
  imageBuffer: Buffer,
  pageNumber: number,
  totalPages: number,
  fileName: string,
): Promise<string> {
  const client = getAnthropicClient()
  const base64 = imageBuffer.toString('base64')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: base64 },
          },
          {
            type: 'text',
            text: `This is page ${pageNumber} of ${totalPages} from the brand document "${fileName}".

Extract and describe:
1. **All text content** — transcribe every word visible on this page.
2. **Visual layout** — describe the layout structure (columns, headers, sidebars, etc.).
3. **Design elements** — colors, fonts, images, logos, icons visible.
4. **Brand signals** — any brand-related elements (taglines, value props, tone of voice clues).

Be thorough and accurate.`,
          },
        ],
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

/** Extract content from a PDF using Claude's document understanding */
async function extractPdf(url: string, fileName: string): Promise<ExtractedContent> {
  try {
    const { buffer } = await fetchFile(url)
    const client = getAnthropicClient()
    const base64 = buffer.toString('base64')

    // Use Claude's native PDF support via document content block
    // The 'document' type is supported by the API but not in SDK v0.27 types
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

1. **ALL text content** — transcribe everything, preserving section structure.
2. **Visual design** — describe colors, typography, layout, imagery, logos.
3. **Brand elements** — taglines, value propositions, tone of voice, brand guidelines.
4. **Document quality** — formatting consistency, professional polish, any issues.

Document: ${fileName}

Be thorough — this will be used for automated brand analysis.`,
            },
          ],
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const content = textBlock?.text || ''

    return {
      fileName,
      fileType: 'pdf',
      textContent: content,
      visualDescription: 'Extracted via Claude document understanding',
      pageCount: null,
      extractionMethod: 'hybrid',
      error: null,
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
  concurrency = 5,
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
