import {
  buildPageCaptureRows,
  captureStatusFromCrawl,
  CAPTURE_SCHEMA_VERSION,
  CAPTURE_RENDERER_VERSION,
  type AuditPageRow,
} from '../page-capture'
import type { DomFacts } from '@/lib/audit-engine/pipeline/dom-verification'

const dom: DomFacts = {
  landmarks: { main: true, nav: 1, header: true, footer: true, skipLink: false },
  headings: [1, 2, 2, 3],
  forms: { totalControls: 4, labeledControls: 2, requiredMarked: 1 },
  links: [{ text: 'Pricing', href: 'https://x.com/pricing' }],
  langAttr: 'en',
  viewportMeta: true,
}

const page: AuditPageRow = {
  url: 'https://x.com/en/signup',
  title: 'Sign Up | X',
  h1: 'Create your account',
  meta_description: 'Join X',
  content_text: 'Sign up now',
  status_code: 200,
  crawl_status: 'success',
  fetch_strategy: 'jina',
  screenshot_url: 'https://cdn/x/shot.png',
  canonical_url: 'https://x.com/en/signup',
  viewport_meta: 'width=device-width',
  has_structured_data: false,
  crawled_at: '2026-06-15T21:00:00Z',
}

describe('captureStatusFromCrawl', () => {
  it('maps crawl status to lifecycle state', () => {
    expect(captureStatusFromCrawl('success')).toBe('complete')
    expect(captureStatusFromCrawl('blocked')).toBe('failed')
    expect(captureStatusFromCrawl('failed')).toBe('failed')
    expect(captureStatusFromCrawl(null)).toBe('partial')
    expect(captureStatusFromCrawl('weird')).toBe('partial')
  })
})

describe('buildPageCaptureRows', () => {
  const rows = buildPageCaptureRows({
    auditId: 'aud-1', workspaceId: 'ws-1', userId: 'user-1',
    pages: [page], domFactsByUrl: { 'https://x.com/en/signup': dom },
  })

  it('produces one row per page with versioning + scoping', () => {
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(r.audit_id).toBe('aud-1')
    expect(r.workspace_id).toBe('ws-1')
    expect(r.user_id).toBe('user-1')
    expect(r.capture_schema_version).toBe(CAPTURE_SCHEMA_VERSION)
    expect(r.capture_renderer_version).toBe(CAPTURE_RENDERER_VERSION)
    expect(r.page_status).toBe('complete')
  })

  it('carries normalized fields + DOM facts', () => {
    const r = rows[0]
    expect(r.title).toBe('Sign Up | X')
    expect(r.h1).toBe('Create your account')
    expect(r.lang).toBe('en')
    expect(r.headings).toEqual([1, 2, 2, 3])
    expect(r.form_presence).toEqual(dom.forms)
    expect(r.dom_facts).toEqual(dom)
    expect(r.extracted_text).toBe('Sign up now')
    expect(r.fetch_strategy).toBe('jina')
    expect((r.meta as any).description).toBe('Join X')
  })

  it('reuses the stored screenshot URL as a screenshot key; blob keys null in Phase 1', () => {
    const r = rows[0]
    expect(r.screenshot_keys).toEqual(['https://cdn/x/shot.png'])
    expect(r.rendered_html_key).toBeNull()
    expect(r.axe_raw_key).toBeNull()
  })

  it('matches DOM facts tolerant of trailing slashes', () => {
    const r = buildPageCaptureRows({
      auditId: 'a', workspaceId: null, userId: null,
      pages: [{ url: 'https://x.com/en' }],
      domFactsByUrl: { 'https://x.com/en/': dom },
    })[0]
    expect(r.lang).toBe('en') // matched despite trailing-slash difference
  })

  it('degrades safely when DOM facts are missing (still captures the page)', () => {
    const r = buildPageCaptureRows({
      auditId: 'a', workspaceId: null, userId: null,
      pages: [{ url: 'https://x.com/en/blog', title: 'Blog', crawl_status: 'success' }],
      domFactsByUrl: {},
    })[0]
    expect(r.page_url).toBe('https://x.com/en/blog')
    expect(r.headings).toBeNull()
    expect(r.dom_facts).toBeNull()
    expect(r.page_status).toBe('complete')
  })

  it('skips rows with no usable URL and tolerates null domFactsByUrl', () => {
    const rows2 = buildPageCaptureRows({
      auditId: 'a', workspaceId: null, userId: null,
      pages: [{ url: '' }, { url: 'https://x.com/ok' }],
      domFactsByUrl: null,
    })
    expect(rows2).toHaveLength(1)
    expect(rows2[0].page_url).toBe('https://x.com/ok')
  })
})
