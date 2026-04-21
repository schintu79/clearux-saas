'use client';

import { useState, useEffect, useRef } from 'react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { Brain, CheckCircle, Eye, Target, Map, MousePointerClick, Zap, Smartphone, Shield, Type, Gauge, ArrowRight, Layers, Accessibility, Heart, Users, Globe2, Scale, Sparkles, Clock, Lock, AlertTriangle, Search, RefreshCw, Share2, BarChart3, ListChecks, Download, TrendingUp, Link2 } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
/* Doodle components available but not used in current design */
import { HomeJsonLd } from "@/components/seo/JsonLd";
import { useAuth } from '@/context/AuthContext';

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

/* (Rotating words and testimonials removed — no longer used) */

/* ── Pillar scroll reveal ────────────────────────────────── */
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

function PillarScrollReveal({ categories }: { categories: Array<{ pillar: string; icon: React.ElementType; title: string; desc: string; featured?: boolean }> }) {
  const pillarNames = ['Future Readiness', 'Foundation', 'Human Experience', 'Inclusive Design'];

  /* Map reordered PILLAR_DATA indices to their original visual panel */
  const visualOrder = [3, 0, 1, 2]; // Future Readiness, Foundation, Human Experience, Inclusive Design

  /* ── Visual panels — simplified, clean ── */
  const visuals = [
    /* FOUNDATION — Score overview */
    <aside key="v0" role="presentation" className="w-full rounded-2xl bg-card/80 dark:bg-card border border-border/50 p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-text/5 flex items-center justify-center"><Eye size={24} className="text-text" /></div>
        <div>
          <p className="text-sm font-semibold text-text">Foundation</p>
          <p className="text-xs text-muted">First impressions &amp; clarity</p>
        </div>
        <span className="ml-auto font-heading text-4xl font-bold text-text">78</span>
      </div>
      <div className="space-y-4">
        {[{t:'Visual Design',s:82},{t:'Messaging Clarity',s:75},{t:'Navigation',s:88},{t:'Conversion Paths',s:70}].map((d,i)=>(
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-text">{d.t}</span>
              <span className="text-sm font-bold text-text">{d.s}</span>
            </div>
            <div className="h-2 rounded-full bg-border/30 dark:bg-white/[0.06]"><div className="h-full rounded-full bg-text" style={{width:`${d.s}%`}} /></div>
          </div>
        ))}
      </div>
      <div className="mt-6 p-4 rounded-xl bg-off/50 dark:bg-white/[0.03]">
        <div className="flex items-start gap-2 mb-1.5">
          <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">CRITICAL</span>
          <p className="text-xs font-semibold text-text">CTA invisible on mobile viewport</p>
        </div>
        <p className="text-[11px] text-muted leading-relaxed">Primary call-to-action blends into the background on screens under 768px — users can&apos;t find the next step.</p>
      </div>
    </aside>,

    /* HUMAN EXPERIENCE — Dark pattern scan */
    <aside key="v1" role="presentation" className="w-full rounded-2xl bg-card/80 dark:bg-card border border-border/50 p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-text/5 flex items-center justify-center"><Heart size={24} className="text-text" /></div>
        <div>
          <p className="text-sm font-semibold text-text">Human Experience</p>
          <p className="text-xs text-muted">Ethics &amp; psychological safety</p>
        </div>
        <span className="ml-auto font-heading text-4xl font-bold text-text">54</span>
      </div>
      <div className="space-y-4">
        {[{t:'Ethical UX Patterns',s:38},{t:'Emotional Safety',s:72},{t:'Cognitive Load',s:55}].map((d,i)=>(
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-text">{d.t}</span>
              <span className="text-sm font-bold text-text">{d.s}</span>
            </div>
            <div className="h-2 rounded-full bg-border/30 dark:bg-white/[0.06]"><div className="h-full rounded-full bg-text" style={{width:`${d.s}%`}} /></div>
          </div>
        ))}
      </div>
      <div className="mt-6 p-4 rounded-xl bg-off/50 dark:bg-white/[0.03]">
        <div className="flex items-start gap-2 mb-1.5">
          <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">CRITICAL</span>
          <p className="text-xs font-semibold text-text">Confirmshaming in cancel flow</p>
        </div>
        <p className="text-[11px] text-muted leading-relaxed">Opt-out label uses guilt language — &ldquo;No, I don&apos;t want to save money&rdquo; — a recognised dark pattern.</p>
      </div>
    </aside>,

    /* INCLUSIVE DESIGN — Accessibility */
    <aside key="v2" role="presentation" className="w-full rounded-2xl bg-card/80 dark:bg-card border border-border/50 p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-text/5 flex items-center justify-center"><Accessibility size={24} className="text-text" /></div>
        <div>
          <p className="text-sm font-semibold text-text">Inclusive Design</p>
          <p className="text-xs text-muted">Accessibility &amp; universal UX</p>
        </div>
        <span className="ml-auto font-heading text-4xl font-bold text-text">71</span>
      </div>
      <div className="space-y-4">
        {[{t:'WCAG Compliance',s:64},{t:'Mobile Responsiveness',s:82},{t:'Keyboard Navigation',s:68}].map((d,i)=>(
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-text">{d.t}</span>
              <span className="text-sm font-bold text-text">{d.s}</span>
            </div>
            <div className="h-2 rounded-full bg-border/30 dark:bg-white/[0.06]"><div className="h-full rounded-full bg-text" style={{width:`${d.s}%`}} /></div>
          </div>
        ))}
      </div>
      <div className="mt-6 p-4 rounded-xl bg-off/50 dark:bg-white/[0.03]">
        <div className="flex items-start gap-2 mb-1.5">
          <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">HIGH</span>
          <p className="text-xs font-semibold text-text">Touch targets below minimum</p>
        </div>
        <p className="text-[11px] text-muted leading-relaxed">Checkout form buttons are 32px — below the 44px WCAG minimum. 18% of mobile users will misfire taps.</p>
      </div>
    </aside>,

    /* FUTURE READINESS — AI readiness */
    <aside key="v3" role="presentation" className="w-full rounded-2xl bg-card/80 dark:bg-card border border-border/50 p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-text/5 flex items-center justify-center"><Brain size={24} className="text-text" /></div>
        <div>
          <p className="text-sm font-semibold text-text">AI Readiness</p>
          <p className="text-xs text-muted">How AI sees your site</p>
        </div>
        <span className="ml-auto font-heading text-4xl font-bold text-text">65</span>
      </div>
      <div className="space-y-4">
        {[{t:'LLM Discoverability',s:72},{t:'Agent Navigation',s:48},{t:'Cultural Readiness',s:62}].map((d,i)=>(
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-text">{d.t}</span>
              <span className="text-sm font-bold text-text">{d.s}</span>
            </div>
            <div className="h-2 rounded-full bg-border/30 dark:bg-white/[0.06]"><div className="h-full rounded-full bg-text" style={{width:`${d.s}%`}} /></div>
          </div>
        ))}
      </div>
      <div className="mt-6 p-4 rounded-xl bg-off/50 dark:bg-white/[0.03]">
        <div className="flex items-start gap-2 mb-1.5">
          <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">HIGH</span>
          <p className="text-xs font-semibold text-text">Structured data incomplete</p>
        </div>
        <p className="text-[11px] text-muted leading-relaxed">AI agents can identify this is a SaaS product but cannot determine pricing or features from structured data alone.</p>
      </div>
    </aside>,
  ];

  return (
    <div className="relative max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
      <div className="space-y-20 lg:space-y-32">
        {PILLAR_DATA.map((pillar, idx) => {
          const pillarCats = categories.filter((c) => c.pillar === pillarNames[idx]);
          const isEven = idx % 2 === 0;

          const textBlock = (
            <div className="flex flex-col justify-center">
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
              <div className="flex flex-wrap gap-2">
                {pillarCats.map((cat, cIdx) => {
                  const Icon = cat.icon;
                  return (
                    <span
                      key={cIdx}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${pillar.colorBg} ${pillar.colorText} ${pillar.colorBorder}`}
                    >
                      <Icon size={12} />
                      {cat.title}
                    </span>
                  );
                })}
              </div>
            </div>
          );

          const visualBlock = (
            <div className="flex items-center justify-center">
              {visuals[visualOrder[idx]]}
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

function FaqSection({ faqRef }: { faqRef: { ref: React.RefObject<HTMLDivElement>; visible: boolean } }) {
  return (
    <section id="faq" className="py-32 sm:py-40 px-4 md:px-6 lg:px-8 bg-surface">
      <div
        ref={faqRef.ref}
        className={`max-w-2xl mx-auto transition-all duration-700 ${faqRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      >
        <div className="text-center mb-12">
          <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-text">FAQ</p>
          <h2 className="font-heading text-3xl md:text-4xl font-semibold text-text tracking-tight">
            Frequently asked questions
          </h2>
        </div>

        <div className="space-y-2">
          {TOP_FAQS.map((item, idx) => (
            <details key={idx} className="group rounded-xl border border-border bg-card overflow-hidden">
              <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-off dark:hover:bg-white/[0.02] transition-colors">
                <h3 className="font-medium text-text text-[15px] pr-4">{item.q}</h3>
                <ArrowRight size={14} className="text-muted flex-shrink-0 transform group-open:rotate-90 transition-transform" />
              </summary>
              <div className="mx-5 pb-5 pt-1 border-t border-border">
                <p className="text-muted text-sm leading-relaxed pt-4">{item.a}</p>
              </div>
            </details>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link
            href="/faq"
            className="inline-flex items-center gap-2 text-sm font-semibold text-text hover:opacity-80 transition-opacity"
          >
            Read all FAQ
            <ArrowRight size={14} className="text-brand" />
          </Link>
        </div>
      </div>
    </section>
  );
}


export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
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

  const c1 = useCountUp(64, 1800);
  const c2 = useCountUp(16, 1400);
  const c3 = useCountUp(4, 1200);
  const c4 = useCountUp(40, 1000);

  const priceRef = useScrollReveal();
  const testRef = useScrollReveal();
  const faqRef = useScrollReveal();

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

  /* Testimonials removed — waiting for real client quotes */

  return (
    <div className="bg-surface text-text min-h-screen">
      <HomeJsonLd />
      <Navbar />
      <main id="main-content">

      {/* ═══════════════════════════════════════════════════════
          HERO — Sketch-style: clean, confident, generous space
          ═══════════════════════════════════════════════════════ */}
      <section className="section-dark dark-forced relative min-h-screen flex flex-col justify-center px-4 md:px-6 lg:px-8 overflow-hidden">

        {/* Aurora background — subtle color bands + grid + scan lines */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Aurora band 1 — emerald/lime sweep across top */}
          <div className="absolute w-[120%] h-[250px] -left-[10%] top-[12%]" style={{
            background: 'linear-gradient(90deg, transparent 0%, #22C55E 15%, #B9FF66 35%, #22C55E 55%, transparent 80%)',
            filter: 'blur(70px)',
            opacity: 0.22,
            animation: 'auroraDrift 20s ease-in-out infinite',
          }} />
          {/* Aurora band 2 — violet/indigo band center */}
          <div className="absolute w-[110%] h-[220px] -left-[5%] top-[38%]" style={{
            background: 'linear-gradient(90deg, transparent 0%, #6366F1 20%, #818CF8 45%, #6366F1 70%, transparent 100%)',
            filter: 'blur(65px)',
            opacity: 0.18,
            animation: 'auroraDrift2 25s ease-in-out infinite',
          }} />
          {/* Aurora band 3 — amber/pink/warm glow lower */}
          <div className="absolute w-[100%] h-[200px] left-0 top-[62%]" style={{
            background: 'linear-gradient(90deg, transparent 0%, #F59E0B 25%, #EF4444 45%, #EC4899 65%, transparent 100%)',
            filter: 'blur(70px)',
            opacity: 0.18,
            animation: 'auroraDrift 22s ease-in-out infinite reverse',
          }} />
          {/* Global pulse overlay for breathing */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(185,255,102,0.04) 0%, transparent 70%)',
            animation: 'auroraPulse 8s ease-in-out infinite',
          }} />

          {/* Grid overlay */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(185,255,102,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(185,255,102,.04) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            animation: 'gridMove 20s linear infinite',
          }} />

          {/* Moving scan lines — horizontal */}
          <div className="absolute left-0 w-full h-[1px]" style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(185,255,102,0.15) 20%, rgba(185,255,102,0.25) 50%, rgba(185,255,102,0.15) 80%, transparent 100%)',
            animation: 'scanLineH 8s linear infinite',
          }} />
          <div className="absolute left-0 w-full h-[1px]" style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.12) 30%, rgba(99,102,241,0.2) 50%, rgba(99,102,241,0.12) 70%, transparent 100%)',
            animation: 'scanLineH 12s linear infinite 4s',
          }} />
          {/* Moving scan lines — vertical */}
          <div className="absolute top-0 h-full w-[1px]" style={{
            background: 'linear-gradient(transparent 0%, rgba(185,255,102,0.15) 20%, rgba(185,255,102,0.25) 50%, rgba(185,255,102,0.15) 80%, transparent 100%)',
            animation: 'scanLineV 10s linear infinite 2s',
          }} />
          <div className="absolute top-0 h-full w-[1px]" style={{
            background: 'linear-gradient(transparent 0%, rgba(236,72,153,0.1) 30%, rgba(236,72,153,0.18) 50%, rgba(236,72,153,0.1) 70%, transparent 100%)',
            animation: 'scanLineV 14s linear infinite 6s',
          }} />

          {/* Edge vignette */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#111111] via-transparent to-[#111111]" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10 flex-1 flex flex-col justify-center pt-20">

          {/* Label badge */}
          <div className="animate-fade-up delay-50 mb-6">
            <span className="inline-flex items-center gap-2 bg-[#B9FF66] text-[#111111] text-xs sm:text-sm font-semibold px-4 py-2 rounded-full">
              Professional AI-powered UX audit in under 10 min
            </span>
          </div>

          {/* Primary headline — problem-outcome first, then price */}
          <h1 className="animate-fade-up delay-100 font-heading text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem] font-semibold tracking-tight mb-8 text-white" style={{ lineHeight: '1.12' }}>
            Find the UX issues costing{' '}
            <br className="hidden sm:block" />
            you conversions.{' '}
            <span className="text-[#B9FF66]">In minutes.</span>
          </h1>

          <p className="animate-fade-up delay-200 text-lg md:text-xl text-white/50 mb-12 sm:mb-14 max-w-2xl mx-auto" style={{ lineHeight: '1.6' }}>
            Get a consultant-grade UX audit for $99 — covering accessibility, dark patterns, conversion psychology, and AI readiness across 64 checkpoints.
          </p>

          {/* Single focal CTA — URL Input (full width) */}
          <form onSubmit={handleHeroSubmit} className="animate-fade-up delay-400 max-w-3xl w-full mx-auto mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <label htmlFor="hero-url-input" className="sr-only">Website URL to audit</label>
                <input
                  id="hero-url-input"
                  type="text"
                  name="url"
                  autoComplete="url"
                  value={heroUrl}
                  onChange={(e) => setHeroUrl(e.target.value)}
                  placeholder="yourwebsite.com"
                  aria-label="Website URL to audit"
                  className="w-full px-6 py-5 text-lg rounded-xl bg-white/[0.06] border border-white/[0.10] text-white placeholder:text-white/30 focus:outline-none focus:border-[#B9FF66]/40 focus:shadow-[0_0_0_3px_rgba(185,255,102,0.08)] transition-all"
                />
              </div>
              <button
                type="submit"
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 min-h-[48px] text-base sm:px-10 sm:py-5 sm:min-h-[60px] sm:text-lg bg-[#B9FF66] text-[#111111] rounded-xl font-semibold transition-all hover:-translate-y-0.5 hover:bg-[#A8EE55] flex-shrink-0"
              >
                {user ? 'Run My Audit' : 'Start Free Audit'}
                <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </form>

          {/* Trust KSPs — directly under input */}
          <div className="animate-fade-up delay-500 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 mb-10">
            <div className="flex items-center gap-2.5">
              <Zap size={18} className="text-[#B9FF66]" />
              <span className="text-sm font-semibold text-white">Results in minutes</span>
            </div>
            <div className="w-px h-4 bg-white/15 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <Shield size={18} className="text-[#B9FF66]" />
              <span className="text-sm font-semibold text-white">Your data is never stored</span>
            </div>
            <div className="w-px h-4 bg-white/15 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <Clock size={18} className="text-[#B9FF66]" />
              <span className="text-sm font-semibold text-white">Credits never expire</span>
            </div>
          </div>

          {/* Scribble arrow pointing down — 4x size */}
          <button
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            className="animate-fade-up delay-700 mx-auto flex flex-col items-center hover:scale-105 transition-transform cursor-pointer mb-8"
            aria-label="Scroll to features"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/scribble-arrow.svg" alt="" width={133} height={200} className="animate-float" style={{ filter: 'brightness(0) invert(1) sepia(1) saturate(50) hue-rotate(30deg) brightness(1.5)' }} />
          </button>

        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FEATURES + STATS
          ═══════════════════════════════════════════════════════ */}
      <section id="features" className="relative bg-surface">
        <div className="relative max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pt-32 sm:pt-40 pb-24">
          <div className="text-center max-w-3xl mx-auto">
            <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-text">Built for product managers, design teams &amp; agencies</p>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-text mb-6 tracking-tight" style={{ lineHeight: '1.1' }}>
              Four pillars. 64 checkpoints.<br className="hidden sm:block" />
              <span className="text-muted">Including the ones nobody else is auditing yet.</span>
            </h2>
            {/* Clean separator — no doodles */}
            <p className="text-muted text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
              Most audit tools stop at performance and SEO. ClearUX goes deeper — ethical UX, cognitive accessibility, AI agent readiness, and conversion psychology. Every finding is ranked by business impact, trackable as your team fixes them, and comparable across re-audits so you can prove improvement to stakeholders.
            </p>
          </div>

          {/* Stats — clean, no background decorations */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 mt-24 max-w-4xl mx-auto">
            {([
              { counter: c1, suffix: '+', label: 'UX checkpoints', prefix: '' },
              { counter: c2, suffix: '', label: 'Categories', prefix: '' },
              { counter: c3, suffix: '', label: 'Audit pillars', prefix: '' },
              { counter: c4, suffix: '+', label: 'Pages crawled', prefix: '' },
            ] as const).map((stat, idx) => {
              const counter = (stat as { counter: typeof c1 }).counter;
              return (
                <div key={idx} ref={counter.ref} className="text-center">
                  <p className="font-heading text-5xl sm:text-6xl md:text-7xl font-semibold text-text leading-none tracking-tight" suppressHydrationWarning>
                    {mounted ? `${stat.prefix}${counter.count}${stat.suffix}` : '\u00A0'}
                  </p>
                  <p className="text-sm text-muted mt-3 font-medium">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          WHY CLEARUX — Competitor differentiation (lime bg)
          ═══════════════════════════════════════════════════════ */}
      <section className="py-24 sm:py-32 px-4 md:px-6 lg:px-8" style={{ background: '#B9FF66' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left — Comparison table */}
          <div className="hidden lg:block">
            <div className="w-full rounded-2xl bg-white border border-[#111]/10 p-6 sm:p-8 shadow-lg shadow-black/[0.05]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#111]/5 flex items-center justify-center"><Gauge size={24} className="text-[#111]" /></div>
                <div>
                  <p className="text-sm font-semibold text-[#111]">Coverage Comparison</p>
                  <p className="text-xs text-[#111]/60">What other tools miss</p>
                </div>
                <span className="ml-auto font-heading text-4xl font-bold text-[#111]">6<span className="text-lg">/6</span></span>
              </div>
              <div className="space-y-4">
                {[
                  { t: 'Ethical UX & dark patterns', others: false, s: 100 },
                  { t: 'Cognitive accessibility', others: false, s: 100 },
                  { t: 'AI agent readiness', others: false, s: 100 },
                  { t: 'Conversion psychology', others: false, s: 100 },
                  { t: 'WCAG accessibility', others: true, s: 100 },
                  { t: 'Performance metrics', others: true, s: 100 },
                ].map((d, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-[#111]">{d.t}</span>
                      <div className="flex items-center gap-3">
                        {d.others
                          ? <span className="text-[10px] font-semibold text-[#111]/40 uppercase">Others</span>
                          : <span className="text-[10px] font-semibold text-[#111]/40 uppercase">Exclusive</span>
                        }
                        <CheckCircle size={16} className="text-[#111]" />
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[#111]/10"><div className="h-full rounded-full bg-[#111]" style={{width:`${d.s}%`}} /></div>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 rounded-xl bg-[#111]/5">
                <div className="flex items-start gap-2 mb-1.5">
                  <span className="bg-[#111] text-[#B9FF66] text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">UNIQUE</span>
                  <p className="text-xs font-semibold text-[#111]">4 categories no other tool covers</p>
                </div>
                <p className="text-[11px] text-[#111]/70 leading-relaxed">Ethical UX, cognitive accessibility, AI readiness, and conversion psychology — audited in every report.</p>
              </div>
            </div>
          </div>

          {/* Right — Text content */}
          <div>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-[#111] mb-10 tracking-tight" style={{ lineHeight: '1.1' }}>
              Why ClearUX
            </h2>

            <div className="space-y-6 mb-10">
              <p className="text-[#111]/70 text-base leading-relaxed">
                <span className="font-semibold text-[#111]">User-behavior tools</span> (Hotjar, Maze, FullStory) show you what users did. They don&apos;t tell you what&apos;s wrong with your design.
              </p>
              <p className="text-[#111]/70 text-base leading-relaxed">
                <span className="font-semibold text-[#111]">Accessibility scanners</span> (axe, WAVE, Lighthouse) catch WCAG violations. They miss dark patterns, cognitive load, and AI-agent readiness entirely.
              </p>
              <p className="text-[#111]/70 text-base leading-relaxed">
                <span className="font-semibold text-[#111]">UX consultants</span> deliver depth. They also cost $5K&ndash;15K and take weeks.
              </p>
            </div>

            <p className="text-[#111] font-semibold text-lg mb-5">ClearUX is the only audit that combines:</p>
            <div className="space-y-3 mb-10">
              {[
                'Ethical UX & dark-pattern detection',
                'Cognitive accessibility & neurodiversity',
                'AI discoverability & agent readiness',
                'Conversion psychology',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#111] flex-shrink-0" />
                  <span className="text-[#111] text-base">{item}</span>
                </div>
              ))}
            </div>

            <p className="text-[#111] text-lg font-semibold mb-8">In minutes. For $99.</p>

            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-[#111] text-[#B9FF66] text-[15px] font-semibold px-6 py-3 min-h-[48px] rounded-xl transition-all hover:brightness-110 hover:-translate-y-0.5"
            >
              Start free audit
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          PILLAR SCROLL REVEAL
          ═══════════════════════════════════════════════════════ */}
      <section className="relative pt-28 sm:pt-36 pb-24" style={{ background: 'var(--gradient-brand-subtle)' }}>
        <PillarScrollReveal categories={auditCategories} />
      </section>

      {/* ═══════════════════════════════════════════════════════
          BEYOND THE REPORT
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-32 sm:py-40 px-4 md:px-6 lg:px-8 bg-surface overflow-hidden">
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-24">
            <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-text">Beyond the report</p>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-text mb-5 tracking-tight" style={{ lineHeight: '1.1' }}>
              An audit is just the beginning.<br className="hidden sm:block" />
              <span className="text-muted">What you do next is what matters.</span>
            </h2>
            <p className="text-muted text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
              ClearUX doesn&apos;t just find problems — it gives your team a system to track fixes, prove improvement, and share progress with stakeholders.
            </p>
          </div>

          <div className="space-y-28 md:space-y-36">

            {/* ── Feature 1: Finding Status Tracking ── */}
            <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-text/5 border border-border mb-5">
                  <ListChecks size={16} className="text-text" />
                  <span className="text-xs font-semibold text-text">Finding Tracker</span>
                </div>
                <h3 className="font-heading font-semibold text-2xl sm:text-3xl text-text mb-4 tracking-tight">
                  Track every fix from<br className="hidden sm:block" /> open to resolved
                </h3>
                <p className="text-muted text-base leading-relaxed mb-5">
                  Every finding has a status: Open, In Progress, Fixed, or Backlog. Update them as your team works through the list. Your dashboard tracks the percentage resolved — proof that the investment is paying off.
                </p>
                <div className="flex flex-wrap gap-2">
                  {['Open', 'In Progress', 'Fixed', 'Backlog'].map((s, i) => {
                    const colors = ['bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', 'bg-emerald-100 text-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-500', 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'];
                    return (
                      <span key={s} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${colors[i]}`}>{s}</span>
                    );
                  })}
                </div>
              </div>
              {/* Visual mock */}
              <div className="w-full rounded-2xl bg-card/80 dark:bg-card border border-border/50 p-6 sm:p-8" aria-label="Illustrative example" data-demo="true" role="presentation">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-text/5 flex items-center justify-center"><ListChecks size={24} className="text-text" /></div>
                  <div>
                    <p className="text-sm font-semibold text-text">Issue Tracker</p>
                    <p className="text-xs text-muted">acme.com</p>
                  </div>
                  <span className="ml-auto font-heading text-4xl font-bold text-emerald-500">67<span className="text-lg">%</span></span>
                </div>
                <div className="space-y-4">
                  {[
                    { t: 'Critical findings', s: 80, resolved: '4/5' },
                    { t: 'High findings', s: 60, resolved: '3/5' },
                    { t: 'Medium findings', s: 50, resolved: '2/4' },
                  ].map((d, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-text">{d.t}</span>
                        <span className="text-sm font-bold text-text">{d.resolved}</span>
                      </div>
                      <div className="h-2 rounded-full bg-border/30 dark:bg-white/[0.06]"><div className="h-full rounded-full bg-text" style={{width:`${d.s}%`}} /></div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 rounded-xl bg-off/50 dark:bg-white/[0.03]">
                  <div className="flex items-start gap-2 mb-1.5">
                    <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">IN PROGRESS</span>
                    <p className="text-xs font-semibold text-text">Low colour contrast on CTA</p>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">Button contrast ratio is 2.8:1 — below the 4.5:1 AA minimum. Affects 12% of users with low vision.</p>
                </div>
              </div>
            </div>

            {/* ── Feature 2: Re-audit & Score Comparison ── */}
            <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div className="w-full order-2 md:order-1 rounded-2xl bg-card/80 dark:bg-card border border-border/50 p-6 sm:p-8" aria-label="Illustrative example" data-demo="true" role="presentation">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-text/5 flex items-center justify-center"><TrendingUp size={24} className="text-text" /></div>
                  <div>
                    <p className="text-sm font-semibold text-text">Score Trend</p>
                    <p className="text-xs text-muted">acme.com over 3 audits</p>
                  </div>
                  <span className="ml-auto font-heading text-4xl font-bold text-emerald-500">78</span>
                </div>
                <div className="space-y-4">
                  {[
                    { t: 'Jan 15 — Baseline', s: 42 },
                    { t: 'Feb 28 — After sprint 1', s: 61 },
                    { t: 'Apr 10 — Current', s: 78 },
                  ].map((d, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-text">{d.t}</span>
                        <span className="text-sm font-bold text-text">{d.s}</span>
                      </div>
                      <div className="h-2 rounded-full bg-border/30 dark:bg-white/[0.06]"><div className="h-full rounded-full bg-text" style={{width:`${d.s}%`}} /></div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 rounded-xl bg-off/50 dark:bg-white/[0.03]">
                  <div className="flex items-start gap-2 mb-1.5">
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">IMPROVED</span>
                    <p className="text-xs font-semibold text-text">+36 points since baseline</p>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">Score climbed from 42 to 78 across 3 audits. Foundation pillar saw the largest gain at +28 points.</p>
                </div>
              </div>
              <div className="order-1 md:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-text/5 border border-border mb-5">
                  <RefreshCw size={16} className="text-text" />
                  <span className="text-xs font-semibold text-text">Re-Audit</span>
                </div>
                <h3 className="font-heading font-semibold text-2xl sm:text-3xl text-text mb-4 tracking-tight">
                  Re-audit the same site.<br className="hidden sm:block" /> Watch your score climb.
                </h3>
                <p className="text-muted text-base leading-relaxed mb-4">
                  Implement your fixes, then re-audit the same URL. ClearUX tracks every audit so you can compare scores over time. Show your team — or your client — exactly how much you improved.
                </p>
                <p className="text-sm text-muted/80 font-medium">
                  Your dashboard shows re-audit badges and average score trends across all your audits. Every point of improvement is evidence.
                </p>
              </div>
            </div>

            {/* ── Feature 2b: After re-audit — two paths ── */}
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-10">
                <h3 className="font-heading font-semibold text-2xl sm:text-3xl text-text mb-3 tracking-tight">
                  After every re-audit, you choose
                </h3>
                <p className="text-muted text-base leading-relaxed max-w-xl mx-auto">
                  Fix what you found, or go deeper. Both options use the same credit.
                </p>
              </div>

              {/* Two-path visual */}
              <div className="relative">
                {/* Connecting line */}
                <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-[70%] bg-border" />

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Path A — Verify fixes */}
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-card p-6 sm:p-7 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                      <RefreshCw size={20} className="text-emerald-500" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Default</span>
                    <h4 className="font-heading font-semibold text-lg text-text mt-1 mb-3">Verify your fixes</h4>
                    <p className="text-muted text-sm leading-relaxed mb-5">
                      ClearUX checks every previous finding: fixed, still present, or dismissed. No new issues are introduced — your score improves predictably.
                    </p>
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      <TrendingUp size={15} />
                      <span>Score goes up as you fix</span>
                    </div>
                  </div>

                  {/* Path B — Dig deeper */}
                  <div className="rounded-xl border border-border bg-card p-6 sm:p-7 text-center">
                    <div className="w-12 h-12 rounded-full bg-text/5 flex items-center justify-center mx-auto mb-4">
                      <Search size={20} className="text-text" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">On demand</span>
                    <h4 className="font-heading font-semibold text-lg text-text mt-1 mb-3">Dig deeper</h4>
                    <p className="text-muted text-sm leading-relaxed mb-5">
                      Ready for a fresh look? A deep audit re-scans all 64 checkpoints and finds new issues that weren&apos;t in the original scope.
                    </p>
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-text">
                      <Layers size={15} />
                      <span>Expands coverage over time</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Feature 2c: Focused Pillar Re-audits ── */}
            <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-text/5 border border-border mb-5">
                  <Target size={16} className="text-text" />
                  <span className="text-xs font-semibold text-text">Focused Re-audit</span>
                </div>
                <h3 className="font-heading font-semibold text-2xl sm:text-3xl text-text mb-4 tracking-tight">
                  Re-audit only the pillars<br className="hidden sm:block" /> that matter right now.
                </h3>
                <p className="text-muted text-base leading-relaxed mb-4">
                  Scored low on Inclusive Design? Re-audit just that pillar after your fixes. No need to re-run all 64 checkpoints when you know exactly what you changed. Your previous scores stay intact for unaudited pillars.
                </p>
                <p className="text-sm text-muted/80 font-medium">
                  Available on re-audits for paying users. First audit always covers all 4 pillars for a complete baseline.
                </p>
              </div>
              {/* Visual — pillar selector mock */}
              <div className="w-full rounded-2xl bg-card/80 dark:bg-card border border-border/50 p-6 sm:p-8" aria-label="Illustrative example" data-demo="true" role="presentation">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-5">Audit scope</p>
                <div className="space-y-3">
                  {[
                    { name: 'Foundation', color: '#6366F1', checked: true, score: 82 },
                    { name: 'Human Experience', color: '#EC4899', checked: false, score: 71 },
                    { name: 'Inclusive Design', color: '#F59E0B', checked: true, score: 45 },
                    { name: 'Future Readiness', color: '#10B981', checked: false, score: 68 },
                  ].map((p, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                        p.checked
                          ? 'border-brand/40 dark:border-brand/30 bg-brand/5 dark:bg-brand/[0.06]'
                          : 'border-border/40 dark:border-white/[0.06] opacity-50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                        p.checked ? 'bg-brand' : 'border-2 border-border'
                      }`}>
                        {p.checked && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 6L5.5 8.5L9.5 3.5" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                      </div>
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      <span className="text-sm font-medium text-text flex-1">{p.name}</span>
                      <span className={`text-sm font-bold ${p.score >= 70 ? 'text-emerald-500' : p.score >= 40 ? 'text-amber-500' : 'text-red-500'}`}>{p.score}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 p-4 rounded-xl bg-off/50 dark:bg-white/[0.03]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-brand text-[#111] text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0">FOCUSED</span>
                    <p className="text-xs font-semibold text-text">2 pillars selected</p>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">Re-auditing Foundation and Inclusive Design. Previous scores for Human Experience and Future Readiness will carry forward.</p>
                </div>
              </div>
            </div>

            {/* ── Feature 3: Share with Your Team ── */}
            <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-text/5 border border-border mb-5">
                  <Share2 size={16} className="text-text" />
                  <span className="text-xs font-semibold text-text">Team Sharing</span>
                </div>
                <h3 className="font-heading font-semibold text-2xl sm:text-3xl text-text mb-4 tracking-tight">
                  Share results with anyone.<br className="hidden sm:block" /> No account needed.
                </h3>
                <p className="text-muted text-base leading-relaxed mb-4">
                  Generate a read-only link for any completed audit. Stakeholders see the overall score, pillar breakdown, top 3 recommendations, and executive summary — without needing a ClearUX account. Revoke the link anytime.
                </p>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                  <div className="flex items-center gap-1.5"><Link2 size={16} className="text-text" /> <span>Shareable link</span></div>
                  <span className="text-border">|</span>
                  <div className="flex items-center gap-1.5"><Lock size={16} className="text-text" /> <span>Revocable anytime</span></div>
                  <span className="text-border hidden sm:block">|</span>
                  <div className="flex items-center gap-1.5 hidden sm:flex"><Download size={16} className="text-text" /> <span>PDF & Word exports</span></div>
                </div>
              </div>
              {/* Visual mock — clean shared report card */}
              <div className="w-full rounded-2xl bg-card/80 dark:bg-card border border-border/50 p-6 sm:p-8" aria-label="Illustrative example" data-demo="true" role="presentation">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-text/5 flex items-center justify-center"><Share2 size={24} className="text-text" /></div>
                  <div>
                    <p className="text-sm font-semibold text-text">Shared Report</p>
                    <p className="text-xs text-muted">Read-only team view</p>
                  </div>
                  <span className="ml-auto font-heading text-4xl font-bold text-text">78</span>
                </div>
                <div className="space-y-4">
                  {[{t:'Foundation',s:72},{t:'Human Experience',s:95},{t:'Inclusive Design',s:64},{t:'Future Readiness',s:82}].map((d,i)=>(
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-text">{d.t}</span>
                        <span className="text-sm font-bold text-text">{d.s}</span>
                      </div>
                      <div className="h-2 rounded-full bg-border/30 dark:bg-white/[0.06]"><div className="h-full rounded-full bg-text" style={{width:`${d.s}%`}} /></div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 rounded-xl bg-off/50 dark:bg-white/[0.03]">
                  <div className="flex items-start gap-2 mb-1.5">
                    <span className="bg-[#B9FF66] text-[#111111] text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">SHARED</span>
                    <p className="text-xs font-semibold text-text">Stakeholder-ready link</p>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">Read-only view with score, pillar breakdown, and top 3 recommendations. No account needed. Revocable anytime.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════
          PRICING — Clean, editorial
          ═══════════════════════════════════════════════════════ */}
      <section id="pricing" className="relative py-32 sm:py-40 px-4 md:px-6 lg:px-8" style={{ background: 'var(--gradient-brand-subtle)' }}>
        <div
          ref={priceRef.ref}
          className={`max-w-4xl mx-auto relative transition-all duration-700 ${priceRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
        >
          {/* Free Audit Banner */}
          {!user && (
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
          )}

          {/* Header */}
          <div className="mb-16 relative">
            <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.5rem] font-semibold text-text mb-3 tracking-tight" style={{ lineHeight: '1.1' }}>
              Transparent pricing
            </h2>
            <p className="text-muted text-base md:text-lg max-w-lg">
              Pay per audit. No subscription, no feature gates.<br />
              Every audit gets the full 64-checkpoint analysis — nothing locked behind tiers.
            </p>
          </div>

          {/* Single Audit */}
          <div className="rounded-xl border border-border bg-card p-8 sm:p-10 mb-4 relative overflow-hidden">
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

          {/* Divider */}
          <div className="flex items-center gap-4 my-10">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted font-medium tracking-wide uppercase">Need more audits? Save with packs</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Credit packs */}
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { name: 'Growth', credits: 5, price: 399, per: '$79.80', save: 19, desc: 'Quarterly audits to catch issues each release cycle', popular: false, perks: ['Priority email support'] },
              { name: 'Agency', credits: 15, price: 999, per: '$66.60', save: 33, desc: 'Manage multiple client sites with white-label reports', perks: ['Priority email support', 'White-label PDF reports'] },
              { name: 'Scale', credits: 50, price: 2499, per: '$49.98', save: 50, desc: 'Continuous auditing across teams and products', perks: ['Dedicated support', 'White-label PDF reports', 'API access (coming soon)'] },
            ].map((pack, idx) => (
              <div
                key={idx}
                className={`group rounded-xl border bg-card p-6 hover:border-accent/40 hover:-translate-y-0.5 transition-all duration-300 ${(pack as any).popular ? 'border-accent ring-1 ring-accent/20' : 'border-border'}`}
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
                <Link
                  href="/register"
                  className="flex items-center justify-center gap-2 text-sm font-semibold rounded-xl py-3 px-6 min-h-[44px] border border-border text-text hover:bg-text hover:text-white dark:hover:bg-white dark:hover:text-text transition-all duration-200"
                >
                  Buy {pack.credits} audits
                </Link>
              </div>
            ))}
          </div>

          {/* All audits include */}
          <div className="mt-14 pt-10 border-t border-border">
            <h2 className="font-heading text-2xl font-semibold text-text mb-6">All audits include</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
              {[
                { title: 'Full 64-checkpoint analysis', desc: 'Every category, every checkpoint. No feature tiers or locked sections.' },
                { title: 'Available in 6 languages', desc: 'English, Spanish, French, German, Italian, and Portuguese. Findings and reports delivered in your chosen language.' },
                { title: 'Credits never expire', desc: 'Buy once, use whenever you need. No monthly fees, no pressure.' },
                { title: 'Instant delivery', desc: 'Reports arrive within minutes. PDF, Word, and an interactive dashboard with improvement tracking.' },
              ].map((item, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold text-text mb-1">{item.title}</p>
                  <p className="text-xs text-muted leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          CASE STUDIES — Placeholder until real quotes exist
          ═══════════════════════════════════════════════════════ */}
      <section className="py-24 sm:py-32 px-4 md:px-6 lg:px-8 relative overflow-hidden" style={{ background: '#B9FF66' }}>
        <div
          ref={testRef.ref}
          className={`max-w-2xl mx-auto text-center transition-all duration-700 ${testRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
        >
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
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FAQ
          ═══════════════════════════════════════════════════════ */}
      <FaqSection faqRef={faqRef} />

      {/* ═══════════════════════════════════════════════════════
          FINAL CTA — Clean, confident
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-36 sm:py-44 px-4 md:px-6 lg:px-8 overflow-hidden bg-[#B9FF66]">

        <div className="max-w-3xl mx-auto text-center relative z-10">
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
                <span className="opacity-30">·</span>
                <span>Share with your team</span>
                <span className="opacity-30">·</span>
                <span>Re-audit to prove improvement</span>
              </>
            ) : (
              <>
                <span>First audit free</span>
                <span className="opacity-30">·</span>
                <span>No credit card needed</span>
                <span className="opacity-30">·</span>
                <span>Results in minutes</span>
              </>
            )}
          </div>

          <p className="text-[#111111]/50 text-sm mt-6">
            Have questions? <a href="mailto:support@clearux.ai" className="underline hover:text-[#111111] transition-colors">support@clearux.ai</a> or <Link href="/contact" className="underline hover:text-[#111111] transition-colors">contact us</Link>
          </p>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  );
}
