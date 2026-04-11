'use client';

import { useState, useEffect, useRef } from 'react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { Brain, CheckCircle, Star, Eye, Target, Map, MousePointerClick, Zap, Smartphone, Shield, Type, Gauge, ArrowRight, ArrowUp, Layers, Accessibility, FileCheck, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { HomeJsonLd } from "@/components/seo/JsonLd";
import { useUser } from '@/hooks/useUser';

/* ── Animated counter ────────────────────────────────────── */
function useCountUp(end: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useEffect(() => {
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
  }, [end, duration]);
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

/* ── Rotating words — fixed to always keep 2-line headline ── */
const HERO_WORDS = ['Conversions', 'Usability', 'Engagement', 'Accessibility', 'Mobile UX', 'Trust'];

function RotatingWord() {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => { setIdx((i) => (i + 1) % HERO_WORDS.length); setFade(true); }, 200);
    }, 2800);
    return () => clearInterval(interval);
  }, []);
  return (
    <span
      className={`transition-opacity duration-300 bg-gradient-to-r from-accent via-purple-400 to-accent bg-clip-text text-transparent ${fade ? 'opacity-100' : 'opacity-0'}`}
    >
      {HERO_WORDS[idx]}
    </span>
  );
}

/* ── Rotating testimonials ──────────────────────────────── */
function RotatingReview({ reviews }: { reviews: { quote: string; author: string; title: string; company: string; initials: string }[] }) {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);

  const next = () => { setFade(false); setTimeout(() => { setIdx((i) => (i + 1) % reviews.length); setFade(true); }, 250); };
  const prev = () => { setFade(false); setTimeout(() => { setIdx((i) => (i - 1 + reviews.length) % reviews.length); setFade(true); }, 250); };

  useEffect(() => {
    const interval = setInterval(next, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = reviews[idx];
  return (
    <div className="relative max-w-2xl mx-auto text-center">
      <div className={`transition-opacity duration-300 ${fade ? 'opacity-100' : 'opacity-0'}`}>
        <p className="text-text text-base md:text-lg font-medium mb-4 leading-relaxed">&ldquo;{r.quote}&rdquo;</p>
        <div className="flex items-center justify-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">{r.initials}</div>
          <div className="text-left">
            <p className="text-text text-sm font-semibold">{r.author}</p>
            <p className="text-muted text-xs">{r.title}, {r.company}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 mt-5">
        <button onClick={prev} aria-label="Previous review" className="w-8 h-8 rounded-full border border-border/40 dark:border-white/[0.04] bg-card hover:border-accent/40 flex items-center justify-center transition-colors">
          <ChevronLeft size={14} className="text-muted" />
        </button>
        <div className="flex gap-1.5">
          {reviews.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-accent w-4' : 'bg-border'}`} />
          ))}
        </div>
        <button onClick={next} aria-label="Next review" className="w-8 h-8 rounded-full border border-border/40 dark:border-white/[0.04] bg-card hover:border-accent/40 flex items-center justify-center transition-colors">
          <ChevronRight size={14} className="text-muted" />
        </button>
      </div>
    </div>
  );
}

/* ── Scroll-to-top button ───────────────────────────────── */
function ScrollToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-accent text-white shadow-lg shadow-accent/30 flex items-center justify-center hover:bg-accent-dk transition-all hover:scale-105"
    >
      <ArrowUp size={18} />
    </button>
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

  // Animated counters
  const c1 = useCountUp(48, 1800);
  const c2 = useCountUp(12, 1400);
  const c3 = useCountUp(6, 1200);
  const c4 = useCountUp(10, 1000);

  const howRef = useScrollReveal();
  const catRef = useScrollReveal();
  const previewRef = useScrollReveal();
  const priceRef = useScrollReveal();
  const testRef = useScrollReveal();
  const faqRef = useScrollReveal();

  const auditCategories = [
    { icon: Eye, title: "First Impression", desc: "How users perceive your product at first glance" },
    { icon: Brain, title: "AI Discoverability", desc: "SEO and AI model indexing optimisation", featured: true },
    { icon: Target, title: "Value Proposition", desc: "Clear communication of your unique value" },
    { icon: Map, title: "Navigation", desc: "Intuitive structure and findability" },
    { icon: MousePointerClick, title: "Conversion & CTAs", desc: "Effective call-to-actions and conversion paths" },
    { icon: Zap, title: "Onboarding", desc: "Seamless user onboarding experience" },
    { icon: Smartphone, title: "Mobile Experience", desc: "Responsive and optimized mobile design" },
    { icon: Shield, title: "Trust & Credibility", desc: "Security and trustworthiness signals" },
    { icon: Type, title: "Content & Copy", desc: "Clear, compelling, well-structured messaging" },
    { icon: Gauge, title: "Performance", desc: "Speed, load times, and responsiveness" },
    { icon: Layers, title: "Visual Hierarchy", desc: "Layout flow, spacing, and element prioritisation" },
    { icon: Accessibility, title: "Accessibility", desc: "Inclusive design for all users and assistive tech" },
  ];

  const testimonials = [
    { quote: "ClearUX identified critical issues we completely missed. The audit was thorough and actionable.", author: "Sarah Chen", title: "Product Manager", company: "TechFlow", initials: "SC" },
    { quote: "Worth every penny. We implemented the recommendations and saw a 34% increase in conversions.", author: "Marcus Webb", title: "Founder", company: "Velocity Labs", initials: "MW" },
    { quote: "The AI-powered analysis is impressive. It caught UX issues our team had overlooked for months.", author: "Elena Rodriguez", title: "Design Lead", company: "Creative Studio", initials: "ER" },
    { quote: "The report was incredibly detailed — the prioritised recommendations saved us weeks of guesswork.", author: "James Kim", title: "CTO", company: "LaunchPad", initials: "JK" },
    { quote: "As an agency, we now include ClearUX audits in every client proposal. It's a game-changer.", author: "Diana Torres", title: "Agency Director", company: "PixelCraft", initials: "DT" },
  ];

  return (
    <div className="bg-surface text-text min-h-screen">
      <HomeJsonLd />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold">
        Skip to content
      </a>
      <Navbar />
      <main id="main-content">

      {/* ═══════════════════════════════════════════════════════
          SOCIAL PROOF — rotating reviews above hero
          ═══════════════════════════════════════════════════════ */}
      <section className="bg-surface-alt border-b border-border/50 dark:border-white/[0.03] py-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[
                { bg: '#8B5CF6', initials: 'SC' },
                { bg: '#A78BFA', initials: 'MW' },
                { bg: '#7C3AED', initials: 'ER' },
                { bg: '#6D28D9', initials: 'JK' },
                { bg: '#C4B5FD', initials: 'DT' },
              ].map((p, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-surface-alt flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ backgroundColor: p.bg, zIndex: 5 - i }}
                >
                  {p.initials}
                </div>
              ))}
            </div>
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-accent text-accent" />
              ))}
            </div>
            <span className="text-muted text-xs">Trusted by product teams worldwide</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          HERO
          ═══════════════════════════════════════════════════════ */}
      <section className="relative pt-16 pb-14 sm:pt-28 sm:pb-24 px-4 md:px-6 lg:px-8 overflow-hidden">
        {/* ── Animated grid background ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Grid lines */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: `
                linear-gradient(to right, currentColor 1px, transparent 1px),
                linear-gradient(to bottom, currentColor 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px',
            }}
          />

          {/* Animated vertical accent line — sweeps left to right */}
          <div
            className="absolute top-0 bottom-0 w-px opacity-20"
            style={{
              background: 'linear-gradient(to bottom, transparent, var(--accent), transparent)',
              animation: 'gridSweepX 8s ease-in-out infinite',
            }}
          />
          {/* Second vertical line — offset timing */}
          <div
            className="absolute top-0 bottom-0 w-px opacity-10"
            style={{
              background: 'linear-gradient(to bottom, transparent, var(--accent), transparent)',
              animation: 'gridSweepX 8s ease-in-out 4s infinite',
            }}
          />

          {/* Animated horizontal accent line — sweeps top to bottom */}
          <div
            className="absolute left-0 right-0 h-px opacity-20"
            style={{
              background: 'linear-gradient(to right, transparent, var(--accent), transparent)',
              animation: 'gridSweepY 10s ease-in-out infinite',
            }}
          />
          {/* Second horizontal line */}
          <div
            className="absolute left-0 right-0 h-px opacity-10"
            style={{
              background: 'linear-gradient(to right, transparent, var(--accent), transparent)',
              animation: 'gridSweepY 10s ease-in-out 5s infinite',
            }}
          />

          {/* Glowing intersection dots — subtle pulsing */}
          <div className="absolute top-[30%] left-[25%] w-1.5 h-1.5 rounded-full bg-accent/30 animate-pulse" />
          <div className="absolute top-[60%] left-[70%] w-1 h-1 rounded-full bg-accent/20 animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-[20%] left-[55%] w-1 h-1 rounded-full bg-purple-400/25 animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute top-[75%] left-[35%] w-1 h-1 rounded-full bg-accent/15 animate-pulse" style={{ animationDelay: '3s' }} />

          {/* Radial fade — fades grid out at edges */}
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 40%, transparent 30%, var(--surface) 100%)' }} />
        </div>

        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-accent/[0.06] blur-[160px] pointer-events-none" />
        <div className="absolute top-40 right-[10%] w-[400px] h-[400px] rounded-full bg-purple-500/[0.04] blur-[120px] pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center relative">
          {/* Badge */}
          <div className="animate-fade-up inline-flex items-center gap-2 px-5 py-2 rounded-full bg-accent/10 border border-accent/20 mb-8">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-sm font-semibold text-accent tracking-wide">AI-Powered UX Audits</span>
          </div>

          {/*
            Force the H1 to always be exactly 2 lines.
            Line 1: "Find & fix UX issues impacting"
            Line 2: the rotating word (centered, on its own line)
          */}
          <h1 className="animate-fade-up delay-100 font-manrope text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6" style={{ lineHeight: '1.15' }}>
            Find &amp; fix UX issues impacting
            <br />
            <RotatingWord />
          </h1>

          <p className="animate-fade-up delay-200 text-base sm:text-lg md:text-xl text-muted mb-8 sm:mb-12 max-w-xl mx-auto" style={{ lineHeight: '1.7' }}>
            48 checkpoints. 12 categories. Professional report with prioritised fixes — delivered in minutes.
          </p>

          {/* URL Input */}
          <form onSubmit={handleHeroSubmit} className="animate-fade-up delay-300 max-w-xl mx-auto mb-8">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <label htmlFor="hero-url-input" className="sr-only">Website URL to audit</label>
                <input
                  id="hero-url-input"
                  type="text"
                  value={heroUrl}
                  onChange={(e) => setHeroUrl(e.target.value)}
                  placeholder="yourwebsite.com"
                  aria-label="Website URL to audit"
                  className="w-full px-5 py-4 text-base rounded-xl bg-card border border-border/50 dark:border-white/[0.04] text-text placeholder:text-placeholder focus:outline-none focus:border-accent/50 focus:shadow-[0_0_0_4px_rgba(139,92,246,0.1)] transition-all"
                />
              </div>
              <button
                type="submit"
                className="group inline-flex items-center justify-center gap-2 px-7 py-4 bg-accent text-white rounded-xl font-semibold hover:bg-accent-dk transition-all shadow-lg shadow-accent/20 hover:shadow-accent/30 flex-shrink-0"
              >
                Audit My Site
                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </form>

          {/* Pricing highlights — bold, accent color */}
          <div className="animate-fade-up delay-400 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-bold text-accent">
            <span>From $99 per audit</span>
            <span className="opacity-40">·</span>
            <span>No subscription</span>
            <span className="opacity-40">·</span>
            <span>Results in minutes</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          VALUE PROPOSITION + STATS + HOW IT WORKS
          Stripe-inspired unified section
          ═══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="relative overflow-hidden bg-surface-alt">
        {/* Background grid — subtle */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />

        {/* ── TOP: Bold statement + Stats ── */}
        <div className="relative max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pt-28 pb-20">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-start">
            {/* Left: Statement */}
            <div>
              <p className="text-accent text-sm font-semibold tracking-wide uppercase mb-4">Built for product teams</p>
              <h2 className="font-manrope text-3xl sm:text-4xl md:text-[2.75rem] font-bold text-text mb-6" style={{ lineHeight: '1.4' }}>
                <span className="text-text">Audit with confidence.</span>{' '}
                <span className="text-muted">Deep analysis across 12 UX categories with AI-powered precision, delivered in minutes not weeks.</span>
              </h2>
              <p className="text-muted text-base md:text-lg leading-relaxed max-w-lg">
                Every audit evaluates 48 professional checkpoints — from first impression and navigation to mobile experience and AI discoverability.
              </p>
            </div>

            {/* Right: Stats grid */}
            <div className="grid grid-cols-2 gap-6 lg:pt-4">
              {([
                { counter: c1, suffix: '+', label: 'UX checkpoints', desc: 'Professional evaluation criteria', prefix: '' },
                { counter: c2, suffix: '', label: 'Audit categories', desc: 'Full-spectrum UX coverage', prefix: '' },
                { counter: c3, suffix: '', label: 'Languages', desc: 'Localised report output', prefix: '' },
                { counter: c4, suffix: '', label: 'Min to report', desc: 'From URL to full analysis', prefix: '<' },
              ] as const).map((stat, idx) => {
                const counter = (stat as { counter: typeof c1 }).counter;
                const gradients = [
                  'from-accent to-purple-400',
                  'from-purple-400 to-pink-400',
                  'from-pink-400 to-orange-400',
                  'from-accent to-emerald-400',
                ];
                return (
                  <div
                    key={idx}
                    ref={counter.ref}
                    className="relative p-5 rounded-2xl bg-card/50 border border-border/30 dark:border-white/[0.03] hover:border-accent/20 transition-all duration-300"
                  >
                    <p className={`font-manrope text-4xl md:text-5xl font-extrabold mb-1 bg-gradient-to-r ${gradients[idx]} bg-clip-text text-transparent`} suppressHydrationWarning>
                      {mounted
                        ? `${stat.prefix}${counter.count}${stat.suffix}`
                        : '\u00A0'
                      }
                    </p>
                    <p className="text-sm font-semibold text-text mb-0.5">{stat.label}</p>
                    <p className="text-xs text-muted">{stat.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Accent divider line ── */}
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
        </div>

        {/* ── BOTTOM: How it works — 3 steps ── */}
        <div className="relative max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pt-20 pb-28">
          <div
            ref={howRef.ref}
            className={`transition-all duration-700 ${howRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="grid lg:grid-cols-[1fr_2fr] gap-16 lg:gap-20 items-start">
              {/* Left: Section intro */}
              <div>
                <p className="text-accent text-sm font-semibold tracking-wide uppercase mb-4">How it works</p>
                <h2 className="font-manrope text-3xl sm:text-4xl font-bold text-text leading-tight mb-4">
                  Three steps to better UX.
                </h2>
                <p className="text-muted text-base leading-relaxed">
                  No setup, no integration, no waiting. Just paste your URL and get a professional audit report.
                </p>
              </div>

              {/* Right: Steps */}
              <div className="space-y-0">
                {[
                  { step: '01', icon: Target, title: 'Paste your URL', desc: 'Just the link — we detect your industry, audience, and tech stack automatically. Works with any publicly accessible website.' },
                  { step: '02', icon: Brain, title: 'AI audits your site', desc: 'We crawl every page and evaluate 48 checkpoints across 12 UX categories with AI-powered precision.' },
                  { step: '03', icon: FileCheck, title: 'Get your report', desc: 'PDF + Word report with scores, severity-ranked issues, screenshots, and actionable fixes — ready in minutes.' },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.step}
                      className="group relative flex gap-5 py-7"
                      style={howRef.visible ? { animation: `fade-up 0.6s ease-out ${200 + idx * 150}ms both` } : { opacity: 0 }}
                    >
                      {/* Step number + icon */}
                      <div className="flex-shrink-0 relative">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/20 flex items-center justify-center group-hover:border-accent/40 transition-colors">
                          <Icon size={22} className="text-accent" />
                        </div>
                        {/* Vertical connector */}
                        {idx < 2 && (
                          <div className="absolute top-14 left-1/2 -translate-x-1/2 w-px h-full bg-gradient-to-b from-accent/20 to-transparent" />
                        )}
                      </div>
                      {/* Content */}
                      <div className="pt-1">
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="text-[10px] font-bold text-accent/50 tracking-widest">{item.step}</span>
                          <h3 className="font-manrope text-lg font-bold text-text">{item.title}</h3>
                        </div>
                        <p className="text-muted text-sm leading-relaxed max-w-md">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          WHAT WE AUDIT — visual break with surface bg
          ═══════════════════════════════════════════════════════ */}
      <section id="features" className="relative py-28 px-4 md:px-6 lg:px-8 bg-surface overflow-hidden">
        {/* Decorative accent glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full bg-accent/[0.03] blur-[120px] pointer-events-none" />

        <div
          ref={catRef.ref}
          className={`max-w-6xl mx-auto relative transition-all duration-700 ${catRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Header — left-aligned Stripe style */}
          <div className="grid lg:grid-cols-[1fr_1.5fr] gap-10 lg:gap-20 items-end mb-14">
            <div>
              <p className="text-accent text-sm font-semibold tracking-wide uppercase mb-4">What we audit</p>
              <h2 className="font-manrope text-3xl sm:text-4xl font-bold text-text leading-snug">
                12 categories.<br />48 checkpoints.
              </h2>
            </div>
            <p className="text-muted text-base md:text-lg leading-relaxed lg:pb-1">
              Every audit covers the full spectrum of user experience — from first impression and visual design to AI discoverability and accessibility. No blind spots.
            </p>
          </div>

          {/* Accent divider */}
          <div className="h-px bg-gradient-to-r from-accent/40 via-accent/20 to-transparent mb-12" />

          {/* Category grid — 4 columns on desktop, elegant minimal cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {auditCategories.map((cat, idx) => {
              const Icon = cat.icon;
              const isFeatured = 'featured' in cat && cat.featured;
              return (
                <div
                  key={idx}
                  className={`group relative rounded-xl p-4 border transition-all duration-300 ${
                    isFeatured
                      ? 'bg-gradient-to-br from-accent/10 via-purple-500/[0.06] to-violet-500/[0.03] border-accent/30 hover:border-accent/50 shadow-sm shadow-accent/5'
                      : 'bg-card/50 border-border/30 dark:border-white/[0.03] hover:border-accent/25 hover:bg-card'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                      isFeatured
                        ? 'bg-accent/20 group-hover:bg-accent/25'
                        : 'bg-accent/10 group-hover:bg-accent/15'
                    }`}>
                      <Icon size={15} className="text-accent" />
                    </div>
                    <h3 className="font-semibold text-text text-[15px]">{cat.title}</h3>
                  </div>
                  <p className="text-muted text-xs leading-relaxed pl-11">{cat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          AUDIT PREVIEW — simulated screens
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-28 px-4 md:px-6 lg:px-8 bg-surface-alt overflow-hidden">
        {/* Subtle grid bg */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{
          backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        <div
          ref={previewRef.ref}
          className={`max-w-6xl mx-auto relative transition-all duration-700 ${previewRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-16">
            <p className="text-accent text-sm font-semibold tracking-wide uppercase mb-4">See it in action</p>
            <h2 className="font-manrope text-3xl sm:text-4xl font-bold text-text leading-snug">
              From URL to actionable insights
            </h2>
            <p className="text-muted text-base md:text-lg mt-4 max-w-2xl mx-auto">
              A complete UX audit delivered as a professional report — scores, findings, and prioritised recommendations.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">

            {/* ── Card 1: Score Overview ── */}
            <div className="rounded-2xl border border-border/40 dark:border-white/[0.03] bg-card shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border/30 dark:border-white/[0.03] flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                </div>
                <span className="text-[11px] text-muted ml-1 font-medium">Audit Score</span>
              </div>
              <div className="p-6 flex flex-col items-center">
                {/* Score ring */}
                <div className="relative w-32 h-32 mb-5">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" className="text-border/40" strokeWidth="8" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke="url(#scoreGrad)" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${0.73 * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                    />
                    <defs>
                      <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="var(--accent)" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-extrabold font-manrope text-text">73</span>
                    <span className="text-[10px] text-muted font-medium uppercase tracking-wide">/ 100</span>
                  </div>
                </div>
                {/* Mini category scores */}
                <div className="w-full space-y-2.5">
                  {[
                    { name: 'First Impression', score: 82, color: 'bg-emerald-500' },
                    { name: 'Navigation', score: 68, color: 'bg-accent' },
                    { name: 'Mobile Experience', score: 55, color: 'bg-amber-500' },
                    { name: 'AI Discoverability', score: 41, color: 'bg-red-500' },
                  ].map((item) => (
                    <div key={item.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted">{item.name}</span>
                        <span className="text-xs font-semibold text-text">{item.score}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
                        <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Card 2: Findings List ── */}
            <div className="rounded-2xl border border-border/40 dark:border-white/[0.03] bg-card shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border/30 dark:border-white/[0.03] flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                </div>
                <span className="text-[11px] text-muted ml-1 font-medium">Key Findings</span>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { severity: 'Critical', color: 'bg-red-500', title: 'No mobile-responsive navigation', category: 'Mobile Experience' },
                  { severity: 'High', color: 'bg-orange-500', title: 'CTA buttons below the fold on landing', category: 'Conversion & CTAs' },
                  { severity: 'High', color: 'bg-orange-500', title: 'Missing structured data for AI indexing', category: 'AI Discoverability' },
                  { severity: 'Medium', color: 'bg-amber-500', title: 'Inconsistent heading hierarchy', category: 'Visual Hierarchy' },
                  { severity: 'Medium', color: 'bg-amber-500', title: 'No loading states on async actions', category: 'Onboarding' },
                  { severity: 'Low', color: 'bg-blue-500', title: 'Alt text missing on 3 hero images', category: 'Accessibility' },
                ].map((finding, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-surface/60 dark:bg-white/[0.02] border border-border/20 dark:border-white/[0.04]">
                    <span className={`mt-0.5 flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold text-white uppercase tracking-wider ${finding.color}`}>
                      {finding.severity}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text leading-snug">{finding.title}</p>
                      <p className="text-[10px] text-muted mt-0.5">{finding.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Card 3: Report Preview ── */}
            <div className="rounded-2xl border border-border/40 dark:border-white/[0.03] bg-card shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border/30 dark:border-white/[0.03] flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                </div>
                <span className="text-[11px] text-muted ml-1 font-medium">PDF Report</span>
              </div>
              <div className="p-5">
                {/* Mock report page */}
                <div className="bg-white dark:bg-white/[0.02] rounded-lg border border-border/30 dark:border-white/[0.03] p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center">
                      <FileText size={12} className="text-accent" />
                    </div>
                    <span className="text-xs font-bold text-text dark:text-white/80">ClearUX Audit Report</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="h-2 w-24 rounded bg-accent/30 mb-2" />
                      <div className="space-y-1.5">
                        <div className="h-1.5 w-full rounded bg-border/40" />
                        <div className="h-1.5 w-5/6 rounded bg-border/40" />
                        <div className="h-1.5 w-4/6 rounded bg-border/40" />
                      </div>
                    </div>
                    <div className="h-px bg-border/30" />
                    <div>
                      <div className="h-2 w-20 rounded bg-accent/30 mb-2" />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-10 rounded bg-accent/[0.06] border border-accent/10" />
                        <div className="h-10 rounded bg-accent/[0.06] border border-accent/10" />
                      </div>
                    </div>
                    <div className="h-px bg-border/30" />
                    <div>
                      <div className="h-2 w-28 rounded bg-orange-400/30 mb-2" />
                      <div className="space-y-1.5">
                        <div className="h-1.5 w-full rounded bg-border/40" />
                        <div className="h-1.5 w-3/4 rounded bg-border/40" />
                      </div>
                    </div>
                  </div>
                </div>
                {/* Download buttons */}
                <div className="flex gap-2 mt-4">
                  <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-accent/10 border border-accent/20">
                    <FileText size={12} className="text-accent" />
                    <span className="text-[11px] font-semibold text-accent">PDF</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-accent/10 border border-accent/20">
                    <FileText size={12} className="text-accent" />
                    <span className="text-[11px] font-semibold text-accent">DOCX</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          PRICING
          ═══════════════════════════════════════════════════════ */}
      <section id="pricing" className="relative py-28 px-4 md:px-6 lg:px-8 bg-gradient-to-b from-[#faf9fe] via-[#f7f5fc] to-[#faf9fe] dark:from-[#0e0e16] dark:via-[#12121c] dark:to-[#0e0e16]">
        <div
          ref={priceRef.ref}
          className={`max-w-5xl mx-auto relative transition-all duration-700 ${priceRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-6">
            <p className="text-accent text-sm font-medium tracking-wide uppercase mb-3">Pricing</p>
            <h2 className="font-manrope text-3xl md:text-4xl font-bold text-text mb-4">
              Simple credit-based pricing
            </h2>
            <p className="text-muted text-lg max-w-xl mx-auto">
              1 credit = 1 full audit. No tiers. No feature limits.
            </p>
          </div>

          {/* ── Every audit includes — shared benefits strip ── */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-14 py-4 border-y border-border/30 dark:border-white/[0.03]">
            {['48-point deep analysis', '12 UX categories', 'AI discoverability audit', 'PDF + DOCX reports', 'Issue screenshots'].map((f, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 text-accent" />
                <span className="text-xs text-muted font-medium">{f}</span>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { name: 'Starter', credits: 1, price: 99, per: '$99', save: null, savePercent: 0, cta: 'Start Auditing', popular: false, desc: 'Try your first audit' },
              { name: 'Growth', credits: 5, price: 399, per: '$79.80', save: '19%', savePercent: 19, cta: 'Get 5 Audits', popular: true, desc: 'Best for growing teams' },
              { name: 'Agency', credits: 15, price: 999, per: '$66.60', save: '33%', savePercent: 33, cta: 'Get 15 Audits', popular: false, desc: 'For agencies & studios' },
              { name: 'Scale', credits: 50, price: 2499, per: '$49.98', save: '50%', savePercent: 50, cta: 'Get 50 Audits', popular: false, desc: 'Enterprise volume' },
            ].map((tier, idx) => (
              <div
                key={idx}
                className={`group relative rounded-2xl flex flex-col transition-all duration-300 overflow-hidden ${
                  tier.popular
                    ? 'border border-accent/40 dark:border-accent/20 hover:border-accent/60 shadow-xl shadow-accent/10 dark:shadow-accent/5 lg:scale-[1.03]'
                    : 'border border-border/50 dark:border-transparent hover:border-accent/25 hover:shadow-lg hover:shadow-accent/5 dark:bg-[#161622] dark:hover:bg-[#1a1a2a]'
                }`}
              >
                {/* Top gradient bar */}
                <div className={`h-1 w-full ${
                  tier.popular
                    ? 'bg-gradient-to-r from-accent via-purple-400 to-accent'
                    : 'bg-gradient-to-r from-transparent via-accent/15 dark:via-accent/[0.08] to-transparent'
                }`} />

                {tier.popular && (
                  <span className="absolute top-4 right-4 bg-gradient-to-r from-accent to-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg shadow-accent/30 z-10">
                    Most Popular
                  </span>
                )}

                <div className={`p-6 pb-5 flex flex-col flex-1 ${
                  tier.popular
                    ? 'bg-gradient-to-b from-accent/[0.06] to-transparent'
                    : 'bg-card'
                }`}>
                  {/* Plan name */}
                  <h3 className="font-manrope font-bold text-lg text-text mb-0.5">{tier.name}</h3>
                  <p className="text-xs text-muted mb-4">{tier.desc}</p>

                  {/* Price */}
                  <div className="mb-0.5">
                    <span className="font-manrope text-4xl font-extrabold text-text">${tier.price.toLocaleString()}</span>
                  </div>

                  {/* Per-audit cost */}
                  <p className="text-sm text-muted mb-5">
                    {tier.per}<span className="text-muted/50"> / audit</span>
                  </p>

                  {/* Credit count — visual pill with icon */}
                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 mb-4 ${
                    tier.popular
                      ? 'bg-accent/10 dark:bg-accent/[0.08] border border-accent/15 dark:border-transparent'
                      : 'bg-surface-alt/50 dark:bg-white/[0.04] border border-border/30 dark:border-transparent'
                  }`}>
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${
                      tier.popular
                        ? 'bg-accent/20'
                        : 'bg-accent/10'
                    }`}>
                      <Zap className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text leading-tight">
                        {tier.credits} credit{tier.credits !== 1 ? 's' : ''}
                      </p>
                      <p className="text-[10px] text-muted leading-tight">
                        {tier.credits} full audit{tier.credits !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {tier.save && (
                      <span className="ml-auto text-xs font-extrabold text-accent bg-accent/10 px-2 py-0.5 rounded-md">
                        -{tier.save}
                      </span>
                    )}
                  </div>

                  {/* Savings detail */}
                  {tier.save ? (
                    <div className="mb-5">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-1 rounded-full bg-border/30 dark:bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-accent to-purple-400 transition-all duration-500"
                            style={{ width: `${tier.savePercent * 2}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-muted/60">
                        Save ${(tier.credits * 99 - tier.price).toLocaleString()} vs individual pricing
                      </p>
                    </div>
                  ) : (
                    <div className="mb-5" />
                  )}

                  {/* CTA — pushed to bottom */}
                  <div className="mt-auto">
                    <Link
                      href="/register"
                      className={`flex items-center justify-center gap-2 text-sm font-bold rounded-xl py-3 transition-all duration-200 ${
                        tier.popular
                          ? 'bg-gradient-to-r from-accent to-purple-500 text-white hover:brightness-110 shadow-lg shadow-accent/25'
                          : 'bg-accent/[0.08] dark:bg-accent/[0.12] text-accent hover:bg-accent/15 dark:hover:bg-accent/[0.18] border border-accent/15 dark:border-transparent'
                      }`}
                    >
                      {tier.cta}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Trust & Security bar ── */}
          <div className="mt-12 rounded-2xl bg-gradient-to-r from-[#1a1136] via-[#1e1542] to-[#1a1136] border border-accent/10 px-6 sm:px-8 py-6 shadow-lg shadow-accent/5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
              {/* Left: Stripe badge */}
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-accent" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white/90">Secure payments via</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/stripe.svg" alt="Stripe" className="h-7" />
                </div>
              </div>

              {/* Center: Trust signals */}
              <div className="flex items-center gap-4 text-xs text-white/80 font-medium">
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  SSL encrypted
                </span>
                <span className="text-white/30">|</span>
                <span>Credits never expire</span>
                <span className="text-white/30">|</span>
                <span>No subscription</span>
              </div>

              {/* Right: Card brand icons */}
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/visa.svg" alt="Visa" className="h-6 rounded" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/mastercard.svg" alt="Mastercard" className="h-6 rounded" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/applepay.svg" alt="Apple Pay" className="h-6 rounded" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/gpay.svg" alt="Google Pay" className="h-6 rounded" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          TESTIMONIALS — rotating, alternating bg
          ═══════════════════════════════════════════════════════ */}
      <section className="py-28 px-4 md:px-6 lg:px-8 bg-surface-alt">
        <div
          ref={testRef.ref}
          className={`max-w-5xl mx-auto transition-all duration-700 ${testRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-14">
            <p className="text-accent text-sm font-medium tracking-wide uppercase mb-3">Testimonials</p>
            <h2 className="font-manrope text-3xl md:text-4xl font-bold text-text mb-2">
              Loved by product teams
            </h2>
            <div className="flex justify-center gap-0.5 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-accent text-accent" />
              ))}
            </div>
          </div>
          <RotatingReview reviews={testimonials} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FAQ
          ═══════════════════════════════════════════════════════ */}
      <section id="faq" className="py-28 px-4 md:px-6 lg:px-8 bg-surface">
        <div
          ref={faqRef.ref}
          className={`max-w-2xl mx-auto transition-all duration-700 ${faqRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-14">
            <p className="text-accent text-sm font-medium tracking-wide uppercase mb-3">FAQ</p>
            <h2 className="font-manrope text-3xl md:text-4xl font-bold text-text">
              Frequently asked questions
            </h2>
          </div>
          <div className="space-y-3">
            {[
              { q: 'How long does an audit take?', a: 'Most audits complete in under 10 minutes. Our AI crawls your website, analyses every page against 48 checkpoints, and generates a full professional report.' },
              { q: 'What does the audit cover?', a: 'We evaluate 12 categories: First Impression, AI Discoverability, Value Proposition, Navigation, Conversion & CTAs, Onboarding, Mobile Experience, Trust & Credibility, Content Quality, Performance, Visual Hierarchy, and Accessibility.' },
              { q: 'How do credits work?', a: 'One credit = one full audit. Credits never expire. Every audit includes all 48 checkpoints, PDF & Word reports, and prioritised recommendations.' },
              { q: 'What format is the report?', a: 'You get a professional PDF and a Word document with overall scores, category breakdowns, detailed findings, and actionable recommendations.' },
              { q: 'Can I audit any website?', a: 'Yes. ClearUX works with any publicly accessible URL. We handle JavaScript-rendered sites, SPAs, and multi-page websites.' },
              { q: 'Is my data secure?', a: 'We only analyse publicly visible content. Payments are processed via Stripe. We do not store or share your website data beyond generating your report.' },
              { q: 'What languages are supported?', a: 'Reports are available in English, Spanish, French, German, Italian, and Portuguese.' },
              { q: 'Can I get a refund?', a: 'If you\u2019re unsatisfied, contact support@clearux.ai and we\u2019ll resolve it or provide a credit for a new audit.' },
            ].map((item, idx) => (
              <details key={idx} className="group rounded-xl border border-border/40 dark:border-white/[0.03] bg-card overflow-hidden">
                <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-card-hover transition-colors">
                  <h3 className="font-medium text-text text-sm pr-4">{item.q}</h3>
                  <ArrowRight size={14} className="text-muted flex-shrink-0 transform group-open:rotate-90 transition-transform" />
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
      <section className="relative py-28 px-4 md:px-6 lg:px-8 overflow-hidden bg-surface-alt">
        <div className="absolute inset-0 bg-gradient-to-t from-accent/[0.04] to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-accent/[0.06] blur-[120px] pointer-events-none" />

        <div className="max-w-2xl mx-auto text-center relative">
          <h2 className="font-manrope text-3xl md:text-4xl font-bold text-text mb-4">
            Ready to improve your UX?
          </h2>
          <p className="text-muted text-lg mb-8">
            Get your comprehensive audit report in minutes.
          </p>
          <Link
            href="/register"
            className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-accent text-white rounded-xl text-base font-semibold hover:bg-accent-dk transition-all shadow-lg shadow-accent/20"
          >
            Audit My Site Now
            <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <p className="text-muted/60 text-sm mt-4">No subscription required.</p>
        </div>
      </section>

      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
}
