import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { Sparkles, ArrowRight, CheckCircle } from 'lucide-react'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fixpath.ai'

export const metadata: Metadata = {
  title: 'UX Audit Checklist: 28 Categories Across 7 Modules | Fixpath',
  description:
    'A comprehensive UX audit checklist organized by 7 modules and 28 categories. Use this template to evaluate accessibility, usability, conversion, and ethical design — or let Fixpath automate it.',
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
    title: 'UX Audit Checklist: 28 Categories Across 7 Modules',
    description:
      'The complete UX audit checklist used by Fixpath, covering accessibility, usability, conversion, and ethical design.',
    url: `${BASE_URL}/ux-audit-checklist`,
    siteName: 'Fixpath',
    type: 'article',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'UX Audit Checklist: 28 Categories Across 7 Modules',
  description:
    'The complete UX audit checklist used by Fixpath, covering accessibility, usability, conversion, and ethical design.',
  url: `${BASE_URL}/ux-audit-checklist`,
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
  datePublished: '2025-01-20',
  dateModified: '2026-05-25',
  image: {
    '@type': 'ImageObject',
    url: `${BASE_URL}/og-image.png`,
    width: 1200,
    height: 630,
  },
}

type Category = { name: string; description: string }

const pillars: { title: string; intro: string; categories: Category[] }[] = [
  {
    title: 'Module 1: Foundation',
    intro:
      'Foundation covers the structural and technical bedrock of your product. These four categories ensure your site is performant, well-structured, and built on solid engineering practices.',
    categories: [
      {
        name: 'Performance & Page Speed',
        description:
          'Measure Core Web Vitals (LCP, INP, CLS), check image optimisation, evaluate JavaScript bundle sizes, and test loading states. A one-second delay in load time can reduce conversions by 7%.',
      },
      {
        name: 'Navigation & Information Architecture',
        description:
          'Is the navigation intuitive? Can users find what they need within three clicks? Evaluate menu structure, breadcrumbs, search functionality, and the overall sitemap for logical grouping.',
      },
      {
        name: 'Layout, Hierarchy & Visual Design',
        description:
          'Assess whether the visual hierarchy guides the eye correctly. Typography should be legible, spacing consistent, and the most important actions visually prominent. White space is a feature, not waste.',
      },
      {
        name: 'Mobile & Responsive Design',
        description:
          "Test on real devices, not resized browser windows. Touch targets should be at least 44px, horizontal scrolling shouldn't occur, and interactive elements shouldn't overlap or become unreachable on smaller screens.",
      },
    ],
  },
  {
    title: 'Module 2: Human Experience',
    intro:
      'Human Experience determines whether users can accomplish their goals efficiently and without frustration. These categories map to established heuristics and real-world interaction patterns.',
    categories: [
      {
        name: 'Forms & Input Design',
        description:
          'Forms are where conversions happen — and where users most often give up. Check for clear labels, inline validation, helpful error messages, autofill support, and appropriate input types for mobile.',
      },
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
          "Does the copy speak to user needs or only list features? Evaluate headline clarity, value proposition placement, reading level, and whether microcopy (button labels, tooltips, empty states) guides users effectively.",
      },
    ],
  },
  {
    title: 'Module 3: Inclusive Design',
    intro:
      "Inclusive Design ensures your product works for every user, regardless of ability. These four categories cover accessibility requirements and ethical considerations that protect your users and your reputation.",
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
          "Respect prefers-reduced-motion, provide captions and transcripts for media, avoid auto-playing content, and ensure animations don't trigger seizures. Reading level and plain-language principles also fall here.",
      },
    ],
  },
  {
    title: 'Module 4: Future Readiness',
    intro:
      'Future Readiness evaluates whether your product is prepared for evolving standards, technologies, and user expectations. These categories ensure long-term resilience.',
    categories: [
      {
        name: 'Dark Patterns & Manipulative UI',
        description:
          'Flag confirmshaming, bait-and-switch tactics, forced continuity, hidden costs, trick questions in opt-outs, and urgency elements that create false scarcity. If the design relies on confusion to drive action, it fails this check.',
      },
      {
        name: 'Privacy & Consent',
        description:
          "Cookie banners should offer genuine choice (not only \"Accept\"). Data collection should follow minimisation principles. Privacy policies should be readable. Pre-checked consent boxes violate GDPR and should be flagged.",
      },
      {
        name: 'Transparency & Honest Communication',
        description:
          'Pricing should be clear, cancellation should be as easy as sign-up, terms should be in plain language, and AI-generated content should be disclosed. Transparency builds long-term trust.',
      },
      {
        name: 'Progressive Enhancement & Resilience',
        description:
          'Ensure the product degrades gracefully when JavaScript fails, third-party services are unavailable, or users are on slow connections. Core functionality should work under constrained conditions.',
      },
    ],
  },
  {
    title: 'Module 5: Accessibility Readiness',
    intro:
      'Accessibility Readiness goes beyond baseline compliance to evaluate how deeply accessibility is embedded in your product and process. These four categories assess organisational maturity and assistive technology support.',
    categories: [
      {
        name: 'Compliance Depth & Standards Alignment',
        description:
          'Evaluate alignment with WCAG 2.2 AA and emerging standards beyond the minimum. Check whether accessibility requirements are documented, tested, and verified across all critical user flows.',
      },
      {
        name: 'Assistive Technology Support',
        description:
          'Test compatibility with screen readers (NVDA, VoiceOver, JAWS), switch access, voice control, and magnification tools. Ensure interactive components announce state changes and provide meaningful feedback.',
      },
      {
        name: 'Accessibility Governance & Process',
        description:
          'Assess whether accessibility is part of design reviews, QA checklists, and acceptance criteria. Check for documented accessibility policies, assigned ownership, and regular audit cadence.',
      },
      {
        name: 'Inclusive Testing & User Feedback',
        description:
          'Evaluate whether the team includes people with disabilities in usability testing. Check for feedback channels, accessibility bug triage processes, and response time commitments.',
      },
    ],
  },
  {
    title: 'Module 6: Brand Consistency',
    intro:
      'Brand Consistency examines whether every touchpoint reinforces a cohesive identity. Inconsistent design erodes trust and makes products feel unfinished.',
    categories: [
      {
        name: 'Visual Identity & Design Tokens',
        description:
          'Check that colours, typography, spacing, and iconography follow a unified design system. Deviations between pages or components signal a lack of design governance.',
      },
      {
        name: 'Tone of Voice & Microcopy',
        description:
          'Every label, tooltip, error message, and empty state should sound like it comes from the same brand. Audit for tonal shifts, jargon inconsistencies, and mismatched formality levels.',
      },
      {
        name: 'Component & Pattern Consistency',
        description:
          'Buttons, cards, modals, and form elements should behave identically across the product. Inconsistent interaction patterns increase cognitive load and undermine usability.',
      },
      {
        name: 'Inclusive & Respectful Content',
        description:
          'Language and imagery should represent diverse audiences. Avoid gendered defaults, cultural assumptions, and exclusionary terminology. Inclusive design extends beyond code — it lives in every word and image.',
      },
    ],
  },
  {
    title: 'Module 7: SEO Structure',
    intro:
      'SEO Structure ensures your product is discoverable and correctly interpreted by search engines. Technical SEO and content structure directly impact organic visibility.',
    categories: [
      {
        name: 'Metadata & Structured Data',
        description:
          'Verify that every page has unique, descriptive title tags and meta descriptions. Check for valid schema.org markup, Open Graph tags, and canonical URLs to avoid duplicate content issues.',
      },
      {
        name: 'Heading Hierarchy & Content Structure',
        description:
          'Pages should use a single H1, logically nested subheadings, and clear content sections. Proper heading hierarchy helps both screen readers and search engine crawlers understand page structure.',
      },
      {
        name: 'Link Health & Internal Linking',
        description:
          'Audit for broken links, orphan pages, and shallow link depth. A strong internal linking strategy distributes authority and helps users and crawlers navigate the site efficiently.',
      },
      {
        name: 'Crawlability & Indexation',
        description:
          'Ensure robots.txt and meta robots directives are correctly configured. Check XML sitemaps, canonical tags, and rendering behaviour to confirm search engines can access and index all important content.',
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
          <h1 className="font-heading font-medium text-3xl sm:text-4xl text-text mb-6">
            UX Audit Checklist: Every Issue Your Website Might Have
          </h1>
          <p className="text-lg text-muted mb-4 leading-relaxed">
            Most websites have problems they don&apos;t know about — accessibility
            failures, trust gaps, broken mobile flows, slow pages. This
            checklist covers all 28 categories across 7 modules, so nothing
            gets missed.
          </p>
          <p className="text-lg text-muted mb-12 leading-relaxed">
            Use it as a manual review template, or let{' '}
            <Link href="/what-is-a-ux-audit" className="text-text font-medium underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">
              Fixpath run the full checklist for you
            </Link>{' '}
            in under 10 minutes — 112 checkpoints, scored by severity, with
            fix guidance for every finding.
          </p>

          {/* ── How to use ── */}
          <section className="mb-12">
            <h2 className="font-heading font-medium text-2xl text-text mb-4">
              How to Use This Website Audit Checklist
            </h2>
            <p className="text-text/80 leading-relaxed mb-4">
              Each module below contains four categories. For a manual audit,
              work through every category and document your findings with
              screenshots, severity ratings (critical, major, minor,
              informational), and recommended fixes. Aim to evaluate at least
              three to five representative pages per category — your homepage,
              a product page, a signup or checkout flow, and a content page.
            </p>
            <p className="text-text/80 leading-relaxed">
              If you prefer to skip the manual work, Fixpath runs this entire
              checklist automatically and generates a scored report you can
              share with your team. Either way, the categories below give you
              a clear picture of what a thorough audit covers.
            </p>
          </section>

          {/* ── Pillars ── */}
          {pillars.map((pillar) => (
            <section key={pillar.title} className="mb-14">
              <h2 className="font-heading font-medium text-2xl text-text mb-3">
                {pillar.title}
              </h2>
              <p className="text-text/80 leading-relaxed mb-6">
                {pillar.intro}
              </p>
              <div className="space-y-4">
                {pillar.categories.map((cat) => (
                  <div
                    key={cat.name}
                    className="p-6 rounded-2xl border border-border bg-card"
                  >
                    <h3 className="font-heading font-medium text-lg text-text mb-2 flex items-start gap-2">
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
            <h2 className="font-heading font-medium text-2xl text-text mb-4">
              Beyond the Checklist: Continuous Auditing
            </h2>
            <p className="text-text/80 leading-relaxed mb-4">
              A checklist is only as good as the last time you used it.
              Products evolve with every sprint, and what passes today may
              fail next month. The most effective teams treat UX auditing as a
              continuous practice, not a one-off project.
            </p>
            <p className="text-text/80 leading-relaxed">
              Fixpath makes this practical by letting you re-run audits after
              every release, track score trends over time, and compare
              results across pages. Instead of a static PDF that collects
              dust, you get a living dashboard that keeps your team
              accountable. Explore how Fixpath compares to other{' '}
              <Link
                href="/best-ux-audit-tools"
                className="text-text font-medium underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity"
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
            <h2 className="font-heading font-medium text-2xl text-text mb-3">
              Automate this entire checklist
            </h2>
            <p className="text-muted mb-6">
              Fixpath evaluates all 28 categories automatically and delivers
              a scored, shareable report in minutes.
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
                  href="/what-is-a-ux-audit"
                  className="inline-flex items-center gap-1 text-text font-medium underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity"
                >
                  What Is a UX Audit? <ArrowRight size={14} />
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
