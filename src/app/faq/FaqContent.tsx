'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, ChevronDown } from 'lucide-react';

/* ── FAQ Data ───────────────────────────────────────────────── */

const FAQ_SECTIONS = [
  {
    title: 'General',
    items: [
      {
        q: 'How long does an audit take?',
        a: 'Most audits complete in under 10 minutes. Our AI crawls your website, analyses every page against 64 checkpoints across 16 categories, and generates a full professional report.',
      },
      {
        q: 'What does the audit cover?',
        a: 'We evaluate 16 categories across 4 pillars: Foundation (Visual Design, Value Proposition, Navigation, Content Quality), Human Experience (CTAs & Conversion, Trust & Credibility, Ethical UX, Emotional Design), Inclusive Design (Accessibility, Cognitive Accessibility, Digital Wellbeing, Mobile Experience), and Future Readiness (Performance & Technical Health, AI Discoverability, AI Agent Readiness, Cultural Sensitivity).',
      },
      {
        q: 'Can I audit any website?',
        a: 'Yes. ClearUX works with any publicly accessible URL — dynamic apps, single-page applications, and traditional multi-page sites. Content behind logins (admin panels, member areas) isn\'t accessible to our crawler. For complex multi-step flows like checkouts, findings cover the accessible steps.',
      },
      {
        q: 'What languages are supported?',
        a: 'Reports are available in English, Spanish, French, German, Italian, and Portuguese. All findings, recommendations, and the full report are translated.',
      },
      {
        q: 'How does ClearUX compare to hiring a UX consultant?',
        a: 'A traditional UX audit costs $5,000–$15,000 and takes 2–4 weeks. ClearUX delivers 64 checkpoints across 16 categories in minutes for a fraction of the cost. It\'s ideal for quick, comprehensive baseline assessments. For deep qualitative research (user interviews, usability testing), we recommend pairing ClearUX findings with a specialist.',
      },
      {
        q: 'Can I track which findings have been fixed?',
        a: 'Yes. Every finding has a status you can update: Open, In Progress, Fixed, or Backlog. Your dashboard tracks how many issues you\'ve resolved over time, giving you a clear picture of progress.',
      },
      {
        q: 'Can I share audit results with my team?',
        a: 'Yes. Every completed audit has a "Share audit" button that generates a read-only link. Anyone with the link can view the scores, executive summary, and category breakdown — no account needed. You can revoke the link at any time.',
      },
      {
        q: 'Can I re-audit the same website to measure improvement?',
        a: 'Absolutely. Re-auditing the same URL is the best way to prove progress. Your dashboard shows re-audit badges and your stats track average scores over time. Audit the same site before and after implementing fixes to see your score improve.',
      },
    ],
  },
  {
    title: 'Audit & AI',
    items: [
      {
        q: 'How does the AI analysis work?',
        a: 'Our engine crawls your site (5–25 pages depending on plan), then runs each page through specialised AI models trained on UX best practices, WCAG guidelines, dark pattern databases, and conversion research. Each finding includes severity scoring, evidence, and a specific recommendation.',
      },
      {
        q: 'What format is the report?',
        a: 'You get a professional PDF and a Word document (DOCX). Both include an overall score, executive summary, top 3 priority recommendations, pillar score breakdown, and detailed findings ranked by severity with specific recommendations and impact estimates.',
      },
      {
        q: 'What should I know before running an audit?',
        a: 'ClearUX analyses all publicly visible pages on your site. For the most comprehensive results, ensure your site is live and publicly accessible. The audit is designed to catch the issues that matter most to real users — the same issues a specialist consultant would prioritise.',
      },
      {
        q: 'What about white-label reports?',
        a: 'Agency and Scale package customers can add their own company logo and name to reports. The ClearUX branding is replaced with yours in both PDF and Word exports — perfect for client-facing deliverables.',
      },
      {
        q: 'What is the free preview audit?',
        a: 'Anyone can run a free preview audit from the homepage without signing up. The preview shows your overall score, pillar scores, and severity breakdown. Individual findings, recommendations, and downloadable reports are available when you unlock the full audit.',
      },
    ],
  },
  {
    title: 'How Our AI Works',
    items: [
      {
        q: 'What AI powers the audits?',
        a: 'ClearUX uses Anthropic\'s Claude as its core analysis engine — but the AI is only the final layer. Behind every audit is a proprietary evaluation framework built on years of UX research, accessibility consulting, and conversion optimisation. Each of the 64 checkpoints is backed by a deeply engineered prompt chain that encodes real-world heuristics from Nielsen Norman Group research, WCAG 2.2 success criteria, FTC dark pattern enforcement actions, behavioural psychology literature, and emerging AI agent interaction standards. The system doesn\'t just ask the AI generic questions — it runs multi-pass analysis: first crawling and extracting your actual page content (text, structure, semantic HTML, visual hierarchy), then cross-referencing findings across pages for context-aware evaluation, and finally scoring each finding against severity and business-impact models calibrated from hundreds of real audits. The result is findings that reference specific elements on your site with the depth of a senior consultant, not the surface-level flags of an automated scanner.',
      },
      {
        q: 'What are the known limitations?',
        a: 'Our AI analyses publicly visible page content. It cannot test JavaScript-heavy interactions (hover states, multi-step flows behind authentication), real page load speed, or actual user behaviour. For accessibility compliance, we strongly recommend pairing ClearUX findings with manual testing using screen readers and keyboard navigation. The AI may also miss highly context-specific design decisions that are intentional for your audience — that\'s why we built the dismiss-with-reason feature.',
      },
      {
        q: 'How does the AI improve over time?',
        a: 'When you dismiss a finding with a reason or add a site note, that context is stored and injected into your next audit. The AI reads your feedback and skips previously dismissed issues. Findings you mark as "fixed" are also tracked — the AI will verify whether the fix holds on re-audit. Your audits get more accurate with every iteration.',
      },
      {
        q: 'Does ClearUX replace a human UX auditor?',
        a: 'No. ClearUX is designed to complement human expertise, not replace it. It covers 64 checkpoints across 16 categories in minutes — the kind of breadth that would take a consultant days. But for deep qualitative research (user interviews, usability testing, nuanced accessibility compliance), we recommend working with a specialist. Many teams use ClearUX to identify what to focus on, then bring in a human expert for the critical issues.',
      },
    ],
  },
  {
    title: 'Account & Billing',
    items: [
      {
        q: 'How do credits work?',
        a: 'One credit = one full audit. Credits never expire. Every audit includes all 64 checkpoints, PDF & Word reports, finding status tracking, shareable team links, and prioritised recommendations. Buy in packs to lower the per-audit cost.',
      },
      {
        q: 'Is my data secure?',
        a: 'We only analyse publicly visible content. Your website data is never stored or shared — only your report. Payments are processed securely via Stripe. We are GDPR compliant and use SSL encryption throughout.',
      },
      {
        q: 'Can I get a refund?',
        a: 'If you\'re unsatisfied with an audit, reach out via our contact form or email support@clearux.ai and we\'ll resolve it or provide a credit for a new audit. We stand behind the quality of our reports.',
      },
      {
        q: 'Can I buy more credits later?',
        a: 'Yes. You can purchase additional credit packs at any time. Credits from different purchases stack together and never expire.',
      },
      {
        q: 'What payment methods are accepted?',
        a: 'We accept Visa, Mastercard, American Express, Apple Pay, and Google Pay. All payments are processed securely via Stripe.',
      },
    ],
  },
  {
    title: 'Trust & Accuracy',
    items: [
      {
        q: 'Is ClearUX 100% accurate?',
        a: 'No, and we believe honesty about this is important. Our AI catches issues that traditional tools miss — dark patterns, emotional design gaps, cognitive accessibility barriers, AI readiness gaps — but no automated system is perfect. We recommend human review for accessibility-critical and security-sensitive findings. That\'s why every finding includes a status tracker: your team can verify, dismiss with a reason, or mark as fixed. The AI learns from your feedback on re-audits.',
      },
      {
        q: 'What if the audit flags something incorrectly?',
        a: 'Dismiss it directly from your dashboard with a reason (e.g., "This is intentional for our audience" or "Addressed on our About page"). The AI will skip that finding on future re-audits. If you believe the finding is a systemic error, use our contact form or email support@clearux.ai and we\'ll review it within 24 hours. We actively use feedback to improve our analysis engine.',
      },
      {
        q: 'Can I share the report with clients or my team?',
        a: 'Yes. Every completed audit has a "Share" button that generates a read-only link. Anyone with the link can see the overall score, pillar breakdown, top recommendations, and executive summary — no ClearUX account needed. You can revoke the link at any time. PDF and Word exports are also available for offline sharing.',
      },
      {
        q: 'How does ClearUX handle false positives?',
        a: 'Our analysis engine uses cross-page awareness — it checks if content exists on other pages before flagging it as "missing" (e.g., it won\'t flag missing founder credentials if your About page has them). You can also add site notes that persist across audits, giving the AI permanent context about your design decisions. Every re-audit gets smarter based on your previous feedback.',
      },
    ],
  },
];

const TAB_ALL = 'All';

/* ── Accordion Item ──────────────────────────────────────────── */

function FaqItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.06]">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-5 text-left hover:bg-white/[0.02] transition-colors"
        aria-expanded={isOpen}
      >
        <span className="flex-1 font-heading font-medium text-white text-[15px] leading-snug">{q}</span>
        <ChevronDown
          size={16}
          className={`text-white/50 flex-shrink-0 mt-0.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 pt-0">
          <div className="border-t border-white/[0.04] pt-4">
            <p className="font-body text-sm text-white/50 leading-[1.8]">{a}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Content ──────────────────────────────────────────── */

export default function FaqContent() {
  const [activeTab, setActiveTab] = useState(TAB_ALL);
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const tabs = [TAB_ALL, ...FAQ_SECTIONS.map(s => s.title)];

  // Filter sections by tab and search
  // When searching, always search ALL sections (ignore active tab)
  const { visibleSections, totalVisible } = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) {
      const tabFiltered = activeTab === TAB_ALL ? FAQ_SECTIONS : FAQ_SECTIONS.filter(s => s.title === activeTab);
      const total = tabFiltered.reduce((sum, s) => sum + s.items.length, 0);
      return { visibleSections: tabFiltered, totalVisible: total };
    }

    // Search across ALL sections — split query into words for broader matching
    const words = query.split(/\s+/).filter(w => w.length > 0);
    const filtered = FAQ_SECTIONS.map(section => ({
      ...section,
      items: section.items.filter(item => {
        const text = `${item.q} ${item.a}`.toLowerCase();
        return words.every(word => text.includes(word));
      }),
    })).filter(section => section.items.length > 0);

    const total = filtered.reduce((sum, s) => sum + s.items.length, 0);
    return { visibleSections: filtered, totalVisible: total };
  }, [activeTab, searchQuery]);

  const toggleItem = (key: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const totalQuestions = FAQ_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <main id="main-content" className="flex-1">

      {/* ── ONE background for the entire page ── */}
      <div className="relative">
        <div className="absolute inset-0" aria-hidden="true">
          <img src="/gradients/bg-features.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#111114] via-transparent to-[#111114]" />
        </div>

        {/* ── HERO ── */}
        <section className="relative z-10 py-28 sm:py-36 lg:py-44">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-6">
              SUPPORT CENTRE
            </p>

            <h1 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white mb-6" style={{ lineHeight: '1.1' }}>
              Frequently asked <span className="text-lime-gradient">questions.</span>
            </h1>

            <p className="font-body text-sm sm:text-base text-white/50 leading-relaxed max-w-lg mb-10">
              Everything you need to know about ClearUX audits, pricing, and reports.
            </p>

            {/* Search Box */}
            <div className="max-w-md">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search FAQs..."
                  className="w-full pl-10 pr-16 py-3 rounded-lg border border-white/[0.1] bg-white/[0.05] text-white text-sm font-body placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-white/20 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-white/40 hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="font-body text-xs text-white/40 mt-2">
                  {totalVisible} result{totalVisible !== 1 ? 's' : ''} found
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── CATEGORY TABS ── */}
        <section className="relative z-10">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pb-12">
            <div className="flex flex-wrap items-center gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setOpenItems(new Set()); }}
                  className={`text-xs font-medium px-4 py-2 rounded-lg transition-all ${
                    activeTab === tab
                      ? 'text-white bg-white/[0.08]'
                      : 'text-white/50 bg-white/[0.04] hover:bg-white/[0.06]'
                  }`}
                >
                  {tab === TAB_ALL ? `All (${totalQuestions})` : tab}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ SECTIONS ── */}
        {visibleSections.length === 0 ? (
          <section className="relative z-10">
            <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pb-10">
              <div className="py-12">
                <Search size={24} className="text-white/50 mb-3" />
                <p className="font-heading text-white font-medium text-sm mb-1">No results found</p>
                <p className="font-body text-white/50 text-xs">
                  Try a different search term, or{' '}
                  <button onClick={() => { setSearchQuery(''); setActiveTab(TAB_ALL); }} className="underline hover:text-white transition-colors">
                    browse all questions
                  </button>
                </p>
              </div>
            </div>
          </section>
        ) : (
          visibleSections.map((section, sIdx) => (
            <section
              key={section.title}
              className={`relative z-10 ${sIdx < visibleSections.length - 1 ? 'pb-10' : 'pb-8'}`}
            >
              <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
                {/* Section header */}
                {(activeTab === TAB_ALL || searchQuery) && (
                  <div className="flex items-center gap-3 mb-5">
                    <h2 className="font-heading font-medium text-xl sm:text-2xl text-white">
                      {section.title}
                    </h2>
                    <span className="font-body text-[11px] font-medium text-white/30">
                      {section.items.length}
                    </span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                  </div>
                )}

                {/* Accordion items */}
                <div className="space-y-3 max-w-3xl">
                  {section.items.map((faq, i) => {
                    const key = `${section.title}-${i}`;
                    return (
                      <FaqItem
                        key={key}
                        q={faq.q}
                        a={faq.a}
                        isOpen={openItems.has(key)}
                        onToggle={() => toggleItem(key)}
                      />
                    );
                  })}
                </div>
              </div>
            </section>
          ))
        )}

        {/* Spacer before CTA */}
        <div className="relative z-10 pb-16" />
      </div>

      {/* ── FINAL CTA ── */}
      <section className="relative py-28 sm:py-36 overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <img src="/gradients/bg-cta.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#111114] via-transparent to-[#111114]" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 text-center">
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white mb-4" style={{ lineHeight: '1.1' }}>
            Start your audit <span className="text-lime-gradient">today</span>
          </h2>
          <p className="text-white/45 text-base md:text-lg max-w-md mx-auto leading-relaxed mb-10">
            Your first audit is free. No credit card, no commitment — just actionable UX insights in minutes.
          </p>
          <Link
            href="/register"
            className="group inline-flex items-center gap-2.5 px-7 py-[1.2rem] rounded-full bg-white text-[#111114] text-base font-medium transition-all hover:bg-white/90 whitespace-nowrap min-h-[48px]"
          >
            Start Free Audit
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>

    </main>
  );
}
