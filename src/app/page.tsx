'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, CheckCircle, Eye, Shield, Heart, Brain,
  Search, FileText, Share2, RefreshCw, BarChart3, ListChecks,
  Sparkles, Target, ScanEye, ShieldAlert,
  Accessibility, Bot, ChevronDown, ShieldCheck,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { HomeJsonLd } from "@/components/seo/JsonLd";
import { useAuth } from '@/context/AuthContext';
// ProductMockup components available if needed
// import { ReportShowcase } from '@/components/motion/ProductMockup';
import { ScrollReveal, StaggerReveal, StaggerItem, AnimatedCounter } from '@/components/motion';

/* ── FAQ data ─────────────────────────────────────────────── */
const TOP_FAQS = [
  { q: 'How accurate is ClearUX?', a: 'Our AI is trained on thousands of professional UX audits and delivers high-precision findings on critical issues like mobile responsiveness, accessibility failures, and conversion blockers. Every finding includes specific evidence — screenshots, element selectors, or metrics — so you can verify instantly. We prioritise precision over volume: fewer, higher-confidence findings you can act on today.' },
  { q: 'How long does it take to get my report?', a: 'Most audits complete in under 10 minutes. Your report arrives via email and is available in your dashboard with downloadable PDF and Word versions. No waiting, no scheduling calls, no follow-up emails.' },
  { q: 'How actionable are the recommendations?', a: 'Every finding comes with a specific fix, not vague advice. Most teams implement the top 3-5 critical fixes in their first sprint and see measurable improvement within 2-4 weeks. You can track progress directly in your dashboard — mark findings as fixed, in progress, or dismissed.' },
  { q: 'How does this compare to hiring a UX consultant?', a: 'A traditional UX audit costs $5,000-$15,000 and takes 2-4 weeks. ClearUX delivers 64 checkpoints across 16 categories in minutes for $99. It\'s ideal for quick baseline assessments, pre-launch checks, and ongoing monitoring. For deep qualitative research like user interviews, pair ClearUX findings with a specialist.' },
  { q: 'Can I re-audit to track improvement?', a: 'Yes. Re-audits run in Baseline mode by default — they verify whether previous findings are fixed, still present, or dismissed. Your score improves predictably as you resolve issues. When you\'re ready to discover new issues, hit "Dig Deeper" for a full analysis.' },
];

/* ── Rotating hero headlines ─────────────────────────────── */
const HERO_HEADLINES = [
  { main: 'Stop Losing Users to', accent: 'Hidden UX Flaws.' },
  { main: 'The $10k Audit.', accent: '$99. 10 Minutes.' },
  { main: '64 Checkpoints.', accent: 'Zero Guesswork.' },
];

/* ── Hero KSPs — outcome-focused, not feature-focused ──── */
const HERO_KSPS = [
  { text: 'First audit free' },
  { text: 'Results in minutes' },
  { text: 'No credit card' },
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
      {/* Single page background */}
      <div className="fixed inset-0" aria-hidden="true">
        <img src="/gradients/bg-hero.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#111114] via-transparent to-[#111114]" />
      </div>
      <HomeJsonLd />
      <Navbar />
      <main id="main-content" role="main" aria-label="ClearUX homepage">

      {/* ═══════════════════════════════════════════════════════
          SECTION 1 — HERO (Musicbed-inspired)
          Left-aligned, clean, minimal, dark mode
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 min-h-screen flex flex-col overflow-hidden">
        {/* Subtle background glow for centered hero */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#84CC16]/[0.03] blur-[120px]" />
        </div>

        {/* Hero content — centered on all screens */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 flex-1 flex flex-col items-center justify-center text-center py-24 sm:pt-44 sm:pb-28">
          {/* Top label */}
          <motion.p
            className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-6 sm:mb-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            AI-Powered UX Audit
          </motion.p>

          {/* Rotating headline — centered, light weight */}
          <div className="relative mb-5 sm:mb-10">
            <AnimatePresence mode="wait">
              <motion.h1
                key={headlineIdx}
                className="font-heading text-[2.75rem] sm:text-[3rem] md:text-[4rem] lg:text-[5rem] font-light text-white"
                style={{ lineHeight: '1.05' }}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -50 }}
                transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                {HERO_HEADLINES[headlineIdx].main}<br />
                <span className="font-medium text-lime-gradient">{HERO_HEADLINES[headlineIdx].accent}</span>
              </motion.h1>
            </AnimatePresence>

            {/* Slider progress indicators */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {HERO_HEADLINES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setHeadlineIdx(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className="relative h-[3px] rounded-full overflow-hidden cursor-pointer"
                  style={{ width: i === headlineIdx ? 32 : 16, background: 'rgba(255,255,255,0.12)', transition: 'width 0.3s ease' }}
                >
                  {i === headlineIdx && (
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full bg-[#84CC16]"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 7, ease: 'linear' }}
                      key={`progress-${headlineIdx}`}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <motion.p
            className="text-white/60 text-base sm:text-lg max-w-xl mb-8 sm:mb-16"
            style={{ lineHeight: '1.7' }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            Your visitors are bouncing and you don't know why. Get a consultant-grade UX audit — 64 checkpoints across accessibility, conversions, dark patterns, and AI readiness — in minutes, not weeks.
          </motion.p>

          {/* URL input field */}
          <motion.form
            onSubmit={handleHeroSubmit}
            className="max-w-2xl w-full mb-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
          >
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              <div className="relative flex items-center flex-1 sm:flex-initial sm:w-[400px] bg-white/[0.06] rounded-full ring-1 ring-inset ring-white/[0.15] focus-within:ring-white/[0.25] transition-all">
                <Search size={16} className="ml-4 text-white/40 flex-shrink-0" />
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
                  className="flex-1 bg-transparent text-white text-[15px] pl-2 pr-4 py-[1.1rem] sm:py-[1.2rem] placeholder:text-white/35 focus:outline-none min-w-0"
                />
              </div>
              <button
                type="submit"
                className="group flex items-center justify-center gap-2 px-5 sm:px-7 py-[1.1rem] sm:py-[1.2rem] rounded-full bg-white text-[#111114] text-base font-medium transition-all hover:bg-white/90 whitespace-nowrap min-h-[48px]"
              >
                <span className="sm:hidden">Start</span>
                <span className="hidden sm:inline">Start Free Audit</span>
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </motion.form>

          {/* KSPs — minimal proof points */}
          <motion.div
            className="flex items-center justify-center gap-3 sm:gap-4 mt-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {HERO_KSPS.map((ksp, i) => (
              <div key={i} className="flex items-center gap-3 sm:gap-4">
                {i > 0 && <span className="text-[#84CC16]/30">·</span>}
                <span className="text-[13px] font-medium text-lime-gradient tracking-wide">{ksp.text}</span>
              </div>
            ))}
          </motion.div>

          {/* Trust badges — cohesive visual group */}
          <motion.div
            className="flex items-center justify-center gap-4 sm:gap-6 mt-8 sm:mt-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            {[
              { icon: Shield, label: 'SSL Encrypted' },
              { icon: ShieldCheck, label: 'GDPR Compliant' },
              { icon: CheckCircle, label: 'Stripe Payments' },
            ].map((badge, i) => {
              const BadgeIcon = badge.icon;
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <BadgeIcon size={13} className="text-white/30" strokeWidth={1.5} />
                  <span className="text-[11px] text-white/30 font-medium tracking-wide">{badge.label}</span>
                </div>
              );
            })}
          </motion.div>
          <motion.p
            className="text-[11px] text-white/25 mt-2 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Your data is never stored or shared beyond generating your report.
          </motion.p>
        </div>

        {/* Scroll indicator — "Discover ClearUX" — always at bottom */}
        <motion.div
          className="relative z-10 flex justify-center pb-6 sm:pb-24 flex-shrink-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
        >
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('trust-stats');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="group flex flex-col items-center gap-2 sm:gap-3 animate-bounce-slow cursor-pointer"
          >
            <span className="text-xs tracking-[0.2em] uppercase text-lime-gradient font-medium">Discover ClearUX</span>
            <div className="w-11 h-11 rounded-full border border-[#84CC16]/40 group-hover:border-[#84CC16]/70 flex items-center justify-center transition-all group-hover:bg-[#84CC16]/[0.05]">
              <ChevronDown size={18} className="text-[#84CC16] group-hover:text-[#BEF264] transition-colors" />
            </div>
          </button>
        </motion.div>

      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2 — TRUST STATS
          Pure white background, charcoal text, left-aligned
          ═══════════════════════════════════════════════════════ */}
      <section id="trust-stats" className="relative z-10 py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal className="mb-14">
            <h2 className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40">
              ClearUX in numbers
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-10 sm:gap-y-12 gap-x-8 sm:gap-x-0">
            {[
              { end: 64, suffix: '', label: 'UX checkpoints', desc: 'across every audit' },
              { end: 16, suffix: '', label: 'Categories', desc: 'in 4 audit pillars' },
              { end: 10, suffix: ' min', suffixClassName: 'text-[1.5rem] sm:text-[2rem] md:text-[2.5rem] lg:text-[3rem] font-light', label: 'To full report', desc: 'paste URL, get results' },
              { end: 99, suffix: '%', label: 'Cost savings', desc: 'vs. traditional audits' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                className={`text-left ${i > 0 ? 'lg:border-l lg:border-white/[0.06] lg:pl-10' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <AnimatedCounter
                  end={stat.end}
                  suffix={stat.suffix}
                  suffixClassName={'suffixClassName' in stat ? (stat as { suffixClassName: string }).suffixClassName : ''}
                  className="font-heading text-[3.5rem] sm:text-[4rem] md:text-[5rem] lg:text-[6rem] font-light text-lime-gradient leading-none"
                  duration={2}
                />
                <p className="text-sm font-medium text-white/70 mt-3">{stat.label}</p>
                <p className="text-xs text-white/40 mt-1">{stat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3 — CORE FEATURES
          Musicbed-style editorial grid with scrolling showcase
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-24 sm:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          {/* Editorial headline — left-aligned, large, Musicbed-style */}
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
              For high-performing digital teams
            </p>
            <h2
              className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white max-w-4xl mb-6"
             
            >
              What makes ClearUX{' '}
              <span className="text-lime-gradient">unstoppable.</span>
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8">
              <p className="text-white/60 text-base md:text-lg max-w-2xl leading-relaxed">
                Four pillars no other tool covers — each one designed to find the issues that actually cost you users and revenue.
              </p>
              <Link
                href="/register"
                className="group inline-flex items-center gap-2.5 px-7 py-[1.2rem] rounded-full bg-white text-[#111114] text-base font-medium transition-all hover:bg-white/90 flex-shrink-0 whitespace-nowrap min-h-[48px]"
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
                desc: 'Detects confirmshaming, hidden costs, trick questions, and forced continuity across every page.',
              },
              {
                icon: Brain,
                title: 'Cognitive Accessibility',
                desc: 'Tests cognitive load, sensory overload, and navigation clarity for users with ADHD, dyslexia, and more.',
              },
              {
                icon: Sparkles,
                title: 'AI Agent Readiness',
                desc: 'Checks if LLMs and AI assistants can accurately describe your product and navigate your flows.',
              },
              {
                icon: Target,
                title: 'Conversion Psychology',
                desc: 'Evaluates CTAs, friction points, trust signals, and pricing clarity — tied to revenue impact.',
              },
              {
                icon: Eye,
                title: 'Visual & UX Audit',
                desc: 'Checks contrast, typography, spacing, responsive breakpoints, and mobile touch targets.',
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <StaggerItem key={i}>
                  <div className="py-8 border-t border-white/[0.06]">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-lg bg-[#84CC16]/10 flex items-center justify-center flex-shrink-0">
                        <Icon size={18} className="text-[#84CC16]" strokeWidth={2} />
                      </div>
                      <h3 className="font-heading text-lg font-medium text-white">{item.title}</h3>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed">{item.desc}</p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerReveal>
        </div>

        {/* ── Scrolling showcase gallery — minimal finding rows ── */}
        <div className="mt-16 sm:mt-24 space-y-4 overflow-hidden relative opacity-90 -mx-6 sm:-mx-10 lg:-mx-16" aria-hidden="true" role="presentation" aria-label="Decorative showcase of audit categories">
          {/* Row 1 — scrolls left */}
          <div className="relative">
            <div
              className="flex gap-2.5 w-max"
              style={{ animation: 'scroll-left 40s linear infinite' }}
            >
              {[...Array(2)].map((_, setIdx) => (
                <div key={setIdx} className="flex gap-2.5">
                  {[
                    { label: 'Dark Pattern Scanner', subtitle: 'Ethical UX Pillar', icon: ShieldAlert },
                    { label: 'Cognitive Load Test', subtitle: 'Accessibility Pillar', icon: Brain },
                    { label: 'AI Discoverability', subtitle: 'Future Readiness Pillar', icon: Bot },
                    { label: 'Conversion Friction Map', subtitle: 'Revenue Impact Pillar', icon: Target },
                  ].map((card, j) => {
                    const CardIcon = card.icon;
                    return (
                      <div
                        key={j}
                        className="relative w-[290px] sm:w-[340px] rounded-xl overflow-hidden flex-shrink-0 px-6 py-6 flex items-start gap-4"
                        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.06]">
                          <CardIcon size={19} className="text-white/40" strokeWidth={1.5} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] tracking-[0.12em] uppercase text-white/25 mb-1.5 font-medium">{card.subtitle}</p>
                          <p className="text-[15px] font-medium text-white/50 leading-tight">{card.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Row 2 — scrolls right */}
          <div className="relative">
            <div
              className="flex gap-2.5 w-max"
              style={{ animation: 'scroll-right 45s linear infinite' }}
            >
              {[...Array(2)].map((_, setIdx) => (
                <div key={setIdx} className="flex gap-2.5">
                  {[
                    { label: 'Trust Signal Audit', subtitle: 'Foundation Pillar', icon: Shield },
                    { label: 'WCAG Compliance', subtitle: 'Inclusive Design Pillar', icon: Eye },
                    { label: 'Reading Complexity', subtitle: 'Cognitive Accessibility', icon: Accessibility },
                    { label: 'Structured Data Check', subtitle: 'AI Readiness', icon: ScanEye },
                  ].map((card, j) => {
                    const CardIcon = card.icon;
                    return (
                      <div
                        key={j}
                        className="relative w-[270px] sm:w-[320px] rounded-xl overflow-hidden flex-shrink-0 px-6 py-6 flex items-start gap-4"
                        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.06]">
                          <CardIcon size={19} className="text-white/40" strokeWidth={1.5} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] tracking-[0.12em] uppercase text-white/25 mb-1.5 font-medium">{card.subtitle}</p>
                          <p className="text-[15px] font-medium text-white/50 leading-tight">{card.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Gradient fade on left and right edges — seamless */}
          <div className="absolute inset-y-0 left-0 w-48 sm:w-72 pointer-events-none" style={{ background: 'linear-gradient(to right, rgba(17,17,20,1) 0%, rgba(17,17,20,1) 20%, transparent 100%)' }} />
          <div className="absolute inset-y-0 right-0 w-48 sm:w-72 pointer-events-none" style={{ background: 'linear-gradient(to left, rgba(17,17,20,1) 0%, rgba(17,17,20,1) 20%, transparent 100%)' }} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — HOW IT WORKS
          Pure white, charcoal text, left-aligned Musicbed style
          ═══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="relative z-10 py-24 sm:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
              Simple process
            </p>
            <h2
              className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white max-w-4xl mb-6"

            >
              How ClearUX <span className="text-lime-gradient">works.</span>
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8">
              <p className="text-white/60 text-base md:text-lg max-w-2xl leading-relaxed">
                No signup walls, no setup, no waiting. Paste a URL, let the AI do the heavy lifting, and get a prioritised report your team can act on immediately.
              </p>
              <Link
                href="/register"
                className="group inline-flex items-center gap-2.5 px-7 py-[1.2rem] rounded-full bg-white text-[#111114] text-base font-medium transition-all hover:bg-white/90 flex-shrink-0 whitespace-nowrap min-h-[48px]"
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
                <div className="border-t border-white/[0.06] pt-8">
                  <span className="font-heading text-[5rem] sm:text-[6rem] md:text-[7rem] font-light text-white/[0.10] leading-none block mb-4">
                    {item.step}
                  </span>
                  <h3 className="font-heading text-xl font-medium text-white mb-3">{item.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{item.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 5 — WHAT YOU GET
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-24 sm:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          {/* Editorial headline */}
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
              What you get
            </p>
            <h2
              className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white max-w-5xl mb-6"
             
            >
              A report your team{' '}
              <span className="text-lime-gradient">can act on.</span>
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 border-b border-white/[0.06] pb-8">
              <div className="max-w-2xl">
                <p className="text-white/60 text-base md:text-lg leading-relaxed mb-4">
                  Every finding ranked by severity and business impact, with clear fixes and category scores your team can act on immediately.
                </p>
                <Link
                  href="/demo-report"
                  className="group inline-flex items-center gap-2 text-sm font-medium text-lime-gradient hover:opacity-80 transition-opacity"
                >
                  See a sample report
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
              {/* Scroll arrows */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  type="button"
                  aria-label="Scroll left"
                  onClick={() => {
                    const el = document.getElementById('feature-cards-scroll');
                    if (el) el.scrollBy({ left: -400, behavior: 'smooth' });
                  }}
                  className="w-11 h-11 rounded-full border border-white/15 flex items-center justify-center hover:border-white/30 transition-colors"
                >
                  <ArrowRight size={16} className="text-white/40 rotate-180" />
                </button>
                <button
                  type="button"
                  aria-label="Scroll right"
                  onClick={() => {
                    const el = document.getElementById('feature-cards-scroll');
                    if (el) el.scrollBy({ left: 400, behavior: 'smooth' });
                  }}
                  className="w-11 h-11 rounded-full border border-white/15 flex items-center justify-center hover:border-white/30 transition-colors"
                >
                  <ArrowRight size={16} className="text-white/40" />
                </button>
              </div>
            </div>
          </ScrollReveal>

          {/* Scrollable cards row */}
          <div
            id="feature-cards-scroll"
            className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {[
              { icon: ListChecks, title: 'Prioritised Findings', label: 'Severity Ranked', desc: 'Critical issues surface first. Ranked by severity and business impact so your team knows exactly where to start.' },
              { icon: FileText, title: 'PDF & Word Export', label: 'One-Click', desc: 'Professional reports ready for stakeholders. Branded, formatted, and downloadable in seconds.' },
              { icon: Share2, title: 'Team Sharing', label: 'Shareable', desc: 'One link for your full score, category breakdown, and prioritised recommendations. No account needed to view.' },
              { icon: CheckCircle, title: 'Track Every Fix', label: 'Dashboard', desc: 'Status tracking for every finding — open, in progress, fixed. Real-time progress at a glance.' },
              { icon: RefreshCw, title: 'Re-Audit', label: 'Baseline', desc: 'Re-audit the same URL to verify fixes or dig deeper. Track your score improvement over time.' },
              { icon: BarChart3, title: 'Category Scores', label: '16 Categories', desc: 'Each of the 4 pillars and 16 categories scored individually. See exactly where you excel and where to improve.' },
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <div
                  key={i}
                  className="relative w-[280px] sm:w-[320px] min-w-[280px] sm:min-w-[320px] rounded-xl p-6 sm:p-8 flex-shrink-0 bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] hover:shadow-lg hover:shadow-black/20 transition-all group"
                >
                  <div className="w-14 h-14 rounded-xl bg-[#84CC16]/10 flex items-center justify-center mb-6">
                    <Icon size={24} className="text-[#84CC16]" strokeWidth={1.5} />
                  </div>
                  <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-white/25 mb-3 block">{card.label}</span>
                  <h3 className="font-heading text-base font-medium text-white mb-3 leading-tight">{card.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 6 — PRICING
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-28 sm:py-36 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
              Simple pricing
            </p>

            {/* Price hero — $99 in bold lime gradient */}
            <div className="mb-6">
              <h2 className="font-heading text-white max-w-4xl" style={{ lineHeight: '1.05' }}>
                <span className="text-lime-gradient font-medium text-[4rem] sm:text-[5rem] md:text-[6rem] lg:text-[8rem]">$99</span>
                <span className="text-[2rem] sm:text-[2.5rem] md:text-[3rem] lg:text-[3.5rem] font-light text-white/60 ml-3 sm:ml-5">per audit</span>
              </h2>
            </div>

            <p className="font-heading text-[1.5rem] sm:text-[2rem] md:text-[2.5rem] font-light text-lime-gradient mb-6">
              First one free.
            </p>

            <p className="text-white/65 text-base md:text-lg max-w-2xl leading-relaxed mb-12">
              No subscription. No feature gates. Every audit gets the full 64-checkpoint analysis across all 16 categories and 4 pillars. Credits never expire.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2.5 px-7 py-[1.2rem] rounded-full bg-white text-[#111114] text-base font-medium transition-all hover:bg-white/90 whitespace-nowrap min-h-[48px]"
              >
                Start Free Audit
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/pricing"
                className="group inline-flex items-center justify-center gap-2.5 px-7 py-[1.2rem] rounded-full border border-white/20 text-white text-base font-medium transition-all hover:border-white/40 whitespace-nowrap min-h-[48px]"
              >
                View All Plans
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </ScrollReveal>

          {/* Feature list — glass card strip */}
          <ScrollReveal>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-6 sm:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8">
                {[
                  'All 16 categories, all 4 pillars',
                  'PDF & Word reports included',
                  'Track fixes and re-audit anytime',
                  'Credits never expire',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[#84CC16] flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-white/60 font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 7 — FAQ
          Dark bg (#111114), left-aligned, clean Musicbed style
          ═══════════════════════════════════════════════════════ */}
      <section id="faq" className="relative z-10 py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
              FAQ
            </p>
            <h2
              className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white max-w-4xl"
             
            >
              Frequently asked <span className="text-lime-gradient">questions.</span>
            </h2>
          </ScrollReveal>

          <StaggerReveal className="max-w-3xl divide-y divide-white/[0.06]" staggerDelay={0.06}>
            {TOP_FAQS.map((item, idx) => (
              <StaggerItem key={idx}>
                <details className="group">
                  <summary className="flex items-center justify-between py-6 cursor-pointer">
                    <h3 className="font-heading text-[15px] sm:text-base font-medium text-white pr-8">{item.q}</h3>
                    <ChevronDown size={16} className="text-white/40 flex-shrink-0 transform group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="pb-6">
                    <p className="text-sm text-white/60 leading-relaxed">{item.a}</p>
                  </div>
                </details>
              </StaggerItem>
            ))}
          </StaggerReveal>

          <ScrollReveal delay={0.3} className="mt-10 max-w-3xl">
            <Link
              href="/faq"
              className="group inline-flex items-center gap-2.5 text-sm font-medium text-white/40 hover:text-white transition-colors"
            >
              Read all FAQ
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 8 — FINAL CTA
          Dark bg with aurora + background visual cards, Musicbed style
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-24 sm:py-32 overflow-hidden">
        {/* Content — left-aligned, above the background */}
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
              Get started
            </p>
            <h2
              className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white max-w-4xl mb-6"
             
            >
              Ready to see what you&apos;re{' '}
              <span className="text-lime-gradient">missing?</span>
            </h2>
            <p className="text-white/60 text-base md:text-lg max-w-2xl leading-relaxed mb-12">
              Real findings your team can act on — prioritised by impact, trackable as you fix them, re-auditable to prove improvement.
            </p>

            <form onSubmit={handleHeroSubmit} className="max-w-2xl mb-0">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <div className="relative flex items-center w-full sm:max-w-[400px] bg-white/[0.06] rounded-full ring-1 ring-inset ring-white/[0.15] focus-within:ring-white/[0.25] transition-all backdrop-blur-sm">
                  <Search size={16} className="ml-4 text-white/40 flex-shrink-0" />
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
                    className="flex-1 bg-transparent text-white text-[15px] pl-2 pr-4 py-[1.2rem] placeholder:text-white/35 focus:outline-none min-w-0"
                  />
                </div>
                <button
                  type="submit"
                  className="group flex items-center justify-center gap-2 px-7 py-[1.2rem] rounded-full bg-white text-[#111114] text-base font-medium transition-all hover:bg-white/90 whitespace-nowrap min-h-[48px]"
                >
                  Start Free Audit
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
              <p className="text-xs text-white/60 mt-3 tracking-wide">No credit card required. Results in minutes.</p>
            </form>
          </ScrollReveal>
        </div>
      </section>

      </main>
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
