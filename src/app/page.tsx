'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, CheckCircle, Shield,
  FileText, Share2, RefreshCw, BarChart3, ListChecks,
  Sparkles, ChevronDown, ShieldCheck, Layers, Users, Accessibility,
  Rocket, Eye, Globe2, Fingerprint, Code2,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { HomeJsonLd } from "@/components/seo/JsonLd";
import { ScrollReveal, StaggerReveal, StaggerItem, AnimatedCounter } from '@/components/motion';

/* ── FAQ data ─────────────────────────────────────────────── */
const TOP_FAQS = [
  { q: 'How accurate is ClearUX?', a: 'Every finding includes specific evidence — screenshots, element selectors, or metrics — so you can verify instantly. We prioritise precision over volume: fewer, higher-confidence findings you can act on today. For deep qualitative research like user interviews, pair ClearUX with a specialist.' },
  { q: 'How long does it take?', a: 'Most audits complete in under 10 minutes. Your report arrives via email and is available in your dashboard with downloadable PDF and Word versions.' },
  { q: 'What does the audit cover?', a: 'Six modules: Foundation (visual design, messaging, navigation), Human Experience (conversion, trust, ethical patterns), Inclusive Design (accessibility, cognitive load, mobile), Future Readiness (performance, AI discoverability, internationalisation), Brand Consistency (voice and visual identity alignment), and SEO Structure (heading hierarchy, meta tags, structured data).' },
  { q: 'How does this compare to a UX consultant?', a: 'A traditional audit costs $5,000-$15,000 and takes 2-4 weeks. ClearUX delivers 64 checkpoints across 6 modules in minutes for $99. For deep qualitative research, pair ClearUX findings with a specialist.' },
  { q: 'Can I re-audit to track improvement?', a: 'Yes. Re-audits verify whether previous findings are fixed, still present, or dismissed. Your score improves predictably as you resolve issues. Hit "Dig Deeper" anytime for a full fresh analysis.' },
];

/* ── Rotating hero headlines ─────────────────────────────── */
const HERO_HEADLINES = [
  { main: 'UX audits are broken.', accent: 'We fixed them.' },
  { main: 'The $10k audit.', accent: '$99. 10 minutes.' },
  { main: '64 checkpoints.', accent: '6 modules. Zero guesswork.' },
];

/* ── 6 Audit Modules ─────────────────────────────────────── */
const MODULES = [
  {
    icon: Layers,
    title: 'Foundation',
    desc: 'Visual design, messaging clarity, navigation structure, and content quality.',
  },
  {
    icon: Users,
    title: 'Human Experience',
    desc: 'Conversion flow, trust signals, ethical patterns, and behavioural psychology.',
  },
  {
    icon: Accessibility,
    title: 'Inclusive Design',
    desc: 'Accessibility compliance, cognitive load, digital wellbeing, and mobile experience.',
  },
  {
    icon: Rocket,
    title: 'Future Readiness',
    desc: 'Performance, AI discoverability, agent readiness, and internationalisation.',
  },
  {
    icon: Fingerprint,
    title: 'Brand Consistency',
    desc: 'Alignment with your brand voice, visual identity, and guidelines.',
  },
  {
    icon: Code2,
    title: 'SEO Structure',
    desc: 'Heading hierarchy, meta tags, structured data, canonical URLs, and crawlability.',
  },
];

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function Home() {
  const [headlineIdx, setHeadlineIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeadlineIdx((prev) => (prev + 1) % HERO_HEADLINES.length);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

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
          SECTION 1 — HERO
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 min-h-screen flex flex-col overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#84CC16]/[0.03] blur-[120px]" />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 flex-1 flex flex-col items-center justify-center text-center py-24 sm:pt-44 sm:pb-28">
          {/* Top label */}
          <motion.p
            className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-6 sm:mb-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            The audit layer for the AI era
          </motion.p>

          {/* Rotating headline */}
          <div className="relative mb-5 sm:mb-10">
            <AnimatePresence mode="wait">
              <motion.h1
                key={headlineIdx}
                className="font-heading text-[2rem] sm:text-[3rem] md:text-[4rem] lg:text-[5rem] font-light text-white"
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

            {/* Slider progress */}
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

          {/* Description — the problem, one line */}
          <motion.p
            className="text-white/60 text-base sm:text-lg max-w-xl mb-8 sm:mb-16"
            style={{ lineHeight: '1.7' }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            Agencies charge $10-50k and take weeks. In-house teams lack the expertise. ClearUX runs 64 checkpoints across 6 modules and delivers an expert-grade report in minutes.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
          >
            <Link
              href="/register"
              className="group inline-flex items-center justify-center gap-2.5 px-7 py-[1.2rem] rounded-full bg-white text-[#111114] text-base font-medium transition-all hover:bg-white/90 whitespace-nowrap min-h-[48px]"
            >
              Start Free Audit
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/how-it-works"
              className="group inline-flex items-center justify-center gap-2.5 px-7 py-[1.2rem] rounded-full border border-white/20 text-white text-base font-medium transition-all hover:border-white/40 whitespace-nowrap min-h-[48px]"
            >
              How It Works
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>

          {/* KSPs */}
          <motion.div
            className="flex items-center justify-center gap-2 sm:gap-4 mt-5 flex-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {['First audit free', 'Results in minutes', 'No credit card'].map((ksp, i) => (
              <div key={i} className="flex items-center gap-2 sm:gap-4">
                {i > 0 && <span className="text-[#84CC16]/30 hidden sm:inline">&middot;</span>}
                <span className="text-[12px] sm:text-[13px] font-medium text-lime-gradient tracking-wide whitespace-nowrap">{ksp}</span>
              </div>
            ))}
          </motion.div>

          {/* Trust badges */}
          <motion.div
            className="flex items-center justify-center gap-3 sm:gap-6 mt-6 sm:mt-10 flex-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            {[
              { icon: Shield, label: 'SSL', full: 'SSL Encrypted' },
              { icon: ShieldCheck, label: 'GDPR', full: 'GDPR Compliant' },
              { icon: CheckCircle, label: 'Stripe', full: 'Stripe Payments' },
            ].map((badge, i) => {
              const BadgeIcon = badge.icon;
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <BadgeIcon size={13} className="text-white/30" strokeWidth={1.5} />
                  <span className="text-[11px] text-white/30 font-medium tracking-wide sm:hidden">{badge.label}</span>
                  <span className="text-[11px] text-white/30 font-medium tracking-wide hidden sm:inline">{badge.full}</span>
                </div>
              );
            })}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="relative z-10 flex justify-center pb-6 sm:pb-24 flex-shrink-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
        >
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('the-problem');
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
          SECTION 2 — THE PROBLEM
          ═══════════════════════════════════════════════════════ */}
      <section id="the-problem" className="relative z-10 py-14 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
              The problem
            </p>
            <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white max-w-4xl mb-6">
              UX audits are <span className="text-lime-gradient">broken.</span>
            </h2>
            <p className="text-white/60 text-base md:text-lg max-w-2xl leading-relaxed">
              Agencies cost $10-50k and take weeks. In-house audits need senior expertise most teams don't have. So products ship with issues that quietly kill conversion and retention.
            </p>
          </ScrollReveal>

          <StaggerReveal className="grid sm:grid-cols-3 gap-6" staggerDelay={0.08}>
            {[
              { label: 'Traditional agencies', stat: '$10-50k', desc: '2-6 weeks delivery. Budget reserved for enterprise.' },
              { label: 'In-house teams', stat: 'Senior hire', desc: 'Most teams lack the specialised UX research expertise.' },
              { label: 'Free tools', stat: 'Surface only', desc: 'Lighthouse checks performance. Nobody checks dark patterns, AI readiness, or conversion psychology.' },
            ].map((item, i) => (
              <StaggerItem key={i}>
                <div className="border-t border-white/[0.06] pt-8">
                  <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-white/30 mb-3">{item.label}</p>
                  <p className="font-heading text-2xl sm:text-3xl font-medium text-lime-gradient mb-2">{item.stat}</p>
                  <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3 — WHAT WE AUDIT (6 modules)
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-14 sm:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
              What we audit
            </p>
            <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white max-w-4xl mb-6">
              6 modules. 64 checkpoints. <span className="text-lime-gradient">Every audit.</span>
            </h2>
            <p className="text-white/60 text-base md:text-lg max-w-2xl leading-relaxed">
              Usability, accessibility, conversion friction, AI discoverability, brand consistency, and SEO structure — prioritised with concrete fixes.
            </p>
          </ScrollReveal>

          <StaggerReveal className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-0" staggerDelay={0.08}>
            {MODULES.map((mod, i) => {
              const Icon = mod.icon;
              return (
                <StaggerItem key={i}>
                  <div className="py-8 border-t border-white/[0.06]">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-lg bg-[#84CC16]/10 flex items-center justify-center flex-shrink-0">
                        <Icon size={18} className="text-[#84CC16]" strokeWidth={2} />
                      </div>
                      <h3 className="font-heading text-lg font-medium text-white">{mod.title}</h3>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed">{mod.desc}</p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerReveal>
        </div>

        {/* Scrolling showcase */}
        <div className="mt-16 sm:mt-24 space-y-4 overflow-hidden relative opacity-90 -mx-6 sm:-mx-10 lg:-mx-16" aria-hidden="true" role="presentation">
          <div className="relative">
            <div className="flex gap-2.5 w-max" style={{ animation: 'scroll-left 40s linear infinite' }}>
              {[...Array(2)].map((_, setIdx) => (
                <div key={setIdx} className="flex gap-2.5">
                  {[
                    { label: 'Dark Pattern Scanner', subtitle: 'Human Experience', icon: ShieldCheck },
                    { label: 'Cognitive Load Test', subtitle: 'Inclusive Design', icon: Accessibility },
                    { label: 'AI Discoverability', subtitle: 'Future Readiness', icon: Rocket },
                    { label: 'Conversion Friction Map', subtitle: 'Human Experience', icon: Users },
                  ].map((card, j) => {
                    const CardIcon = card.icon;
                    return (
                      <div key={j} className="relative w-[290px] sm:w-[340px] rounded-xl overflow-hidden flex-shrink-0 px-6 py-6 flex items-start gap-4" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
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

          <div className="relative">
            <div className="flex gap-2.5 w-max" style={{ animation: 'scroll-right 45s linear infinite' }}>
              {[...Array(2)].map((_, setIdx) => (
                <div key={setIdx} className="flex gap-2.5">
                  {[
                    { label: 'Trust Signal Audit', subtitle: 'Foundation', icon: Shield },
                    { label: 'WCAG Compliance', subtitle: 'Inclusive Design', icon: Eye },
                    { label: 'Brand Voice Check', subtitle: 'Brand Consistency', icon: Fingerprint },
                    { label: 'Structured Data', subtitle: 'SEO Structure', icon: Code2 },
                  ].map((card, j) => {
                    const CardIcon = card.icon;
                    return (
                      <div key={j} className="relative w-[270px] sm:w-[320px] rounded-xl overflow-hidden flex-shrink-0 px-6 py-6 flex items-start gap-4" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
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

          <div className="absolute inset-y-0 left-0 w-48 sm:w-72 pointer-events-none" style={{ background: 'linear-gradient(to right, rgba(17,17,20,1) 0%, rgba(17,17,20,1) 20%, transparent 100%)' }} />
          <div className="absolute inset-y-0 right-0 w-48 sm:w-72 pointer-events-none" style={{ background: 'linear-gradient(to left, rgba(17,17,20,1) 0%, rgba(17,17,20,1) 20%, transparent 100%)' }} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — WHY CLEARUX (what others miss)
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-14 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
              Why ClearUX
            </p>
            <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white max-w-4xl mb-6">
              What others <span className="text-lime-gradient">miss.</span>
            </h2>
            <p className="text-white/60 text-base md:text-lg max-w-2xl leading-relaxed">
              Research tools tell you what users did. Analytics tell you where they dropped. Agencies sell you hours. None of them audit your interface against best practices at speed. We do.
            </p>
          </ScrollReveal>

          <StaggerReveal className="grid sm:grid-cols-2 gap-6" staggerDelay={0.08}>
            {[
              {
                icon: Globe2,
                title: 'AI discoverability',
                desc: 'We\'re the only platform auditing how LLMs read and surface your product. Structured data, semantic markup, machine-readable content — the new SEO.',
                label: 'No other tool checks this',
              },
              {
                icon: Eye,
                title: 'Dark pattern detection',
                desc: 'Confirmshaming, hidden costs, trick questions, forced continuity. We flag manipulative design that erodes trust and conversion.',
                label: 'Beyond accessibility scanners',
              },
              {
                icon: Fingerprint,
                title: 'Brand consistency',
                desc: 'Upload your brand guidelines and we audit your site against them — voice, visual identity, tone. Not just colours and fonts, but whether your site sounds like you.',
                label: 'New module',
              },
              {
                icon: RefreshCw,
                title: 'Continuous, not annual',
                desc: 'Re-audit after every sprint. Track fixes, prove improvement, catch regressions. UX quality as a continuous metric, not a one-off project.',
                label: 'Built for modern teams',
              },
            ].map((item, i) => {
              const CardIcon = item.icon;
              return (
                <StaggerItem key={i}>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-8 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-5">
                      <div className="w-11 h-11 rounded-xl bg-[#84CC16]/10 flex items-center justify-center">
                        <CardIcon size={20} className="text-[#84CC16]" />
                      </div>
                      <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#84CC16]/60">{item.label}</p>
                    </div>
                    <h3 className="font-heading text-lg font-medium text-white mb-3">{item.title}</h3>
                    <p className="text-sm text-white/60 leading-relaxed">{item.desc}</p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 5 — HOW IT WORKS
          ═══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="relative z-10 py-14 sm:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
              How it works
            </p>
            <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white max-w-4xl mb-6">
              Paste a URL. Get a <span className="text-lime-gradient">report.</span>
            </h2>
          </ScrollReveal>

          <StaggerReveal className="grid md:grid-cols-3 gap-8 lg:gap-10" staggerDelay={0.12}>
            {[
              {
                step: '01',
                title: 'Paste your URL',
                desc: 'Enter any website. ClearUX crawls your key pages, maps the user journey, and identifies interactive elements. No code, no setup.',
              },
              {
                step: '02',
                title: 'Our AI runs 64 checkpoints',
                desc: 'Every page evaluated across 6 modules: foundation, experience, inclusivity, future readiness, brand consistency, and SEO structure. Scored by severity and business impact.',
              },
              {
                step: '03',
                title: 'Act on your report',
                desc: 'Critical issues first. Clear fixes for each finding. Export as PDF or Word, share with a link, track progress from your dashboard.',
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
          SECTION 6 — WHAT YOU GET
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-14 sm:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
              What you get
            </p>
            <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white max-w-5xl mb-6">
              A report your team{' '}
              <span className="text-lime-gradient">can act on.</span>
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 border-b border-white/[0.06] pb-8">
              <div className="max-w-2xl">
                <p className="text-white/60 text-base md:text-lg leading-relaxed mb-4">
                  Every finding ranked by severity and business impact, with specific fixes your team can ship in their next sprint.
                </p>
                <Link
                  href="/demo-report"
                  className="group inline-flex items-center gap-2.5 px-6 py-3 rounded-full border border-[#84CC16]/30 bg-[#84CC16]/[0.06] hover:bg-[#84CC16]/[0.12] text-sm font-medium text-lime-gradient transition-all"
                >
                  See a sample report
                  <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button type="button" aria-label="Scroll left" onClick={() => { const el = document.getElementById('feature-cards-scroll'); if (el) el.scrollBy({ left: -400, behavior: 'smooth' }); }} className="w-11 h-11 rounded-full border border-white/15 flex items-center justify-center hover:border-white/30 transition-colors">
                  <ArrowRight size={16} className="text-white/40 rotate-180" />
                </button>
                <button type="button" aria-label="Scroll right" onClick={() => { const el = document.getElementById('feature-cards-scroll'); if (el) el.scrollBy({ left: 400, behavior: 'smooth' }); }} className="w-11 h-11 rounded-full border border-white/15 flex items-center justify-center hover:border-white/30 transition-colors">
                  <ArrowRight size={16} className="text-white/40" />
                </button>
              </div>
            </div>
          </ScrollReveal>

          <div id="feature-cards-scroll" className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {[
              { icon: ListChecks, title: 'Prioritised Findings', label: 'Severity Ranked', desc: 'Critical issues surface first. Ranked by severity and business impact so your team knows exactly where to start.' },
              { icon: FileText, title: 'PDF & Word Export', label: 'One-Click', desc: 'Professional reports ready for stakeholders. White-label available for agencies.' },
              { icon: Share2, title: 'Team Sharing', label: 'Shareable', desc: 'One link for your full score, breakdown, and recommendations. No account needed to view.' },
              { icon: CheckCircle, title: 'Track Every Fix', label: 'Dashboard', desc: 'Status tracking for every finding — open, in progress, fixed. Real-time progress at a glance.' },
              { icon: RefreshCw, title: 'Re-Audit', label: 'Continuous', desc: 'Re-audit the same URL to verify fixes or dig deeper. Track your score improvement over time.' },
              { icon: BarChart3, title: 'Module Scores', label: '6 Modules', desc: 'Each module scored individually. See exactly where you excel and where to improve.' },
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className="relative w-[280px] sm:w-[320px] min-w-[280px] sm:min-w-[320px] rounded-xl p-6 sm:p-8 flex-shrink-0 bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] hover:shadow-lg hover:shadow-black/20 transition-all group">
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
          SECTION 7 — WHY NOW
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-14 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal>
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
              Why now
            </p>
            <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white max-w-4xl mb-6">
              Two audiences. <span className="text-lime-gradient">One interface.</span>
            </h2>
            <p className="text-white/60 text-base md:text-lg max-w-2xl leading-relaxed mb-12">
              Your interface now serves humans and language models. The teams that audit fast and audit often will own the next decade. ClearUX makes it continuous, not annual.
            </p>
          </ScrollReveal>

          <ScrollReveal>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { num: '64', label: 'Checkpoints', desc: 'per audit' },
                { num: '6', label: 'Modules', desc: 'complete coverage' },
                { num: '<10', label: 'Minutes', desc: 'to full report' },
              ].map((stat, i) => (
                <div key={i} className={`text-left ${i > 0 ? 'sm:border-l sm:border-white/[0.06] sm:pl-8' : ''}`}>
                  <p className="font-heading text-[4rem] sm:text-[5rem] font-light text-lime-gradient leading-none mb-2">{stat.num}</p>
                  <p className="text-sm font-medium text-white/70">{stat.label}</p>
                  <p className="text-xs text-white/40">{stat.desc}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 8 — PRICING
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-28 sm:py-36 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
              Pricing
            </p>
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
              No subscription. No feature gates. Every audit gets all 6 modules, 64 checkpoints, and full reports. Credits never expire.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <Link href="/register" className="group inline-flex items-center justify-center gap-2.5 px-7 py-[1.2rem] rounded-full bg-white text-[#111114] text-base font-medium transition-all hover:bg-white/90 whitespace-nowrap min-h-[48px]">
                Start Free Audit
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link href="/pricing" className="group inline-flex items-center justify-center gap-2.5 px-7 py-[1.2rem] rounded-full border border-white/20 text-white text-base font-medium transition-all hover:border-white/40 whitespace-nowrap min-h-[48px]">
                View All Plans
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-6 sm:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8">
                {[
                  'All 6 modules, 64 checkpoints',
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
          SECTION 9 — FAQ
          ═══════════════════════════════════════════════════════ */}
      <section id="faq" className="relative z-10 py-14 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
              FAQ
            </p>
            <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white max-w-4xl">
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
            <Link href="/faq" className="group inline-flex items-center gap-2.5 text-sm font-medium text-white/40 hover:text-white transition-colors">
              Read all FAQ
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 10 — FINAL CTA
          ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-14 sm:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ScrollReveal className="mb-16 sm:mb-20">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
              Get started
            </p>
            <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white max-w-4xl mb-6">
              Ready to see what you&apos;re{' '}
              <span className="text-lime-gradient">missing?</span>
            </h2>
            <p className="text-white/60 text-base md:text-lg max-w-2xl leading-relaxed mb-12">
              Your first audit is free. 64 checkpoints, 6 modules, full report in minutes.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2.5 px-7 py-[1.2rem] rounded-full bg-white text-[#111114] text-base font-medium transition-all hover:bg-white/90 whitespace-nowrap min-h-[48px]"
              >
                Start Free Audit
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/how-it-works"
                className="group inline-flex items-center justify-center gap-2.5 px-7 py-[1.2rem] rounded-full border border-white/20 text-white text-base font-medium transition-all hover:border-white/40 whitespace-nowrap min-h-[48px]"
              >
                How It Works
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <p className="text-xs text-white/60 mt-3 tracking-wide">No credit card required. Results in minutes.</p>
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
