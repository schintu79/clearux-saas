import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { Sparkles, CheckCircle, ArrowRight } from 'lucide-react'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fixpath.ai'

export const metadata: Metadata = {
  title: 'What Is a UX Audit? Definition, Process & Why It Matters | Fixpath',
  description:
    'Learn what a UX audit is, why your product needs one, and how the UX audit process works. Discover what gets evaluated — from accessibility to ethical design — and how Fixpath automates the entire workflow.',
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
    siteName: 'Fixpath',
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
  author: {
    '@type': 'Organization',
    name: 'Fixpath',
    url: BASE_URL,
  },
  publisher: {
    '@type': 'Organization',
    name: 'Fixpath',
    url: BASE_URL,
  },
  datePublished: '2025-01-15',
  dateModified: '2026-05-25',
  image: {
    '@type': 'ImageObject',
    url: `${BASE_URL}/og-image.png`,
    width: 1200,
    height: 630,
  },
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
            What Is a UX Audit? Find What&apos;s Hurting Your Website — and Fix It
          </h1>
          <p className="text-lg text-muted mb-4 leading-relaxed">
            Your website is losing trust right now, and you probably don&apos;t
            know where. A UX audit finds the real issues — not guesses, not
            opinions — so you can fix what actually matters.
          </p>
          <p className="text-lg text-muted mb-12 leading-relaxed">
            Most websites have 5 to 10 critical issues hiding in plain sight:
            confusing navigation, broken accessibility, trust-eroding copy, or
            conversion flows that quietly lose you customers. A UX audit
            surfaces all of them in one structured pass and ranks them by
            impact. Fixpath does it in under 10 minutes.
          </p>

          {/* ── Section: Definition ── */}
          <section className="mb-12">
            <h2 className="font-heading font-medium text-2xl text-text mb-4">
              What exactly is a UX audit?
            </h2>
            <p className="text-text/80 leading-relaxed mb-4">
              A UX audit is a structured, evidence-based review of how people
              actually experience your website or app. It goes beyond gut feel
              and design opinions — it follows proven frameworks (Nielsen&apos;s
              heuristics, WCAG standards, conversion best practices) to produce
              measurable findings you can act on immediately.
            </p>
            <p className="text-text/80 leading-relaxed">
              The result: a scored report with specific issues, severity
              rankings, and concrete recommendations. Think of it as an X-ray
              for your product — you might think everything looks fine, but an
              audit shows you exactly where you&apos;re losing users and why.
            </p>
          </section>

          {/* ── Section: Why ── */}
          <section className="mb-12">
            <h2 className="font-heading font-medium text-2xl text-text mb-4">
              Why you should audit your website now
            </h2>
            <p className="text-text/80 leading-relaxed mb-4">
              The longer you wait, the more conversions you lose. Problems
              accumulate silently — a rushed feature, an inherited pattern, a
              form nobody tested on mobile — until your product is quietly
              losing you money every day. A UX audit catches what daily
              development misses, and the sooner you run one, the sooner you
              stop the leakage.
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
              A thorough UX audit process covers seven modules. Each module
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
                  actions? This module examines call-to-action clarity, page load
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
                  that don&apos;t meet GDPR or similar regulations. This module is
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

          {/* ── Section: Fixpath ── */}
          <section className="mb-12">
            <h2 className="font-heading font-medium text-2xl text-text mb-4">
              Run your first audit in under 10 minutes with Fixpath
            </h2>
            <p className="text-text/80 leading-relaxed mb-4">
              Fixpath replaces the $5,000+ manual audit with an AI engine that
              evaluates your site across all seven modules — 112 checkpoints,
              28 categories — in minutes. Submit your URL, and get back a
              professional report with scores, severity-ranked findings, and
              step-by-step fix guidance. No consultants, no waiting.
            </p>
            <p className="text-text/80 leading-relaxed mb-4">
              Every audit is repeatable and consistent. Run one after each
              sprint, compare scores over time, and share reports with
              stakeholders — no more 80-page PDFs that nobody reads.
              Because the entire{' '}
              <Link href="/ux-audit-checklist" className="text-text font-medium underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">
                checklist
              </Link>{' '}
              is built in, nothing gets missed.
            </p>
            <p className="text-text/80 leading-relaxed">
              Your first audit is free — no credit card, no catches. See
              exactly what&apos;s hurting your site and start fixing it today.
            </p>
          </section>

          {/* ── CTA ── */}
          <div
            className="mt-16 text-center p-8 rounded-2xl"
            style={{ background: 'var(--gradient-brand-subtle)' }}
          >
            <h2 className="font-heading font-medium text-2xl text-text mb-3">
              Find out what&apos;s hurting your website — free
            </h2>
            <p className="text-muted mb-6">
              112 checkpoints. 7 modules. Results in under 10 minutes.
              No credit card, no catches.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-brand text-[#111] font-medium px-6 py-3 rounded-xl hover:brightness-110 transition-all"
            >
              <Sparkles size={16} /> Run your free audit now
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
