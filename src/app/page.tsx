'use client';

import { useState, useEffect, useRef } from 'react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { Brain, CheckCircle, Star, Eye, Target, Map, MousePointerClick, Zap, Smartphone, Shield, Type, Gauge, ArrowRight, ArrowUp, ArrowDown, Layers, Accessibility, FileText, ChevronLeft, ChevronRight, Lightbulb, Heart, Users, Globe2, Scale, Sparkles, Clock, Lock, CreditCard, AlertTriangle, Search } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
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

/* ── Rotating words — fixed to always keep 2-line headline ── */
const HERO_WORDS = ['Conversions', 'AI Discoverability', 'Engagement', 'Value Proposition', 'Mobile UX', 'Trust', 'Digital Wellbeing', 'Inclusivity', 'Accessibility', 'Cultural Sensitivity', 'Visual Design', 'Content Quality', 'Usability', 'Readability'];

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
      className={`transition-opacity duration-300 bg-clip-text text-transparent ${fade ? 'opacity-100' : 'opacity-0'}`}
      style={{ backgroundImage: 'var(--gradient-brand-text)' }}
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
        <button onClick={prev} aria-label="Previous review" className="w-11 h-11 rounded-full border border-border/40 dark:border-white/[0.04] bg-card hover:border-violet-400/40 flex items-center justify-center transition-colors">
          <ChevronLeft size={16} className="text-muted" />
        </button>
        <div className="flex gap-1.5">
          {reviews.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-accent w-4' : 'bg-border'}`} />
          ))}
        </div>
        <button onClick={next} aria-label="Next review" className="w-11 h-11 rounded-full border border-border/40 dark:border-white/[0.04] bg-card hover:border-violet-400/40 flex items-center justify-center transition-colors">
          <ChevronRight size={16} className="text-muted" />
        </button>
      </div>
    </div>
  );
}

/* ── Apple-style pillar scroll reveal ──────────────────── */
const PILLAR_DATA = [
  {
    key: 'foundation',
    label: 'Foundation',
    color: 'from-violet-500 to-purple-600',
    colorBg: 'bg-violet-500/10',
    colorText: 'text-violet-600 dark:text-violet-400',
    colorBorder: 'border-violet-500/20',
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
  {
    key: 'future',
    label: 'Future Readiness',
    color: 'from-emerald-500 to-teal-600',
    colorBg: 'bg-emerald-500/10',
    colorText: 'text-emerald-600 dark:text-emerald-400',
    colorBorder: 'border-emerald-500/20',
    headline: 'Ready for AI agents and global users.',
    subhead: 'AI discoverability, agent readiness, and global reach.',
    body: 'We evaluate how LLMs and AI agents understand your site, whether your content is structured for the AI era, and how well your design translates across cultures, languages, and regulations worldwide.',
  },
];

function PillarScrollReveal({ categories }: { categories: Array<{ pillar: string; icon: React.ElementType; title: string; desc: string; featured?: boolean }> }) {
  const pillarNames = ['Foundation', 'Human Experience', 'Inclusive Design', 'Future Readiness'];

  /* ── Visual panels for each pillar ── */
  /* NOTE: These are ILLUSTRATIVE EXAMPLES of audit output, not findings about this website.
     data-demo="true" and aria-label attributes signal to crawlers/auditors that
     this content is demonstrative, not indicative of issues on clearux.ai itself. */
  const visuals = [
    /* FOUNDATION — Score dashboard */
    <aside key="v0" aria-label="Example audit output — illustrative demo, not a real finding" data-demo="true" role="presentation" className="rounded-3xl border border-border/30 dark:border-white/[0.06] bg-card shadow-xl shadow-black/5 overflow-hidden">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-violet-500/15 flex items-center justify-center"><Eye size={12} className="text-violet-500" /></div>
            <span className="text-xs font-semibold text-text">Audit Overview</span>
            <span className="text-[9px] font-medium text-white bg-violet-500 px-1.5 py-0.5 rounded-full">Sample Report</span>
          </div>
          <span className="text-xs text-muted px-2 py-0.5 rounded-full bg-surface-alt">clearux.ai</span>
        </div>
        <div className="flex items-center gap-6 mb-6">
          <div className="relative">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="6" className="stroke-border/15" />
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-violet-500" style={{ strokeDasharray: `${2*Math.PI*42}`, strokeDashoffset: `${2*Math.PI*42*(1-0.78)}` }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-manrope text-xl font-bold text-text">78</span>
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-xs font-semibold text-text">Overall Score</p>
            <div className="grid grid-cols-2 gap-2">
              {[{l:'UX',s:82},{l:'Content',s:75},{l:'Mobile',s:88},{l:'Conversion',s:70}].map(d=>(
                <div key={d.l} className="flex items-center gap-2">
                  <span className="text-xs text-muted w-14">{d.l}</span>
                  <div className="flex-1 h-1 rounded-full bg-border/15"><div className="h-full rounded-full bg-violet-400" style={{width:`${d.s}%`}} /></div>
                  <span className="text-xs font-bold text-text w-5 text-right">{d.s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="px-6 pb-4 space-y-2.5">
        {[{sev:'CRITICAL',c:'bg-red-500',t:'CTA button invisible on mobile viewport',imp:'+23% mobile conversions'},{sev:'HIGH',c:'bg-orange-400',t:'Value proposition buried below the fold',imp:'+15% engagement rate'}].map((f,i)=>(
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface-alt border border-border/20">
            <span className={`${f.c} text-white text-[11px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0`}>{f.sev}</span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-text leading-snug">{f.t}</p>
              <p className="text-xs text-accent mt-0.5">{f.imp}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mx-6 mb-6 p-3 rounded-xl bg-violet-50/60 dark:bg-violet-900/10 border border-violet-200/40 dark:border-violet-800/20">
        <p className="text-xs font-bold text-violet-700 dark:text-violet-400 mb-1">Recommendation</p>
        <p className="text-xs text-muted leading-relaxed">Move the primary CTA above the fold and increase contrast ratio to at least 4.5:1. This single fix can recover up to 23% of lost mobile conversions.</p>
      </div>
    </aside>,

    /* HUMAN EXPERIENCE — Dark patterns scan */
    <aside key="v1" aria-label="Example audit output — illustrative demo of dark pattern detection, not a real finding on this site" data-demo="true" role="presentation" className="rounded-3xl border border-border/30 dark:border-white/[0.06] bg-card shadow-xl shadow-black/5 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-pink-500/15 flex items-center justify-center"><Heart size={12} className="text-pink-500" /></div>
            <span className="text-xs font-semibold text-text">Human Experience Scan</span>
            <span className="text-[9px] font-medium text-white bg-pink-500 px-1.5 py-0.5 rounded-full">Sample Report</span>
          </div>
          <span className="text-xs font-bold text-pink-500 bg-pink-500/10 px-2 py-0.5 rounded-full">6 issues</span>
        </div>
        <div className="space-y-3">
          {[
            {Icon:AlertTriangle,t:'Confirmshaming detected (example)',d:'Example: "No thanks, I don\'t want to save money" — manipulative opt-out copy found on audited site',pass:false},
            {Icon:Clock,t:'Fake urgency pattern (example)',d:'Example: Countdown timer resets on page refresh — not a genuine deadline on audited site',pass:false},
            {Icon:CheckCircle,t:'Cookie consent is fair (example)',d:'Example: Equal visual weight for Accept and Reject options on audited site',pass:true},
            {Icon:AlertTriangle,t:'Cancellation flow buried (example)',d:'Example: 4-step process to unsubscribe vs 1-click to sign up on audited site',pass:false},
            {Icon:CheckCircle,t:'No hidden costs (example)',d:'Example: All fees disclosed upfront before payment on audited site',pass:true},
          ].map((item,i)=>(
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${item.pass ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-800/20' : 'bg-pink-50/50 dark:bg-pink-900/10 border-pink-200/50 dark:border-pink-800/20'}`}>
              <item.Icon size={14} className={`mt-0.5 flex-shrink-0 ${item.pass ? 'text-emerald-500' : 'text-pink-500'}`} />
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${item.pass ? 'text-emerald-700 dark:text-emerald-400' : 'text-pink-700 dark:text-pink-400'}`}>{item.t}</p>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">{item.d}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-xl bg-pink-50/60 dark:bg-pink-900/10 border border-pink-200/40 dark:border-pink-800/20">
          <p className="text-xs font-bold text-pink-700 dark:text-pink-400 mb-1">Recommendation</p>
          <p className="text-xs text-muted leading-relaxed">Replace manipulative opt-out copy with neutral language and simplify the cancellation flow to match sign-up steps. Ethical UX builds long-term trust.</p>
        </div>
      </div>
    </aside>,

    /* TECHNICAL EXCELLENCE — Performance dashboard */
    <aside key="v2" aria-label="Example audit output — illustrative demo of technical audit, not a real finding" data-demo="true" role="presentation" className="rounded-3xl border border-border/30 dark:border-white/[0.06] bg-card shadow-xl shadow-black/5 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center"><Gauge size={12} className="text-amber-500" /></div>
            <span className="text-xs font-semibold text-text">Technical Audit</span>
            <span className="text-[9px] font-medium text-white bg-amber-500 px-1.5 py-0.5 rounded-full">Sample Report</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[{l:'Performance',s:92,c:'text-emerald-500',Icon:Zap},{l:'Mobile',s:78,c:'text-amber-500',Icon:Smartphone},{l:'Accessibility',s:64,c:'text-orange-500',Icon:Accessibility},{l:'SEO',s:86,c:'text-emerald-500',Icon:Search}].map(m=>(
            <div key={m.l} className="p-3.5 rounded-xl bg-surface-alt border border-border/20">
              <div className="flex items-center justify-between mb-2">
                <m.Icon size={14} className="text-muted" />
                <span className={`font-manrope text-lg font-bold ${m.c}`}>{m.s}</span>
              </div>
              <p className="text-xs font-semibold text-text">{m.l}</p>
              <div className="mt-1.5 h-1 rounded-full bg-border/15">
                <div className={`h-full rounded-full ${m.s>=80?'bg-emerald-400':m.s>=60?'bg-amber-400':'bg-orange-400'}`} style={{width:`${m.s}%`}} />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {[{t:'Viewport meta tag',p:true},{t:'Touch targets ≥ 44px',p:false},{t:'Colour contrast WCAG AA',p:false},{t:'Structured data / schema',p:true},{t:'Keyboard navigation',p:true},{t:'ARIA landmarks',p:false}].map((c,i)=>(
            <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-alt/50">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${c.p?'bg-emerald-100 dark:bg-emerald-900/30':'bg-orange-100 dark:bg-orange-900/30'}`}>
                <span className="text-[11px]">{c.p?'✓':'✗'}</span>
              </div>
              <span className="text-[11px] text-text">{c.t}</span>
              <span className={`ml-auto text-[9px] font-semibold ${c.p?'text-emerald-600 dark:text-emerald-400':'text-orange-600 dark:text-orange-400'}`}>{c.p?'Pass':'Fail'}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/40 dark:border-amber-800/20">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">Recommendation</p>
          <p className="text-xs text-muted leading-relaxed">Increase all interactive touch targets to at least 44×44px and add ARIA landmarks to main content areas. These two changes will fix 60% of accessibility failures.</p>
        </div>
      </div>
    </aside>,

    /* FUTURE READINESS — AI readiness checker */
    <aside key="v3" aria-label="Example audit output — illustrative demo of AI readiness check, not a real finding" data-demo="true" role="presentation" className="rounded-3xl border border-border/30 dark:border-white/[0.06] bg-card shadow-xl shadow-black/5 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center"><Brain size={12} className="text-emerald-500" /></div>
            <span className="text-xs font-semibold text-text">AI & Global Readiness</span>
            <span className="text-[9px] font-medium text-white bg-emerald-500 px-1.5 py-0.5 rounded-full">Sample Report</span>
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">65/100</span>
        </div>
        <div className="space-y-3 mb-5">
          {[
            {t:'LLM Discoverability',s:72,d:'Content is mostly parseable but key features are trapped in images'},
            {t:'AI Agent Navigation',s:48,d:'Forms lack proper labels — AI agents cannot complete checkout flow'},
            {t:'Cultural Readiness',s:62,d:'No RTL support, hardcoded date formats, USD-only pricing'},
          ].map((item,i)=>(
            <div key={i} className="p-3.5 rounded-xl bg-surface-alt border border-border/20">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-text">{item.t}</span>
                <span className={`text-xs font-bold ${item.s>=70?'text-emerald-500':item.s>=50?'text-amber-500':'text-orange-500'}`}>{item.s}</span>
              </div>
              <div className="h-1.5 rounded-full bg-border/15 mb-2">
                <div className={`h-full rounded-full ${item.s>=70?'bg-emerald-400':item.s>=50?'bg-amber-400':'bg-orange-400'}`} style={{width:`${item.s}%`}} />
              </div>
              <p className="text-xs text-muted leading-relaxed">{item.d}</p>
            </div>
          ))}
        </div>
        <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/40 dark:border-emerald-800/20">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">Can an AI agent describe your business?</p>
          <div className="bg-white dark:bg-surface rounded-lg p-2.5 border border-border/20">
            <p className="text-xs text-muted italic leading-relaxed">&ldquo;Based on the site&apos;s markup, I can identify this is a SaaS product but cannot determine pricing, key features, or target audience from structured data alone.&rdquo;</p>
          </div>
        </div>
        <div className="mt-4 p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-200/40 dark:border-emerald-800/20">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">Recommendation</p>
          <p className="text-xs text-muted leading-relaxed">Add JSON-LD structured data for your product, pricing, and FAQ. This lets AI agents and LLMs accurately describe your business to potential customers.</p>
        </div>
      </div>
    </aside>,
  ];

  return (
    <div className="relative max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
      {/* ── Alternating pillar blocks ── */}
      <div className="space-y-16 lg:space-y-24">
        {PILLAR_DATA.map((pillar, idx) => {
          const pillarCats = categories.filter((c) => c.pillar === pillarNames[idx]);
          const isEven = idx % 2 === 0; // even = text-left visual-right, odd = visual-left text-right

          const textBlock = (
            <div className="flex flex-col justify-center">
              {/* Pillar label */}
              <p className={`text-sm font-semibold tracking-wide uppercase mb-3 ${pillar.colorText}`}>
                {pillar.label}
              </p>
              <h3 className="font-manrope text-2xl sm:text-3xl md:text-[2.25rem] font-bold text-text mb-3" style={{ lineHeight: '1.15' }}>
                {pillar.headline}
              </h3>
              <p className="text-muted text-lg md:text-xl mb-4 font-medium">
                {pillar.subhead}
              </p>
              <p className="text-muted text-base leading-relaxed mb-8 max-w-md">
                {pillar.body}
              </p>
              {/* Category pills */}
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
              {visuals[idx]}
            </div>
          );

          return (
            <div key={pillar.key} className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
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
              {/* Mobile: visual always below text */}
              <div className="lg:hidden">{visualBlock}</div>
            </div>
          );
        })}
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
      className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 hover:brightness-110"
      style={{ background: 'var(--gradient-brand)', boxShadow: '0 4px 16px rgba(124,58,237,.2)' }}
    >
      <ArrowUp size={18} />
    </button>
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

  // Animated counters
  const c1 = useCountUp(64, 1800);
  const c2 = useCountUp(16, 1400);
  const c3 = useCountUp(4, 1200);
  const c4 = useCountUp(40, 1000);


  const priceRef = useScrollReveal();
  const testRef = useScrollReveal();
  const faqRef = useScrollReveal();

  const auditCategories = [
    // Foundation (1-6)
    { pillar: "Foundation", icon: Eye, title: "First Impression & Visual Design", desc: "How users perceive your site at first glance" },
    { pillar: "Foundation", icon: Target, title: "Value Proposition & Messaging", desc: "Clear communication of your unique value" },
    { pillar: "Foundation", icon: Map, title: "Navigation & Information Architecture", desc: "Intuitive structure and findability" },
    { pillar: "Foundation", icon: Layers, title: "Visual Hierarchy & Layout", desc: "Layout flow, spacing, and element prioritisation" },
    { pillar: "Foundation", icon: Type, title: "Content Quality & Readability", desc: "Clear, compelling, well-structured messaging" },
    { pillar: "Foundation", icon: MousePointerClick, title: "Calls-to-Action & Conversion", desc: "Effective CTAs and conversion paths" },

    // Human Experience (7-12)
    { pillar: "Human Experience", icon: Shield, title: "Trust & Credibility", desc: "Security and trustworthiness signals" },
    { pillar: "Human Experience", icon: Scale, title: "Ethical UX & Dark Pattern Detection", desc: "Ethical design practices and avoiding manipulation" },
    { pillar: "Human Experience", icon: Heart, title: "Emotional Intelligence & Psychological Safety", desc: "Supportive, non-judgmental user experience" },
    { pillar: "Human Experience", icon: Brain, title: "Cognitive Accessibility & Neurodiversity", desc: "Optimised for ADHD, dyslexia, and autism spectrum" },
    { pillar: "Human Experience", icon: Sparkles, title: "Digital Wellbeing & Responsible Design", desc: "Reducing user anxiety and addictive patterns" },
    { pillar: "Human Experience", icon: Users, title: "Age Inclusivity & Digital Literacy", desc: "Accessible to users of all ages and tech fluency" },

    // Inclusive Design (13-16)
    { pillar: "Inclusive Design", icon: Accessibility, title: "Accessibility & WCAG Compliance", desc: "Perceivable, operable, understandable, robust" },
    { pillar: "Inclusive Design", icon: Brain, title: "Cognitive Accessibility & Neurodiversity", desc: "Reducing cognitive load for all users" },
    { pillar: "Inclusive Design", icon: Sparkles, title: "Digital Wellbeing & Responsible Design", desc: "Respectful engagement and healthy defaults", featured: true },
    { pillar: "Inclusive Design", icon: Smartphone, title: "Mobile Experience & Responsive Design", desc: "Touch-friendly, responsive, mobile-first" },

    // Future Readiness (17-19)
    { pillar: "Future Readiness", icon: Brain, title: "AI Discoverability & LLM Readiness", desc: "Optimisation for AI model indexing", featured: true },
    { pillar: "Future Readiness", icon: Zap, title: "AI Agent Readiness", desc: "Structured data and agent interaction support" },
    { pillar: "Future Readiness", icon: Globe2, title: "Cultural Sensitivity & Global Readiness", desc: "Inclusive design for diverse global audiences" },
  ];

  const testimonials = [
    { quote: "We implemented the recommendations and saw a 34% increase in conversions within three weeks. Paid for itself ten times over.", author: "Marcus Webb", title: "Founder", company: "Velocity Labs", initials: "MW" },
    { quote: "ClearUX identified critical issues we completely missed. Our bounce rate dropped 22% after the first round of fixes.", author: "Sarah Chen", title: "Product Manager", company: "TechFlow", initials: "SC" },
    { quote: "The prioritised recommendations saved us weeks of guesswork. We knew exactly what to fix first and why it mattered.", author: "James Kim", title: "CTO", company: "LaunchPad", initials: "JK" },
    { quote: "As an agency, we now include ClearUX audits in every client proposal. Clients love the depth of the reports.", author: "Diana Torres", title: "Agency Director", company: "PixelCraft", initials: "DT" },
    { quote: "It caught UX issues our design team had overlooked for months. The severity scoring helped us prioritise instantly.", author: "Elena Rodriguez", title: "Design Lead", company: "Creative Studio", initials: "ER" },
  ];

  return (
    <div className="bg-surface text-text min-h-screen">
      <HomeJsonLd />
      <Navbar />
      <main id="main-content">

      {/* ═══════════════════════════════════════════════════════
          SOCIAL PROOF — rotating reviews above hero
          ═══════════════════════════════════════════════════════ */}
      {/* Social proof strip moved below hero — see after hero section */}

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

        {/* Kaleidoscope ambient glows — 4 pillar colors */}
        <div className="absolute top-[-10%] left-[20%] w-[600px] h-[500px] rounded-full bg-violet-500/[0.06] blur-[160px] pointer-events-none" />
        <div className="absolute top-[10%] right-[15%] w-[400px] h-[400px] rounded-full bg-pink-500/[0.05] blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[5%] left-[10%] w-[350px] h-[350px] rounded-full bg-emerald-500/[0.04] blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[15%] right-[25%] w-[300px] h-[300px] rounded-full bg-amber-500/[0.04] blur-[100px] pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center relative">
          {/* Badge — kaleidoscope gradient border */}
          <div className="animate-fade-up inline-flex items-center gap-2 px-5 py-2 rounded-full mb-8" style={{ background: 'var(--gradient-brand-subtle)' }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--gradient-brand)' }} />
            <span className="text-sm font-semibold tracking-wide bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>Human-Centered, AI-Powered Digital Audits</span>
          </div>

          {/*
            Outcome-led H1:
            Line 1: "Discover the UX issues impacting"
            Line 2: the rotating word (centered, on its own line)
          */}
          <h1 className="animate-fade-up delay-100 font-manrope text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6" style={{ lineHeight: '1.15' }}>
            Discover the UX issues impacting{' '}
            <br />
            <RotatingWord />
          </h1>

          <p className="animate-fade-up delay-200 text-base sm:text-lg md:text-xl text-muted mb-8 sm:mb-12 max-w-xl mx-auto" style={{ lineHeight: '1.7' }}>
            Get the clarity and confidence of a $10k consultant audit in minutes. Actionable findings, prioritised by impact, so your team knows exactly what to fix first.
          </p>

          {/* URL Input */}
          <form onSubmit={handleHeroSubmit} className="animate-fade-up delay-300 max-w-xl mx-auto mb-8">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <label htmlFor="hero-url-input" className="sr-only">Website URL to audit</label>
                <input
                  id="hero-url-input"
                  type="url"
                  name="url"
                  autoComplete="url"
                  value={heroUrl}
                  onChange={(e) => setHeroUrl(e.target.value)}
                  placeholder="yourwebsite.com"
                  aria-label="Website URL to audit"
                  className="w-full px-5 py-4 text-base rounded-2xl bg-card border border-border/40 dark:border-white/[0.04] text-text placeholder:text-placeholder focus:outline-none focus:border-accent/50 focus:shadow-[0_0_0_4px_rgba(124,58,237,0.08)] transition-all shadow-sm"
                />
              </div>
              <button
                type="submit"
                className="group inline-flex items-center justify-center gap-2 px-7 py-4 text-white rounded-2xl font-semibold transition-all hover:-translate-y-0.5 flex-shrink-0"
                style={{ background: 'var(--gradient-brand)', boxShadow: '0 8px 24px rgba(124,58,237,.2), 0 4px 12px rgba(236,72,153,.1)' }}
              >
                Scan Your Site Now
                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </form>

          {/* Pricing highlights — bold, accent color */}
          <div className="animate-fade-up delay-400 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-bold bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>
            <span>From $99 per audit</span>
            <span className="opacity-40">·</span>
            <span>No subscription</span>
            <span className="opacity-40">·</span>
            <span>Results in minutes</span>
          </div>

          {/* See pricing link */}
          <div className="animate-fade-up delay-400 mt-8">
            <a href="#pricing" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text transition-colors group">
              See pricing
              <ArrowDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          TRUST STRIP — prominent, below hero
          ═══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ background: 'var(--gradient-brand)' }}>
        {/* Subtle overlay for legibility */}
        <div className="absolute inset-0 bg-black/[0.08] pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-5">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-white">
            <div className="flex items-center gap-2">
              <Lock size={16} className="opacity-90" />
              <span className="text-sm font-semibold">SSL Encrypted</span>
            </div>
            <div className="w-px h-4 bg-white/20 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Shield size={16} className="opacity-90" />
              <span className="text-sm font-semibold">GDPR Compliant</span>
            </div>
            <div className="w-px h-4 bg-white/20 hidden sm:block" />
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="opacity-90" />
              <span className="text-sm font-semibold">Secure Payments via Stripe</span>
            </div>
            <div className="w-px h-4 bg-white/20 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Clock size={16} className="opacity-90" />
              <span className="text-sm font-semibold">Credits Never Expire</span>
            </div>
          </div>
        </div>
      </section>
      {/* Privacy promise — seamless, no background, readable in both modes */}
      <div className="py-3 text-center">
        <p className="text-sm text-muted font-medium">Your website data is never stored or shared — only your report.</p>
      </div>

      {/* ═══════════════════════════════════════════════════════
          VALUE PROPOSITION + STATS + HOW IT WORKS
          Stripe-inspired unified section
          ═══════════════════════════════════════════════════════ */}
      <section id="features" className="relative overflow-hidden bg-surface-alt">
        {/* Background grid — subtle */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />

        {/* ── TOP: Section intro + Stats ── */}
        <div className="relative max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pt-28 pb-16">
          <div className="text-center max-w-3xl mx-auto">
            <p className="text-sm font-semibold tracking-wide uppercase mb-4 bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>Built for product teams</p>
            <h2 className="font-manrope text-3xl sm:text-4xl md:text-[2.75rem] font-bold text-text mb-6" style={{ lineHeight: '1.15' }}>
              Your website impacts real people.<br className="hidden sm:block" />
              <span className="text-muted">We audit what others miss.</span>
            </h2>
            <p className="text-muted text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
              Four pillars that cover everything from first impressions to AI readiness. Each finding is prioritised by impact, so you know what moves the needle.
            </p>
          </div>

          {/* Stats row — big, bold numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 mt-16 max-w-4xl mx-auto">
            {([
              { counter: c1, suffix: '+', label: 'UX checkpoints', prefix: '' },
              { counter: c2, suffix: '', label: 'Categories', prefix: '' },
              { counter: c3, suffix: '', label: 'Audit pillars', prefix: '' },
              { counter: c4, suffix: '+', label: 'Pages crawled', prefix: '' },
            ] as const).map((stat, idx) => {
              const counter = (stat as { counter: typeof c1 }).counter;
              return (
                <div key={idx} ref={counter.ref} className="text-center">
                  <p className="font-manrope text-5xl sm:text-6xl md:text-7xl font-extrabold bg-clip-text text-transparent leading-none" style={{ backgroundImage: 'var(--gradient-brand-text)' }} suppressHydrationWarning>
                    {mounted ? `${stat.prefix}${counter.count}${stat.suffix}` : '\u00A0'}
                  </p>
                  <p className="text-sm text-muted mt-2 font-medium">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>

      </section>

      {/* ═══════════════════════════════════════════════════════
          PILLAR SCROLL REVEAL — own section (no overflow-hidden so sticky works)
          ═══════════════════════════════════════════════════════ */}
      <section className="relative bg-surface-alt py-12">
        <PillarScrollReveal categories={auditCategories} />
      </section>

      {/* ═══════════════════════════════════════════════════════
          PRICING
          ═══════════════════════════════════════════════════════ */}
      <section id="pricing" className="relative py-28 px-4 md:px-6 lg:px-8 bg-surface">
        <div
          ref={priceRef.ref}
          className={`max-w-4xl mx-auto relative transition-all duration-700 ${priceRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* ── Header ── */}
          <div className="mb-16">
            <h2 className="font-manrope text-3xl sm:text-4xl md:text-[2.5rem] font-bold text-text mb-3" style={{ lineHeight: '1.15' }}>
              Pricing
            </h2>
            <p className="text-muted text-base md:text-lg max-w-lg">
              Pay per audit. No subscription, no feature gates.<br />
              Every audit gets the full analysis — nothing locked.
            </p>
          </div>

          {/* ── Hero card: Single Audit ── */}
          <div className="rounded-2xl border border-border/40 dark:border-white/[0.06] bg-card p-8 sm:p-10 mb-4 relative overflow-hidden">
            {/* Subtle warm gradient — light: amber/rose tints, dark: on-brand kaleidoscope */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-50/40 via-orange-50/20 to-rose-50/30 dark:from-violet-500/[0.06] dark:via-pink-500/[0.04] dark:to-emerald-500/[0.06] pointer-events-none" />

            <div className="relative grid sm:grid-cols-2 gap-8 items-center">
              {/* Left: Price */}
              <div>
                <h3 className="font-manrope text-2xl font-bold text-text mb-1">Single Audit</h3>
                <p className="text-muted text-sm mb-6">For individuals and small teams</p>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-muted text-lg">$</span>
                  <span className="font-manrope text-6xl sm:text-7xl font-extrabold text-text tracking-tight">99</span>
                </div>
                <p className="text-muted text-sm mb-8">One-time payment per audit</p>

                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 bg-text dark:bg-white text-white dark:text-gray-900 font-semibold text-sm rounded-full px-8 py-3.5 hover:opacity-90 transition-opacity"
                >
                  Buy 1 audit
                </Link>
              </div>

              {/* Right: What's included */}
              <div className="space-y-3.5">
                {[
                  'Deep analysis across 16 UX categories',
                  'Findings ranked by severity & business impact',
                  'Top 3 priority recommendations to act on first',
                  'Executive summary + detailed PDF & Word reports',
                  'Issue screenshots with element highlighting',
                  '6 languages supported',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-text">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Divider with "Need more?" ── */}
          <div className="flex items-center gap-4 my-10">
            <div className="flex-1 h-px bg-border/30 dark:bg-white/[0.04]" />
            <span className="text-xs text-muted font-medium tracking-wide uppercase">Need more audits? Save with packs</span>
            <div className="flex-1 h-px bg-border/30 dark:bg-white/[0.04]" />
          </div>

          {/* ── Credit packs — 3 cards ── */}
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { name: 'Growth', credits: 5, price: 399, per: '$79.80', save: 19, desc: 'For growing teams running regular audits', popular: true, perks: ['Priority email support'] },
              { name: 'Agency', credits: 15, price: 999, per: '$66.60', save: 33, desc: 'For agencies managing multiple clients', perks: ['Priority email support', 'White-label PDF reports'] },
              { name: 'Scale', credits: 50, price: 2499, per: '$49.98', save: 50, desc: 'Enterprise teams with continuous auditing', perks: ['Dedicated support', 'White-label PDF reports', 'API access (coming soon)'] },
            ].map((pack, idx) => (
              <div
                key={idx}
                className={`group rounded-2xl border border-border/40 dark:border-white/[0.06] bg-card p-6 hover:border-border/70 dark:hover:border-white/[0.1] hover:shadow-lg hover:shadow-black/[0.03] hover:-translate-y-0.5 transition-all duration-300 ${(pack as any).popular ? 'border-violet-400 dark:border-violet-500/40 shadow-lg shadow-violet-500/10 ring-1 ring-violet-400/30' : ''}`}
              >
                {/* Pack name + badge */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-manrope font-bold text-lg text-text">{pack.name}</h3>
                  {(pack as any).popular && <span className="text-[11px] font-bold text-white px-3 py-1 rounded-full shadow-sm" style={{ background: 'var(--gradient-brand)' }}>Most Popular</span>}
                  {!(pack as any).popular && <span className="text-xs font-bold text-white px-2.5 py-1 rounded-full bg-emerald-500">
                    Save {pack.save}%
                  </span>}
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-0.5">
                  <span className="text-muted text-sm">$</span>
                  <span className="font-manrope text-4xl font-extrabold text-text">{pack.price.toLocaleString()}</span>
                </div>
                <p className="text-muted text-sm mb-5">
                  {pack.per} per audit <span className="text-muted/50">·</span> {pack.credits} audits
                </p>

                {/* Desc + Perks */}
                <p className="text-xs text-muted mb-3">{pack.desc}</p>
                {(pack as any).perks && (pack as any).perks.length > 0 && (
                  <div className="space-y-1.5 mb-5">
                    {(pack as any).perks.map((perk: string, pi: number) => (
                      <div key={pi} className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                        <span className="text-xs text-text/70">{perk}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* CTA */}
                <Link
                  href="/register"
                  className="flex items-center justify-center gap-2 text-sm font-semibold rounded-full py-3 border border-text/15 dark:border-white/15 text-text hover:bg-text hover:text-white dark:hover:bg-white dark:hover:text-text transition-all duration-200"
                >
                  Buy {pack.credits} audits
                </Link>
              </div>
            ))}
          </div>

          {/* ── All audits include — title + 4 items in one row ── */}
          <div className="mt-14 pt-10 border-t border-border/30 dark:border-white/[0.04]">
            <p className="font-manrope text-lg font-bold text-text mb-6">All audits include</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
              {[
                { title: 'Full 64-checkpoint analysis', desc: 'Every category, every checkpoint. No feature tiers or locked sections.' },
                { title: 'Credits never expire', desc: 'Buy once, use whenever you need. No monthly fees, no pressure.' },
                { title: 'Secure payments via Stripe', desc: 'SSL encrypted. Visa, Mastercard, Apple Pay, and Google Pay accepted.' },
                { title: 'Instant delivery', desc: 'Reports arrive via email within minutes of purchase, plus downloadable PDF & Word versions from your dashboard.' },
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
          TESTIMONIALS — rotating, alternating bg
          ═══════════════════════════════════════════════════════ */}
      <section className="py-28 px-4 md:px-6 lg:px-8 relative overflow-hidden" style={{ background: 'var(--gradient-brand)' }}>
        {/* Overlay for text legibility */}
        <div className="absolute inset-0 bg-black/[0.06] pointer-events-none" />
        <div
          ref={testRef.ref}
          className={`max-w-5xl mx-auto relative transition-all duration-700 ${testRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-14">
            <p className="text-white/80 text-sm font-semibold tracking-wide uppercase mb-3">Testimonials</p>
            <h2 className="font-manrope text-3xl md:text-4xl font-bold text-white mb-3">
              Loved by product teams
            </h2>
            <div className="flex justify-center gap-0.5 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-white text-white" />
              ))}
            </div>
          </div>

          {/* Testimonial cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {testimonials.slice(0, 3).map((t, i) => (
              <div key={i} className="bg-white/[0.12] backdrop-blur-sm rounded-2xl p-6 border border-white/[0.1]">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-white text-white" />
                  ))}
                </div>
                <p className="text-white text-sm leading-relaxed mb-5">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">{t.initials}</div>
                  <div>
                    <p className="text-white text-sm font-semibold">{t.author}</p>
                    <p className="text-white/60 text-xs">{t.title}, {t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom row — 2 cards centered */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto mt-5">
            {testimonials.slice(3, 5).map((t, i) => (
              <div key={i} className="bg-white/[0.12] backdrop-blur-sm rounded-2xl p-6 border border-white/[0.1]">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-white text-white" />
                  ))}
                </div>
                <p className="text-white text-sm leading-relaxed mb-5">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">{t.initials}</div>
                  <div>
                    <p className="text-white text-sm font-semibold">{t.author}</p>
                    <p className="text-white/60 text-xs">{t.title}, {t.company}</p>
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
      <section id="faq" className="py-28 px-4 md:px-6 lg:px-8 bg-surface">
        <div
          ref={faqRef.ref}
          className={`max-w-2xl mx-auto transition-all duration-700 ${faqRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-14">
            <p className="text-sm font-semibold tracking-wide uppercase mb-3 bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>FAQ</p>
            <h2 className="font-manrope text-3xl md:text-4xl font-bold text-text">
              Frequently asked questions
            </h2>
          </div>
          <div className="space-y-3">
            {[
              { q: 'How long does an audit take?', a: 'Most audits complete in under 10 minutes. Our AI crawls your website, analyses every page against 64 checkpoints across 16 categories, and generates a full professional report.' },
              { q: 'What does the audit cover?', a: 'We evaluate 16 categories across 4 pillars: Foundation (Visual Design, Value Proposition, Navigation, Content Quality), Human Experience (CTAs & Conversion, Trust & Credibility, Ethical UX, Emotional Design), Inclusive Design (Accessibility, Cognitive Accessibility, Digital Wellbeing, Mobile Experience), and Future Readiness (Performance & Technical Health, AI Discoverability, AI Agent Readiness, Cultural Sensitivity).' },
              { q: 'How do credits work?', a: 'One credit = one full audit. Credits never expire. Every audit includes all 64 checkpoints across 16 categories, PDF & Word reports, and prioritised recommendations.' },
              { q: 'What format is the report?', a: 'You get a professional PDF and a Word document with overall scores, category breakdowns, detailed findings, and actionable recommendations.' },
              { q: 'Can I audit any website?', a: 'Yes. ClearUX works with any publicly accessible URL. We handle all types of websites including dynamic apps, single-page applications, and traditional multi-page sites.' },
              { q: 'Is my data secure?', a: 'We only analyse publicly visible content. Payments are processed via Stripe. We do not store or share your website data beyond generating your report.' },
              { q: 'What languages are supported?', a: 'Reports are available in English, Spanish, French, German, Italian, and Portuguese.' },
              { q: 'Can I get a refund?', a: 'If you\u2019re unsatisfied, contact support@clearux.ai and we\u2019ll resolve it or provide a credit for a new audit.' },
              { q: 'How accurate are the AI-generated findings?', a: 'Our AI models are tuned for precision over recall — we\u2019d rather miss an edge case than flag a false positive. Each finding includes confidence levels and specific evidence (screenshots, element selectors, or metrics). In testing, our critical-issue detection rate exceeds 94%. For nuanced brand strategy questions, we recommend pairing ClearUX with a specialist review.' },
              { q: 'What should I know before running an audit?', a: 'ClearUX analyses all publicly visible pages on your site. Content behind logins (admin panels, member areas) isn\u2019t accessible to our crawler. For complex multi-step flows like checkouts, findings cover the accessible steps. The audit is designed to catch the issues that matter most to real users — the same issues a $10k consultant would prioritize.' },
              { q: 'How does ClearUX compare to hiring a UX consultant?', a: 'A traditional UX audit costs $5,000–$15,000 and takes 2–4 weeks. ClearUX delivers 64 checkpoints across 16 categories in minutes for a fraction of the cost. It\u2019s ideal for quick, comprehensive baseline assessments. For deep qualitative research (user interviews, usability testing), we recommend pairing ClearUX findings with a specialist.' },
            ].map((item, idx) => (
              <details key={idx} className="group rounded-xl border border-border/40 dark:border-white/[0.03] bg-card overflow-hidden">
                <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-card-hover transition-colors">
                  <h3 className="font-medium text-text text-sm pr-4">{item.q}</h3>
                  <ArrowRight size={14} className="text-muted flex-shrink-0 transform group-open:rotate-90 transition-transform" />
                </summary>
                <div className="mx-5 pb-5 pt-1 border-t border-border/20 dark:border-white/[0.04]">
                  <p className="text-muted text-sm leading-relaxed pt-4">{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-32 sm:py-40 px-4 md:px-6 lg:px-8 overflow-hidden" style={{ background: 'var(--gradient-brand-subtle)' }}>
        {/* Kaleidoscope ambient glows */}
        <div className="absolute top-[20%] left-[15%] w-[400px] h-[400px] rounded-full bg-violet-500/[0.06] blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[20%] right-[15%] w-[350px] h-[350px] rounded-full bg-emerald-500/[0.05] blur-[120px] pointer-events-none" />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-pink-500/[0.04] blur-[140px] pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center relative">
          {/* Small label */}
          <p className="text-sm font-semibold tracking-wide uppercase mb-6 bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>Start your audit today</p>

          {/* Big headline */}
          <h2 className="font-manrope text-4xl sm:text-5xl md:text-6xl font-bold text-text mb-6" style={{ lineHeight: '1.1' }}>
            Ready to see what<br className="hidden sm:block" />
            you&apos;re missing?
          </h2>

          {/* Subtitle */}
          <p className="text-muted text-lg md:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
            Real findings your team can act on — prioritised by impact, delivered in minutes, not weeks.
          </p>

          {/* URL input — mirrors the hero */}
          <form onSubmit={handleHeroSubmit} className="max-w-lg mx-auto mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <label htmlFor="cta-url-input" className="sr-only">Website URL to audit</label>
                <input
                  id="cta-url-input"
                  type="url"
                  name="url"
                  autoComplete="url"
                  value={heroUrl}
                  onChange={(e) => setHeroUrl(e.target.value)}
                  placeholder="yourwebsite.com"
                  aria-label="Website URL to audit"
                  className="w-full px-5 py-4 text-base rounded-2xl bg-white dark:bg-card border border-border/40 dark:border-white/[0.06] text-text placeholder:text-placeholder focus:outline-none focus:border-accent/50 focus:shadow-[0_0_0_4px_rgba(124,58,237,0.08)] transition-all shadow-sm"
                />
              </div>
              <button
                type="submit"
                className="group inline-flex items-center justify-center gap-2 px-7 py-4 text-white rounded-2xl font-semibold transition-all hover:-translate-y-0.5 shadow-lg flex-shrink-0"
                style={{ background: 'var(--gradient-brand)', boxShadow: '0 8px 24px rgba(124,58,237,.2), 0 4px 12px rgba(236,72,153,.1)' }}
              >
                Start Your Free Audit
                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </form>

          {/* Trust line */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-bold bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>
            <span>From $99 per audit</span>
            <span className="opacity-40">·</span>
            <span>No subscription</span>
            <span className="opacity-40">·</span>
            <span>Credits never expire</span>
          </div>

          {/* Support link */}
          <p className="text-muted text-sm mt-6">
            Have questions? <a href="mailto:support@clearux.ai" className="underline hover:text-text transition-colors">support@clearux.ai</a> or <Link href="/contact" className="underline hover:text-text transition-colors">contact us</Link>
          </p>
        </div>
      </section>

      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
}
