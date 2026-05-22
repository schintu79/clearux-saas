'use client'

import Link from 'next/link'
import { SectionMarker } from '@/components/marketing/SectionMarker'
import { Button } from '@/components/marketing/Button'
import { ArrowRightIcon } from '@/components/marketing/icons'

/* ── Static placeholder articles (will be replaced by Supabase CMS) ── */
const ARTICLES = [
  {
    slug: 'what-is-website-health-score',
    title: 'What is a Website Health Score?',
    excerpt: 'Your Website Health Score is a composite metric that tells you how well your site performs across UX, accessibility, AI readiness, and more.',
    category: 'Getting started',
    readTime: '4 min',
  },
  {
    slug: 'fix-dark-patterns',
    title: 'How to identify and fix dark patterns',
    excerpt: 'Dark patterns erode trust and may violate consumer protection laws. Here is how to find them on your site and what to do about them.',
    category: 'UX',
    readTime: '6 min',
  },
  {
    slug: 'ai-visibility-guide',
    title: 'A practical guide to AI visibility',
    excerpt: 'AI agents are reading your site for their users. Learn how to ensure they get accurate information about your business.',
    category: 'AI readiness',
    readTime: '8 min',
  },
  {
    slug: 'wcag-accessibility-basics',
    title: 'WCAG 2.1 AA: what you actually need to do',
    excerpt: 'Accessibility compliance can feel overwhelming. This guide breaks down the most impactful changes you can make today.',
    category: 'Accessibility',
    readTime: '7 min',
  },
  {
    slug: 'seo-structure-audit',
    title: 'SEO structure: what your audit is really checking',
    excerpt: 'Heading hierarchy, canonical URLs, internal linking, and metadata. What matters most and how to fix common issues.',
    category: 'SEO',
    readTime: '5 min',
  },
  {
    slug: 'wordpress-audit-workflow',
    title: 'The WordPress audit workflow',
    excerpt: 'How to use the Fixpath WordPress plugin to audit, fix, and track improvements without leaving your admin panel.',
    category: 'WordPress',
    readTime: '4 min',
  },
]

export function ResourcesContent() {
  return (
    <main>
      {/* Hero */}
      <section className="py-20 sm:py-[100px] border-b border-rule">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <p className="font-mono text-[11px] tracking-[0.12em] uppercase text-signal mb-6">Resources</p>
          <h1 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6" style={{ fontSize: 'clamp(44px, 6vw, 80px)' }}>
            Learn how to improve{' '}
            <em className="italic text-signal">your site.</em>
          </h1>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] font-sans">
            Guides, tutorials, and best practices for improving website health, accessibility,
            SEO, and AI visibility.
          </p>
        </div>
      </section>

      {/* Articles grid */}
      <section className="py-[80px] max-sm:py-12">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ARTICLES.map((article) => (
              <article
                key={article.slug}
                className="group rounded-[4px] border border-rule p-6 hover:border-ink transition-colors"
                style={{ background: 'var(--paper)' }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-signal">{article.category}</span>
                  <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted">{article.readTime}</span>
                </div>
                <h2 className="font-sans text-[17px] font-semibold text-ink mb-2 group-hover:text-signal transition-colors">
                  {article.title}
                </h2>
                <p className="font-sans text-[14px] text-ink-2 leading-relaxed">{article.excerpt}</p>
              </article>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="font-sans text-[15px] text-m-muted">
              More resources coming soon. Want to be notified?
            </p>
            <Button href="/register" className="mt-4">
              Create a free account
              <ArrowRightIcon size={14} />
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
