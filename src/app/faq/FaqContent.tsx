'use client'

import { useState, useMemo } from 'react'
import { SectionMarker } from '@/components/marketing/SectionMarker'
import { ArrowRightIcon } from '@/components/marketing/icons'
import { HomeCta } from '@/components/marketing/HomeCta'

/* ── FAQ Data ───────────────────────────────────────────────── */

const FAQ_SECTIONS = [
  {
    title: 'General',
    items: [
      { q: 'How long does an audit take?', a: 'Most audits complete in under 10 minutes. Our AI crawls your website, analyses every page against 112 checkpoints across seven modules, and generates a full professional report.' },
      { q: 'What does the audit cover?', a: 'We evaluate 28 categories across seven modules: Foundation (the structural and technical baseline), Human Experience (how your product feels to use — clarity, flow, cognitive load, wellbeing), Inclusive Design (accessibility and equity for every user, every ability, every context), Future Readiness (AI discoverability and how your product holds up as discovery shifts), Accessibility Readiness (compliance depth, assistive technology support, and organisational accessibility maturity), Brand Consistency (whether what users see matches what the brand promises), and SEO Structure (whether your product is findable, legible, and ranked the way it deserves). Available for websites, brand identity materials, and design files.' },
      { q: 'What types of audits do you offer?', a: 'Three types: Website audits (paste a URL and we crawl your site), Brand Identity audits (upload your brand guidelines, logo, and materials for analysis), and Design audits (coming soon — review designs before production). Every audit type uses the same 7-module, 112-checkpoint framework.' },
      { q: 'Can I audit any website?', a: 'Yes. Fixpath works with any publicly accessible URL — dynamic apps, single-page applications, and traditional multi-page sites. Content behind logins (admin panels, member areas) isn\'t accessible to our crawler. For complex multi-step flows like checkouts, findings cover the accessible steps.' },
      { q: 'What languages are supported?', a: 'Reports are available in English, Spanish, French, German, Italian, and Portuguese. All findings, recommendations, and the full report are translated.' },
      { q: 'How does Fixpath compare to hiring a UX consultant?', a: 'A traditional UX audit costs $5,000-$15,000 and takes 2-4 weeks. Fixpath delivers 112 checkpoints across seven modules in minutes for a fraction of the cost. It\'s ideal for quick, comprehensive baseline assessments. For deep qualitative research (user interviews, usability testing), we recommend pairing Fixpath findings with a specialist.' },
      { q: 'Can I track which findings have been fixed?', a: 'Yes. Every finding has a status you can update: Open, In Progress, Fixed, or Backlog. Your dashboard tracks how many issues you\'ve resolved over time, giving you a clear picture of progress.' },
      { q: 'Can I share audit results with my team?', a: 'Yes. Every completed audit has a "Share audit" button that generates a read-only link. Anyone with the link can view the scores, executive summary, and category breakdown — no account needed. You can revoke the link at any time.' },
      { q: 'Can I re-audit the same website to measure improvement?', a: 'Absolutely. Re-auditing the same URL is the best way to prove progress. Your dashboard shows re-audit badges and your stats track average scores over time. Audit the same site before and after implementing fixes to see your score improve.' },
    ],
  },
  {
    title: 'Audit & AI',
    items: [
      { q: 'How does the AI analysis work?', a: 'Our engine crawls your site, then runs each page through specialised AI models trained on UX best practices, WCAG guidelines, dark pattern databases, and conversion research. Each page is evaluated across seven modules and 112 checkpoints. Every finding includes severity scoring, evidence, and a specific recommendation.' },
      { q: 'What format is the report?', a: 'You get a professional PDF and a Word document (DOCX). Both include an overall score, executive summary, top 3 priority recommendations, module score breakdown, and detailed findings ranked by severity with specific recommendations and impact estimates.' },
      { q: 'What should I know before running an audit?', a: 'Fixpath analyses all publicly visible pages on your site. For the most comprehensive results, ensure your site is live and publicly accessible. The audit is designed to catch the issues that matter most to real users — the same issues a specialist consultant would prioritise.' },
      { q: 'What about white-label reports?', a: 'Agency and Scale package customers can add their own company logo and name to reports. The Fixpath branding is replaced with yours in both PDF and Word exports — perfect for client-facing deliverables.' },
      { q: 'What is the free preview audit?', a: 'Anyone can run a free preview audit from the homepage without signing up. The preview shows your overall score, module scores, and severity breakdown. Individual findings, recommendations, and downloadable reports are available when you unlock the full audit.' },
    ],
  },
  {
    title: 'How Our AI Works',
    items: [
      { q: 'What AI powers the audits?', a: 'Fixpath uses Anthropic\'s Claude as its core analysis engine — but the AI is only the final layer. Behind every audit is a proprietary evaluation framework built on years of UX research, accessibility consulting, and conversion optimisation. Each of the 112 checkpoints is backed by a deeply engineered prompt chain that encodes real-world heuristics from Nielsen Norman Group research, WCAG 2.2 success criteria, FTC dark pattern enforcement actions, behavioural psychology literature, and emerging AI agent interaction standards.' },
      { q: 'What are the known limitations?', a: 'Our AI analyses publicly visible page content. It cannot test JavaScript-heavy interactions (hover states, multi-step flows behind authentication), real page load speed, or actual user behaviour. For accessibility compliance, we strongly recommend pairing Fixpath findings with manual testing using screen readers and keyboard navigation.' },
      { q: 'How does the AI improve over time?', a: 'When you dismiss a finding with a reason or add a site note, that context is stored and injected into your next audit. The AI reads your feedback and skips previously dismissed issues. Findings you mark as "fixed" are also tracked — the AI will verify whether the fix holds on re-audit.' },
      { q: 'Does Fixpath replace a human UX auditor?', a: 'No. Fixpath is designed to complement human expertise, not replace it. It covers 112 checkpoints across seven modules in minutes — the kind of breadth that would take a consultant days. But for deep qualitative research (user interviews, usability testing, nuanced accessibility compliance), we recommend working with a specialist.' },
    ],
  },
  {
    title: 'Account & Billing',
    items: [
      { q: 'How do credits work?', a: 'One credit = one full audit. Credits never expire. Every audit includes all seven modules, 112 checkpoints, PDF & Word reports, finding status tracking, shareable team links, and prioritised recommendations. Buy in packs to lower the per-audit cost.' },
      { q: 'Is my data secure?', a: 'We only analyse publicly visible content. Your website data is never stored or shared — only your report. Payments are processed securely via Stripe. We\'re GDPR compliant and use SSL encryption throughout.' },
      { q: 'Can I get a refund?', a: 'If you\'re unsatisfied with an audit, reach out via our contact form or email support@fixpath.ai and we\'ll resolve it or provide a credit for a new audit. We stand behind the quality of our reports.' },
      { q: 'Can I buy more credits later?', a: 'Yes. You can purchase additional credit packs at any time. Credits from different purchases stack together and never expire.' },
      { q: 'What payment methods are accepted?', a: 'We accept Visa, Mastercard, American Express, Apple Pay, and Google Pay. All payments are processed securely via Stripe.' },
    ],
  },
  {
    title: 'Trust & Accuracy',
    items: [
      { q: 'Is Fixpath 100% accurate?', a: 'No, and we believe honesty about this is important. Our AI catches issues that traditional tools miss — dark patterns, emotional design gaps, cognitive accessibility barriers, AI readiness gaps — but no automated system is perfect. We recommend human review for accessibility-critical and security-sensitive findings.' },
      { q: 'What if the audit flags something incorrectly?', a: 'Dismiss it directly from your dashboard with a reason (e.g., "This is intentional for our audience"). The AI will skip that finding on future re-audits. If you believe the finding is a systemic error, use our contact form and we\'ll review it within 24 hours.' },
      { q: 'Can I share the report with clients or my team?', a: 'Yes. Every completed audit has a "Share" button that generates a read-only link. Anyone with the link can see the overall score, module breakdown, top recommendations, and executive summary — no Fixpath account needed.' },
      { q: 'How does Fixpath handle false positives?', a: 'Our analysis engine uses cross-page awareness — it checks if content exists on other pages before flagging it as "missing". You can also add site notes that persist across audits, giving the AI permanent context about your design decisions.' },
    ],
  },
]

const TAB_ALL = 'All'

/* ── Chevron Icon ── */
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
      <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── Search Icon ── */
function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute left-4 top-1/2 -translate-y-1/2 text-m-muted">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/* ── Accordion Item ── */
function FaqItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-rule last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 py-5 px-1 text-left hover:text-signal transition-colors group"
        aria-expanded={isOpen}
      >
        <span className="flex-1 font-sans font-medium text-ink text-[15px] leading-relaxed group-hover:text-signal transition-colors">{q}</span>
        <ChevronIcon open={isOpen} />
      </button>
      {isOpen && (
        <div className="pb-5 px-1">
          <p className="font-sans text-[14px] text-ink-2 leading-[1.75]">{a}</p>
        </div>
      )}
    </div>
  )
}

/* ── Main Content ── */
export default function FaqContent() {
  const [activeTab, setActiveTab] = useState(TAB_ALL)
  const [searchQuery, setSearchQuery] = useState('')
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())

  const tabs = [TAB_ALL, ...FAQ_SECTIONS.map(s => s.title)]

  const { visibleSections, totalVisible } = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    if (!query) {
      const tabFiltered = activeTab === TAB_ALL ? FAQ_SECTIONS : FAQ_SECTIONS.filter(s => s.title === activeTab)
      const total = tabFiltered.reduce((sum, s) => sum + s.items.length, 0)
      return { visibleSections: tabFiltered, totalVisible: total }
    }

    const words = query.split(/\s+/).filter(w => w.length > 0)
    const filtered = FAQ_SECTIONS.map(section => ({
      ...section,
      items: section.items.filter(item => {
        const text = `${item.q} ${item.a}`.toLowerCase()
        return words.every(word => text.includes(word))
      }),
    })).filter(section => section.items.length > 0)

    const total = filtered.reduce((sum, s) => sum + s.items.length, 0)
    return { visibleSections: filtered, totalVisible: total }
  }, [activeTab, searchQuery])

  const toggleItem = (key: string) => {
    setOpenItems(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const totalQuestions = FAQ_SECTIONS.reduce((sum, s) => sum + s.items.length, 0)

  return (
    <main>
      {/* Hero */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="01" label="Support centre" />
          <h1 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-4" style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}>
            Frequently asked <em className="italic text-signal">questions.</em>
          </h1>
          <p className="text-[18px] leading-[1.55] text-ink-2 max-w-[480px] mb-10 font-sans">
            Everything you need to know about Fixpath audits, pricing, and reports.
          </p>

          {/* Search */}
          <div className="max-w-md relative">
            <SearchIcon />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search FAQs..."
              className="w-full pl-11 pr-16 py-3 rounded-full border border-rule bg-paper-2 text-ink text-[15px] font-sans placeholder:text-m-muted focus:outline-none focus:border-ink transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-mono text-m-muted hover:text-ink transition-colors uppercase tracking-[0.06em]"
              >
                Clear
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="font-mono text-[11px] text-m-muted mt-3 tracking-[0.06em] uppercase">
              {totalVisible} result{totalVisible !== 1 ? 's' : ''} found
            </p>
          )}
        </div>
      </section>

      {/* Tabs + Questions */}
      <section className="py-[80px] max-sm:py-12">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          {/* Category tabs */}
          <div className="flex flex-wrap items-center gap-2 mb-12">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setOpenItems(new Set()) }}
                className={`text-[12px] font-mono tracking-[0.08em] uppercase px-4 py-2 rounded-full transition-all border ${
                  activeTab === tab
                    ? 'bg-ink text-paper border-ink'
                    : 'text-ink-2 border-rule hover:border-ink'
                }`}
              >
                {tab === TAB_ALL ? `All (${totalQuestions})` : tab}
              </button>
            ))}
          </div>

          {/* Sections */}
          {visibleSections.length === 0 ? (
            <div className="py-16">
              <p className="font-sans text-ink font-medium text-[15px] mb-2">No results found</p>
              <p className="font-sans text-ink-2 text-[14px]">
                Try a different search term, or{' '}
                <button onClick={() => { setSearchQuery(''); setActiveTab(TAB_ALL) }} className="underline hover:text-signal transition-colors">
                  browse all questions
                </button>
              </p>
            </div>
          ) : (
            <div className="max-w-3xl space-y-14">
              {visibleSections.map((section) => (
                <div key={section.title}>
                  {(activeTab === TAB_ALL || searchQuery) && (
                    <div className="flex items-center gap-4 mb-6">
                      <h2 className="font-serif text-[22px] text-ink font-normal tracking-[-0.01em]">{section.title}</h2>
                      <span className="font-mono text-[11px] text-m-muted tracking-[0.08em]">{section.items.length}</span>
                      <div className="flex-1 h-px bg-rule" />
                    </div>
                  )}
                  <div>
                    {section.items.map((faq, i) => {
                      const key = `${section.title}-${i}`
                      return (
                        <FaqItem
                          key={key}
                          q={faq.q}
                          a={faq.a}
                          isOpen={openItems.has(key)}
                          onToggle={() => toggleItem(key)}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <HomeCta />
    </main>
  )
}
