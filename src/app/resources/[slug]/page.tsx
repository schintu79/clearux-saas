import Link from 'next/link'
import { notFound } from 'next/navigation'

/* ── Static placeholder articles (mirrors ResourcesContent.tsx) ── */
const ARTICLES: Record<string, { title: string; category: string; readTime: string; content: string }> = {
  'what-is-website-health-score': {
    title: 'What is a Website Health Score?',
    category: 'Getting started',
    readTime: '4 min',
    content: `Your Website Health Score is a composite metric that tells you how well your site performs across UX, accessibility, AI readiness, and more. Fixpath calculates it by running 96 checkpoints across six modules, weighting each finding by severity and impact.\n\nThe score ranges from 0 to 100. A score above 80 indicates a well-maintained site with no critical issues. Between 50 and 80, there are meaningful improvements to make. Below 50, there are likely structural problems affecting user experience or discoverability.\n\nUnlike single-dimension tools that only check page speed or accessibility, the Website Health Score gives you a holistic view of your site across every dimension that matters — from how humans experience it to how AI systems read and represent it.`,
  },
  'fix-dark-patterns': {
    title: 'How to identify and fix dark patterns',
    category: 'UX',
    readTime: '6 min',
    content: `Dark patterns are deceptive design choices that trick users into actions they did not intend. They erode trust, increase churn, and may violate consumer protection regulations in the EU, US, and UK.\n\nFixpath scans for common dark patterns including: forced continuity (subscriptions that are easy to start, hard to cancel), confirmshaming (guilt-tripping language on opt-out buttons), hidden costs that appear late in checkout, and misdirection that draws attention away from important choices.\n\nTo fix dark patterns, start by auditing your conversion flows with Fixpath. Each flagged pattern includes the affected page, a severity rating, and a recommended fix. Prioritize anything rated "critical" — these are the patterns most likely to trigger regulatory action or drive users away permanently.`,
  },
  'ai-visibility-guide': {
    title: 'A practical guide to AI visibility',
    category: 'AI readiness',
    readTime: '8 min',
    content: `AI agents — from ChatGPT to Perplexity to Google AI Overviews — are reading your site on behalf of their users. When someone asks an AI about your industry, product category, or brand, the answer it gives depends on what it can find and understand about your site.\n\nAI visibility is not the same as SEO. Search engines index pages; AI systems interpret meaning. They rely on structured data, clear semantic markup, and explicit machine-readable signals like llms.txt files.\n\nFixpath checks your AI visibility across four dimensions: structured data completeness, LLM probe accuracy (what AI models say about you vs. reality), AI discovery file presence, and citation quality. Each finding includes what to fix and why it matters for how AI represents your business.`,
  },
  'wcag-accessibility-basics': {
    title: 'WCAG 2.1 AA: what you actually need to do',
    category: 'Accessibility',
    readTime: '7 min',
    content: `WCAG 2.1 AA is the most widely referenced accessibility standard. It covers four principles: Perceivable, Operable, Understandable, and Robust. Meeting AA compliance means your site works for people using screen readers, keyboard navigation, and assistive technologies.\n\nThe most impactful changes you can make today: ensure all images have descriptive alt text, maintain a colour contrast ratio of at least 4.5:1 for body text, make all interactive elements keyboard-accessible, and add proper ARIA labels to dynamic content.\n\nFixpath runs automated WCAG checks and flags violations by severity. Critical issues (like missing form labels or inaccessible navigation) are prioritized over advisory items. Each finding links directly to the relevant WCAG success criterion so you can understand the requirement and verify your fix.`,
  },
  'seo-structure-audit': {
    title: 'SEO structure: what your audit is really checking',
    category: 'SEO',
    readTime: '5 min',
    content: `SEO structure goes beyond keywords. It covers the technical foundation that search engines use to crawl, index, and rank your pages: heading hierarchy, canonical URLs, internal linking, metadata quality, and indexability signals.\n\nA proper heading hierarchy means one H1 per page, followed by H2s and H3s in logical order. Canonical URLs prevent duplicate content issues. Internal links distribute authority and help crawlers discover deep pages.\n\nFixpath checks all of this automatically. The SEO Structure module runs 16 checkpoints covering meta tags, heading structure, canonical URLs, internal linking patterns, and crawlability. Findings are ranked by impact — a missing canonical on your highest-traffic page matters more than a suboptimal meta description on a low-traffic blog post.`,
  },
  'wordpress-audit-workflow': {
    title: 'The WordPress audit workflow',
    category: 'WordPress',
    readTime: '4 min',
    content: `The Fixpath WordPress plugin lets you audit, fix, and track improvements without leaving your admin panel. Install it from the WordPress plugin directory, connect it to your Fixpath account, and run your first audit directly from the dashboard.\n\nThe plugin surfaces findings inside WordPress with direct links to the affected pages and templates. For many common issues — missing alt text, heading hierarchy problems, meta description gaps — you can apply fixes with one click.\n\nAfter fixing issues, re-audit to verify improvements and track your Website Health Score over time. The plugin syncs with your Fixpath dashboard so your team can see progress whether they work in WordPress or in the web app.`,
  },
}

export function generateStaticParams() {
  return Object.keys(ARTICLES).map((slug) => ({ slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const article = ARTICLES[params.slug]
  if (!article) return { title: 'Not found' }
  return {
    title: `${article.title} — Fixpath Resources`,
    description: article.content.slice(0, 160),
  }
}

export default function ResourceArticlePage({ params }: { params: { slug: string } }) {
  const article = ARTICLES[params.slug]
  if (!article) notFound()

  return (
    <main>
      <section className="py-20 sm:py-[100px] border-b border-rule">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <Link
            href="/resources"
            className="font-mono text-[11px] tracking-[0.12em] uppercase text-signal no-underline hover:underline mb-8 inline-block"
          >
            &larr; All resources
          </Link>
          <div className="flex items-center gap-3 mb-6">
            <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-signal">{article.category}</span>
            <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted">{article.readTime}</span>
          </div>
          <h1
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-8"
            style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}
          >
            {article.title}
          </h1>
        </div>
      </section>

      <section className="py-[60px] max-sm:py-10">
        <div className="max-w-[680px] mx-auto px-8 max-sm:px-5">
          {article.content.split('\n\n').map((para, i) => (
            <p key={i} className="font-sans text-[17px] leading-[1.75] text-ink-2 mb-6">
              {para}
            </p>
          ))}

          <div className="mt-16 pt-8 border-t border-rule">
            <p className="font-sans text-[15px] text-m-muted mb-4">
              Want to see these checks applied to your site?
            </p>
            <Link
              href="/register"
              className="font-sans text-[15px] font-semibold text-signal no-underline hover:underline"
            >
              Start your free audit &rarr;
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
