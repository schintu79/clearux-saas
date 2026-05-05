'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Search, ChevronDown, HelpCircle, BookOpen, Brain, CreditCard, ShieldCheck, Sparkles } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

/* ── FAQ Data ───────────────────────────────────────────────── */

const FAQ_SECTIONS = [
  {
    title: 'General',
    icon: HelpCircle,
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
        a: 'Yes. ClearUX works with any publicly accessible URL — dynamic apps, single-page applications, and traditional multi-page sites. Content behind logins (admin panels, member areas) isn’t accessible to our crawler. For complex multi-step flows like checkouts, findings cover the accessible steps.',
      },
      {
        q: 'What languages are supported?',
        a: 'Reports are available in English, Spanish, French, German, Italian, and Portuguese. All findings, recommendations, and the full report are translated.',
      },
      {
        q: 'How does ClearUX compare to hiring a UX consultant?',
        a: 'A traditional UX audit costs $5,000–$15,000 and takes 2–4 weeks. ClearUX delivers 64 checkpoints across 16 categories in minutes for a fraction of the cost. It’s ideal for quick, comprehensive baseline assessments. For deep qualitative research (user interviews, usability testing), we recommend pairing ClearUX findings with a specialist.',
      },
      {
        q: 'Can I track which findings have been fixed?',
        a: 'Yes. Every finding has a status you can update: Open, In Progress, Fixed, or Backlog. Your dashboard tracks how many issues you’ve resolved over time, giving you a clear picture of progress.',
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
    icon: BookOpen,
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
    icon: Brain,
    items: [
      {
        q: 'What AI powers the audits?',
        a: 'ClearUX uses Anthropic’s Claude as its core analysis engine — but the AI is only the final layer. Behind every audit is a proprietary evaluation framework built on years of UX research, accessibility consulting, and conversion optimisation. Each of the 64 checkpoints is backed by a deeply engineered prompt chain that encodes real-world heuristics from Nielsen Norman Group research, WCAG 2.2 success criteria, FTC dark pattern enforcement actions, behavioural psychology literature, and emerging AI agent interaction standards. The system doesn’t just ask the AI generic questions — it runs multi-pass analysis: first crawling and extracting your actual page content (text, structure, semantic HTML, visual hierarchy), then cross-referencing findings across pages for context-aware evaluation, and finally scoring each finding against severity and business-impact models calibrated from hundreds of real audits. The result is findings that reference specific elements on your site with the depth of a senior consultant, not the surface-level flags of an automated scanner.',
      },
      {
        q: 'What are the known limitations?',
        a: 'Our AI analyses publicly visible page content. It cannot test JavaScript-heavy interactions (hover states, multi-step flows behind authentication), real page load speed, or actual user behaviour. For accessibility compliance, we strongly recommend pairing ClearUX findings with manual testing using screen readers and keyboard navigation. The AI may also miss highly context-specific design decisions that are intentional for your audience — that’s why we built the dismiss-with-reason feature.',
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
    icon: CreditCard,
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
        a: 'If you’re unsatisfied with an audit, contact support@clearux.ai and we’ll resolve it or provide a credit for a new audit. We stand behind the quality of our reports.',
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
    icon: ShieldCheck,
    items: [
      {
        q: 'Is ClearUX 100% accurate?',
        a: 'No, and we believe honesty about this is important. Our AI catches issues that traditional tools miss — dark patterns, emotional design gaps, cognitive accessibility barriers, AI readiness gaps — but no automated system is perfect. We recommend human review for accessibility-critical and security-sensitive findings. That’s why every finding includes a status tracker: your team can verify, dismiss with a reason, or mark as fixed. The AI learns from your feedback on re-audits.',
      },
      {
        q: 'What if the audit flags something incorrectly?',
        a: 'Dismiss it directly from your dashboard with a reason (e.g., "This is intentional for our audience" or "Addressed on our About page"). The AI will skip that finding on future re-audits. If you believe the finding is a systemic error, email support@clearux.ai and we’ll review it within 24 hours. We actively use feedback to improve our analysis engine.',
      },
      {
        q: 'Can I share the report with clients or my team?',
        a: 'Yes. Every completed audit has a "Share" button that generates a read-only link. Anyone with the link can see the overall score, pillar breakdown, top recommendations, and executive summary — no ClearUX account needed. You can revoke the link at any time. PDF and Word exports are also available for offline sharing.',
      },
      {
        q: 'How does ClearUX handle false positives?',
        a: 'Our analysis engine uses cross-page awareness — it checks if content exists on other pages before flagging it as "missing" (e.g., it won’t flag missing founder credentials if your About page has them). You can also add site notes that persist across audits, giving the AI permanent context about your design decisions. Every re-audit gets smarter based on your previous feedback.',
      },
    ],
  },
];

const TAB_ALL = 'All';

/* ── Accordion Item ──────────────────────────────────────────── */

function FaqItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border border-border/20 dark:border-white/[0.05] rounded-2xl overflow-hidden bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-5 text-left hover:bg-surface-alt/40 dark:hover:bg-white/[0.02] transition-colors"
        aria-expanded={isOpen}
      >
        <span className="flex-1 font-semibold text-text text-[15px] leading-snug">{q}</span>
        <ChevronDown
          size={16}
          className={`text-muted flex-shrink-0 mt-0.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 pt-0">
          <div className="border-t border-border/20 dark:border-white/[0.04] pt-4">
            <p className="text-muted text-sm leading-[1.8]">{a}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────── */

export default function FaqPage() {
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
    <div className="flex flex-col min-h-screen bg-surface">
      <Navbar />

      <main id="main-content" className="flex-1">
        {/* Dark Hero */}
        <section className="relative overflow-hidden py-28 sm:py-36 px-4 md:px-6 lg:px-8" style={{ background: '#080808' }}>
          {/* Aurora glows */}
          <div className="absolute top-[-10%] left-[15%] w-[600px] h-[500px] rounded-full bg-[#B9FF66]/[0.05] blur-[160px] pointer-events-none" />
          <div className="absolute top-[30%] right-[10%] w-[400px] h-[400px] rounded-full bg-[#6366F1]/[0.04] blur-[140px] pointer-events-none" />

          <div className="max-w-4xl mx-auto text-center relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-white/40 border border-white/[0.08] rounded-full px-4 py-1.5 mb-6">
                <Sparkles size={12} className="text-[#B9FF66]" />
                Support Centre
              </span>
            </motion.div>

            <motion.h1
              className="font-heading font-semibold text-4xl sm:text-5xl md:text-6xl text-white mb-6"
              style={{ lineHeight: '1.1' }}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Frequently Asked Questions
            </motion.h1>

            <motion.p
              className="text-white/50 text-lg max-w-lg mx-auto mb-10"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              Everything you need to know about ClearUX audits, pricing, and reports.
            </motion.p>

            {/* Search Box in Hero */}
            <motion.div
              className="max-w-md mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
            >
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search FAQs..."
                  className="w-full pl-10 pr-16 py-3 rounded-full border border-white/[0.1] bg-white/[0.05] text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#B9FF66]/30 focus:border-[#B9FF66]/40 transition-all backdrop-blur-sm"
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
                <p className="text-xs text-white/40 mt-2 text-center">
                  {totalVisible} result{totalVisible !== 1 ? 's' : ''} found
                </p>
              )}
            </motion.div>
          </div>
        </section>

        {/* Category Tabs */}
        <motion.section
          className="px-4 sm:px-6 lg:px-8 py-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-wrap items-center gap-2 justify-center">
              {tabs.map((tab) => {
                const section = FAQ_SECTIONS.find(s => s.title === tab);
                const SectionIcon = section?.icon;
                return (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setOpenItems(new Set()); }}
                    className={`text-xs font-semibold px-4 py-2 rounded-full transition-all flex items-center gap-1.5 ${
                      activeTab === tab
                        ? 'text-white bg-text dark:bg-white dark:text-[#1D1D1F] shadow-sm'
                        : 'text-muted bg-off/60 dark:bg-white/[0.04] hover:bg-off dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {SectionIcon && <SectionIcon size={12} />}
                    {tab === TAB_ALL ? `All (${totalQuestions})` : tab}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* FAQ Sections */}
        {visibleSections.length === 0 ? (
          <section className="px-4 sm:px-6 lg:px-8 pb-10">
            <div className="max-w-3xl mx-auto text-center py-12">
              <Search size={24} className="text-muted mx-auto mb-3" />
              <p className="text-text font-medium text-sm mb-1">No results found</p>
              <p className="text-muted text-xs">
                Try a different search term, or{' '}
                <button onClick={() => { setSearchQuery(''); setActiveTab(TAB_ALL); }} className="underline hover:text-text transition-colors">
                  browse all questions
                </button>
              </p>
            </div>
          </section>
        ) : (
          visibleSections.map((section, sIdx) => (
            <motion.section
              key={section.title}
              className={`px-4 sm:px-6 lg:px-8 ${sIdx < visibleSections.length - 1 ? 'pb-10' : 'pb-8'}`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: sIdx * 0.05 }}
            >
              <div className="max-w-3xl mx-auto">
                {/* Section header */}
                {(activeTab === TAB_ALL || searchQuery) && (
                  <div className="flex items-center gap-3 mb-5">
                    <section.icon size={20} className="text-text flex-shrink-0" />
                    <h2 className="font-heading font-semibold text-xl sm:text-2xl text-text">
                      {section.title}
                    </h2>
                    <span className="text-[11px] font-semibold text-muted/50 bg-off dark:bg-white/[0.04] px-2.5 py-1 rounded-full">
                      {section.items.length}
                    </span>
                    <div className="flex-1 h-px bg-border/30 dark:bg-white/[0.04]" />
                  </div>
                )}

                {/* Accordion items */}
                <div className="space-y-3">
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
            </motion.section>
          ))
        )}

        {/* Lime CTA Band */}
        <section className="w-full py-24 sm:py-32 px-4 md:px-6 lg:px-8" style={{ background: '#B9FF66' }}>
          <motion.div
            className="text-center max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold text-[#111] mb-3 tracking-tight">
              Still have questions?
            </h3>
            <p className="text-[#111]/50 text-sm sm:text-base mb-8">
              Reach out and we will get back to you within a business day.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href="mailto:support@clearux.ai"
                className="group inline-flex items-center gap-3 bg-[#111] text-[#B9FF66] text-base font-bold px-10 py-4 rounded-2xl transition-all duration-300 hover:shadow-[0_8px_40px_rgba(0,0,0,0.3)] hover:-translate-y-1"
              >
                Email Support
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </a>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#111]/20 text-[#111] rounded-xl font-semibold hover:bg-white/30 transition-all"
              >
                Contact Us
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 mt-10">
              <Link href="/pricing" className="text-sm font-medium text-[#111]/60 hover:text-[#111] transition-colors">
                See pricing
              </Link>
              <Link href="/about" className="text-sm font-medium text-[#111]/60 hover:text-[#111] transition-colors">
                How it works
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#111]"
              >
                Start free audit <ArrowRight size={13} />
              </Link>
            </div>
          </motion.div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
