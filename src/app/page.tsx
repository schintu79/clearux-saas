'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, CheckCircle, Eye, Shield, Heart, Brain,
  Search, BarChart3, FileText, Share2, RefreshCw,
  Sparkles, Target, ScanEye, ShieldAlert,
  Zap, Accessibility, Bot, ChevronDown,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { HomeJsonLd } from "@/components/seo/JsonLd";
import { useAuth } from '@/context/AuthContext';
import { ReportShowcase } from '@/components/motion/ProductMockup';
import { ScrollReveal, StaggerReveal, StaggerItem, AnimatedCounter } from '@/components/motion';
import AuroraBackground from '@/components/motion/AuroraBackground';

/* ── FAQ data ─────────────────────────────────────────────── */
const TOP_FAQS = [
  { q: 'How long does an audit take?', a: 'Most audits complete in under 10 minutes. Our AI crawls your website, analyses every page against 64 checkpoints across 16 categories, and generates a full professional report.' },
  { q: 'What does the audit cover?', a: 'We evaluate 16 categories across 4 pillars: Foundation, Human Experience, Inclusive Design, and Future Readiness. Every audit includes accessibility, ethical UX, AI readiness, conversion analysis, and more.' },
  { q: 'Is ClearUX 100% accurate?', a: 'No automated tool is perfect, and we believe honesty about this builds trust. Our AI catches what other tools miss, but we recommend human review for critical accessibility findings. You can dismiss any finding with a reason, and the AI learns from your feedback on re-audits.' },
  { q: 'How do credits work?', a: 'One credit = one full audit. Credits never expire. Every audit includes all 64 checkpoints, PDF & Word reports, finding status tracking, shareable team links, and prioritised recommendations.' },
  { q: 'Can I re-audit the same site to track improvement?', a: 'Yes. Re-audits run in Baseline mode by default — they only verify whether previous findings are fixed, still present, or dismissed. Your score improves predictably as you resolve issues. When you\'re ready to discover new issues beyond the baseline, hit "Dig Deeper" for a full Deep mode analysis.' },
];

/* ── Rotating hero headlines ─────────────────────────────── */
const HERO_HEADLINES = [
  { main: 'Find the UX Issues', accent: 'Costing You Conversions' },
  { main: 'See What Your Users', accent: "Won't Tell You" },
  { main: '64 Checkpoints.', accent: 'Zero Guesswork.' },
];

/* ── Selling points below search bar ────────────────────── */
const HERO_SELLING_POINTS = [
  { icon: ShieldAlert, label: 'Dark Pattern', highlight: 'Detection' },
  { icon: Accessibility, label: 'Cognitive', highlight: 'Accessibility' },
  { icon: Bot, label: 'AI Agent', highlight: 'Readiness' },
  { icon: Target, label: 'Conversion', highlight: 'Psychology' },
];

/* ── Typewriter placeholders ─────────────────────────────── */
const PLACEHOLDER_URLS = [
  'yourwebsite.com',
  'acme.com/pricing',
  'shopify.com/checkout',
  'notion.so/product',
  'linear.app/features',
];

function useTypewriterPlaceholder() {
  const [placeholder, setPlaceholder] = useState(PLACEHOLDER_URLS[0]);
  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % PLACEHOLDER_URLS.length;
      setPlaceholder(PLACEHOLDER_URLS[idx]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  return placeholder;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE — Dark atmospheric, DeepSeek V3 inspired
   Deep navy bg, vibrant gradient blobs, glass-morphism cards
   ═══════════════════════════════════════════════════════════════ */
export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [heroUrl, setHeroUrl] = useState('');
  const placeholder = useTypewriterPlaceholder();
  const [headlineIdx, setHeadlineIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeadlineIdx((prev) => (prev + 1) % HERO_HEADLINES.length);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = heroUrl.trim();
    if (!trimmed) return;
    const encoded = encodeURIComponent(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    router.push(user ? `/dashboard/new-audit?url=${encoded}` : `/register?url=${encoded}`);
  };

  return (
    <div className="bg-[#111114] text-white min-h-screen">
      <HomeJsonLd />
      <Navbar />
      <main id="main-content">

      {/* ═══════════════════════════════════════════════════════
          SECTION 1 — HERO (Musicbed-inspired)
          Left-aligned, clean, minimal, dark mode
          ═══════════════════════════════════════════════════════ */}
      <section className="relative">
        <AuroraBackground variant="hero" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pt-32 sm:pt-40 pb-16 sm:pb-20">
          {/* Top label */}
          <motion.p
            className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            AI-Powered UX Audit
          </motion.p>

          {/* Rotating headline — left-aligned, light weight, Musicbed-sized */}
          <div className="h-[5rem] sm:h-[6.5rem] md:h-[8rem] lg:h-[10rem] relative mb-8">
            <AnimatePresence mode="wait">
              <motion.h1
                key={headlineIdx}
                className="font-heading text-[2.5rem] sm:text-[3.5rem] md:text-[4.5rem] lg:text-[5.5rem] font-light tracking-tight text-white absolute inset-x-0"
                style={{ lineHeight: '1.08' }}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -50 }}
                transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                {HERO_HEADLINES[headlineIdx].main}<br />
                <span className="font-semibold text-lime-gradient">{HERO_HEADLINES[headlineIdx].accent}</span>
              </motion.h1>
            </AnimatePresence>
          </div>

          {/* Description + CTA row */}
          <motion.div
            className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            <p className="text-white/40 text-base sm:text-lg max-w-xl" style={{ lineHeight: '1.7' }}>
              We analyse websites across 64 checkpoints covering accessibility, dark patterns, conversion psychology, and AI readiness. Fully automated and delivered in minutes.
            </p>

            <div className="flex items-center gap-5 flex-shrink-0">
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-7 py-3.5 min-h-[48px] border border-white text-white text-sm font-semibold tracking-wide uppercase hover:bg-white hover:text-[#111114] transition-all"
              >
                Start Free Audit
              </Link>
              <span className="text-xs text-white/30 max-w-[140px] leading-snug">
                No credit card required. Browse your full report instantly.
              </span>
            </div>
          </motion.div>

          {/* URL input field */}
          <motion.form
            onSubmit={handleHeroSubmit}
            className="max-w-2xl mb-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
          >
            <div className="relative flex items-center bg-white/[0.03] border border-white/[0.08] rounded-none p-1.5 focus-within:border-white/[0.2] transition-all">
              <Search size={18} className="ml-4 text-white/25 flex-shrink-0" />
              <label htmlFor="hero-url-input" className="sr-only">Website URL to audit</label>
              <input
                id="hero-url-input"
                type="text"
                name="url"
                autoComplete="url"
                value={heroUrl}
                onChange={(e) => setHeroUrl(e.target.value)}
                placeholder={placeholder}
                aria-label="Website URL to audit"
                className="flex-1 bg-transparent text-white text-base px-3 py-3 placeholder:text-white/20 focus:outline-none"
              />
              <button
                type="submit"
                className="group flex items-center gap-2 px-6 py-3 bg-white text-[#111114] text-sm font-semibold tracking-wide uppercase transition-all hover:bg-white/90 flex-shrink-0"
              >
                {user ? 'Audit Now' : 'Audit Now'}
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </motion.form>
        </div>

        {/* Divider line */}
        <div className="relative z-10 border-t border-white/[0.06]" />

        {/* Selling points row — horizontal strip */}
        <motion.div
          className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
            {HERO_SELLING_POINTS.map((sp, i) => {
              const Icon = sp.icon;
              return (
                <div key={i} className="flex items-center gap-2.5">
                  <Icon size={16} className="text-[#84CC16]" />
                  <span className="text-[13px] text-white/40 tracking-wide">{sp.label} <span className="font-semibold text-white/70">{sp.highlight}</span></span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2 — TRUST STATS
          Visual break with subtle background
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28 px-6 sm:px-10 lg:px-16 overflow-hidden" style={{ background: 'rgba(132,204,22,0.04)' }}>
        <div className="absolute inset-0 border-t border-b border-[#84CC16]/10 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-8">
            {[
              { end: 64, suffix: '+', label: 'UX checkpoints', desc: 'across every audit' },
              { end: 16, suffix: '', label: 'Categories', desc: 'in the framework' },
              { end: 4, suffix: '', label: 'UX pillars', desc: 'for complete coverage' },
              { end: 40, suffix: '+', label: 'Pages analysed', desc: 'per audit on avg.' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <AnimatedCounter
                  end={stat.end}
                  suffix={stat.suffix}
                  className="font-heading text-5xl sm:text-6xl lg:text-7xl font-light text-white"
                  duration={2}
                />
                <p className="text-sm font-semibold text-white/60 mt-3">{stat.label}</p>
                <p className="text-xs text-white/25 mt-1">{stat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3 — CORE FEATURES
          Visual card grid with icons and accent colors
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <AuroraBackground variant="section" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#84CC16] mb-3">Core features</p>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-bold text-white tracking-tight mb-4" style={{ lineHeight: '1.1' }}>
              What makes ClearUX <span className="italic font-normal text-white/50">unstoppable</span>
            </h2>
            <p className="text-white/40 text-base md:text-lg max-w-2xl mx-auto">
              Four pillars no other tool covers — each one designed to find the issues that actually cost you users and revenue.
            </p>
          </ScrollReveal>

          <StaggerReveal className="grid sm:grid-cols-2 gap-5 lg:gap-6" staggerDelay={0.1}>
            {[
              {
                icon: ShieldAlert,
                color: '#F87171',
                bgColor: 'rgba(248,113,113,0.08)',
                borderColor: 'rgba(248,113,113,0.12)',
                title: 'Dark pattern detection',
                desc: 'Confirmshaming, forced continuity, trick questions, hidden costs — we detect manipulative UX patterns that erode trust and no other scanner looks for.',
                highlights: ['Deceptive UI patterns', 'Manipulative copy', 'Hidden costs & traps'],
              },
              {
                icon: Brain,
                color: '#A78BFA',
                bgColor: 'rgba(167,139,250,0.08)',
                borderColor: 'rgba(167,139,250,0.12)',
                title: 'Cognitive accessibility',
                desc: 'How your site performs for users with ADHD, dyslexia, and autism spectrum — testing cognitive load, reading complexity, and sensory overload.',
                highlights: ['Cognitive load scoring', 'Reading complexity', 'Sensory overload check'],
              },
              {
                icon: Sparkles,
                color: '#60A5FA',
                bgColor: 'rgba(96,165,250,0.08)',
                borderColor: 'rgba(96,165,250,0.12)',
                title: 'AI agent readiness',
                desc: 'Can ChatGPT describe your product? Can an AI agent navigate your checkout? We test how LLMs and AI agents understand and interact with your site.',
                highlights: ['LLM discoverability', 'Agent navigation', 'Structured data quality'],
              },
              {
                icon: Target,
                color: '#FBBF24',
                bgColor: 'rgba(251,191,36,0.08)',
                borderColor: 'rgba(251,191,36,0.12)',
                title: 'Conversion psychology',
                desc: 'CTA placement, friction points, trust signal positioning, and user decision psychology. Every finding ties back to revenue impact.',
                highlights: ['Friction point mapping', 'Trust signal audit', 'CTA effectiveness'],
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <StaggerItem key={i}>
                  <div
                    className="rounded-2xl p-7 sm:p-8 h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 group"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${item.borderColor}`,
                    }}
                  >
                    {/* Icon + Title row */}
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: item.bgColor }}
                      >
                        <Icon size={22} style={{ color: item.color }} />
                      </div>
                      <div className="pt-1">
                        <h3 className="font-heading text-lg font-semibold text-white">{item.title}</h3>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-white/45 leading-relaxed mb-5">{item.desc}</p>

                    {/* Highlight tags */}
                    <div className="flex flex-wrap gap-2">
                      {item.highlights.map((tag, j) => (
                        <span
                          key={j}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                          style={{
                            background: item.bgColor,
                            color: item.color,
                          }}
                        >
                          <ScanEye size={11} style={{ color: item.color, opacity: 0.7 }} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerReveal>

          {/* CTA below the grid */}
          <ScrollReveal delay={0.3} className="text-center mt-12">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2.5 bg-[#84CC16] text-[#111114] font-semibold text-[15px] px-7 py-3.5 rounded-xl transition-all hover:bg-[#95d825]"
            >
              Try It Out
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — HOW IT WORKS
          3 steps, clean cards on dark
          ═══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#84CC16] mb-3">Simple process</p>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
              How ClearUX Works
            </h2>
            <p className="text-white/40 text-base md:text-lg max-w-xl mx-auto">
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
                  <div className="glass-card rounded-2xl p-8 h-full relative overflow-hidden hover:bg-white/[0.05] transition-colors">
                    {/* Watermark step number */}
                    <span className="absolute -top-3 -right-2 font-heading text-[7rem] font-bold leading-none select-none pointer-events-none text-white/[0.03]">
                      {item.step}
                    </span>
                    <div className="relative">
                      <div className="flex items-center gap-4 mb-5">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#84CC16]/10">
                          <Icon size={22} className="text-[#84CC16]" />
                        </div>
                        <span className="font-heading text-sm font-bold tracking-wide text-white/30">
                          Step {item.step}
                        </span>
                      </div>
                      <h3 className="font-heading text-xl font-semibold text-white mb-3">{item.title}</h3>
                      <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 5 — PRODUCT SHOWCASE
          Report mockup with glass card features below
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <AuroraBackground variant="subtle" />
        <div className="relative z-10 max-w-5xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4 text-[#84CC16]">What you get</p>
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
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#84CC16]/10 mb-4">
                      <Icon size={18} className="text-[#84CC16]" />
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
          SECTION 6 — BEYOND THE REPORT
          Glass cards in a horizontal strip
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
              Beyond the report
            </h2>
            <p className="text-white/40 text-base md:text-lg max-w-xl mx-auto">
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
                  <div className="glass-card glass-card-hover rounded-2xl p-8 h-full transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-5">
                      <Icon size={20} className="text-white/60" />
                    </div>
                    <h3 className="font-heading text-lg font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 7 — PRICING TEASER
          Glass card, simple
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <div className="glass-card rounded-2xl p-8 sm:p-12">
              <div className="grid sm:grid-cols-2 gap-10 items-center">
                <div>
                  <p className="text-xs font-semibold tracking-widest uppercase text-white/30 mb-4">Simple pricing</p>
                  <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
                    $99 per audit.
                  </h2>
                  <p className="text-white/40 text-base mb-8 leading-relaxed">
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
                        <CheckCircle className="w-4 h-4 text-[#84CC16] flex-shrink-0" />
                        <span className="text-sm text-white/70">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row items-start gap-3">
                    <Link
                      href="/register"
                      className="inline-flex items-center gap-2 bg-[#84CC16] text-[#111114] font-semibold text-[15px] rounded-xl px-6 py-3 min-h-[48px] hover:bg-[#95d825] transition-all"
                    >
                      Start Free Audit
                      <ArrowRight size={16} />
                    </Link>
                    <Link
                      href="/pricing"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-white/40 hover:text-white transition-colors py-3 px-2"
                    >
                      View all plans
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-center justify-center">
                  <div className="text-center">
                    <div className="flex items-baseline justify-center gap-1 mb-2">
                      <span className="text-white/30 text-2xl">$</span>
                      <span className="font-heading text-8xl font-bold text-white tracking-tight">99</span>
                    </div>
                    <p className="text-white/30 text-sm">per audit, one-time</p>
                    <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#84CC16]/10 border border-[#84CC16]/15">
                      <CheckCircle size={13} className="text-[#84CC16]" />
                      <span className="text-xs font-semibold text-[#84CC16]">First audit free</span>
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
          Clean accordion on dark
          ═══════════════════════════════════════════════════════ */}
      <section id="faq" className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <ScrollReveal className="text-center mb-12">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
              Frequently asked questions
            </h2>
          </ScrollReveal>

          <StaggerReveal className="space-y-2" staggerDelay={0.08}>
            {TOP_FAQS.map((item, idx) => (
              <StaggerItem key={idx}>
                <details className="group rounded-2xl glass-card overflow-hidden">
                  <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.03] transition-colors">
                    <h3 className="font-medium text-white text-[15px] pr-4">{item.q}</h3>
                    <ArrowRight size={14} className="text-white/30 flex-shrink-0 transform group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="mx-5 pb-5 pt-1 border-t border-white/[0.06]">
                    <p className="text-white/40 text-sm leading-relaxed pt-4">{item.a}</p>
                  </div>
                </details>
              </StaggerItem>
            ))}
          </StaggerReveal>

          <ScrollReveal delay={0.3} className="text-center mt-8">
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/50 hover:text-white transition-colors"
            >
              Read all FAQ
              <ArrowRight size={14} />
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 9 — FINAL CTA
          Aurora gradient background with URL input
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <AuroraBackground variant="cta" />
        <ScrollReveal className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight" style={{ lineHeight: '1.1' }}>
            Ready to see what<br className="hidden sm:block" />
            you&apos;re <span className="text-[#84CC16]">missing</span>?
          </h2>
          <p className="text-white/40 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
            Real findings your team can act on — prioritised by impact, trackable as you fix them, re-auditable to prove improvement.
          </p>

          <form onSubmit={handleHeroSubmit} className="max-w-lg mx-auto mb-6">
            <div className="relative flex items-center bg-white/[0.04] border border-white/[0.08] rounded-2xl p-1.5 focus-within:border-[#84CC16]/30 transition-all">
              <Search size={18} className="ml-4 text-white/25 flex-shrink-0" />
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
                className="flex-1 bg-transparent text-white text-base px-3 py-3 placeholder:text-white/25 focus:outline-none"
              />
              <button
                type="submit"
                className="group flex items-center gap-2 px-6 py-3 bg-[#84CC16] text-[#111114] rounded-xl font-semibold text-[15px] transition-all hover:bg-[#95d825] flex-shrink-0"
              >
                {user ? 'Get My Audit' : 'Start Free Audit'}
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/25">
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
