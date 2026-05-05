'use client';

import { useState } from 'react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight, CheckCircle, Eye, Shield, Heart, Brain,
  Search, BarChart3, FileText, Share2, RefreshCw,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { HomeJsonLd } from "@/components/seo/JsonLd";
import { useAuth } from '@/context/AuthContext';
import { HeroReportMockup, ReportShowcase } from '@/components/motion/ProductMockup';
import { ScrollReveal, StaggerReveal, StaggerItem } from '@/components/motion';

/* ── FAQ data ─────────────────────────────────────────────── */
const TOP_FAQS = [
  { q: 'How long does an audit take?', a: 'Most audits complete in under 10 minutes. Our AI crawls your website, analyses every page against 64 checkpoints across 16 categories, and generates a full professional report.' },
  { q: 'What does the audit cover?', a: 'We evaluate 16 categories across 4 pillars: Foundation, Human Experience, Inclusive Design, and Future Readiness. Every audit includes accessibility, ethical UX, AI readiness, conversion analysis, and more.' },
  { q: 'Is ClearUX 100% accurate?', a: 'No automated tool is perfect, and we believe honesty about this builds trust. Our AI catches what other tools miss, but we recommend human review for critical accessibility findings. You can dismiss any finding with a reason, and the AI learns from your feedback on re-audits.' },
  { q: 'How do credits work?', a: 'One credit = one full audit. Credits never expire. Every audit includes all 64 checkpoints, PDF & Word reports, finding status tracking, shareable team links, and prioritised recommendations.' },
  { q: 'Can I re-audit the same site to track improvement?', a: 'Yes. Re-audits run in Baseline mode by default — they only verify whether previous findings are fixed, still present, or dismissed. Your score improves predictably as you resolve issues. When you\'re ready to discover new issues beyond the baseline, hit "Dig Deeper" for a full Deep mode analysis.' },
];

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE — Clean, structured, Stability AI / Twinkle.ai style
   ═══════════════════════════════════════════════════════════════ */
export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [heroUrl, setHeroUrl] = useState('');

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = heroUrl.trim();
    if (!trimmed) return;
    const encoded = encodeURIComponent(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    router.push(user ? `/dashboard/new-audit?url=${encoded}` : `/register?url=${encoded}`);
  };

  return (
    <div className="bg-surface text-text min-h-screen">
      <HomeJsonLd />
      <Navbar />
      <main id="main-content">

      {/* ═══════════════════════════════════════════════════════
          SECTION 1 — HERO
          Clean white background, big typography, product screenshot
          ═══════════════════════════════════════════════════════ */}
      <section className="relative bg-surface overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-28 pb-0">
          {/* Headline — large, confident */}
          <motion.div
            className="text-center max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem] font-bold tracking-tight text-text mb-6" style={{ lineHeight: '1.08' }}>
              Find the UX Issues<br />
              Costing You Conversions
            </h1>
            <p className="text-muted text-lg md:text-xl max-w-2xl mx-auto mb-10" style={{ lineHeight: '1.6' }}>
              AI-powered UX audit across 64 checkpoints — accessibility, dark patterns, conversion psychology, and AI readiness. Professional report in under 10 minutes.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Link
                href="/register"
                className="group inline-flex items-center gap-2.5 bg-text text-surface font-semibold text-base px-8 py-4 min-h-[52px] rounded-xl transition-all hover:opacity-90"
              >
                Start Free Audit
                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center gap-2 text-base font-medium text-muted hover:text-text px-6 py-4 min-h-[52px] rounded-xl border border-border hover:border-text/20 transition-all"
              >
                See How It Works
              </Link>
            </div>

            {/* Trust line */}
            <p className="text-sm text-muted mb-16 sm:mb-20">
              First audit free. No credit card required.
            </p>
          </motion.div>

          {/* Product mockup — hero centerpiece */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <HeroReportMockup />
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2 — TRUST BAR
          Horizontal logo strip
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-surface border-t border-border/50 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold tracking-widest uppercase text-muted/60 mb-8">
            Built for teams who care about user experience
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {['Product Managers', 'Design Teams', 'Agencies', 'Startups', 'Enterprise'].map((label, i) => (
              <motion.span
                key={i}
                className="text-sm font-medium text-muted/50 tracking-wide"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                {label}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3 — HOW IT WORKS
          3-step horizontal grid, clean and compact
          ═══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="bg-off py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text tracking-tight mb-4">
              How ClearUX Works
            </h2>
            <p className="text-muted text-base md:text-lg max-w-xl mx-auto">
              Three steps. Under 10 minutes. Zero setup.
            </p>
          </ScrollReveal>

          <StaggerReveal className="grid md:grid-cols-3 gap-6 lg:gap-8" staggerDelay={0.15}>
            {[
              {
                step: '01',
                icon: Search,
                title: 'Paste your URL',
                desc: 'Enter any website. ClearUX crawls every key page automatically — no code, no setup, no browser extension.',
              },
              {
                step: '02',
                icon: Brain,
                title: 'AI runs 64 checkpoints',
                desc: 'Each page is evaluated against four UX pillars: ethical design, cognitive accessibility, AI readiness, and conversion psychology.',
              },
              {
                step: '03',
                icon: BarChart3,
                title: 'Get your report',
                desc: 'A ranked list of findings by severity and business impact — with clear, actionable fixes for each one. Export PDF or Word.',
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <StaggerItem key={i}>
                  <div className="bg-card rounded-2xl border border-border/40 p-8 h-full">
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-10 h-10 rounded-xl bg-text/[0.05] flex items-center justify-center">
                        <Icon size={20} className="text-text" />
                      </div>
                      <span className="font-heading text-sm font-bold text-muted/40">{item.step}</span>
                    </div>
                    <h3 className="font-heading text-lg font-semibold text-text mb-2">{item.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{item.desc}</p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — PRODUCT SHOWCASE
          Dark section with detailed report mockup
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-[#111111] py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4 text-[#34D399]">What you get</p>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
              A report your team can act on
            </h2>
            <p className="text-white/40 text-base md:text-lg max-w-xl mx-auto">
              Every finding ranked by severity and business impact, with clear fixes and category scores.
            </p>
          </ScrollReveal>

          <ReportShowcase />

          {/* 3 feature highlights */}
          <StaggerReveal className="grid sm:grid-cols-3 gap-8 mt-16" staggerDelay={0.1}>
            {[
              { icon: CheckCircle, title: 'Prioritised findings', desc: 'Critical issues surface first so you fix what matters most.' },
              { icon: FileText, title: 'PDF & Word export', desc: 'Share professional reports with stakeholders in one click.' },
              { icon: Share2, title: 'Team sharing', desc: 'One link gives anyone the score, breakdown, and recommendations.' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <StaggerItem key={i}>
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.06] mb-4">
                      <Icon size={18} className="text-[#34D399]" />
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1.5">{item.title}</h3>
                    <p className="text-xs text-white/40 leading-relaxed">{item.desc}</p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 5 — DIFFERENTIATORS
          4 cards in a 2x2 grid — what makes ClearUX different
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-surface py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text tracking-tight mb-4">
              What other tools miss
            </h2>
            <p className="text-muted text-base md:text-lg max-w-2xl mx-auto">
              Lighthouse checks performance. WAVE checks WCAG. ClearUX checks everything else — the human side of UX that actually drives conversions.
            </p>
          </ScrollReveal>

          <StaggerReveal className="grid sm:grid-cols-2 gap-5 lg:gap-6" staggerDelay={0.1}>
            {[
              {
                icon: Shield,
                title: 'Dark pattern detection',
                desc: 'Confirmshaming, forced continuity, trick questions, hidden costs — we detect manipulative UX patterns that no scanner looks for.',
                tag: 'Ethical UX',
              },
              {
                icon: Heart,
                title: 'Cognitive accessibility',
                desc: 'How your site performs for users with ADHD, dyslexia, and autism spectrum — testing cognitive load, reading complexity, and sensory overload.',
                tag: 'Beyond WCAG',
              },
              {
                icon: Brain,
                title: 'AI agent readiness',
                desc: 'Can ChatGPT describe your product? Can an AI agent navigate your checkout? We test how LLMs and AI agents understand your site.',
                tag: 'Future-proof',
              },
              {
                icon: Eye,
                title: 'Conversion psychology',
                desc: 'CTA placement, friction points, trust signal positioning, and user decision psychology. Every finding ties back to revenue impact.',
                tag: 'Revenue impact',
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <StaggerItem key={i}>
                  <div className="rounded-2xl border border-border/40 bg-card p-7 sm:p-8 h-full hover:border-border transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-text/[0.05] flex items-center justify-center">
                        <Icon size={20} className="text-text" />
                      </div>
                      <span className="text-[10px] font-semibold tracking-wider uppercase text-muted/50 border border-border/50 px-2.5 py-1 rounded-full">{item.tag}</span>
                    </div>
                    <h3 className="font-heading text-lg font-semibold text-text mb-2">{item.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{item.desc}</p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 6 — BEYOND THE REPORT
          3 features in a horizontal strip
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-off py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text tracking-tight mb-4">
              Beyond the report
            </h2>
            <p className="text-muted text-base md:text-lg max-w-xl mx-auto">
              Track fixes, measure improvement, share results — all from one dashboard.
            </p>
          </ScrollReveal>

          <StaggerReveal className="grid md:grid-cols-3 gap-6 lg:gap-8" staggerDelay={0.12}>
            {[
              {
                icon: CheckCircle,
                title: 'Track every fix',
                desc: 'Every finding gets a status — open, in progress, fixed. Your dashboard shows resolution progress in real-time.',
              },
              {
                icon: RefreshCw,
                title: 'Re-audit to prove it',
                desc: 'Fix issues and re-audit the same URL. Verify your fixes, run deep scans for new issues, or focus on specific pillars.',
              },
              {
                icon: Share2,
                title: 'Share with anyone',
                desc: 'One link gives stakeholders the score, pillar breakdown, and top recommendations. Export PDF or Word. Revoke anytime.',
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <StaggerItem key={i}>
                  <div className="bg-card rounded-2xl border border-border/40 p-8 h-full">
                    <div className="w-10 h-10 rounded-xl bg-text/[0.05] flex items-center justify-center mb-5">
                      <Icon size={20} className="text-text" />
                    </div>
                    <h3 className="font-heading text-lg font-semibold text-text mb-2">{item.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{item.desc}</p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 7 — PRICING TEASER
          Simple, confident
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-surface py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="rounded-2xl border border-border/40 bg-card p-8 sm:p-12">
              <div className="grid sm:grid-cols-2 gap-10 items-center">
                <div>
                  <p className="text-xs font-semibold tracking-widest uppercase text-muted mb-4">Simple pricing</p>
                  <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text mb-3 tracking-tight">
                    $99 per audit.
                  </h2>
                  <p className="text-muted text-base mb-8 leading-relaxed">
                    No subscription. No feature gates. Every audit gets the full 64-checkpoint analysis. First audit is free.
                  </p>
                  <div className="space-y-3 mb-8">
                    {[
                      'All 16 categories, all 4 pillars',
                      'PDF & Word reports included',
                      'Track fixes and re-audit anytime',
                      'Credits never expire',
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span className="text-sm text-text">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row items-start gap-3">
                    <Link
                      href="/register"
                      className="inline-flex items-center gap-2 bg-text text-surface font-semibold text-[15px] rounded-xl px-6 py-3 min-h-[48px] hover:opacity-90 transition-opacity"
                    >
                      Start Free Audit
                      <ArrowRight size={16} />
                    </Link>
                    <Link
                      href="/pricing"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-text transition-colors py-3 px-2"
                    >
                      View all plans
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-center justify-center">
                  <div className="text-center">
                    <div className="flex items-baseline justify-center gap-1 mb-2">
                      <span className="text-muted text-2xl">$</span>
                      <span className="font-heading text-8xl font-bold text-text tracking-tight">99</span>
                    </div>
                    <p className="text-muted text-sm">per audit, one-time</p>
                    <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/15">
                      <CheckCircle size={13} className="text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">First audit free</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 8 — FAQ
          Clean accordion
          ═══════════════════════════════════════════════════════ */}
      <section id="faq" className="bg-off py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <ScrollReveal className="text-center mb-12">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text tracking-tight mb-4">
              Frequently asked questions
            </h2>
          </ScrollReveal>

          <StaggerReveal className="space-y-2" staggerDelay={0.08}>
            {TOP_FAQS.map((item, idx) => (
              <StaggerItem key={idx}>
                <details className="group rounded-2xl border border-border/40 bg-card overflow-hidden">
                  <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-off/50 transition-colors">
                    <h3 className="font-medium text-text text-[15px] pr-4">{item.q}</h3>
                    <ArrowRight size={14} className="text-muted flex-shrink-0 transform group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="mx-5 pb-5 pt-1 border-t border-border">
                    <p className="text-muted text-sm leading-relaxed pt-4">{item.a}</p>
                  </div>
                </details>
              </StaggerItem>
            ))}
          </StaggerReveal>

          <ScrollReveal delay={0.3} className="text-center mt-8">
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 text-sm font-semibold text-text hover:opacity-70 transition-opacity"
            >
              Read all FAQ
              <ArrowRight size={14} />
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 9 — FINAL CTA
          Dark band, confident, minimal
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-[#111111] py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
        <ScrollReveal className="max-w-3xl mx-auto text-center">
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight" style={{ lineHeight: '1.1' }}>
            Ready to see what<br className="hidden sm:block" />
            you&apos;re missing?
          </h2>
          <p className="text-white/50 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
            Real findings your team can act on — prioritised by impact, trackable as you fix them, re-auditable to prove improvement.
          </p>

          <form onSubmit={handleHeroSubmit} className="max-w-lg mx-auto mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label htmlFor="cta-url-input" className="sr-only">Website URL to audit</label>
                <input
                  id="cta-url-input"
                  type="text"
                  name="url"
                  autoComplete="url"
                  value={heroUrl}
                  onChange={(e) => setHeroUrl(e.target.value)}
                  placeholder="yourwebsite.com"
                  aria-label="Website URL to audit"
                  className="w-full px-5 py-4 text-base rounded-xl bg-white/[0.06] border border-white/[0.10] text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 transition-all"
                />
              </div>
              <button
                type="submit"
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 min-h-[52px] text-base bg-white text-[#111111] rounded-xl font-semibold transition-all hover:bg-white/90 flex-shrink-0"
              >
                {user ? 'Get My Audit' : 'Start Free Audit'}
                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/30">
            <span>First audit free</span>
            <span className="opacity-40">&middot;</span>
            <span>No credit card needed</span>
            <span className="opacity-40">&middot;</span>
            <span>Results in minutes</span>
          </div>
        </ScrollReveal>
      </section>

      </main>
      <Footer />
    </div>
  );
}
