'use client';

import { useState, useEffect, useRef } from 'react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { Brain, CheckCircle, Star, Eye, Target, Map, MousePointerClick, Zap, Smartphone, Shield, Type, Gauge, ArrowRight, Users, FileCheck, Cpu, BarChart3, Layers, Accessibility } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { HomeJsonLd } from "@/components/seo/JsonLd";
import { useUser } from '@/hooks/useUser';

/* ── Animated counter hook ───────────────────────────────── */
function useCountUp(end: number, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!startOnView) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const tick = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * end));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [end, duration, startOnView]);

  return { count, ref };
}

/* ── Fade-in on scroll ───────────────────────────────────── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

/* ── Avatar stack ────────────────────────────────────────── */
const AVATAR_PEOPLE = [
  { initials: 'SC', bg: '#3ECF8E' },
  { initials: 'MW', bg: '#6366F1' },
  { initials: 'ER', bg: '#F59E0B' },
  { initials: 'JK', bg: '#EC4899' },
  { initials: 'DT', bg: '#14B8A6' },
];

function AvatarStack() {
  return (
    <div className="flex items-center -space-x-2">
      {AVATAR_PEOPLE.map((p, i) => (
        <div
          key={i}
          className="w-8 h-8 rounded-full border-2 border-white dark:border-[#1C1C1C] flex items-center justify-center text-white text-[10px] font-bold shadow-sm animate-scale-in"
          style={{ backgroundColor: p.bg, zIndex: AVATAR_PEOPLE.length - i, animationDelay: `${800 + i * 80}ms` }}
        >
          {p.initials}
        </div>
      ))}
    </div>
  );
}

/* ── Rotating audit dimensions for hero ─────────────────── */
const HERO_DIMENSIONS = [
  'Conversion Rate',
  'Usability',
  'AI Discoverability',
  'Visual Hierarchy',
  'Mobile Experience',
  'Site Structure',
  'Content Clarity',
  'Accessibility',
  'Navigation Flow',
  'Trust & Credibility',
]

function RotatingDimension() {
  const [idx, setIdx] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIdx((i) => (i + 1) % HERO_DIMENSIONS.length)
        setFade(true)
      }, 300)
    }, 2600)
    return () => clearInterval(interval)
  }, [])

  return (
    <span className="inline-block overflow-visible pb-2">
      <span
        className={`inline-block transition-all duration-300 bg-gradient-to-r from-[#3ECF8E] via-[#2EAF6E] to-[#24B47E] bg-clip-text text-transparent ${
          fade ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
        }`}
      >
        {HERO_DIMENSIONS[idx]}
      </span>
    </span>
  )
}

/* ── Floating decorative orbs ────────────────────────────── */
function FloatingOrbs() {
  return (
    <>
      <div className="absolute top-20 left-[10%] w-3 h-3 rounded-full bg-accent/30 animate-float" style={{ animationDelay: '0s' }} />
      <div className="absolute top-40 right-[15%] w-2 h-2 rounded-full bg-accent/20 animate-float" style={{ animationDelay: '1s' }} />
      <div className="absolute bottom-32 left-[20%] w-2.5 h-2.5 rounded-full bg-accent/25 animate-float-slow" style={{ animationDelay: '2s' }} />
      <div className="absolute top-60 right-[8%] w-4 h-4 rounded-full bg-accent/15 animate-float-slow" style={{ animationDelay: '3s' }} />
      <div className="absolute bottom-20 right-[25%] w-2 h-2 rounded-full bg-purple-400/20 animate-float" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-28 left-[35%] w-1.5 h-1.5 rounded-full bg-blue-400/25 animate-float-slow" style={{ animationDelay: '0.5s' }} />
    </>
  );
}

export default function Home() {
  const router = useRouter();
  const { user } = useUser();
  const [heroUrl, setHeroUrl] = useState('');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = heroUrl.trim();
    if (!trimmed) return;
    const encoded = encodeURIComponent(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    router.push(user ? `/dashboard/new-audit?url=${encoded}` : `/register?url=${encoded}`);
  };

  // Counters — keep numbers honest and verifiable
  const c1 = useCountUp(48, 1600);
  const c2 = useCountUp(12, 1400);
  const c3 = useCountUp(100, 1800);
  const c4 = useCountUp(6, 1200);

  // Scroll reveals
  const howRef = useScrollReveal();
  const catRef = useScrollReveal();
  const prevRef = useScrollReveal();
  const priceRef = useScrollReveal();
  const testRef = useScrollReveal();

  const auditCategories = [
    { icon: Eye, title: "First Impression", description: "How users perceive your product at first glance" },
    { icon: Brain, title: "AI Discoverability", description: "SEO and AI model indexing optimisation", featured: true },
    { icon: Target, title: "Value Proposition", description: "Clear communication of your unique value" },
    { icon: Map, title: "Navigation", description: "Intuitive structure and findability" },
    { icon: MousePointerClick, title: "Conversion & CTAs", description: "Effective call-to-actions and conversion paths" },
    { icon: Zap, title: "Onboarding", description: "Seamless user onboarding experience" },
    { icon: Smartphone, title: "Mobile Experience", description: "Responsive and optimized mobile design" },
    { icon: Shield, title: "Trust & Credibility", description: "Security and trustworthiness signals" },
    { icon: Type, title: "Content & Copy", description: "Clear, compelling, and well-structured messaging" },
    { icon: Gauge, title: "Performance", description: "Speed, load times, and responsiveness" },
    { icon: Layers, title: "Visual Hierarchy", description: "Layout flow, spacing, and element prioritisation" },
    { icon: Accessibility, title: "Accessibility", description: "Inclusive design for all users and assistive tech" },
  ];

  const testimonials = [
    { quote: "ClearUX identified critical issues we completely missed. The audit was thorough and actionable.", author: "Sarah Chen", title: "Product Manager", company: "TechFlow" },
    { quote: "Worth every penny. We implemented the recommendations and saw a 34% increase in conversions.", author: "Marcus Webb", title: "Founder", company: "Velocity Labs" },
    { quote: "The AI-powered analysis is impressive. It caught UX issues that our internal team had overlooked for months.", author: "Elena Rodriguez", title: "Design Lead", company: "Creative Studio Inc" },
  ];

  return (
    <div className="bg-surface">
      <HomeJsonLd />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold">
        Skip to content
      </a>
      <Navbar />
      <main id="main-content">

      {/* ═══════════════════════════════════════════════════════
          HERO
          ═══════════════════════════════════════════════════════ */}
      <section className="relative pt-32 pb-28 px-4 md:px-6 lg:px-8 overflow-hidden">
        {/* ── Animated dot grid ── */}
        <div className="absolute inset-0 overflow-hidden" style={{ zIndex: -3 }}>
          <div
            className="absolute -inset-20 animate-grid-drift"
            style={{
              backgroundImage: `radial-gradient(circle, rgba(62,207,142,0.22) 1px, transparent 1px)`,
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        {/* ── Light green gradient wash across the hero ── */}
        <div
          className="absolute inset-0"
          style={{
            zIndex: -2,
            background: `
              radial-gradient(ellipse 70% 60% at 30% 20%, rgba(62,207,142,0.07) 0%, transparent 70%),
              radial-gradient(ellipse 50% 50% at 75% 60%, rgba(62,207,142,0.05) 0%, transparent 70%),
              radial-gradient(ellipse 90% 80% at 50% 50%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.95) 100%)
            `,
          }}
        />

        {/* ── Animated green aurora blobs ── */}
        <div
          className="absolute rounded-full animate-glow-pulse"
          style={{ zIndex: -1, width: 800, height: 600, top: '-10%', left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(ellipse at center, rgba(62,207,142,0.08) 0%, transparent 70%)' }}
        />
        <div
          className="absolute rounded-full animate-glow-pulse"
          style={{ zIndex: -1, width: 500, height: 500, top: '5%', right: '-5%', background: 'radial-gradient(ellipse at center, rgba(62,207,142,0.06) 0%, transparent 70%)', animationDelay: '2s' }}
        />
        <div
          className="absolute rounded-full animate-glow-pulse"
          style={{ zIndex: -1, width: 400, height: 400, bottom: '0%', left: '5%', background: 'radial-gradient(ellipse at center, rgba(62,207,142,0.05) 0%, transparent 70%)', animationDelay: '4s' }}
        />

        {/* Floating orbs */}
        <FloatingOrbs />

        <div className="max-w-6xl mx-auto text-center relative">
          {/* Pill badge */}
          <div className="animate-fade-up inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-accent/10 border border-accent/20 mb-8">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-sm font-bold text-accent tracking-wide uppercase">AI-Powered UX Audit — 48 Checkpoints</span>
          </div>

          <h1 className="animate-fade-up delay-100 font-manrope text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 pb-1 text-text" style={{ lineHeight: '1.2' }}>
            Find &amp; Fix Hidden UX Issues<br className="hidden md:block" />{' '}
            Impacting <RotatingDimension />
          </h1>

          <p className="animate-fade-up delay-200 text-lg md:text-xl text-muted mb-3 max-w-2xl mx-auto" style={{ lineHeight: '1.7' }}>
            Your site is losing customers to UX issues you can&rsquo;t see &mdash; slow load times, confusing navigation, weak CTAs, and poor mobile experience.
          </p>
          <p className="animate-fade-up delay-200 text-lg md:text-xl text-text font-semibold mb-10 max-w-2xl mx-auto" style={{ lineHeight: '1.7' }}>
            Our AI audits <span className="text-accent font-bold">48 checkpoints</span> across <span className="text-accent font-bold">12 categories</span> and delivers a prioritised action plan in minutes &mdash; not weeks.
          </p>

          {/* Social proof — above form */}
          <div className="animate-fade-up delay-300 flex justify-center mb-8">
            <div className="flex items-center gap-3">
              <AvatarStack />
              <p className="text-sm text-muted">
                Trusted by product teams &amp; agencies worldwide
              </p>
            </div>
          </div>

          {/* Hero URL Input */}
          <form onSubmit={handleHeroSubmit} className="animate-fade-up delay-400 max-w-2xl mx-auto mb-10">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <label htmlFor="hero-url-input" className="sr-only">Website URL to audit</label>
                <input
                  id="hero-url-input"
                  type="url"
                  value={heroUrl}
                  onChange={(e) => setHeroUrl(e.target.value)}
                  placeholder="Enter your website URL..."
                  aria-label="Website URL to audit"
                  className="w-full px-5 py-4 text-base border-2 border-border rounded-xl bg-card text-text placeholder:text-placeholder focus:outline-none focus:border-accent focus:shadow-[0_0_0_4px_rgba(62,207,142,0.1)] transition-all"
                />
              </div>
              <button
                type="submit"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-accent text-white rounded-xl font-semibold hover:bg-accent-dk transition-all shadow-lg hover:shadow-xl hover:shadow-accent/20 flex-shrink-0"
              >
                Audit My Site Now
                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            {/* Language availability — left-aligned under input */}
            <div className="flex items-center gap-1.5 mt-2.5 text-xs text-muted">
              <span>Now in</span>
              <span className="inline-flex items-center gap-1">🇬🇧 EN</span>
              <span className="opacity-30">·</span>
              <span className="inline-flex items-center gap-1">🇪🇸 ES</span>
              <span className="opacity-30">·</span>
              <span className="inline-flex items-center gap-1">🇫🇷 FR</span>
              <span className="opacity-30">·</span>
              <span className="inline-flex items-center gap-1">🇩🇪 DE</span>
              <span className="opacity-30">·</span>
              <span className="inline-flex items-center gap-1">🇮🇹 IT</span>
              <span className="opacity-30">·</span>
              <span className="inline-flex items-center gap-1">🇧🇷 PT</span>
            </div>
          </form>

          {/* Pricing pill badge */}
          <div className="animate-fade-up delay-500 flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent/10 border border-accent/20">
              <CheckCircle size={14} className="text-accent" />
              <span className="text-sm font-semibold text-accent">Start with 1 audit for $29 &mdash; No subscription required</span>
            </div>
          </div>

          <div className="animate-fade-up delay-600 flex justify-center mb-10">
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-accent hover:text-accent-dk transition-colors"
            >
              See how it works ↓
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          TRUST NUMBERS — animated counters
          ═══════════════════════════════════════════════════════ */}
      <section className="py-20 px-4 md:px-6 lg:px-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0D1F17 0%, #122B1E 40%, #0A1F14 100%)' }}>
        {/* Grid overlay on dark green */}
        <div
          className="absolute inset-0 -z-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(62,207,142,0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(62,207,142,0.08) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
        {/* Glow behind section */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-accent/10 blur-[120px] -z-0" />

        <div className="max-w-5xl mx-auto relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-6">
            {[
              { counter: c1, suffix: '', label: 'Deep UX Checkpoints', icon: BarChart3 },
              { counter: c2, suffix: '', label: 'Audit Categories', icon: Layers },
              { counter: c3, suffix: '%', label: 'AI Powered', icon: Cpu },
              { counter: c4, suffix: '', label: 'Languages Supported', icon: Users },
            ].map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div
                  key={idx}
                  ref={stat.counter.ref}
                  className="flex flex-col items-center text-center group"
                >
                  <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-sm flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-white/15 transition-all duration-300">
                    <Icon size={32} className="text-accent" />
                  </div>
                  <p className="font-manrope text-4xl md:text-5xl font-extrabold mb-1 tabular-nums tracking-tight text-white" suppressHydrationWarning>
                    {mounted ? stat.counter.count : '\u00A0'}
                    {mounted ? stat.suffix : ''}
                  </p>
                  <p className="text-white/60 text-sm font-medium">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          HOW IT WORKS
          ═══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 px-4 md:px-6 lg:px-8 relative overflow-hidden">
        {/* Subtle background accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-[120px] -z-10" />

        <div
          ref={howRef.ref}
          className={`max-w-5xl mx-auto transition-all duration-700 ${howRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold tracking-widest text-accent uppercase mb-3">How it works</span>
            <h2 className="font-manrope text-4xl md:text-5xl font-bold text-text mb-4">
              Three steps. That&apos;s it.
            </h2>
            <p className="text-muted text-lg max-w-xl mx-auto">
              You give us the link. We do all the work. You get a professional report.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* Connecting line behind cards (desktop only) */}
            <div className="hidden md:block absolute top-[72px] left-[16.66%] right-[16.66%] h-0.5 bg-gradient-to-r from-accent/20 via-accent/40 to-accent/20 -z-0" />

            {[
              { step: '1', icon: Target, title: 'Paste your URL', description: 'Just the link — we automatically detect your industry, business model, target audience, and tech stack.', gradient: 'from-accent/10 to-emerald-500/5' },
              { step: '2', icon: Brain, title: 'AI audits your site', description: 'We crawl your website and evaluate it against 48 checkpoints across 12 UX categories. No manual work needed.', gradient: 'from-blue-500/10 to-accent/5' },
              { step: '3', icon: FileCheck, title: 'Get your report', description: 'A detailed PDF report with scores, prioritized issues, and actionable recommendations — ready in minutes.', gradient: 'from-purple-500/10 to-accent/5' },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="relative group"
                  style={howRef.visible ? { animation: `fade-up 0.6s ease-out ${300 + idx * 150}ms both` } : { opacity: 0 }}
                >
                  <div className={`bg-gradient-to-br ${item.gradient} rounded-2xl border border-border p-8 h-full hover:shadow-xl hover:border-accent/30 hover:-translate-y-1 transition-all duration-300`}>
                    {/* Step number + icon */}
                    <div className="flex items-center justify-center mb-6">
                      <div className="relative">
                        <div className="w-[72px] h-[72px] rounded-2xl bg-card border border-border shadow-lg flex items-center justify-center group-hover:shadow-xl group-hover:border-accent/30 transition-all duration-300">
                          <Icon size={32} className="text-accent" />
                        </div>
                        <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center font-manrope font-bold text-xs shadow-md shadow-accent/30">
                          {item.step}
                        </div>
                      </div>
                    </div>

                    <h3 className="font-manrope text-xl font-bold text-text mb-3 text-center">{item.title}</h3>
                    <p className="text-muted text-sm leading-relaxed text-center">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          WHAT WE AUDIT
          ═══════════════════════════════════════════════════════ */}
      <section id="features" className="py-24 px-4 md:px-6 lg:px-8 bg-off">
        <div
          ref={catRef.ref}
          className={`max-w-6xl mx-auto transition-all duration-700 ${catRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <h2 className="font-manrope text-4xl font-bold text-center text-text mb-4">
            Comprehensive UX Analysis
          </h2>
          <p className="text-center text-muted text-lg mb-16 max-w-2xl mx-auto">
            We evaluate 12 critical categories with 48 detailed checklist items.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {auditCategories.map((category, idx) => {
              const IconComponent = category.icon;
              const isFeatured = 'featured' in category && category.featured;
              return (
                <div
                  key={idx}
                  className={`rounded-xl p-6 border hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group ${
                    isFeatured
                      ? 'bg-gradient-to-br from-accent/10 via-card to-accent/5 border-accent/40 shadow-lg shadow-accent/10 ring-1 ring-accent/20'
                      : 'bg-card border-border hover:border-accent/30'
                  }`}
                  style={catRef.visible ? { animationDelay: `${idx * 60}ms` } : undefined}
                >
                  {isFeatured && (
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2.5 py-0.5 rounded-full mb-3">
                      New & Essential
                    </span>
                  )}
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-all duration-300 ${
                    isFeatured ? 'bg-accent/20 group-hover:bg-accent/30' : 'bg-accent/10 group-hover:bg-accent/20'
                  }`}>
                    <IconComponent className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-manrope text-lg font-bold text-text mb-2">{category.title}</h3>
                  <p className="text-muted text-sm">{category.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SAMPLE REPORT PREVIEW
          ═══════════════════════════════════════════════════════ */}
      <section className="py-24 px-4 md:px-6 lg:px-8">
        <div
          ref={prevRef.ref}
          className={`max-w-6xl mx-auto transition-all duration-700 ${prevRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <h2 className="font-manrope text-4xl font-bold text-center text-text mb-4">
            What you'll receive
          </h2>
          <p className="text-center text-muted text-lg mb-16 max-w-2xl mx-auto">
            A detailed report with scores, insights, and actionable recommendations.
          </p>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="bg-gradient-to-br from-accent/5 via-surface to-accent/5 rounded-2xl p-8 border border-border hover:shadow-xl transition-shadow duration-500">
              <div className="text-center mb-8">
                <p className="text-muted text-sm font-semibold mb-2">Overall Score</p>
                <div className="w-32 h-32 rounded-full border-4 border-accent mx-auto flex items-center justify-center shadow-lg shadow-accent/10">
                  <span className="font-manrope text-5xl font-bold text-accent">78</span>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: "First Impression", score: 82 },
                  { label: "Navigation", score: 75 },
                  { label: "Mobile Experience", score: 72 },
                  { label: "Conversion & CTAs", score: 78 },
                ].map((cat, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-text font-medium">{cat.label}</span>
                      <span className="text-accent font-bold">{cat.score}</span>
                    </div>
                    <div className="w-full bg-off rounded-full h-2 border border-border overflow-hidden">
                      <div
                        className="bg-accent h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ width: prevRef.visible ? `${cat.score}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {[
                { dot: 'bg-red-500', title: 'CTA buttons lack urgency', badge: 'Critical', badgeClass: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300', desc: 'Primary CTAs blend in with secondary elements. Consider stronger color contrast and micro-copy that creates urgency.' },
                { dot: 'bg-yellow-500', title: 'Mobile nav menu hidden', badge: 'Warning', badgeClass: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300', desc: 'Navigation requires horizontal scrolling on mobile devices, impacting discoverability.' },
                { dot: 'bg-green-500', title: 'Strong value proposition', badge: 'Strength', badgeClass: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300', desc: 'Above-the-fold messaging clearly communicates core benefits.' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="bg-card border border-border rounded-xl p-6 hover:shadow-lg hover:border-accent/20 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-2 h-2 rounded-full ${item.dot} mt-2 flex-shrink-0`} />
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-manrope font-bold text-text">{item.title}</h4>
                        <span className={`text-xs ${item.badgeClass} px-2 py-1 rounded font-semibold`}>{item.badge}</span>
                      </div>
                      <p className="text-muted text-sm">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          PRICING
          ═══════════════════════════════════════════════════════ */}
      <section id="pricing" className="relative py-28 px-4 md:px-6 lg:px-8 bg-[#0F172A] overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(62,207,142,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(62,207,142,.5) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-accent/[0.06] blur-3xl pointer-events-none" />

        <div
          ref={priceRef.ref}
          className={`relative z-10 max-w-6xl mx-auto transition-all duration-700 ${priceRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-14">
            <span className="inline-block text-accent text-xs font-bold uppercase tracking-widest mb-4">Pricing</span>
            <h2 className="font-manrope text-4xl sm:text-5xl font-bold text-white mb-4">
              Simple credit-based pricing
            </h2>
            <p className="text-slate-400 text-lg mb-4 max-w-2xl mx-auto">
              Every audit is a full deep-dive across all 48 checkpoints. Buy more credits, pay less per audit.
            </p>
            <p className="text-accent font-semibold text-sm">
              1 credit = 1 full audit. No tiers. No feature limits.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { name: 'Starter', credits: 1, price: 29, per: '$29', save: null, cta: 'Start Auditing', popular: false },
              { name: 'Growth', credits: 5, price: 99, per: '$19.80', save: 'Save 32%', cta: 'Get 5 Audits', popular: true },
              { name: 'Agency', credits: 15, price: 249, per: '$16.60', save: 'Save 43%', cta: 'Get 15 Audits', popular: false },
              { name: 'Scale', credits: 50, price: 599, per: '$11.98', save: 'Save 59%', cta: 'Get 50 Audits', popular: false },
            ].map((tier, idx) => (
              <div
                key={idx}
                className={`relative rounded-2xl p-6 flex flex-col hover:-translate-y-1 transition-all duration-300 backdrop-blur-sm ${
                  tier.popular
                    ? 'bg-white border-2 border-accent shadow-xl shadow-accent/15'
                    : 'bg-white/[0.07] border border-white/[0.12] hover:bg-white/[0.10] hover:shadow-xl hover:shadow-black/20'
                }`}
              >
                {tier.popular && (
                  <span className="absolute -top-2.5 right-4 bg-accent text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-md">
                    Customers Favourite
                  </span>
                )}

                <h3 className={`font-manrope font-bold text-lg mb-1 ${tier.popular ? 'text-[#0F172A]' : 'text-white'}`}>
                  {tier.name}
                </h3>

                <div className="mb-1">
                  <span className={`font-manrope text-3xl font-bold ${tier.popular ? 'text-[#0F172A]' : 'text-white'}`}>
                    ${tier.price}
                  </span>
                </div>

                <p className={`text-xs mb-4 ${tier.popular ? 'text-slate-500' : 'text-slate-400'}`}>
                  {tier.credits} credit{tier.credits !== 1 ? 's' : ''} &middot; {tier.per}/audit
                </p>

                {tier.save && (
                  <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mb-4 ${
                    tier.popular ? 'bg-accent/10 text-accent' : 'bg-accent/20 text-accent'
                  }`}>
                    {tier.save}
                  </div>
                )}
                {!tier.save && <div className="mb-4" />}

                <div className="space-y-2 mb-6 flex-1">
                  {[
                    '48-point deep analysis',
                    '12 UX categories',
                    'AI discoverability audit',
                    'PDF + DOCX reports',
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 text-accent" />
                      <span className={`text-xs ${tier.popular ? 'text-slate-600' : 'text-slate-300'}`}>{f}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/register"
                  className="block text-center text-sm font-bold rounded-lg py-2.5 transition-all bg-accent text-white hover:bg-accent-dk shadow-lg shadow-accent/25"
                >
                  {tier.cta} &rarr;
                </Link>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-4 mt-10">
            <p className="text-center text-slate-400 text-xs">
              Credits never expire. Use them whenever you need. Secure payment via Stripe.
            </p>
            <div className="flex items-center gap-4">
              {/* Official Stripe logo — white version for dark bg */}
              <svg width="68" height="28" viewBox="54 36 360.02 149.84" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" fill="#ffffff" fillOpacity="0.7" d="M414,113.4c0-25.6-12.4-45.8-36.1-45.8c-23.8,0-38.2,20.2-38.2,45.6c0,30.1,17,45.3,41.4,45.3 c11.9,0,20.9-2.7,27.7-6.5v-20c-6.8,3.4-14.6,5.5-24.5,5.5c-9.7,0-18.3-3.4-19.4-15.2h48.9C413.8,121,414,115.8,414,113.4z M364.6,103.9c0-11.3,6.9-16,13.2-16c6.1,0,12.6,4.7,12.6,16H364.6z"/>
                <path fillRule="evenodd" clipRule="evenodd" fill="#ffffff" fillOpacity="0.7" d="M301.1,67.6c-9.8,0-16.1,4.6-19.6,7.8l-1.3-6.2h-22v116.6l25-5.3l0.1-28.3c3.6,2.6,8.9,6.3,17.7,6.3 c17.9,0,34.2-14.4,34.2-46.1C335.1,83.4,318.6,67.6,301.1,67.6z M295.1,136.5c-5.9,0-9.4-2.1-11.8-4.7l-0.1-37.1 c2.6-2.9,6.2-4.9,11.9-4.9c9.1,0,15.4,10.2,15.4,23.3C310.5,126.5,304.3,136.5,295.1,136.5z"/>
                <polygon fillRule="evenodd" clipRule="evenodd" fill="#ffffff" fillOpacity="0.7" points="223.8,61.7 248.9,56.3 248.9,36 223.8,41.3"/>
                <rect x="223.8" y="69.3" fillRule="evenodd" clipRule="evenodd" fill="#ffffff" fillOpacity="0.7" width="25.1" height="87.5"/>
                <path fillRule="evenodd" clipRule="evenodd" fill="#ffffff" fillOpacity="0.7" d="M196.9,76.7l-1.6-7.4h-21.6v87.5h25V97.5c5.9-7.7,15.9-6.3,19-5.2v-23C214.5,68.1,202.8,65.9,196.9,76.7z"/>
                <path fillRule="evenodd" clipRule="evenodd" fill="#ffffff" fillOpacity="0.7" d="M146.9,47.6l-24.4,5.2l-0.1,80.1c0,14.8,11.1,25.7,25.9,25.7c8.2,0,14.2-1.5,17.5-3.3V135 c-3.2,1.3-19,5.9-19-8.9V90.6h19V69.3h-19L146.9,47.6z"/>
                <path fillRule="evenodd" clipRule="evenodd" fill="#ffffff" fillOpacity="0.7" d="M79.3,94.7c0-3.9,3.2-5.4,8.5-5.4c7.6,0,17.2,2.3,24.8,6.4V72.2c-8.3-3.3-16.5-4.6-24.8-4.6 C67.5,67.6,54,78.2,54,95.9c0,27.6,38,23.2,38,35.1c0,4.6-4,6.1-9.6,6.1c-8.3,0-18.9-3.4-27.3-8v23.8c9.3,4,18.7,5.7,27.3,5.7 c20.8,0,35.1-10.3,35.1-28.2C117.4,100.6,79.3,105.9,79.3,94.7z"/>
              </svg>
              {/* Verified & Secure shield */}
              <div className="flex items-center gap-2">
                <svg width="22" height="26" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 0L0 3v5.5c0 4.7 3.4 9.1 8 9.5 4.6-.4 8-4.8 8-9.5V3L8 0z" fill="#3ECF8E" fillOpacity="0.2" stroke="#3ECF8E" strokeWidth="1.2"/>
                  <path d="M5.5 9l2 2L11 7" stroke="#3ECF8E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-sm font-semibold text-white/60">Verified & Secure</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          TESTIMONIALS
          ═══════════════════════════════════════════════════════ */}
      <section className="py-24 px-4 md:px-6 lg:px-8">
        <div
          ref={testRef.ref}
          className={`max-w-6xl mx-auto transition-all duration-700 ${testRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <h2 className="font-manrope text-4xl font-bold text-center text-text mb-4">
            Loved by product teams
          </h2>
          <p className="text-center text-muted text-lg mb-16 max-w-2xl mx-auto">
            See what our customers have to say about their ClearUX experience.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, idx) => (
              <div
                key={idx}
                className="bg-card border border-border rounded-xl p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-text mb-6 italic leading-relaxed">"{testimonial.quote}"</p>
                <div className="pt-6 border-t border-border flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                    style={{ backgroundColor: AVATAR_PEOPLE[idx % AVATAR_PEOPLE.length].bg }}
                  >
                    {testimonial.author.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-semibold text-text text-sm">{testimonial.author}</p>
                    <p className="text-xs text-muted">{testimonial.title} at {testimonial.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FAQ
          ═══════════════════════════════════════════════════════ */}
      <section id="faq" className="py-24 px-4 md:px-6 lg:px-8 bg-off">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-manrope text-4xl font-bold text-center text-text mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-center text-muted text-lg mb-12 max-w-2xl mx-auto">
            Everything you need to know about ClearUX audits.
          </p>
          <div className="space-y-4">
            {[
              { q: 'How long does an audit take?', a: 'Most audits complete in under 10 minutes. Our AI crawls your website, analyses every page against 48 checkpoints across 12 UX categories, and generates a full professional report with prioritised recommendations.' },
              { q: 'What does the audit cover?', a: 'We evaluate 12 critical UX categories: First Impression & Visual Design, AI Discoverability, Value Proposition, Navigation, Conversion & CTAs, Onboarding, Mobile Experience, Trust & Credibility, Content Quality, Performance, Visual Hierarchy, and Accessibility.' },
              { q: 'How do credits work?', a: 'One credit equals one full audit of any website. Credits never expire. There are no feature tiers or limits \u2014 every audit includes all 48 checkpoints, PDF & Word reports, and prioritised recommendations.' },
              { q: 'What format is the report?', a: 'You get both a professional PDF report and a downloadable Word document. Reports include an overall score, category breakdowns, detailed findings with severity levels, and actionable recommendations for each issue.' },
              { q: 'Can I audit any website?', a: 'Yes. ClearUX works with any publicly accessible URL. Our crawler handles JavaScript-rendered sites, single-page applications, and multi-page websites. We automatically detect your industry, tech stack, and target audience.' },
              { q: 'Is my data secure?', a: 'Absolutely. We only analyse publicly visible content on your website. Payments are processed securely via Stripe. We do not store or share your website data beyond generating your audit report.' },
              { q: 'What languages are supported?', a: 'Audit reports are available in 6 languages: English, Spanish, French, German, Italian, and Portuguese. The AI generates findings and recommendations natively in your chosen language.' },
              { q: 'Can I get a refund?', a: 'If you are unsatisfied with an audit result, contact us at support@clearux.ai and we will work with you to resolve the issue or provide a credit for a new audit.' },
            ].map((item, idx) => (
              <details key={idx} className="group bg-card border border-border rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-off/50 transition-colors">
                  <h3 className="font-semibold text-text text-sm pr-4">{item.q}</h3>
                  <ArrowRight size={16} className="text-muted flex-shrink-0 transform group-open:rotate-90 transition-transform" />
                </summary>
                <div className="px-5 pb-5">
                  <p className="text-muted text-sm leading-relaxed">{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 px-4 md:px-6 lg:px-8 bg-navy overflow-hidden">
        {/* Grid in CTA too */}
        <div
          className="absolute inset-0 -z-0"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(62,207,142,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(62,207,142,0.08) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="font-manrope text-5xl font-bold text-white dark:text-black mb-6">
            Ready to improve your UX?
          </h2>
          <p className="text-xl text-white/60 dark:text-black/60 mb-8 max-w-2xl mx-auto">
            Get your comprehensive audit report in under 1 hour.
          </p>
          <Link
            href="/register"
            className="group inline-flex items-center justify-center gap-2 px-10 py-5 bg-accent text-white rounded-xl text-lg font-bold hover:bg-accent-dk transition-all duration-200 shadow-lg shadow-accent/20"
          >
            Audit My Site Now
            <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <p className="text-white/40 text-sm mt-4">No subscription required. Results in minutes.</p>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  );
}
