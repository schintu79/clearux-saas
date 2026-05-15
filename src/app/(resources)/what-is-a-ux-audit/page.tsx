import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { Sparkles, CheckCircle, ArrowRight } from 'lucide-react'

const BASE_URL = 'https://clearux.ai'

export const metadata: Metadata = {
  title: 'What Is a UX Audit? Definition, Process & Why It Matters | ClearUX',
  description:
    'Learn what a UX audit is, why your product needs one, and how the UX audit process works. Discover what gets evaluated — from accessibility to ethical design — and how ClearUX automates the entire workflow.',
  keywords: [
    'what is a ux audit',
    'ux audit definition',
    'ux audit process',
    'user experience audit',
    'ux review',
    'website ux audit',
  ],
  alternates: { canonical: `${BASE_URL}/what-is-a-ux-audit` },
  openGraph: {
    title: 'What Is a UX Audit? Definition, Process & Why It Matters',
    description:
      'A complete guide to understanding UX audits: what they cover, why they matter, and how to run one efficiently.',
    url: `${BASE_URL}/what-is-a-ux-audit`,
    siteName: 'ClearUX',
    type: 'article',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'What Is a UX Audit? Definition, Process & Why It Matters',
  description:
    'A complete guide to understanding UX audits: what they cover, why they matter, and how to run one efficiently.',
  url: `${BASE_URL}/what-is-a-ux-audit`,
  publisher: {
    '@type': 'Organization',
    name: 'ClearUX',
    url: BASE_URL,
  },
  datePublished: '2025-01-15',
  dateModified: '2026-04-24',
}

export default function WhatIsAUxAuditPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main id="main-content" className="bg-surface">
        <article className="max-w-3xl mx-auto px-4 py-16 sm:py-24">
          {/* ── H1 ── */}
          <h1 className="font-heading font-medium text-3xl sm:text-4xl text-text mb-6">
            What Is a UX Audit? A Complete Guide to the Process
          </h1>
          <p className="text-lg text-muted mb-12 leading-relaxed">
            A UX audit is a systematic evaluation of a digital product&apos;s user
            experience. It uncovers usability issues, accessibility gaps,
            conversion blockers, and ethical design concerns — giving teams a
            clear, prioritized roadmap for improvement. Whether you call it a UX
            review, a heuristic evaluation, or a design audit, the goal is the
            same: understand where your product falls short and what to fix
            first.
          </p>

          {/* ── Section: Definition ── */}
          <section className="mb-12">
            <h2 className="font-heading font-medium text-2xl text-text mb-4">
              UX Audit Definition
            </h2>
            <p className="text-text/80 leading-relaxed mb-4">
              At its core, a UX audit is a structured, evidence-based review of
              how real users interact with your website or application. Unlike a
              quick design critique, a proper audit follows established
              frameworks — Nielsen&apos;s heuristics, WCAG accessibility standards,
              conversion-rate best practices, and ethical design principles — to
              produce measurable findings rather than subjective opinions.
            </p>
            <p className="text-text/80 leading-relaxed">
              The output is typically a report that scores each area, documents
              specific issues with screenshots or recordings, and recommends
              concrete fixes ranked by severity and business impact. Think of it
              as a health check-up for your product: you might feel fine, but an
              audit reveals what&apos;s actually going on under the surface.
            </p>
          </section>

          {/* ── Section: Why ── */}
          <section className="mb-12">
            <h2 className="font-heading font-medium text-2xl text-text mb-4">
              Why Your Product Needs a UX Audit
            </h2>
            <p className="text-text/80 leading-relaxed mb-4">
              Most teams don&apos;t ship bad experiences on purpose. Problems
              accumulate gradually — a rushed feature here, an inherited design
              pattern there — until the product quietly haemorrhages users. A UX
              audit catches what day-to-day development misses.
            </p>
            <ul className="space-y-3 mb-4">
              {[
                'Reduce churn by identifying friction points that cause users to abandon key flows.',
                'Improve conversion rates by removing unnecessary steps, confusing copy, or hidden calls to action.',
                'Meet accessibility requirements (WCAG 2.2) and avoid legal exposure in jurisdictions with digital accessibility laws.',
                'Build user trust by eliminating dark patterns, misleading interfaces, and manipulative design choices.',
                'Align cross-functional teams around objective data instead of competing opinions about what to fix next.',
              ].map((item) => (
                <li key={item} className="flex gap-3 text-text/80 leading-relaxed">
                  <CheckCircle size={18} className="text-brand mt-1 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-text/80 leading-relaxed">
              Companies that conduct regular audits consistently outperform those
              that rely on ad-hoc feedback. The data replaces guesswork with
              clarity.
            </p>
          </section>

          {/* ── Section: What Gets Evaluated ── */}
          <section className="mb-12">
            <h2 className="font-heading font-medium text-2xl text-text mb-4">
              What a UX Audit Evaluates
            </h2>
            <p className="text-text/80 leading-relaxed mb-6">
              A thorough UX audit process covers four pillars. Each pillar
              addresses a different dimension of the user experience, and
              skipping any one of them leaves blind spots.
            </p>

            <div className="space-y-6">
              <div className="p-6 rounded-2xl border border-border bg-card">
                <h3 className="font-heading font-medium text-lg text-text mb-2">
                  Accessibility
                </h3>
                <p className="text-text/80 leading-relaxed">
                  Does every user — regardless of ability — have equal access?
                  This includes colour contrast, keyboard navigation, screen
                  reader support, focus management, and ARIA labelling. The audit
                  checks compliance with WCAG 2.2 at the AA level and flags
                  issues by severity.
                </p>
              </div>
              <div className="p-6 rounded-2xl border border-border bg-card">
                <h3 className="font-heading font-medium text-lg text-text mb-2">
                  Usability
                </h3>
                <p className="text-text/80 leading-relaxed">
                  Can users accomplish their goals efficiently? The audit
                  evaluates navigation clarity, information architecture, form
                  design, error handling, mobile responsiveness, and cognitive
                  load. Each issue is mapped to a recognised usability heuristic.
                </p>
              </div>
              <div className="p-6 rounded-2xl border border-border bg-card">
                <h3 className="font-heading font-medium text-lg text-text mb-2">
                  Conversion & Engagement
                </h3>
                <p className="text-text/80 leading-relaxed">
                  Is the product designed to guide users toward meaningful
                  actions? This pillar examines call-to-action clarity, page load
                  performance, trust signals, onboarding flows, and overall
                  content strategy. Small improvements here often drive outsized
                  revenue gains.
                </p>
              </div>
              <div className="p-6 rounded-2xl border border-border bg-card">
                <h3 className="font-heading font-medium text-lg text-text mb-2">
                  Ethical Design
                </h3>
                <p className="text-text/80 leading-relaxed">
                  Does the interface respect the user? Ethical audits flag dark
                  patterns, manipulative language, hidden costs, forced
                  continuity, privacy-hostile defaults, and consent mechanisms
                  that don&apos;t meet GDPR or similar regulations. This pillar is
                  increasingly important as regulators tighten rules around
                  deceptive design.
                </p>
              </div>
            </div>
          </section>

          {/* ── Section: The Process ── */}
          <section className="mb-12">
            <h2 className="font-heading font-medium text-2xl text-text mb-4">
              The Typical UX Audit Process
            </h2>
            <p className="text-text/80 leading-relaxed mb-4">
              A traditional UX audit follows a predictable workflow. A
              consultant or internal team defines the scope, reviews the product
              against a{' '}
              <Link href="/ux-audit-checklist" className="text-text font-medium underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">
                UX audit checklist
              </Link>
              , documents findings, scores each area, and delivers a report with
              recommendations. The entire cycle typically takes two to six weeks
              and costs anywhere from $5,000 to $30,000 depending on the
              product&apos;s complexity.
            </p>
            <p className="text-text/80 leading-relaxed mb-4">
              While the manual approach produces valuable insights, it has
              obvious drawbacks: it&apos;s slow, expensive, subjective (two
              consultants will flag different issues), and produces a static
              snapshot that goes stale the moment the product ships a new
              feature.
            </p>
            <p className="text-text/80 leading-relaxed">
              That&apos;s why more teams are turning to{' '}
              <Link href="/best-ux-audit-tools" className="text-text font-medium underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">
                UX audit tools
              </Link>{' '}
              that can automate large parts of the process while maintaining
              expert-level depth.
            </p>
          </section>

          {/* ── Section: ClearUX ── */}
          <section className="mb-12">
            <h2 className="font-heading font-medium text-2xl text-text mb-4">
              How ClearUX Automates the UX Audit Process
            </h2>
            <p className="text-text/80 leading-relaxed mb-4">
              ClearUX replaces the manual audit workflow with an AI-powered
              platform that evaluates your product across all four pillars — 16
              categories in total — in minutes, not weeks. You submit a URL, and
              ClearUX returns a comprehensive report with scores, issue
              descriptions, severity ratings, and actionable recommendations.
            </p>
            <p className="text-text/80 leading-relaxed mb-4">
              Every audit is repeatable and consistent. Run one after each
              sprint, compare scores over time, and share interactive reports
              with stakeholders — no more 80-page PDFs that nobody reads.
              Because the entire{' '}
              <Link href="/ux-audit-checklist" className="text-text font-medium underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">
                checklist
              </Link>{' '}
              is built in, nothing gets missed.
            </p>
            <p className="text-text/80 leading-relaxed">
              The result is faster feedback loops, lower cost, and a living
              audit trail that evolves with your product.
            </p>
          </section>

          {/* ── CTA ── */}
          <div
            className="mt-16 text-center p-8 rounded-2xl"
            style={{ background: 'var(--gradient-brand-subtle)' }}
          >
            <h2 className="font-heading font-medium text-2xl text-text mb-3">
              Ready to audit your product?
            </h2>
            <p className="text-muted mb-6">
              Get a comprehensive UX audit in minutes — not weeks. No
              consultants, no waiting.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-brand text-[#111] font-medium px-6 py-3 rounded-xl hover:brightness-110 transition-all"
            >
              <Sparkles size={16} /> Get your free audit
            </Link>
          </div>

          {/* ── Related ── */}
          <nav className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted mb-3 font-medium uppercase tracking-wider">
              Related resources
            </p>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/ux-audit-checklist"
                  className="inline-flex items-center gap-1 text-text font-medium underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity"
                >
                  UX Audit Checklist <ArrowRight size={14} />
                </Link>
              </li>
              <li>
                <Link
                  href="/best-ux-audit-tools"
                  className="inline-flex items-center gap-1 text-text font-medium underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity"
                >
                  Best UX Audit Tools <ArrowRight size={14} />
                </Link>
              </li>
            </ul>
          </nav>
        </article>
      </main>
      <Footer />
    </>
  )
}
