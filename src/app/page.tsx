'use client';

import { useState, useEffect, useRef } from 'react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import {
  Brain, CheckCircle, Eye, Target, Map, MousePointerClick, Zap,
  Smartphone, Shield, Type, ArrowRight, Layers, Accessibility,
  Heart, Users, Globe2, Scale, Sparkles, Clock,
  Search,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { HomeJsonLd } from "@/components/seo/JsonLd";
import AllAuditsInclude from "@/components/ui/AllAuditsInclude";
import { useAuth } from '@/context/AuthContext';
import HowItWorks from '@/components/motion/HowItWorks';
import WhyClearUX from '@/components/motion/WhyClearUX';
import BeyondTheReport from '@/components/motion/BeyondTheReport';
import {
  ScrollReveal, StaggerReveal, StaggerItem, ScaleReveal,
  AnimatedBar, AnimatedCounter, FloatingOrb,
} from '@/components/motion';

/* ── Pillar data ────────────────────────────────────────────── */
const PILLAR_DATA = [
  {
    key: 'future',
    label: 'Future Readiness',
    color: 'from-emerald-500 to-teal-600',
    colorBg: 'bg-emerald-500/10',
    colorText: 'text-emerald-500',
    colorBorder: 'border-emerald-500/20',
    headline: 'Ready for AI agents and global users.',
    subhead: 'AI discoverability, agent readiness, and global reach.',
    body: 'We evaluate how LLMs and AI agents understand your site, whether your content is structured for the AI era, and how well your design translates across cultures, languages, and regulations worldwide.',
  },
  {
    key: 'foundation',
    label: 'Foundation',
    color: 'from-violet-500 to-purple-600',
    colorBg: 'bg-brand/10',
    colorText: 'text-brand',
    colorBorder: 'border-brand/20',
    headline: 'Stop losing users in the first 5 seconds.',
    subhead: 'First impressions, clear messaging, and friction-free navigation.',
    body: 'We evaluate visual design, value proposition clarity, information architecture, layout hierarchy, content quality, and conversion paths. These are the fundamentals that make or break user trust in the first 5 seconds.',
  },
  {
    key: 'human',
    label: 'Human Experience',
    color: 'from-pink-500 to-rose-600',
    colorBg: 'bg-pink-500/10',
    colorText: 'text-pink-600 dark:text-pink-400',
    colorBorder: 'border-pink-500/20',
    headline: 'Build trust, not dark patterns.',
    subhead: 'Ethical patterns, emotional safety, and inclusive experiences.',
    body: 'We detect dark patterns, evaluate psychological safety, test for cognitive accessibility and neurodiversity support, assess digital wellbeing practices, and check age inclusivity. Because your users are people first.',
  },
  {
    key: 'technical',
    label: 'Inclusive Design',
    color: 'from-amber-500 to-orange-600',
    colorBg: 'bg-amber-500/10',
    colorText: 'text-amber-600 dark:text-amber-400',
    colorBorder: 'border-amber-500/20',
    headline: 'Accessibility that converts.',
    subhead: 'Universal design, accessibility, and inclusive experience.',
    body: 'We audit WCAG accessibility compliance, keyboard navigation, screen reader support, cognitive accessibility, mobile responsiveness, and digital wellbeing. Design that works for everyone, everywhere.',
  },
];

/* ── Animated pillar mock card ──────────────────────────────── */
function AnimatedMockCard({
  icon: Icon,
  title,
  subtitle,
  score,
  bars,
  finding,
  findingSeverity,
  findingLabel,
  findingDesc,
}: {
  icon: React.ElementType
  title: string
  subtitle: string
  score: number
  bars: Array<{ t: string; s: number }>
  finding: string
  findingSeverity: string
  findingLabel: string
  findingDesc: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-15%' })
  const [displayScore, setDisplayScore] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!isInView || started.current) return
    started.current = true
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / 1200, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayScore(Math.round(eased * score))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [isInView, score])

  const severityColor = findingSeverity === 'CRITICAL' ? 'bg-red-500' : 'bg-orange-500'

  return (
    <motion.aside
      ref={ref}
      role="presentation"
      className="w-full rounded-2xl bg-card/80 dark:bg-card border border-border/30 dark:border-white/[0.05] p-7 sm:p-9 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none"
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-10%' }}
      transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Header */}
      <motion.div
        className="flex items-center gap-3 mb-6"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ delay: 0.2 }}
      >
        <div className="w-12 h-12 rounded-xl bg-text/5 flex items-center justify-center">
          <Icon size={24} className="text-text" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text">{title}</p>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
        <motion.span
          className="ml-auto font-heading text-4xl font-bold text-text"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
        >
          {displayScore}
        </motion.span>
      </motion.div>

      {/* Progress bars */}
      <div className="space-y-4">
        {bars.map((d, i) => (
          <div key={i}>
            <motion.div
              className="flex items-center justify-between mb-1.5"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.3 + i * 0.1 }}
            >
              <span className="text-sm text-text">{d.t}</span>
              <span className="text-sm font-bold text-text">{d.s}</span>
            </motion.div>
            <AnimatedBar value={d.s} delay={0.4 + i * 0.12} />
          </div>
        ))}
      </div>

      {/* Finding card */}
      <motion.div
        className="mt-6 p-4 rounded-xl bg-off/50 dark:bg-white/[0.03]"
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.9, duration: 0.5 }}
      >
        <div className="flex items-start gap-2 mb-1.5">
          <span className={`${severityColor} text-white text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0`}>{findingSeverity}</span>
          <p className="text-xs font-semibold text-text">{findingLabel}</p>
        </div>
        <p className="text-[11px] text-muted leading-relaxed">{findingDesc}</p>
      </motion.div>
    </motion.aside>
  )
}

/* ── Pillar scroll reveal (animated version) ────────────────── */
function PillarScrollReveal({ categories }: { categories: Array<{ pillar: string; icon: React.ElementType; title: string; desc: string; featured?: boolean }> }) {
  const pillarNames = ['Future Readiness', 'Foundation', 'Human Experience', 'Inclusive Design'];
  const visualOrder = [3, 0, 1, 2];

  const mockData = [
    { icon: Eye, title: 'Foundation', subtitle: 'First impressions & clarity', score: 78, bars: [{t:'Visual Design',s:82},{t:'Messaging Clarity',s:75},{t:'Navigation',s:88},{t:'Conversion Paths',s:70}], findingSeverity: 'CRITICAL', findingLabel: 'CTA invisible on mobile viewport', findingDesc: 'Primary call-to-action blends into the background on screens under 768px — users can’t find the next step.' },
    { icon: Heart, title: 'Human Experience', subtitle: 'Ethics & psychological safety', score: 54, bars: [{t:'Ethical UX Patterns',s:38},{t:'Emotional Safety',s:72},{t:'Cognitive Load',s:55}], findingSeverity: 'CRITICAL', findingLabel: 'Confirmshaming in cancel flow', findingDesc: 'Opt-out label uses guilt language — “No, I don’t want to save money” — a recognised dark pattern.' },
    { icon: Accessibility, title: 'Inclusive Design', subtitle: 'Accessibility & universal UX', score: 71, bars: [{t:'WCAG Compliance',s:64},{t:'Mobile Responsiveness',s:82},{t:'Keyboard Navigation',s:68}], findingSeverity: 'HIGH', findingLabel: 'Touch targets below minimum', findingDesc: 'Checkout form buttons are 32px — below the 44px WCAG minimum. 18% of mobile users will misfire taps.' },
    { icon: Brain, title: 'AI Readiness', subtitle: 'How AI sees your site', score: 65, bars: [{t:'LLM Discoverability',s:72},{t:'Agent Navigation',s:48},{t:'Cultural Readiness',s:62}], findingSeverity: 'HIGH', findingLabel: 'Structured data incomplete', findingDesc: 'AI agents can identify this is a SaaS product but cannot determine pricing or features from structured data alone.' },
  ]

  return (
    <div className="relative max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
      <div className="space-y-24 lg:space-y-36">
        {PILLAR_DATA.map((pillar, idx) => {
          const pillarCats = categories.filter((c) => c.pillar === pillarNames[idx]);
          const isEven = idx % 2 === 0;
          const mock = mockData[visualOrder[idx]];

          const textBlock = (
            <motion.div
              className="flex flex-col justify-center"
              initial={{ opacity: 0, x: isEven ? -40 : 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <p className={`text-[13px] font-semibold tracking-widest uppercase mb-4 ${pillar.colorText}`}>
                {pillar.label}
              </p>
              <h3 className="font-heading text-2xl sm:text-3xl md:text-[2.25rem] font-semibold text-text mb-4" style={{ lineHeight: '1.1' }}>
                {pillar.headline}
              </h3>
              <p className="text-muted text-lg md:text-xl mb-4 font-medium" style={{ lineHeight: '1.5' }}>
                {pillar.subhead}
              </p>
              <p className="text-muted text-base leading-relaxed mb-8 max-w-md">
                {pillar.body}
              </p>
              <StaggerReveal className="flex flex-wrap gap-2" staggerDelay={0.08}>
                {pillarCats.map((cat, cIdx) => {
                  const CatIcon = cat.icon;
                  return (
                    <StaggerItem key={cIdx}>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${pillar.colorBg} ${pillar.colorText} ${pillar.colorBorder}`}>
                        <CatIcon size={12} />
                        {cat.title}
                      </span>
                    </StaggerItem>
                  );
                })}
              </StaggerReveal>
            </motion.div>
          );

          const visualBlock = (
            <div className="flex items-center justify-center">
              <AnimatedMockCard
                icon={mock.icon}
                title={mock.title}
                subtitle={mock.subtitle}
                score={mock.score}
                bars={mock.bars}
                finding=""
                findingSeverity={mock.findingSeverity}
                findingLabel={mock.findingLabel}
                findingDesc={mock.findingDesc}
              />
            </div>
          );

          return (
            <div key={pillar.key} className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              {isEven ? (
                <>
                  {textBlock}
                  <div className="hidden lg:block">{visualBlock}</div>
                </>
              ) : (
                <>
                  <div className="hidden lg:block">{visualBlock}</div>
                  {textBlock}
                </>
              )}
              <div className="lg:hidden">{visualBlock}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── FAQ ──────────────────────────────────────────────────── */
const TOP_FAQS = [
  { q: 'How long does an audit take?', a: 'Most audits complete in under 10 minutes. Our AI crawls your website, analyses every page against 64 checkpoints across 16 categories, and generates a full professional report.' },
  { q: 'What does the audit cover?', a: 'We evaluate 16 categories across 4 pillars: Foundation, Human Experience, Inclusive Design, and Future Readiness. Every audit includes accessibility, ethical UX, AI readiness, conversion analysis, and more.' },
  { q: 'Is ClearUX 100% accurate?', a: 'No automated tool is perfect, and we believe honesty about this builds trust. Our AI catches what other tools miss, but we recommend human review for critical accessibility findings. You can dismiss any finding with a reason, and the AI learns from your feedback on re-audits.' },
  { q: 'How do credits work?', a: 'One credit = one full audit. Credits never expire. Every audit includes all 64 checkpoints, PDF & Word reports, finding status tracking, shareable team links, and prioritised recommendations.' },
  { q: 'Can I re-audit the same site to track improvement?', a: 'Yes. Re-audits run in Baseline mode by default — they only verify whether previous findings are fixed, still present, or dismissed. Your score improves predictably as you resolve issues. When you\'re ready to discover new issues beyond the baseline, hit "Dig Deeper" for a full Deep mode analysis.' },
];

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
/* ── Hero typewriter placeholder animation ─────────────────── */
const PLACEHOLDER_EXAMPLES = ['acme.com', 'mystore.io', 'app.saas.co', 'brand.com']

function useTypewriterPlaceholder() {
  const [placeholder, setPlaceholder] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    let exIdx = 0, charIdx = 0, deleting = false, timer: ReturnType<typeof setTimeout>

    const tick = () => {
      const word = PLACEHOLDER_EXAMPLES[exIdx]
      if (!deleting) {
        charIdx++
        setPlaceholder(word.slice(0, charIdx))
        if (charIdx >= word.length) {
          timer = setTimeout(() => { deleting = true; tick() }, 2000)
          return
        }
        timer = setTimeout(tick, 90)
      } else {
        charIdx--
        setPlaceholder(word.slice(0, charIdx))
        if (charIdx <= 0) {
          deleting = false
          exIdx = (exIdx + 1) % PLACEHOLDER_EXAMPLES.length
          timer = setTimeout(tick, 400)
          return
        }
        timer = setTimeout(tick, 50)
      }
    }
    timer = setTimeout(tick, 800)
    return () => clearTimeout(timer)
  }, [])

  return { placeholder, isFocused, setIsFocused }
}

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [heroUrl, setHeroUrl] = useState('');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { placeholder: typedPlaceholder, isFocused: inputFocused, setIsFocused: setInputFocused } = useTypewriterPlaceholder();

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = heroUrl.trim();
    if (!trimmed) return;
    const encoded = encodeURIComponent(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    router.push(user ? `/dashboard/new-audit?url=${encoded}` : `/register?url=${encoded}`);
  };

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroOpacity = useTransform(heroScroll, [0, 0.5], [1, 0]);
  const heroY = useTransform(heroScroll, [0, 0.5], [0, -60]);

  const auditCategories = [
    { pillar: "Foundation", icon: Eye, title: "First Impression & Visual Design", desc: "How users perceive your site at first glance" },
    { pillar: "Foundation", icon: Target, title: "Value Proposition & Messaging", desc: "Clear communication of your unique value" },
    { pillar: "Foundation", icon: Map, title: "Navigation & Information Architecture", desc: "Intuitive structure and findability" },
    { pillar: "Foundation", icon: Layers, title: "Visual Hierarchy & Layout", desc: "Layout flow, spacing, and element prioritisation" },
    { pillar: "Foundation", icon: Type, title: "Content Quality & Readability", desc: "Clear, compelling, well-structured messaging" },
    { pillar: "Foundation", icon: MousePointerClick, title: "Calls-to-Action & Conversion", desc: "Effective CTAs and conversion paths" },
    { pillar: "Human Experience", icon: Shield, title: "Trust & Credibility", desc: "Security and trustworthiness signals" },
    { pillar: "Human Experience", icon: Scale, title: "Ethical UX & Dark Pattern Detection", desc: "Ethical design practices and avoiding manipulation" },
    { pillar: "Human Experience", icon: Heart, title: "Emotional Intelligence & Psychological Safety", desc: "Supportive, non-judgmental user experience" },
    { pillar: "Human Experience", icon: Brain, title: "Cognitive Accessibility & Neurodiversity", desc: "Optimised for ADHD, dyslexia, and autism spectrum" },
    { pillar: "Human Experience", icon: Sparkles, title: "Digital Wellbeing & Responsible Design", desc: "Reducing user anxiety and addictive patterns" },
    { pillar: "Human Experience", icon: Users, title: "Age Inclusivity & Digital Literacy", desc: "Accessible to users of all ages and tech fluency" },
    { pillar: "Inclusive Design", icon: Accessibility, title: "Accessibility & WCAG Compliance", desc: "Perceivable, operable, understandable, robust" },
    { pillar: "Inclusive Design", icon: Brain, title: "Cognitive Accessibility & Neurodiversity", desc: "Reducing cognitive load for all users" },
    { pillar: "Inclusive Design", icon: Sparkles, title: "Digital Wellbeing & Responsible Design", desc: "Respectful engagement and healthy defaults", featured: true },
    { pillar: "Inclusive Design", icon: Smartphone, title: "Mobile Experience & Responsive Design", desc: "Touch-friendly, responsive, mobile-first" },
    { pillar: "Future Readiness", icon: Brain, title: "AI Discoverability & LLM Readiness", desc: "Optimisation for AI model indexing", featured: true },
    { pillar: "Future Readiness", icon: Zap, title: "AI Agent Readiness", desc: "Structured data and agent interaction support" },
    { pillar: "Future Readiness", icon: Globe2, title: "Cultural Sensitivity & Global Readiness", desc: "Inclusive design for diverse global audiences" },
  ];

  return (
    <div className="bg-surface text-text min-h-screen">
      <HomeJsonLd />
      <Navbar />
      <main id="main-content">

      {/* ═══════════════════════════════════════════════════════
          HERO — Dark, cinematic, parallax content
          ═══════════════════════════════════════════════════════ */}
      <section ref={heroRef} className="section-dark dark-forced relative min-h-screen flex flex-col justify-center px-4 md:px-6 lg:px-8 overflow-hidden" style={{ background: '#080808' }}>

        {/* Aurora background — high contrast, vivid */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Primary lime aurora — strong */}
          <div className="absolute w-[130%] h-[300px] -left-[15%] top-[8%]" style={{
            background: 'linear-gradient(90deg, transparent 0%, #22C55E 10%, #B9FF66 30%, #B9FF66 50%, #22C55E 70%, transparent 100%)',
            filter: 'blur(80px)',
            opacity: 0.30,
            animation: 'auroraDrift 20s ease-in-out infinite',
          }} />
          {/* Secondary indigo aurora */}
          <div className="absolute w-[120%] h-[260px] -left-[10%] top-[35%]" style={{
            background: 'linear-gradient(90deg, transparent 0%, #6366F1 15%, #818CF8 40%, #6366F1 65%, transparent 100%)',
            filter: 'blur(70px)',
            opacity: 0.22,
            animation: 'auroraDrift2 25s ease-in-out infinite',
          }} />
          {/* Warm accent aurora */}
          <div className="absolute w-[110%] h-[240px] -left-[5%] top-[60%]" style={{
            background: 'linear-gradient(90deg, transparent 0%, #F59E0B 20%, #EF4444 40%, #EC4899 60%, transparent 100%)',
            filter: 'blur(75px)',
            opacity: 0.20,
            animation: 'auroraDrift 22s ease-in-out infinite reverse',
          }} />
          {/* Center spotlight — lime glow behind headline */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse 60% 40% at 50% 38%, rgba(185,255,102,0.08) 0%, transparent 60%)',
            animation: 'auroraPulse 8s ease-in-out infinite',
          }} />

          {/* Grid overlay */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(185,255,102,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(185,255,102,.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            animation: 'gridMove 20s linear infinite',
          }} />

          {/* Scan lines */}
          <div className="absolute left-0 w-full h-[1px]" style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(185,255,102,0.2) 20%, rgba(185,255,102,0.35) 50%, rgba(185,255,102,0.2) 80%, transparent 100%)',
            animation: 'scanLineH 8s linear infinite',
          }} />
          <div className="absolute left-0 w-full h-[1px]" style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.15) 30%, rgba(99,102,241,0.25) 50%, rgba(99,102,241,0.15) 70%, transparent 100%)',
            animation: 'scanLineH 12s linear infinite 4s',
          }} />
          <div className="absolute top-0 h-full w-[1px]" style={{
            background: 'linear-gradient(transparent 0%, rgba(185,255,102,0.18) 20%, rgba(185,255,102,0.3) 50%, rgba(185,255,102,0.18) 80%, transparent 100%)',
            animation: 'scanLineV 10s linear infinite 2s',
          }} />

          {/* Deep edge vignette — pushes black harder at edges */}
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to bottom, #080808 0%, transparent 20%, transparent 80%, #080808 100%)',
          }} />
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 40%, #080808 100%)',
          }} />
        </div>

        {/* Hero content with parallax */}
        <motion.div
          style={{ opacity: heroOpacity, y: heroY }}
          className="max-w-7xl mx-auto text-center relative z-10 flex-1 flex flex-col justify-center pt-20"
        >
          {/* Label badge */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <span className="inline-flex items-center gap-2 bg-[#B9FF66] text-[#080808] text-xs sm:text-sm font-bold px-5 py-2.5 rounded-full shadow-[0_0_30px_rgba(185,255,102,0.3)]">
              Professional AI-powered UX audit in under 10 min
            </span>
          </motion.div>

          {/* Headline — bigger, brighter */}
          <motion.h1
            className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-[4.75rem] font-bold tracking-tight mb-8 text-white"
            style={{ lineHeight: '1.08' }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            Find the UX issues costing{' '}
            <br className="hidden sm:block" />
            you conversions.{' '}
            <span className="text-[#B9FF66]" style={{ textShadow: '0 0 40px rgba(185,255,102,0.3)' }}>In minutes.</span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-white/60 mb-12 sm:mb-14 max-w-2xl mx-auto"
            style={{ lineHeight: '1.6' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            Get a consultant-grade UX audit for $99 — covering accessibility, dark patterns, conversion psychology, and AI readiness across 64 checkpoints.
          </motion.p>

          {/* CTA Form — compact, with typewriter placeholder */}
          <motion.form
            onSubmit={handleHeroSubmit}
            className="max-w-2xl w-full mx-auto mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <div className="flex flex-col sm:flex-row gap-3 p-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
              <div className="relative flex-1">
                <label htmlFor="hero-url-input" className="sr-only">Website URL to audit</label>
                <div className="relative">
                  <input
                    id="hero-url-input"
                    type="text"
                    name="url"
                    autoComplete="url"
                    value={heroUrl}
                    onChange={(e) => setHeroUrl(e.target.value)}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder=""
                    aria-label="Website URL to audit"
                    className="w-full px-5 py-4 text-base rounded-xl bg-transparent text-white placeholder:text-white/30 focus:outline-none transition-all"
                  />
                  {/* Typewriter placeholder */}
                  {!heroUrl && (
                    <div className="absolute inset-0 flex items-center px-5 pointer-events-none">
                      <span className="text-base text-white/25">{inputFocused ? '' : typedPlaceholder}</span>
                      {!inputFocused && (
                        <motion.span
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity }}
                          className="inline-block w-[2px] h-5 bg-[#B9FF66]/60 ml-0.5"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="submit"
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 min-h-[48px] text-base bg-[#B9FF66] text-[#080808] rounded-xl font-bold transition-all hover:-translate-y-0.5 hover:bg-[#CDFF8C] hover:shadow-[0_0_30px_rgba(185,255,102,0.25)] flex-shrink-0"
              >
                {user ? 'Run My Audit' : 'Run My Audit'}
                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </motion.form>

          {/* Trust KSPs */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 mb-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.65 }}
          >
            <div className="flex items-center gap-2.5">
              <Zap size={16} className="text-[#B9FF66]" />
              <span className="text-sm font-medium text-white/70">Results in minutes</span>
            </div>
            <div className="w-px h-4 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <Shield size={16} className="text-[#B9FF66]" />
              <span className="text-sm font-medium text-white/70">Your data is never stored</span>
            </div>
            <div className="w-px h-4 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <Clock size={16} className="text-[#B9FF66]" />
              <span className="text-sm font-medium text-white/70">Credits never expire</span>
            </div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.button
            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            className="mx-auto flex flex-col items-center hover:scale-105 transition-transform cursor-pointer mb-8"
            aria-label="Scroll to see how it works"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <motion.div
              className="w-6 h-10 rounded-full border-2 border-white/15 flex justify-center pt-2"
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <motion.div
                className="w-1 h-2 rounded-full bg-[#B9FF66]"
                animate={{ opacity: [0.4, 1, 0.4], y: [0, 6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.div>
            <span className="text-white/25 text-xs mt-3 font-medium">See how it works</span>
          </motion.button>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          HOW IT WORKS — Animated 3-step walkthrough
          ═══════════════════════════════════════════════════════ */}
      <div id="how-it-works">
        <HowItWorks />
      </div>

      {/* ═══════════════════════════════════════════════════════
          FEATURES + STATS — Staggered reveals
          ═══════════════════════════════════════════════════════ */}
      <section id="features" className="relative bg-surface overflow-hidden">
        {/* Floating orbs */}
        <FloatingOrb className="top-[10%] right-[-5%]" size={400} color="rgba(185,255,102,0.04)" delay={0} />
        <FloatingOrb className="bottom-[20%] left-[-8%]" size={350} color="rgba(99,102,241,0.03)" delay={4} />

        <div className="relative max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pt-32 sm:pt-40 pb-24">
          <ScrollReveal className="text-center max-w-3xl mx-auto">
            {/* Audience pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              {['Product Managers', 'Design Teams', 'Agencies'].map((audience, i) => (
                <span key={i} className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold border border-border/40 dark:border-white/[0.08] bg-card text-text">
                  {audience}
                </span>
              ))}
            </div>

            <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-text mb-6 tracking-tight" style={{ lineHeight: '1.1' }}>
              Four pillars. 64 checkpoints.<br className="hidden sm:block" />
              <span className="text-muted">The ones nobody else audits.</span>
            </h2>
            <p className="text-muted text-base md:text-lg leading-relaxed max-w-xl mx-auto">
              Most tools stop at performance and SEO. ClearUX covers ethical UX, cognitive accessibility, AI readiness, and conversion psychology — ranked by business impact.
            </p>
          </ScrollReveal>

          {/* Stats — staggered count-up */}
          <StaggerReveal className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 mt-24 max-w-7xl mx-auto" staggerDelay={0.15}>
            {([
              { end: 64, suffix: '+', label: 'UX checkpoints' },
              { end: 16, suffix: '', label: 'Categories' },
              { end: 4, suffix: '', label: 'Audit pillars' },
              { end: 40, suffix: '+', label: 'Pages crawled' },
            ] as const).map((stat, idx) => (
              <StaggerItem key={idx} className="text-center">
                <p className="font-heading text-5xl sm:text-6xl md:text-7xl font-semibold text-text leading-none tracking-tight" suppressHydrationWarning>
                  {mounted ? (
                    <AnimatedCounter end={stat.end} suffix={stat.suffix} duration={1.5} />
                  ) : ' '}
                </p>
                <p className="text-sm text-muted mt-3 font-medium">{stat.label}</p>
              </StaggerItem>
            ))}
          </StaggerReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          WHY CLEARUX — Animated scroll-driven differentiators
          ═══════════════════════════════════════════════════════ */}
      <WhyClearUX />

      {/* ═══════════════════════════════════════════════════════
          PILLAR SCROLL REVEAL (animated cards)
          ═══════════════════════════════════════════════════════ */}
      <section className="relative pt-28 sm:pt-36 pb-24" style={{ background: 'var(--gradient-brand-subtle)' }}>
        <ScrollReveal className="text-center mb-20 px-4">
          <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-text">The four pillars</p>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-text mb-5 tracking-tight" style={{ lineHeight: '1.1' }}>
            What we audit — and why it matters.
          </h2>
        </ScrollReveal>
        <PillarScrollReveal categories={auditCategories} />
      </section>

      {/* ═══════════════════════════════════════════════════════
          BEYOND THE REPORT — Animated scroll-driven features
          ═══════════════════════════════════════════════════════ */}
      <BeyondTheReport />

      {/* ═══════════════════════════════════════════════════════
          PRICING
          ═══════════════════════════════════════════════════════ */}
      <section id="pricing" className="relative py-32 sm:py-40 px-4 md:px-6 lg:px-8" style={{ background: 'var(--gradient-brand-subtle)' }}>
        <div className="max-w-4xl mx-auto relative">
          {/* Free Audit Banner */}
          {!user && (
            <ScrollReveal y={20}>
              <div className="rounded-xl p-6 sm:p-8 mb-12" style={{ background: '#B9FF66' }}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={18} className="text-[#111]" />
                      <h3 className="font-heading font-semibold text-xl text-[#111]">Start with a free audit</h3>
                    </div>
                    <p className="text-sm text-[#111]/60 max-w-md">
                      No credit card required. Run your first UX audit free, then choose a plan that scales with your team.
                    </p>
                  </div>
                  <Link
                    href="/register"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#111] text-[#B9FF66] text-[15px] font-semibold px-6 py-3 min-h-[48px] rounded-xl transition-all hover:brightness-105 hover:-translate-y-0.5 flex-shrink-0"
                  >
                    Start Free Audit
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </ScrollReveal>
          )}

          {/* Header */}
          <ScrollReveal className="mb-16 relative">
            <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.5rem] font-semibold text-text mb-3 tracking-tight" style={{ lineHeight: '1.1' }}>
              Transparent pricing
            </h2>
            <p className="text-muted text-base md:text-lg max-w-lg">
              Pay per audit. No subscription, no feature gates.<br />
              Every audit gets the full 64-checkpoint analysis — nothing locked behind tiers.
            </p>
          </ScrollReveal>

          {/* Single Audit */}
          <ScaleReveal>
            <div className="rounded-2xl border border-border/30 dark:border-white/[0.05] bg-card p-8 sm:p-10 mb-4 relative overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none">
              <div className="relative grid sm:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="font-heading text-2xl font-semibold text-text mb-1">Single audit</h3>
                  <p className="text-muted text-sm mb-6">For individuals and small teams</p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-muted text-lg">$</span>
                    <span className="font-heading text-6xl sm:text-7xl font-semibold text-text tracking-tight">99</span>
                  </div>
                  <p className="text-muted text-sm mb-8">One-time payment per audit</p>
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center gap-2 bg-text dark:bg-white text-white dark:text-gray-900 font-semibold text-[15px] rounded-xl px-6 py-3 min-h-[48px] hover:opacity-90 transition-opacity"
                  >
                    Buy 1 audit
                  </Link>
                </div>
                <div className="space-y-3.5">
                  {[
                    'Deep analysis across 16 UX categories',
                    'Findings ranked by severity & business impact',
                    'Track progress: mark findings as fixed, in progress, or backlog',
                    'Executive summary + detailed PDF & Word reports',
                    'Share results with your team via read-only links',
                    'Re-audit the same URL to measure your improvement over time',
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-text">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScaleReveal>

          {/* Divider */}
          <div className="flex items-center gap-4 my-10">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted font-medium tracking-wide uppercase">Need more audits? Save with packs</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Credit packs */}
          <StaggerReveal className="grid sm:grid-cols-3 gap-4" staggerDelay={0.12}>
            {[
              { name: 'Growth', credits: 5, price: 399, per: '$79.80', save: 19, desc: 'Quarterly audits to catch issues each release cycle', popular: false, perks: ['Priority email support'] },
              { name: 'Agency', credits: 15, price: 999, per: '$66.60', save: 33, desc: 'Manage multiple client sites with white-label reports', perks: ['Priority email support', 'White-label PDF reports'] },
              { name: 'Scale', credits: 50, price: 2499, per: '$49.98', save: 50, desc: 'Continuous auditing across teams and products', perks: ['Dedicated support', 'White-label PDF reports', 'API access (coming soon)'] },
            ].map((pack, idx) => (
              <StaggerItem key={idx}>
                <motion.div
                  className={`group rounded-2xl border bg-card p-7 transition-all duration-300 shadow-[0_1px_3px_rgba(0,0,0,0.03)] dark:shadow-none h-full flex flex-col ${(pack as any).popular ? 'border-accent ring-1 ring-accent/20' : 'border-border/30 dark:border-white/[0.05]'}`}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading font-semibold text-lg text-text">{pack.name}</h3>
                    {(pack as any).popular && <span className="text-[11px] font-bold bg-brand text-surface dark:text-[#111] px-3 py-1 rounded-lg">Most Popular</span>}
                    {!(pack as any).popular && <span className="text-xs font-bold text-white px-2.5 py-1 rounded-full bg-emerald-500">
                      Save {pack.save}%
                    </span>}
                  </div>
                  <div className="flex items-baseline gap-1 mb-0.5">
                    <span className="text-muted text-sm">$</span>
                    <span className="font-heading text-4xl font-semibold text-text">{pack.price.toLocaleString()}</span>
                  </div>
                  <p className="text-muted text-sm mb-5">
                    {pack.per} per audit <span className="opacity-40">·</span> {pack.credits} audits
                  </p>
                  <p className="text-xs text-muted mb-3">{pack.desc}</p>
                  {(pack as any).perks && (pack as any).perks.length > 0 && (
                    <div className="space-y-1.5 mb-5">
                      {(pack as any).perks.map((perk: string, pi: number) => (
                        <div key={pi} className="flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                          <span className="text-xs text-muted">{perk}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto">
                    <Link
                      href="/register"
                      className="flex items-center justify-center gap-2 text-sm font-semibold rounded-xl py-3 px-6 min-h-[44px] border border-border text-text hover:bg-text hover:text-white dark:hover:bg-white dark:hover:text-text transition-all duration-200"
                    >
                      Buy {pack.credits} audits
                    </Link>
                  </div>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerReveal>

          <AllAuditsInclude className="mt-14" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          CASE STUDIES placeholder
          ═══════════════════════════════════════════════════════ */}
      <section className="py-24 sm:py-32 px-4 md:px-6 lg:px-8 relative overflow-hidden" style={{ background: '#B9FF66' }}>
        <ScrollReveal className="max-w-2xl mx-auto text-center">
          <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-[#111] mb-4 tracking-tight">
            Case studies launching soon.
          </h2>
          <p className="text-[#111]/60 text-base leading-relaxed mb-8 max-w-md mx-auto">
            We&apos;d rather show you real client results than invent testimonials. Want to be one of the first?
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-[#111] text-[#B9FF66] text-[15px] font-semibold px-6 py-3 min-h-[48px] rounded-xl transition-all hover:brightness-110 hover:-translate-y-0.5"
          >
            Start your free audit
            <ArrowRight size={16} />
          </Link>
        </ScrollReveal>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FAQ
          ═══════════════════════════════════════════════════════ */}
      <section id="faq" className="py-32 sm:py-40 px-4 md:px-6 lg:px-8 bg-surface">
        <div className="max-w-2xl mx-auto">
          <ScrollReveal className="text-center mb-12">
            <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-text">FAQ</p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-text tracking-tight">
              Frequently asked questions
            </h2>
          </ScrollReveal>

          <StaggerReveal className="space-y-2" staggerDelay={0.08}>
            {TOP_FAQS.map((item, idx) => (
              <StaggerItem key={idx}>
                <details className="group rounded-2xl border border-border/30 dark:border-white/[0.05] bg-card overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none">
                  <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-off dark:hover:bg-white/[0.02] transition-colors">
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
              className="inline-flex items-center gap-2 text-sm font-semibold text-text hover:opacity-80 transition-opacity"
            >
              Read all FAQ
              <ArrowRight size={14} className="text-brand" />
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-36 sm:py-44 px-4 md:px-6 lg:px-8 overflow-hidden bg-[#B9FF66]">
        <ScrollReveal className="max-w-3xl mx-auto text-center relative z-10">
          <p className="text-[13px] font-semibold tracking-widest uppercase mb-6 text-[#111111]/60">Start your audit today</p>

          <h2 className="font-heading text-4xl sm:text-5xl md:text-6xl font-semibold text-[#111111] mb-6 tracking-tight" style={{ lineHeight: '1.08' }}>
            Ready to see what<br className="hidden sm:block" />
            you&apos;re missing?
          </h2>

          <p className="text-[#111111]/60 text-lg md:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
            Real findings your team can act on — prioritised by impact, trackable as you fix them, and re-auditable to prove the improvement. Delivered in minutes, not weeks.
          </p>

          <form onSubmit={handleHeroSubmit} className="max-w-lg mx-auto mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
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
                  className="w-full px-5 py-4 text-base rounded-xl bg-[#111111]/[0.06] border border-[#111111]/[0.10] text-[#111111] placeholder:text-[#111111]/30 focus:outline-none focus:border-[#111111]/30 focus:shadow-[0_0_0_3px_rgba(17,17,17,0.06)] transition-all"
                />
              </div>
              <button
                type="submit"
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] text-[15px] sm:px-8 sm:py-4 sm:text-base bg-[#111111] text-[#B9FF66] rounded-xl font-semibold transition-all hover:-translate-y-0.5 hover:bg-[#222222] flex-shrink-0"
              >
                {user ? 'Get My Audit' : 'Get Your Free UX Audit'}
                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold text-[#111111]/50">
            {user ? (
              <>
                <span>Track fixes over time</span>
                <span className="opacity-30">&middot;</span>
                <span>Share with your team</span>
                <span className="opacity-30">&middot;</span>
                <span>Re-audit to prove improvement</span>
              </>
            ) : (
              <>
                <span>First audit free</span>
                <span className="opacity-30">&middot;</span>
                <span>No credit card needed</span>
                <span className="opacity-30">&middot;</span>
                <span>Results in minutes</span>
              </>
            )}
          </div>

          <p className="text-[#111111]/50 text-sm mt-6">
            Have questions? <a href="mailto:support@clearux.ai" className="underline hover:text-[#111111] transition-colors">support@clearux.ai</a> or <Link href="/contact" className="underline hover:text-[#111111] transition-colors">contact us</Link>
          </p>
        </ScrollReveal>
      </section>

      </main>
      <Footer />
    </div>
  );
}
