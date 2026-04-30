import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { Sparkles, ArrowRight, CheckCircle } from 'lucide-react'

const BASE_URL = 'https://clearux.com'

export const metadata: Metadata = {
  title: 'UX Audit Checklist: 16 Categories Across 4 Pillars | ClearUX',
  description:
    'A comprehensive UX audit checklist organized by 4 pillars and 16 categories. Use this template to evaluate accessibility, usability, conversion, and ethical design — or let ClearUX automate it.',
  keywords: [
    'ux audit checklist',
    'ux audit template',
    'website audit checklist',
    'ux review checklist',
    'ux heuristic checklist',
    'design audit checklist',
  ],
  alternates: { canonical: `${BASE_URL}/ux-audit-checklist` },
  openGraph: {
    title: 'UX Audit Checklist: 16 Categories Across 4 Pillars',
    description:
      'The complete UX audit checklist used by ClearUX, covering accessibility, usability, conversion, and ethical design.',
    url: `${BASE_URL}/ux-audit-checklist`,
    siteName: 'ClearUX',
    type: 'article',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'UX Audit Checklist: 16 Categories Across 4 Pillars',
  description:
    'The complete UX audit checklist used by ClearUX, covering accessibility, usability, conversion, and ethical design.',
  url: `${BASE_URL}/ux-audit-checklist`,
  publisher: {
    '@type': 'Organization',
    name: 'ClearUX',
    url: BASE_URL,
  },
  datePublished: '2025-01-20',
  dateModified: '2026-04-24',
}

type Category = { name: string; description: string }

const pillars: { title: string; intro: string; categories: Category[] }[] = [
  {
    title: 'Pillar 1: Accessibility',
    intro:
      'Accessibility is not optional — it is a baseline requirement. These four categories ensure your product works for every user, including those who rely on assistive technology.',
    categories: [
      {
        name: 'Visual & Colour Accessibility',
        description:
          'Verify colour contrast ratios meet WCAG 2.2 AA minimums (4.5:1 for text, 3:1 for large text and UI components). Check that information is never conveyed by colour alone and that focus indicators are clearly visible.',
      },
      {
        name: 'Keyboard & Navigation Accessibility',
        description:
          'Every interactive element must be reachable and operable via keyboard. Tab order should follow a logical reading sequence, focus traps should be avoided except in modals, and skip-to-content links should be present.',
      },
      {
        name: 'Screen Reader & Semantic Structure',
        description:
          'Evaluate heading hierarchy, landmark roles, ARIA labels, alt text for images, and live region announcements. A screen reader user should be able to understand the page structure and complete all tasks.',
      },
      {
        name: 'Motion, Media & Cognitive Accessibility',
        description:
          'Respect prefers-reduced-motion, provide captions and transcripts for media, avoid auto-playing content, and ensure animations do not trigger seizures. Reading level and plain-language principles also fall here.',
      },
    ],
  },
  {
    title: 'Pillar 2: Usability',
    intro:
      'Usability determines whether users can accomplish their goals efficiently and without frustration. These categories map to established heuristics and real-world interaction patterns.',
    categories: [
      {
        name: 'Navigation & Information Architecture',
        description:
          'Is the navigation intuitive? Can users find what they need within three clicks? Evaluate menu structure, breadcrumbs, search functionality, and the overall sitemap for logical grouping.',
      },
      {
        name: 'Forms & Input Design',
        description:
          'Forms are where conversions happen — and where users most often give up. Check for clear labels, inline validation, helpful error messages, autofill support, and appropriate input types for mobile.',
      },
      {
        name: 'Layout, Hierarchy & Visual Design',
        description:
          'Assess whether the visual hierarchy guides the eye correctly. Typography should be legible, spacing consistent, and the most important actions visually prominent. White space is a feature, not waste.',
      },
      {
        name: 'Mobile & Responsive Design',
        description:
          'Test on real devices, not just resized browser windows. Touch targets should be at least 44px, horizontal scrolling should not occur, and interactive elements should not overlap or become unreachable on smaller screens.',
      },
    ],
  },
  {
    title: 'Pillar 3: Conversion & Engagement',
    intro:
      'A product can be usable and accessible but still fail to convert. This pillar examines whether the design actively supports business goals without sacrificing user experience.',
    categories: [
      {
        name: 'Calls to Action & User Flows',
        description:
          'Primary CTAs should be visually distinct, use action-oriented language, and appear at decision points. Audit the number of steps in key flows — every extra step is a potential drop-off point.',
      },
      {
        name: 'Trust & Credibility Signals',
        description:
          'Users make snap judgements about trustworthiness. Check for social proof, clear pricing, visible contact information, professional design quality, and security indicators on payment pages.',
      },
      {
        name: 'Content Strategy & Messaging',
        description:
          'Does the copy speak to user needs or just list features? Evaluate headline clarity, value proposition placement, reading level, and whether microcopy (button labels, tooltips, empty states) guides users effectively.',
      },
      {
        name: 'Performance & Page Speed',
        description:
          'Slow pages kill conversion. Measure Core Web Vitals (LCP, FID, CLS), check image optimisation, evaluate JavaScript bundle sizes, and test loading states. A one-second delay in load time can reduce conversions by 7%.',
      },
    ],
  },
  {
    title: 'Pillar 4: Ethical Design',
    intro:
      'Ethical design protects the user. As regulations like the EU Digital Services Act and FTC enforcement actions increase, products that employ dark patterns face real legal and reputational risk.',
    categories: [
      {
        name: 'Dark Patterns & Manipulative UI',
        description:
          'Flag confirmshaming, bait-and-switch tactics, forced continuity, hidden costs, trick questions in opt-outs, and urgency elements that create false scarcity. If the design relies on confusion to drive action, it fails this check.',
      },
      {
        name: 'Privacy & Consent',
        description:
          'Cookie banners should offer genuine choice (not just "Accept"). Data collection should follow minimisation principles. Privacy policies should be readable. Pre-checked consent boxes violate GDPR and should be flagged.',
      },
      {
        name: 'Transparency & Honest Communication',
        description:
          'Pricing should be clear, cancellation should be as easy as sign-up, terms should be in plain language, and AI-generated content should be disclosed. Transparency builds long-term trust.',
      },
      {
        name: 'Inclusive & Respectful Content',
        description:
          'Language and imagery should represent diverse audiences. Avoid gendered defaults, cultural assumptions, and exclusionary terminology. Inclusive design extends beyond code — it lives in every word and image.',
      },
    ],
  },
]

export default function UxAuditChecklistPage() {
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
          <h1 className="font-heading font-bold text-3xl sm:text-4xl text-text mb-6 tracking-tight">
            The Complete UX Audit Checklist: 16 Categories, 4 Pillars
          </h1>
          <p className="text-lg text-muted mb-12 leading-relaxed">
            Running a{' '}
            <Link href="/what-is-a-ux-audit" className="text-text font-semibold underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">
              UX audit
            </Link>{' '}
            without a checklist is like performing a code review without
            linting rules — you will catch some issues, but you will miss far
            more. This UX audit checklist covers the 16 categories that
            ClearUX evaluates, organized into four pillars: Accessibility,
            Usability, Conversion, and Ethical Design. Use it as a template
            for manual reviews, or let ClearUX automate the entire process.
          </p>

          {/* ── How to use ── */}
          <section className="mb-12">
            <h2 className="font-heading font-semibold text-2xl text-text mb-4">
              How to Use This Website Audit Checklist
            </h2>
            <p className="text-text/80 leading-relaxed mb-4">
              Each pillar below contains four categories. For a manual audit,
              work through every category and document your findings with
              screenshots, severity ratings (critical, major, minor,
              informational), and recommended fixes. Aim to evaluate at least
              three to five representative pages per category — your homepage,
              a product page, a signup or checkout flow, and a content page.
            </p>
            <p className="text-text/80 leading-relaxed">
              If you prefer to skip the manual work, ClearUX runs this entire
              checklist automatically and generates a scored report you can
              share with your team. Either way, the categories below give you
              a clear picture of what a thorough audit covers.
            </p>
          </section>

          {/* ── Pillars ── */}
          {pillars.map((pillar) => (
            <section key={pillar.title} className="mb-14">
              <h2 className="font-heading font-semibold text-2xl text-text mb-3">
                {pillar.title}
              </h2>
              <p className="text-text/80 leading-relaxed mb-6">
                {pillar.intro}
              </p>
              <div className="space-y-4">
                {pillar.categories.map((cat) => (
                  <div
                    key={cat.name}
                    className="p-6 rounded-2xl border border-border/20 dark:border-white/[0.05] bg-card shadow-[0_1px_3px_rgba(0,0,0,0.03)] dark:shadow-none"
                  >
                    <h3 className="font-heading font-semibold text-lg text-text mb-2 flex items-start gap-2">
                      <CheckCircle size={18} className="text-brand mt-1 shrink-0" />
                      {cat.name}
                    </h3>
                    <p className="text-text/80 leading-relaxed pl-[26px]">
                      {cat.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* ── Beyond the Checklist ── */}
          <section className="mb-12">
            <h2 className="font-heading font-semibold text-2xl text-text mb-4">
              Beyond the Checklist: Continuous Auditing
            </h2>
            <p className="text-text/80 leading-relaxed mb-4">
              A checklist is only as good as the last time you used it.
              Products evolve with every sprint, and what passes today may
              fail next month. The most effective teams treat UX auditing as a
              continuous practice, not a one-off project.
            </p>
            <p className="text-text/80 leading-relaxed">
              ClearUX makes this practical by letting you re-run audits after
              every release, track score trends over time, and compare
              results across pages. Instead of a static PDF that collects
              dust, you get a living dashboard that keeps your team
              accountable. Explore how ClearUX compares to other{' '}
              <Link
                href="/best-ux-audit-tools"
                className="text-text font-semibold underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity"
              >
                UX audit tools
              </Link>{' '}
              in our comparison guide.
            </p>
          </section>

          {/* ── CTA ── */}
          <div
            className="mt-16 text-center p-8 rounded-2xl"
            style={{ background: 'var(--gradient-brand-subtle)' }}
          >
            <h2 className="font-heading font-semibold text-2xl text-text mb-3">
              Automate this entire checklist
            </h2>
            <p className="text-muted mb-6">
              ClearUX evaluates all 16 categories automatically and delivers
              a scored, shareable report in minutes.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-brand text-[#111] font-semibold px-6 py-3 rounded-xl hover:brightness-110 transition-all"
            >
              <Sparkles size={16} /> Get your free audit
            </Link>
          </div>

          {/* ── Related ── */}
          <nav className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted mb-3 font-semibold uppercase tracking-wider">
              Related resources
            </p>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/what-is-a-ux-audit"
                  className="inline-flex items-center gap-1 text-text font-semibold underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity"
                >
                  What Is a UX Audit? <ArrowRight size={14} />
                </Link>
              </li>
              <li>
                <Link
                  href="/best-ux-audit-tools"
                  className="inline-flex items-center gap-1 text-text font-semibold underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity"
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
