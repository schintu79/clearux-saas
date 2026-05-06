'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, CheckCircle, Eye, Shield, Heart, Brain,
  Search, FileText, Share2, RefreshCw, BarChart3, ListChecks,
  Sparkles, Target, ScanEye, ShieldAlert,
  Zap, Accessibility, Bot, ChevronDown,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { HomeJsonLd } from "@/components/seo/JsonLd";
import { useAuth } from '@/context/AuthContext';
// ProductMockup components available if needed
// import { ReportShowcase } from '@/components/motion/ProductMockup';
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

          {/* Rotating headline — left-aligned, light weight */}
          <div className="h-[4.5rem] sm:h-[5.5rem] md:h-[7rem] lg:h-[8.5rem] relative mb-12 sm:mb-16">
            <AnimatePresence mode="wait">
              <motion.h1
                key={headlineIdx}
                className="font-heading text-[2.25rem] sm:text-[3rem] md:text-[4rem] lg:text-[5rem] font-light tracking-tight text-white absolute inset-x-0"
                style={{ lineHeight: '1.02' }}
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

          {/* Description */}
          <motion.p
            className="text-white/35 text-base sm:text-lg max-w-xl mb-10 sm:mb-14"
            style={{ lineHeight: '1.7' }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            We analyse websites across 64 checkpoints covering accessibility, dark patterns, conversion psychology, and AI readiness. Fully automated and delivered in minutes.
          </motion.p>

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
                Start Free Audit
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            <p className="text-[11px] text-white/20 mt-3 tracking-wide">No credit card required</p>
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
          Pure white background, charcoal text, left-aligned
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-6 sm:px-10 lg:px-16 bg-white">
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
                className="text-left"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <AnimatedCounter
                  end={stat.end}
                  suffix={stat.suffix}
                  className="font-heading text-5xl sm:text-6xl lg:text-7xl font-light text-[#111114]"
                  duration={2}
                />
                <p className="text-sm font-semibold text-[#111114]/70 mt-3">{stat.label}</p>
                <p className="text-xs text-[#111114]/40 mt-1">{stat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3 — CORE FEATURES
          Musicbed-style editorial grid with scrolling showcase
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 overflow-hidden bg-[#141418]">
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          {/* Editorial headline — left-aligned, large, Musicbed-style */}
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40 mb-8">
              For high-performing digital teams
            </p>
            <h2
              className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white tracking-tight max-w-4xl mb-10"
              style={{ lineHeight: '1.1' }}
            >
              What makes ClearUX{' '}
              <span className="italic text-white/40">unstoppable.</span>
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8">
              <p className="text-white/35 text-base md:text-lg max-w-2xl leading-relaxed">
                Four pillars no other tool covers — each one designed to find the issues that actually cost you users and revenue.
              </p>
              <Link
                href="/register"
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-white text-[#111114] text-sm font-semibold tracking-wide uppercase transition-all hover:bg-white/90 flex-shrink-0 whitespace-nowrap"
              >
                Start Your Audit Now
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </ScrollReveal>

          {/* Feature grid — 3 columns top, 2 bottom, matching Musicbed layout */}
          <StaggerReveal className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-0" staggerDelay={0.08}>
            {[
              {
                icon: ShieldAlert,
                title: 'Dark Pattern Detection',
                desc: 'Confirmshaming, forced continuity, trick questions, hidden costs — we detect manipulative UX patterns that erode trust.',
              },
              {
                icon: Brain,
                title: 'Cognitive Accessibility',
                desc: 'How your site performs for users with ADHD, dyslexia, and autism spectrum — testing cognitive load and sensory overload.',
              },
              {
                icon: Sparkles,
                title: 'AI Agent Readiness',
                desc: 'Can ChatGPT describe your product? Can an AI agent navigate your checkout? We test how LLMs interact with your site.',
              },
              {
                icon: Target,
                title: 'Conversion Psychology',
                desc: 'CTA placement, friction points, trust signal positioning, and decision psychology. Every finding ties back to revenue impact.',
              },
              {
                icon: Eye,
                title: 'Visual & UX Audit',
                desc: 'Colour contrast, typography hierarchy, layout consistency, and responsive design — the foundation every site needs right.',
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <StaggerItem key={i}>
                  <div className="py-8 border-t border-white/[0.06]">
                    <div className="flex items-center gap-3 mb-4">
                      <Icon size={18} className="text-white/50" strokeWidth={1.5} />
                      <h3 className="font-heading text-[15px] font-semibold text-white">{item.title}</h3>
                    </div>
                    <p className="text-sm text-white/35 leading-relaxed">{item.desc}</p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerReveal>
        </div>

        {/* ── Scrolling showcase gallery ── */}
        <div className="mt-16 sm:mt-24 space-y-4 overflow-hidden">
          {/* Row 1 — scrolls left */}
          <div className="relative">
            <div
              className="flex gap-4 w-max"
              style={{ animation: 'scroll-left 40s linear infinite' }}
            >
              {[...Array(2)].map((_, setIdx) => (
                <div key={setIdx} className="flex gap-4">
                  {[
                    { label: 'Dark Pattern Scanner', subtitle: 'Ethical UX Pillar', color: '#F87171' },
                    { label: 'Cognitive Load Test', subtitle: 'Accessibility Pillar', color: '#A78BFA' },
                    { label: 'AI Discoverability', subtitle: 'Future Readiness Pillar', color: '#60A5FA' },
                    { label: 'Conversion Friction Map', subtitle: 'Revenue Impact Pillar', color: '#FBBF24' },
                  ].map((card, j) => (
                    <div
                      key={j}
                      className="relative w-[280px] sm:w-[340px] h-[180px] sm:h-[200px] rounded-xl overflow-hidden flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      {/* Subtle gradient accent */}
                      <div
                        className="absolute inset-0 opacity-[0.08]"
                        style={{ background: `radial-gradient(circle at 30% 40%, ${card.color} 0%, transparent 70%)` }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between">
                        <div>
                          <p className="text-xs text-white/30 mb-1">{card.subtitle}</p>
                          <p className="text-sm font-semibold text-white/80">{card.label}</p>
                        </div>
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: `${card.color}20` }}
                        >
                          <ScanEye size={14} style={{ color: card.color }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Row 2 — scrolls right */}
          <div className="relative">
            <div
              className="flex gap-4 w-max"
              style={{ animation: 'scroll-right 45s linear infinite' }}
            >
              {[...Array(2)].map((_, setIdx) => (
                <div key={setIdx} className="flex gap-4">
                  {[
                    { label: 'Trust Signal Audit', subtitle: 'Foundation Pillar', color: '#84CC16' },
                    { label: 'WCAG Compliance', subtitle: 'Inclusive Design Pillar', color: '#22D3EE' },
                    { label: 'Reading Complexity', subtitle: 'Cognitive Accessibility', color: '#EC4899' },
                    { label: 'Structured Data Check', subtitle: 'AI Readiness', color: '#F59E0B' },
                  ].map((card, j) => (
                    <div
                      key={j}
                      className="relative w-[260px] sm:w-[300px] h-[160px] sm:h-[180px] rounded-xl overflow-hidden flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div
                        className="absolute inset-0 opacity-[0.08]"
                        style={{ background: `radial-gradient(circle at 70% 60%, ${card.color} 0%, transparent 70%)` }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between">
                        <div>
                          <p className="text-xs text-white/30 mb-1">{card.subtitle}</p>
                          <p className="text-sm font-semibold text-white/80">{card.label}</p>
                        </div>
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: `${card.color}20` }}
                        >
                          <ScanEye size={12} style={{ color: card.color }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — HOW IT WORKS
          Pure white, charcoal text, left-aligned Musicbed style
          ═══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="relative py-24 sm:py-32 px-6 sm:px-10 lg:px-16 bg-white">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#111114]/40 mb-8">
              Simple process
            </p>
            <h2
              className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-[#111114] tracking-tight max-w-4xl mb-10"
              style={{ lineHeight: '1.1' }}
            >
              How ClearUX <span className="italic text-[#111114]/40">works.</span>
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8">
              <p className="text-[#111114]/40 text-base md:text-lg max-w-2xl leading-relaxed">
                No signup walls, no setup, no waiting. Paste a URL, let the AI do the heavy lifting, and get a prioritised report your team can act on immediately.
              </p>
              <Link
                href="/register"
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-[#111114] text-white text-sm font-semibold tracking-wide uppercase transition-all hover:bg-[#111114]/90 flex-shrink-0 whitespace-nowrap"
              >
                Start Your Audit Now
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </ScrollReveal>

          <StaggerReveal className="grid md:grid-cols-3 gap-8 lg:gap-10" staggerDelay={0.12}>
            {[
              {
                step: '01',
                title: 'Paste your URL',
                desc: 'Enter any website or specific page. ClearUX automatically crawls your key pages, identifies interactive elements, and maps the user journey — no code snippets, no browser extension, no tag manager required.',
              },
              {
                step: '02',
                title: 'AI analyses 64 checkpoints',
                desc: 'Every page is evaluated against four UX pillars: ethical design, cognitive accessibility, AI agent readiness, and conversion psychology. The AI scores each category, flags issues by severity, and ties findings to business impact.',
              },
              {
                step: '03',
                title: 'Get your prioritised report',
                desc: 'A ranked report with critical issues first, clear explanations of what\'s wrong and why it matters, and actionable fixes for each finding. Export as PDF or Word, share with a link, or track fixes from your dashboard.',
              },
            ].map((item, i) => (
              <StaggerItem key={i}>
                <div className="border-t border-[#111114]/10 pt-8">
                  <span className="font-heading text-[4rem] sm:text-[5rem] font-light text-[#111114]/[0.06] leading-none block mb-4">
                    {item.step}
                  </span>
                  <h3 className="font-heading text-xl font-semibold text-[#111114] mb-3">{item.title}</h3>
                  <p className="text-sm text-[#111114]/40 leading-relaxed">{item.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 5 — WHAT YOU GET
          Light grey bg, editorial headline + scrolling cards
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 overflow-hidden" style={{ background: '#F7F7F8' }}>
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          {/* Editorial headline */}
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#111114]/40 mb-8">
              What you get
            </p>
            <h2
              className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-[#111114] tracking-tight max-w-4xl mb-10"
              style={{ lineHeight: '1.1' }}
            >
              A report your team{' '}
              <span className="italic text-[#111114]/40">can act on.</span>
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 border-b border-[#111114]/10 pb-8">
              <p className="text-[#111114]/40 text-base md:text-lg max-w-2xl leading-relaxed">
                Every finding ranked by severity and business impact, with clear fixes and category scores your team can act on immediately.
              </p>
              <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#111114]/30 flex-shrink-0">
                64+ checkpoints across 16 categories
              </p>
            </div>
          </ScrollReveal>
        </div>

        {/* Scrolling feature cards — Musicbed image gallery style */}
        <div className="space-y-5">
          {/* Row 1 — scrolls left */}
          <div className="relative">
            <div
              className="flex gap-5 w-max pl-6 sm:pl-10 lg:pl-16"
              style={{ animation: 'scroll-left 50s linear infinite' }}
            >
              {[...Array(2)].map((_, setIdx) => (
                <div key={setIdx} className="flex gap-5">
                  {[
                    { icon: ListChecks, title: 'Prioritised Findings', label: 'Severity Ranked', desc: 'Critical issues surface first so you fix what matters most.' },
                    { icon: FileText, title: 'PDF & Word Export', label: 'One-Click Reports', desc: 'Share professional reports with stakeholders. Branded and formatted.' },
                    { icon: Share2, title: 'Team Sharing', label: 'Shareable Links', desc: 'One link gives anyone the score, breakdown, and recommendations.' },
                  ].map((card, j) => (
                    <div
                      key={j}
                      className="relative w-[300px] sm:w-[360px] rounded-2xl p-7 flex-shrink-0 bg-white border border-[#111114]/[0.06] hover:border-[#111114]/[0.12] transition-colors"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <card.icon size={22} className="text-[#111114]/30" strokeWidth={1.5} />
                        <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#111114]/25">{card.label}</span>
                      </div>
                      <h3 className="font-heading text-lg font-semibold text-[#111114] mb-2">{card.title}</h3>
                      <p className="text-sm text-[#111114]/40 leading-relaxed">{card.desc}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Row 2 — scrolls right */}
          <div className="relative">
            <div
              className="flex gap-5 w-max pl-6 sm:pl-10 lg:pl-16"
              style={{ animation: 'scroll-right 55s linear infinite' }}
            >
              {[...Array(2)].map((_, setIdx) => (
                <div key={setIdx} className="flex gap-5">
                  {[
                    { icon: CheckCircle, title: 'Track Every Fix', label: 'Status Dashboard', desc: 'Every finding gets a status — open, in progress, fixed. Track resolution in real-time.' },
                    { icon: RefreshCw, title: 'Re-Audit to Prove It', label: 'Baseline Mode', desc: 'Fix issues and re-audit the same URL. Verify fixes or dig deeper for new issues.' },
                    { icon: BarChart3, title: 'Category Scores', label: '16 Categories', desc: '16 categories across 4 pillars — each scored individually so you know where to improve.' },
                  ].map((card, j) => (
                    <div
                      key={j}
                      className="relative w-[300px] sm:w-[360px] rounded-2xl p-7 flex-shrink-0 bg-white border border-[#111114]/[0.06] hover:border-[#111114]/[0.12] transition-colors"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <card.icon size={22} className="text-[#111114]/30" strokeWidth={1.5} />
                        <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#111114]/25">{card.label}</span>
                      </div>
                      <h3 className="font-heading text-lg font-semibold text-[#111114] mb-2">{card.title}</h3>
                      <p className="text-sm text-[#111114]/40 leading-relaxed">{card.desc}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 7 — PRICING TEASER
          Glass card, simple
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-6 sm:px-10 lg:px-16">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <div className="glass-card rounded-2xl p-8 sm:p-12 max-w-4xl">
              <div className="grid sm:grid-cols-2 gap-10 items-center">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40 mb-4">Simple pricing</p>
                  <h2 className="font-heading text-3xl sm:text-4xl font-light text-white mb-3 tracking-tight">
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
      <section id="faq" className="relative py-24 sm:py-32 px-6 sm:px-10 lg:px-16">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40 mb-8">
              FAQ
            </p>
            <h2
              className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white tracking-tight max-w-4xl"
              style={{ lineHeight: '1.1' }}
            >
              Frequently asked <span className="italic text-white/40">questions.</span>
            </h2>
          </ScrollReveal>

          <StaggerReveal className="space-y-2 max-w-2xl" staggerDelay={0.08}>
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

          <ScrollReveal delay={0.3} className="mt-8 max-w-2xl">
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
      <section className="relative py-24 sm:py-32 px-6 sm:px-10 lg:px-16 overflow-hidden">
        <AuroraBackground variant="cta" />
        <ScrollReveal className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] font-light text-white mb-6 tracking-tight" style={{ lineHeight: '1.1' }}>
            Ready to see what<br className="hidden sm:block" />
            you&apos;re <span className="italic text-white/40">missing?</span>
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
