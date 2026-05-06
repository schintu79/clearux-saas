'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, CheckCircle, Eye, Shield, Heart, Brain,
  Search, FileText, Share2, RefreshCw, BarChart3, ListChecks,
  Sparkles, Target, ScanEye, ShieldAlert,
  Accessibility, Bot, ChevronDown,
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
      <section className="relative min-h-screen flex flex-col">
        <AuroraBackground variant="hero" />

        {/* Background visual cards — slowly scrolling on the right, Musicbed-style */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {/* Two columns of cards, scrolling vertically in opposite directions */}
          <div className="absolute top-0 right-[2%] lg:right-[5%] w-[45%] lg:w-[40%] h-full flex gap-3 opacity-[0.35]">
            {/* Column 1 — scrolls up */}
            <div className="flex-1 overflow-hidden">
              <div
                className="flex flex-col gap-3"
                style={{ animation: 'scroll-up-slow 60s linear infinite' }}
              >
                {[...Array(2)].map((_, setIdx) => (
                  <div key={setIdx} className="flex flex-col gap-3">
                    {[
                      { label: 'Dark Pattern Scanner', subtitle: 'Ethical UX', color: '#F87171' },
                      { label: 'AI Discoverability', subtitle: 'Future Readiness', color: '#60A5FA' },
                      { label: 'Trust Signal Audit', subtitle: 'Foundation', color: '#84CC16' },
                      { label: 'Reading Complexity', subtitle: 'Cognitive', color: '#EC4899' },
                    ].map((card, j) => (
                      <div
                        key={j}
                        className="relative w-full h-[200px] sm:h-[220px] rounded-2xl overflow-hidden flex-shrink-0"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                      >
                        <div
                          className="absolute inset-0 opacity-50"
                          style={{ background: `radial-gradient(circle at 30% 40%, ${card.color} 0%, transparent 70%)` }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 p-5">
                          <p className="text-[10px] text-white/60 mb-1">{card.subtitle}</p>
                          <p className="text-sm font-semibold text-white/90">{card.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2 — scrolls down */}
            <div className="flex-1 overflow-hidden hidden sm:block">
              <div
                className="flex flex-col gap-3"
                style={{ animation: 'scroll-down-slow 50s linear infinite' }}
              >
                {[...Array(2)].map((_, setIdx) => (
                  <div key={setIdx} className="flex flex-col gap-3">
                    {[
                      { label: 'Cognitive Load Test', subtitle: 'Accessibility', color: '#A78BFA' },
                      { label: 'Conversion Friction', subtitle: 'Revenue Impact', color: '#FBBF24' },
                      { label: 'WCAG Compliance', subtitle: 'Inclusive Design', color: '#22D3EE' },
                      { label: 'Structured Data', subtitle: 'AI Readiness', color: '#F59E0B' },
                    ].map((card, j) => (
                      <div
                        key={j}
                        className="relative w-full h-[180px] sm:h-[200px] rounded-2xl overflow-hidden flex-shrink-0"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                      >
                        <div
                          className="absolute inset-0 opacity-50"
                          style={{ background: `radial-gradient(circle at 60% 50%, ${card.color} 0%, transparent 70%)` }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 p-5">
                          <p className="text-[10px] text-white/60 mb-1">{card.subtitle}</p>
                          <p className="text-sm font-semibold text-white/90">{card.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Gradient overlay — softer fade so cards are visible */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to right, #111114 25%, rgba(17,17,20,0.85) 40%, rgba(17,17,20,0.4) 60%, rgba(17,17,20,0.1) 80%, transparent 100%)',
            }}
          />
          {/* Top/bottom fade */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, #111114 0%, transparent 12%, transparent 88%, #111114 100%)',
            }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pt-36 sm:pt-44 pb-20 sm:pb-28">
          {/* Top label */}
          <motion.p
            className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40 mb-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            AI-Powered UX Audit
          </motion.p>

          {/* Rotating headline — left-aligned, light weight */}
          <div className="h-[9rem] sm:h-[11rem] md:h-[14rem] lg:h-[17rem] relative mb-10 sm:mb-14">
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
            className="text-white/35 text-base sm:text-lg max-w-xl mb-12 sm:mb-16"
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
            <div className="relative flex items-center bg-white/[0.03] border border-white/[0.08] rounded-full p-1.5 focus-within:border-white/[0.2] transition-all">
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
                className="group flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#111114] text-sm font-semibold tracking-wide uppercase transition-all hover:bg-white/90 flex-shrink-0"
              >
                Start Free Audit
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            <p className="text-[11px] text-white/20 mt-3 tracking-wide">No credit card required</p>
          </motion.form>

          {/* Selling points — inline below input */}
          <motion.div
            className="flex flex-wrap items-center gap-x-8 gap-y-3 mt-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {HERO_SELLING_POINTS.map((sp, i) => {
              const Icon = sp.icon;
              return (
                <div key={i} className="flex items-center gap-2.5">
                  <Icon size={16} className="text-[#84CC16]" />
                  <span className="text-[13px] text-white/40 tracking-wide">{sp.label} <span className="font-semibold text-white/70">{sp.highlight}</span></span>
                </div>
              );
            })}
          </motion.div>
        </div>

        {/* Scroll indicator — "Discover ClearUX" */}
        <div className="relative z-10 flex-1" />
        <motion.div
          className="relative z-10 flex justify-center pb-10"
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
            className="group flex flex-col items-center gap-3 animate-bounce-slow cursor-pointer"
          >
            <span className="text-xs tracking-[0.2em] uppercase text-lime-gradient font-semibold">Discover ClearUX</span>
            <div className="w-10 h-10 rounded-full border border-[#84CC16]/40 group-hover:border-[#84CC16]/70 flex items-center justify-center transition-all group-hover:bg-[#84CC16]/[0.05]">
              <ChevronDown size={18} className="text-[#84CC16] group-hover:text-[#BEF264] transition-colors" />
            </div>
          </button>
        </motion.div>

      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2 — TRUST STATS
          Pure white background, charcoal text, left-aligned
          ═══════════════════════════════════════════════════════ */}
      <section id="trust-stats" className="relative py-24 sm:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal className="mb-14">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#111114]/40">
              ClearUX in numbers
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-0">
            {[
              { end: 64, suffix: '+', label: 'UX checkpoints', desc: 'across every audit' },
              { end: 16, suffix: '', label: 'Categories', desc: 'in the framework' },
              { end: 4, suffix: '', label: 'UX pillars', desc: 'for complete coverage' },
              { end: 40, suffix: '+', label: 'Pages analysed', desc: 'per audit on avg.' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                className={`text-left ${i > 0 ? 'lg:border-l lg:border-[#111114]/10 lg:pl-10' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <AnimatedCounter
                  end={stat.end}
                  suffix={stat.suffix}
                  className="font-heading text-[3rem] sm:text-[4rem] md:text-[5rem] lg:text-[6rem] font-light text-[#111114]"
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
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-white text-[#111114] text-sm font-semibold tracking-wide uppercase transition-all hover:bg-white/90 flex-shrink-0 whitespace-nowrap"
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
                      <div className="w-9 h-9 rounded-lg bg-lime-gradient flex items-center justify-center flex-shrink-0">
                        <Icon size={18} className="text-[#111114]" strokeWidth={2} />
                      </div>
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
        <div className="mt-16 sm:mt-24 space-y-4 overflow-hidden relative">
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
                      <div
                        className="absolute inset-0 opacity-30"
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
                        className="absolute inset-0 opacity-30"
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

          {/* Gradient fade on left and right edges — Musicbed style */}
          <div className="absolute inset-y-0 left-0 w-32 sm:w-48 pointer-events-none" style={{ background: 'linear-gradient(to right, #141418 0%, transparent 100%)' }} />
          <div className="absolute inset-y-0 right-0 w-32 sm:w-48 pointer-events-none" style={{ background: 'linear-gradient(to left, #141418 0%, transparent 100%)' }} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — HOW IT WORKS
          Pure white, charcoal text, left-aligned Musicbed style
          ═══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="relative py-24 sm:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
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
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-[#111114] text-white text-sm font-semibold tracking-wide uppercase transition-all hover:bg-[#111114]/90 flex-shrink-0 whitespace-nowrap"
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
                  <span className="font-heading text-[5rem] sm:text-[6rem] md:text-[7rem] font-light text-[#111114]/[0.06] leading-none block mb-4">
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
          Light grey bg, editorial headline + scrollable cards
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
              {/* Scroll arrows */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  type="button"
                  aria-label="Scroll left"
                  onClick={() => {
                    const el = document.getElementById('feature-cards-scroll');
                    if (el) el.scrollBy({ left: -400, behavior: 'smooth' });
                  }}
                  className="w-10 h-10 rounded-full border border-[#111114]/15 flex items-center justify-center hover:border-[#111114]/30 transition-colors"
                >
                  <ArrowRight size={16} className="text-[#111114]/40 rotate-180" />
                </button>
                <button
                  type="button"
                  aria-label="Scroll right"
                  onClick={() => {
                    const el = document.getElementById('feature-cards-scroll');
                    if (el) el.scrollBy({ left: 400, behavior: 'smooth' });
                  }}
                  className="w-10 h-10 rounded-full border border-[#111114]/15 flex items-center justify-center hover:border-[#111114]/30 transition-colors"
                >
                  <ArrowRight size={16} className="text-[#111114]/40" />
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
                  className="relative w-[320px] min-w-[320px] rounded-xl p-8 flex-shrink-0 bg-white border border-[#111114]/[0.08] hover:border-[#111114]/[0.15] hover:shadow-lg hover:shadow-black/[0.04] transition-all group"
                >
                  <div className="w-14 h-14 rounded-xl bg-lime-gradient flex items-center justify-center mb-6">
                    <Icon size={24} className="text-[#111114]" strokeWidth={1.5} />
                  </div>
                  <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#111114]/25 mb-3 block">{card.label}</span>
                  <h3 className="font-heading text-base font-semibold text-[#111114] mb-3 leading-tight">{card.title}</h3>
                  <p className="text-sm text-[#111114]/40 leading-relaxed">{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 6 — PRICING
          Dark bg, left-aligned editorial, Musicbed style
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 bg-[#141418]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40 mb-8">
              Simple pricing
            </p>
            <h2
              className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white tracking-tight max-w-4xl mb-10"
              style={{ lineHeight: '1.1' }}
            >
              $99 per audit.{' '}
              <span className="italic text-white/40">First one free.</span>
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8">
              <p className="text-white/35 text-base md:text-lg max-w-2xl leading-relaxed">
                No subscription. No feature gates. Every audit gets the full 64-checkpoint analysis across all 16 categories and 4 pillars. Credits never expire.
              </p>
              <div className="flex items-center gap-4 flex-shrink-0">
                <Link
                  href="/register"
                  className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-white text-[#111114] text-sm font-semibold tracking-wide uppercase transition-all hover:bg-white/90 whitespace-nowrap"
                >
                  Start Free Audit
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  href="/pricing"
                  className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full border border-white/20 text-white text-sm font-semibold tracking-wide uppercase transition-all hover:border-white/40 whitespace-nowrap"
                >
                  View All Plans
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </ScrollReveal>

          {/* Feature list — horizontal strip */}
          <ScrollReveal>
            <div className="border-t border-white/[0.06] pt-10">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  'All 16 categories, all 4 pillars',
                  'PDF & Word reports included',
                  'Track fixes and re-audit anytime',
                  'Credits never expire',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[#84CC16] flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-white/50">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 7 — FAQ
          White bg, left-aligned, clean Musicbed style
          ═══════════════════════════════════════════════════════ */}
      <section id="faq" className="relative py-24 sm:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#111114]/40 mb-8">
              FAQ
            </p>
            <h2
              className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-[#111114] tracking-tight max-w-4xl"
              style={{ lineHeight: '1.1' }}
            >
              Frequently asked <span className="italic text-[#111114]/40">questions.</span>
            </h2>
          </ScrollReveal>

          <StaggerReveal className="max-w-3xl divide-y divide-[#111114]/10" staggerDelay={0.06}>
            {TOP_FAQS.map((item, idx) => (
              <StaggerItem key={idx}>
                <details className="group">
                  <summary className="flex items-center justify-between py-6 cursor-pointer">
                    <h3 className="font-heading text-[15px] sm:text-base font-semibold text-[#111114] pr-8">{item.q}</h3>
                    <ChevronDown size={16} className="text-[#111114]/30 flex-shrink-0 transform group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="pb-6">
                    <p className="text-sm text-[#111114]/40 leading-relaxed">{item.a}</p>
                  </div>
                </details>
              </StaggerItem>
            ))}
          </StaggerReveal>

          <ScrollReveal delay={0.3} className="mt-10 max-w-3xl">
            <Link
              href="/faq"
              className="group inline-flex items-center gap-2.5 text-sm font-semibold text-[#111114]/40 hover:text-[#111114] transition-colors"
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
      <section className="relative py-24 sm:py-32 overflow-hidden bg-[#111114]">
        {/* Aurora background — same as hero */}
        <AuroraBackground variant="hero" />

        {/* Background visual cards — scrolling columns like hero, Musicbed style */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {/* Two columns of cards, scrolling vertically in opposite directions */}
          <div className="absolute top-0 right-[2%] lg:right-[5%] w-[50%] lg:w-[45%] h-full flex gap-3 opacity-[0.35]">
            {/* Column 1 — scrolls up */}
            <div className="flex-1 overflow-hidden">
              <div
                className="flex flex-col gap-3"
                style={{ animation: 'scroll-up-slow 60s linear infinite' }}
              >
                {[...Array(2)].map((_, setIdx) => (
                  <div key={setIdx} className="flex flex-col gap-3">
                    {[
                      { label: 'Dark Pattern Scanner', subtitle: 'Ethical UX', color: '#F87171' },
                      { label: 'AI Discoverability', subtitle: 'Future Readiness', color: '#60A5FA' },
                      { label: 'Trust Signal Audit', subtitle: 'Foundation', color: '#84CC16' },
                      { label: 'Reading Complexity', subtitle: 'Cognitive', color: '#EC4899' },
                    ].map((card, j) => (
                      <div
                        key={j}
                        className="relative w-full h-[200px] sm:h-[220px] rounded-2xl overflow-hidden flex-shrink-0"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                      >
                        <div
                          className="absolute inset-0 opacity-50"
                          style={{ background: `radial-gradient(circle at 30% 40%, ${card.color} 0%, transparent 70%)` }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 p-5">
                          <p className="text-[10px] text-white/60 mb-1">{card.subtitle}</p>
                          <p className="text-sm font-semibold text-white/90">{card.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2 — scrolls down */}
            <div className="flex-1 overflow-hidden hidden sm:block">
              <div
                className="flex flex-col gap-3"
                style={{ animation: 'scroll-down-slow 50s linear infinite' }}
              >
                {[...Array(2)].map((_, setIdx) => (
                  <div key={setIdx} className="flex flex-col gap-3">
                    {[
                      { label: 'Cognitive Load Test', subtitle: 'Accessibility', color: '#A78BFA' },
                      { label: 'Conversion Friction', subtitle: 'Revenue Impact', color: '#FBBF24' },
                      { label: 'WCAG Compliance', subtitle: 'Inclusive Design', color: '#22D3EE' },
                      { label: 'Structured Data', subtitle: 'AI Readiness', color: '#F59E0B' },
                    ].map((card, j) => (
                      <div
                        key={j}
                        className="relative w-full h-[180px] sm:h-[200px] rounded-2xl overflow-hidden flex-shrink-0"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                      >
                        <div
                          className="absolute inset-0 opacity-50"
                          style={{ background: `radial-gradient(circle at 60% 50%, ${card.color} 0%, transparent 70%)` }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 p-5">
                          <p className="text-[10px] text-white/60 mb-1">{card.subtitle}</p>
                          <p className="text-sm font-semibold text-white/90">{card.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Gradient overlay — softer fade so cards are visible */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to right, #111114 25%, rgba(17,17,20,0.85) 40%, rgba(17,17,20,0.4) 60%, rgba(17,17,20,0.1) 80%, transparent 100%)',
            }}
          />
          {/* Top/bottom fade */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, #111114 0%, transparent 12%, transparent 88%, #111114 100%)',
            }}
          />
        </div>

        {/* Content — left-aligned, above the background */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40 mb-8">
              Get started
            </p>
            <h2
              className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white tracking-tight max-w-4xl mb-10"
              style={{ lineHeight: '1.1' }}
            >
              Ready to see what you&apos;re{' '}
              <span className="italic text-white/40">missing?</span>
            </h2>
            <p className="text-white/35 text-base md:text-lg max-w-2xl leading-relaxed mb-12">
              Real findings your team can act on — prioritised by impact, trackable as you fix them, re-auditable to prove improvement.
            </p>

            <form onSubmit={handleHeroSubmit} className="max-w-2xl mb-0">
              <div className="relative flex items-center bg-white/[0.03] border border-white/[0.08] rounded-full p-1.5 focus-within:border-white/[0.2] transition-all backdrop-blur-sm">
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
                  className="flex-1 bg-transparent text-white text-base px-3 py-3 placeholder:text-white/20 focus:outline-none"
                />
                <button
                  type="submit"
                  className="group flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#111114] text-sm font-semibold tracking-wide uppercase transition-all hover:bg-white/90 flex-shrink-0"
                >
                  Start Free Audit
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
              <p className="text-[11px] text-white/20 mt-3 tracking-wide">No credit card required. Results in minutes.</p>
            </form>
          </ScrollReveal>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  );
}
