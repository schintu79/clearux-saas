// ============================================================
// ClearUX API — GET /api/reports/:id/pdf
// HTML template → Puppeteer → PDF
// Uses the canonical report-template design for pixel-perfect output.
// ============================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { getLocale, getScoreLabel } from '@/lib/languages'
import { renderWebsiteReport, type WebsiteReportData } from '@/lib/report-template/render-website-report'
import { renderBrandReport, type BrandReportData } from '@/lib/report-template/render-brand-report'

/* ── Main route ───────────────────────────────────────────── */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: auditId } = await params

    // ── Auth ──────────────────────────────────────────────
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceSupabase()
    const { data: ownerCheck } = await db.from('audits').select('user_id').eq('id', auditId).single()
    if (!ownerCheck || ((ownerCheck as any).user_id !== user.id && user.email !== 's.schintu@gmail.com'))
      return NextResponse.json({ error: 'Not authorized to access this report' }, { status: 403 })

    // ── Fetch data ────────────────────────────────────────
    const [auditRes, reportRes, findingsRes, pagesRes] = await Promise.all([
      db.from('audits').select('*').eq('id', auditId).single(),
      db.from('reports').select('*').eq('audit_id', auditId).single(),
      db.from('audit_findings').select('*, screenshot_url, target_element').eq('audit_id', auditId)
        .order('severity', { ascending: true }).order('sort_order', { ascending: true }),
      db.from('audit_pages').select('url, title, status_code, load_time_ms, screenshot_url')
        .eq('audit_id', auditId).order('crawled_at', { ascending: true }),
    ])

    if (auditRes.error || !auditRes.data)
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    if (reportRes.error || !reportRes.data)
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const a = auditRes.data as any
    const r = reportRes.data as any
    const f = (findingsRes.data || []) as any[]
    const pages = (pagesRes.data || []) as any[]

    // White label
    const { data: wlSettings } = await db
      .from('white_label_settings')
      .select('*')
      .eq('user_id', a.user_id)
      .eq('is_active', true)
      .single()

    const wlCompany: string | null = (wlSettings as any)?.company_name || a.white_label_company_name || null
    const wlFooterText: string | null = (wlSettings as any)?.footer_text || null

    const lang = a.language || 'en'
    const rawJson = r.raw_json || {}
    const isBrandAudit = rawJson.type === 'brand_identity'

    let domain = 'audit'
    if (isBrandAudit) {
      domain = rawJson.brandName || 'Brand Identity Audit'
    } else {
      try { domain = new URL(a.product_url).hostname.replace(/^www\./, '') } catch {}
    }

    const dateStr = new Date(a.created_at).toLocaleDateString(getLocale(lang), {
      year: 'numeric', month: 'long', day: 'numeric',
    })
    const topRecs: string[] = rawJson.topRecommendations || (rawJson.keyRecommendation ? [rawJson.keyRecommendation] : [])

    // ── Render HTML ───────────────────────────────────────
    let html: string

    if (isBrandAudit) {
      const catResults = (rawJson.categoryResults || rawJson._baselineCategoryScores || []).map((c: any) => ({
        name: c.name,
        slug: c.slug,
        score: c.score,
        summary: c.summary || '',
        weight: c.weight,
      }))

      const brandData: BrandReportData = {
        brandName: domain,
        overallScore: r.overall_score ?? 0,
        executiveSummary: r.executive_summary || '',
        totalIssues: r.total_issues || 0,
        dateStr,
        language: lang,
        categoryResults: catResults,
        findings: f.map(fn => ({
          severity: fn.severity,
          title: fn.title,
          description: fn.description,
          recommendation: fn.recommendation,
          estimated_impact: fn.estimated_impact,
          page_url: fn.page_url,
        })),
        topRecommendations: topRecs,
        whiteLabel: wlCompany ? { companyName: wlCompany, footerText: wlFooterText || undefined } : undefined,
      }
      html = renderBrandReport(brandData)
    } else {
      const catScores = (rawJson?.categoryScores && Array.isArray(rawJson.categoryScores) ? rawJson.categoryScores : [])
        .map((c: any) => ({ name: c.name, score: c.score, summary: c.summary || '' }))

      // Build checkpoint results from raw data if available
      const checkpointResults: Record<string, Array<{ label: string; status: 'pass' | 'warn' | 'fail' }>> = {}
      if (rawJson.checkpointResults) {
        for (const [catName, results] of Object.entries(rawJson.checkpointResults)) {
          checkpointResults[catName] = (results as any[]).map((r: any) => ({
            label: r.label || r.name || '',
            status: r.status || (r.score >= 70 ? 'pass' : r.score >= 40 ? 'warn' : 'fail'),
          }))
        }
      }

      const websiteData: WebsiteReportData = {
        domain,
        productUrl: a.product_url || domain,
        overallScore: r.overall_score ?? 0,
        executiveSummary: r.executive_summary || '',
        totalIssues: r.total_issues || 0,
        dateStr,
        language: lang,
        categoryScores: catScores,
        findings: f.map(fn => ({
          severity: fn.severity,
          title: fn.title,
          description: fn.description,
          recommendation: fn.recommendation,
          estimated_impact: fn.estimated_impact,
          page_url: fn.page_url,
        })),
        pages: pages.map(pg => ({
          url: pg.url,
          title: pg.title || 'Untitled',
          status_code: pg.status_code,
        })),
        topRecommendations: topRecs,
        checkpointResults: Object.keys(checkpointResults).length > 0 ? checkpointResults : undefined,
        whiteLabel: wlCompany ? { companyName: wlCompany, footerText: wlFooterText || undefined } : undefined,
      }
      html = renderWebsiteReport(websiteData)
    }

    // ── HTML → PDF via Puppeteer ──────────────────────────
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteer = (await import('puppeteer-core')).default

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chr = chromium as any
    if ('setHeadlessMode' in chromium) chr.setHeadlessMode = true
    if ('setGraphicsMode' in chromium) chr.setGraphicsMode = false

    const executablePath = await chromium.executablePath()

    const browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
      defaultViewport: { width: 794, height: 1123 }, // A4 at 96dpi
      executablePath,
      headless: true,
    })

    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 })

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
        // Margins are in the HTML template itself
      })

      const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_')
      const brandLabel = wlCompany
        ? wlCompany.replace(/[^a-zA-Z0-9 .-]/g, '').replace(/\s+/g, '-')
        : 'ClearUX'

      return new NextResponse(pdfBuffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${brandLabel}-Audit-${safeDomain}.pdf"`,
          'Cache-Control': 'no-store',
        },
      })
    } finally {
      await browser.close()
    }

  } catch (err) {
    console.error('[PDF] Error generating report:', err)
    return NextResponse.json(
      { error: 'Failed to generate PDF report', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
