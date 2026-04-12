'use client';

import { useState, useEffect, useRef } from 'react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { Brain, CheckCircle, Star, Eye, Target, Map, MousePointerClick, Zap, Smartphone, Shield, Type, Gauge, ArrowRight, ArrowUp, Layers, Accessibility, FileText, ChevronLeft, ChevronRight, Lightbulb, Heart, Users, Globe2, Scale, Sparkles, Clock } from "lucide-react";
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
const HERO_WORDS = ['Conversions', 'Usability', 'Engagement', 'Accessibility', 'Mobile UX', 'Trust', 'Digital Wellbeing', 'Inclusivity'];

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

/* ── Apple-style pillar scroll reveal ──────────────────── */
const PILLAR_DATA = [
  {
    key: 'foundation',
    label: 'Foundation',
    color: 'from-violet-500 to-purple-600',
    colorBg: 'bg-violet-500/10',
    colorText: 'text-violet-600 dark:text-violet-400',
    colorBorder: 'border-violet-500/20',
    headline: 'Get the basics right.',
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
    headline: 'Design for humans, not metrics.',
    subhead: 'Ethical patterns, emotional safety, and inclusive experiences.',
    body: 'We detect dark patterns, evaluate psychological safety, test for cognitive accessibility and neurodiversity support, assess digital wellbeing practices, and check age inclusivity. Because your users are people first.',
  },
  {
    key: 'technical',
    label: 'Technical Excellence',
    color: 'from-amber-500 to-orange-600',
    colorBg: 'bg-amber-500/10',
    colorText: 'text-amber-600 dark:text-amber-400',
    colorBorder: 'border-amber-500/20',
    headline: 'Performance that users can feel.',
    subhead: 'Speed, mobile experience, accessibility, and SEO.',
    body: 'We audit page speed, mobile responsiveness, WCAG accessibility compliance, keyboard navigation, screen reader support, structured data, and technical SEO. The invisible infrastructure that powers great experiences.',
  },
  {
    key: 'future',
    label: 'Future Readiness',
    color: 'from-emerald-500 to-teal-600',
    colorBg: 'bg-emerald-500/10',
    colorText: 'text-emerald-600 dark:text-emerald-400',
    colorBorder: 'border-emerald-500/20',
    headline: 'Ready for what comes next.',
    subhead: 'AI discoverability, agent readiness, and global reach.',
    body: 'We evaluate how LLMs and AI agents understand your site, whether your content is structured for the AI era, and how well your design translates across cultures, languages, and regulations worldwide.',
  },
];

function PillarScrollReveal({ categories }: { categories: Array<{ pillar: string; icon: React.ElementType; title: string; desc: string; featured?: boolean }> }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    sectionRefs.current.forEach((el, idx) => {
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveIdx(idx);
        },
        { rootMargin: '-40% 0px -40% 0px', threshold: 0.1 },
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const pillarNames = ['Foundation', 'Human Experience', 'Technical Excellence', 'Future Readiness'];
  const active = PILLAR_DATA[activeIdx];

  return (
    <div className="relative max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pb-20">
      {/* Pillar nav dots — desktop only */}
      <div className="hidden lg:flex items-center justify-center gap-3 mb-12">
        {PILLAR_DATA.map((p, i) => (
          <button
            key={p.key}
            onClick={() => sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 border ${
              activeIdx === i
                ? `${p.colorBg} ${p.colorText} ${p.colorBorder}`
                : 'bg-transparent text-muted border-border/30 hover:border-border/60'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Scrollable layout */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-start">
        {/* LEFT — Scroll sections */}
        <div className="space-y-0">
          {PILLAR_DATA.map((pillar, idx) => {
            const pillarCats = categories.filter((c) => c.pillar === pillarNames[idx]);
            const isActive = activeIdx === idx;

            return (
              <div
                key={pillar.key}
                ref={(el) => { sectionRefs.current[idx] = el; }}
                className="min-h-[60vh] lg:min-h-[70vh] flex flex-col justify-center py-12 lg:py-16"
              >
                <div className={`transition-all duration-500 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-30 translate-y-2 lg:opacity-30'}`}>
                  {/* Pillar label */}
                  <p className={`text-sm font-semibold tracking-wide uppercase mb-3 ${pillar.colorText}`}>
                    {pillar.label}
                  </p>

                  {/* Main headline */}
                  <h3 className="font-manrope text-2xl sm:text-3xl md:text-[2.25rem] font-bold text-text mb-3" style={{ lineHeight: '1.15' }}>
                    {pillar.headline}
                  </h3>

                  {/* Subhead */}
                  <p className="text-muted text-lg md:text-xl mb-4 font-medium">
                    {pillar.subhead}
                  </p>

                  {/* Body */}
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
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300 ${
                            isActive
                              ? `${pillar.colorBg} ${pillar.colorText} ${pillar.colorBorder}`
                              : 'bg-card text-muted border-border/30'
                          }`}
                        >
                          <Icon size={12} />
                          {cat.title}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT — Sticky visual panel */}
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <div className="relative">
              <div className={`rounded-3xl border border-border/30 dark:border-white/[0.06] bg-card shadow-xl shadow-black/5 overflow-hidden transition-all duration-500`}>

                {/* ── FOUNDATION: Score dashboard mockup ── */}
                <div className={`transition-all duration-500 ${activeIdx === 0 ? 'opacity-100 h-auto' : 'opacity-0 h-0 overflow-hidden absolute inset-0'}`}>
                  <div className="p-6 pb-0">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-violet-500/15 flex items-center justify-center"><Eye size={12} className="text-violet-500" /></div>
                        <span className="text-xs font-semibold text-text">Audit Overview</span>
                      </div>
                      <span className="text-[10px] text-muted px-2 py-0.5 rounded-full bg-surface-alt">clearux.ai</span>
                    </div>
                    {/* Score ring */}
                    <div className="flex items-center gap-6 mb-6">
                      <div className="relative">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" fill="none" strokeWidth="6" className="stroke-border/15" />
                          <circle cx="50" cy="50" r="42" fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-violet-500 transition-all duration-700" style={{ strokeDasharray: `${2*Math.PI*42}`, strokeDashoffset: `${2*Math.PI*42*(1-0.78)}` }} />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center font-manrope text-xl font-bold text-text">78</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className="text-xs font-semibold text-text">Overall Score</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[{l:'UX',s:82},{l:'Content',s:75},{l:'Mobile',s:88},{l:'Conversion',s:70}].map(d=>(
                            <div key={d.l} className="flex items-center gap-2">
                              <span className="text-[10px] text-muted w-14">{d.l}</span>
                              <div className="flex-1 h-1 rounded-full bg-border/15"><div className="h-full rounded-full bg-violet-400 transition-all duration-700" style={{width:`${d.s}%`}} /></div>
                              <span className="text-[10px] font-bold text-text w-5 text-right">{d.s}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Finding cards */}
                  <div className="px-6 pb-6 space-y-2.5">
                    {[{sev:'CRITICAL',c:'bg-red-500',t:'CTA button invisible on mobile viewport',imp:'+23% mobile conversions'},{sev:'HIGH',c:'bg-orange-400',t:'Value proposition buried below the fold',imp:'+15% engagement rate'},{sev:'MEDIUM',c:'bg-yellow-400',t:'Navigation lacks clear visual hierarchy',imp:'Reduced bounce rate'}].map((f,i)=>(
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface-alt border border-border/20">
                        <span className={`${f.c} text-white text-[8px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0`}>{f.sev}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-text leading-snug">{f.t}</p>
                          <p className="text-[10px] text-accent mt-0.5">{f.imp}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── HUMAN EXPERIENCE: Dark patterns scan ── */}
                <div className={`transition-all duration-500 ${activeIdx === 1 ? 'opacity-100 h-auto' : 'opacity-0 h-0 overflow-hidden absolute inset-0'}`}>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-pink-500/15 flex items-center justify-center"><Heart size={12} className="text-pink-500" /></div>
                        <span className="text-xs font-semibold text-text">Human Experience Scan</span>
                      </div>
                      <span className="text-[10px] font-bold text-pink-500 bg-pink-500/10 px-2 py-0.5 rounded-full">6 issues</span>
                    </div>
                    {/* Scan results */}
                    <div className="space-y-3">
                      {[
                        {icon:'⚠️',t:'Confirmshaming detected',d:'"No thanks, I don\'t want to save money" — manipulative opt-out copy',pass:false},
                        {icon:'⏰',t:'Fake urgency pattern',d:'Countdown timer resets on page refresh — not a genuine deadline',pass:false},
                        {icon:'✓',t:'Cookie consent is fair',d:'Equal visual weight for Accept and Reject options',pass:true},
                        {icon:'⚠️',t:'Cancellation flow buried',d:'4-step process to unsubscribe vs 1-click to sign up',pass:false},
                        {icon:'✓',t:'No hidden costs at checkout',d:'All fees disclosed upfront before payment',pass:true},
                        {icon:'⚠️',t:'Anxiety-inducing language',d:'"You\'ll lose everything!" on downgrade page creates unnecessary fear',pass:false},
                      ].map((item,i)=>(
                        <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${item.pass ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-800/20' : 'bg-pink-50/50 dark:bg-pink-900/10 border-pink-200/50 dark:border-pink-800/20'}`}>
                          <span className="text-sm mt-0.5 flex-shrink-0">{item.icon}</span>
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold ${item.pass ? 'text-emerald-700 dark:text-emerald-400' : 'text-pink-700 dark:text-pink-400'}`}>{item.t}</p>
                            <p className="text-[10px] text-muted mt-0.5 leading-relaxed">{item.d}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── TECHNICAL EXCELLENCE: Performance dashboard ── */}
                <div className={`transition-all duration-500 ${activeIdx === 2 ? 'opacity-100 h-auto' : 'opacity-0 h-0 overflow-hidden absolute inset-0'}`}>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center"><Gauge size={12} className="text-amber-500" /></div>
                        <span className="text-xs font-semibold text-text">Technical Audit</span>
                      </div>
                    </div>
                    {/* Metric cards */}
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      {[{l:'Performance',s:92,c:'text-emerald-500',icon:'⚡'},{l:'Mobile',s:78,c:'text-amber-500',icon:'📱'},{l:'Accessibility',s:64,c:'text-orange-500',icon:'♿'},{l:'SEO',s:86,c:'text-emerald-500',icon:'🔍'}].map(m=>(
                        <div key={m.l} className="p-3.5 rounded-xl bg-surface-alt border border-border/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm">{m.icon}</span>
                            <span className={`font-manrope text-lg font-bold ${m.c}`}>{m.s}</span>
                          </div>
                          <p className="text-[10px] font-semibold text-text">{m.l}</p>
                          <div className="mt-1.5 h-1 rounded-full bg-border/15">
                            <div className={`h-full rounded-full transition-all duration-700 ${m.s>=80?'bg-emerald-400':m.s>=60?'bg-amber-400':'bg-orange-400'}`} style={{width:`${m.s}%`}} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Checklist */}
                    <div className="space-y-2">
                      {[{t:'Viewport meta tag',p:true},{t:'Touch targets ≥ 44px',p:false},{t:'Colour contrast WCAG AA',p:false},{t:'Structured data / schema',p:true},{t:'Keyboard navigation',p:true},{t:'ARIA landmarks',p:false}].map((c,i)=>(
                        <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-alt/50">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${c.p?'bg-emerald-100 dark:bg-emerald-900/30':'bg-orange-100 dark:bg-orange-900/30'}`}>
                            <span className="text-[8px]">{c.p?'✓':'✗'}</span>
                          </div>
                          <span className="text-[11px] text-text">{c.t}</span>
                          <span className={`ml-auto text-[9px] font-semibold ${c.p?'text-emerald-600 dark:text-emerald-400':'text-orange-600 dark:text-orange-400'}`}>{c.p?'Pass':'Fail'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── FUTURE READINESS: AI readiness checker ── */}
                <div className={`transition-all duration-500 ${activeIdx === 3 ? 'opacity-100 h-auto' : 'opacity-0 h-0 overflow-hidden absolute inset-0'}`}>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center"><Brain size={12} className="text-emerald-500" /></div>
                        <span className="text-xs font-semibold text-text">AI & Global Readiness</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">65/100</span>
                    </div>
                    {/* AI readiness cards */}
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
                            <div className={`h-full rounded-full transition-all duration-700 ${item.s>=70?'bg-emerald-400':item.s>=50?'bg-amber-400':'bg-orange-400'}`} style={{width:`${item.s}%`}} />
                          </div>
                          <p className="text-[10px] text-muted leading-relaxed">{item.d}</p>
                        </div>
                      ))}
                    </div>
                    {/* Simulated AI query */}
                    <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/40 dark:border-emerald-800/20">
                      <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">Can an AI agent describe your business?</p>
                      <div className="bg-white dark:bg-surface rounded-lg p-2.5 border border-border/20">
                        <p className="text-[10px] text-muted italic leading-relaxed">&ldquo;Based on the site&apos;s markup, I can identify this is a SaaS product but cannot determine pricing, key features, or target audience from structured data alone.&rdquo;</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom nav dots */}
                <div className="px-6 py-3 border-t border-border/15 flex items-center justify-between">
                  <p className="text-[10px] text-muted">{active.label} audit preview</p>
                  <div className="flex gap-1.5">
                    {PILLAR_DATA.map((p, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === activeIdx ? `w-5 bg-gradient-to-r ${p.color}` : 'w-1.5 bg-border/30'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: category grid (visible only on smaller screens) */}
      <div className="lg:hidden mt-8">
        <div className="grid grid-cols-2 gap-3">
          {categories.map((cat, idx) => {
            const Icon = cat.icon;
            const pillarIdx = pillarNames.indexOf(cat.pillar);
            const p = PILLAR_DATA[pillarIdx] || PILLAR_DATA[0];
            return (
              <div key={idx} className={`rounded-xl p-3.5 border ${p.colorBorder} ${p.colorBg} transition-all`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={13} className={p.colorText} />
                  <span className="text-xs font-semibold text-text truncate">{cat.title}</span>
                </div>
                <p className="text-[11px] text-muted leading-relaxed">{cat.desc}</p>
              </div>
            );
          })}
        </div>
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
  const c1 = useCountUp(95, 1800);
  const c2 = useCountUp(19, 1400);
  const c3 = useCountUp(6, 1200);
  const c4 = useCountUp(10, 1000);

  const previewRef = useScrollReveal();
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

    // Technical Excellence (13-16)
    { pillar: "Technical Excellence", icon: Gauge, title: "Performance & Page Speed", desc: "Speed, load times, and responsiveness" },
    { pillar: "Technical Excellence", icon: Smartphone, title: "Mobile Experience", desc: "Responsive and optimized mobile design" },
    { pillar: "Technical Excellence", icon: Accessibility, title: "Accessibility & Inclusive Design", desc: "WCAG compliance and assistive tech support", featured: true },
    { pillar: "Technical Excellence", icon: FileText, title: "Technical SEO & Accessibility", desc: "Search engine and AI crawlability" },

    // Future Readiness (17-19)
    { pillar: "Future Readiness", icon: Brain, title: "AI Discoverability & LLM Readiness", desc: "Optimisation for AI model indexing", featured: true },
    { pillar: "Future Readiness", icon: Zap, title: "AI Agent Readiness", desc: "Structured data and agent interaction support" },
    { pillar: "Future Readiness", icon: Globe2, title: "Cultural Sensitivity & Global Readiness", desc: "Inclusive design for diverse global audiences" },
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
      <section className="bg-surface-alt border-b border-border/50 dark:border-white/[0.03] py-5 px-4">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2.5">
              {[
                { bg: '#8B5CF6', initials: 'SC' },
                { bg: '#A78BFA', initials: 'MW' },
                { bg: '#7C3AED', initials: 'ER' },
                { bg: '#6D28D9', initials: 'JK' },
                { bg: '#C4B5FD', initials: 'DT' },
              ].map((p, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full border-2 border-surface-alt flex items-center justify-center text-white text-[11px] font-bold"
                  style={{ backgroundColor: p.bg, zIndex: 5 - i }}
                >
                  {p.initials}
                </div>
              ))}
            </div>
            <div>
              <div className="flex gap-0.5 mb-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                ))}
              </div>
              <span className="text-text text-sm font-semibold">Trusted by product teams worldwide</span>
            </div>
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
            <span className="text-sm font-semibold text-accent tracking-wide">Human-Centered, AI-Powered Digital Audits</span>
          </div>

          {/*
            Force the H1 to always be exactly 2 lines.
            Line 1: "Find & fix UX issues impacting"
            Line 2: the rotating word (centered, on its own line)
          */}
          <h1 className="animate-fade-up delay-100 font-manrope text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6" style={{ lineHeight: '1.15' }}>
            Find & fix UX issues impacting
            <br />
            <RotatingWord />
          </h1>

          <p className="animate-fade-up delay-200 text-base sm:text-lg md:text-xl text-muted mb-8 sm:mb-12 max-w-xl mx-auto" style={{ lineHeight: '1.7' }}>
            Your website has UX issues you can&apos;t see. Get a professional audit across 95 checkpoints in 19 categories — in minutes, not weeks.
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
                  className="w-full px-5 py-4 text-base rounded-2xl bg-card border border-border/40 dark:border-white/[0.04] text-text placeholder:text-placeholder focus:outline-none focus:border-accent/50 focus:shadow-[0_0_0_4px_rgba(124,58,237,0.08)] transition-all shadow-sm"
                />
              </div>
              <button
                type="submit"
                className="group inline-flex items-center justify-center gap-2 px-7 py-4 bg-accent text-white rounded-2xl font-semibold hover:bg-accent-dk transition-all shadow-lg shadow-accent/20 hover:shadow-accent/30 hover:-translate-y-0.5 flex-shrink-0"
              >
                Get My UX Report
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

          {/* Sample report link */}
          <div className="animate-fade-up delay-400 mt-4">
            <a href="#see-it-in-action" className="text-sm text-muted hover:text-accent transition-colors underline underline-offset-2 decoration-border hover:decoration-accent">
              See a sample report
            </a>
          </div>
        </div>
      </section>

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
            <p className="text-accent text-sm font-semibold tracking-wide uppercase mb-4">Built for product teams</p>
            <h2 className="font-manrope text-3xl sm:text-4xl md:text-[2.75rem] font-bold text-text mb-6" style={{ lineHeight: '1.15' }}>
              Your website impacts real people.<br className="hidden sm:block" />
              <span className="text-muted">We audit what others miss.</span>
            </h2>
            <p className="text-muted text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
              95 professional checkpoints across 19 categories. Four pillars that cover everything from first impressions to AI readiness.
            </p>
          </div>

          {/* Stats row — big, bold numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 mt-16 max-w-4xl mx-auto">
            {([
              { counter: c1, suffix: '+', label: 'UX checkpoints', prefix: '' },
              { counter: c2, suffix: '', label: 'Categories', prefix: '' },
              { counter: c3, suffix: '', label: 'Languages', prefix: '' },
              { counter: c4, suffix: '', label: 'Min to report', prefix: '<' },
            ] as const).map((stat, idx) => {
              const counter = (stat as { counter: typeof c1 }).counter;
              return (
                <div key={idx} ref={counter.ref} className="text-center">
                  <p className="font-manrope text-5xl sm:text-6xl md:text-7xl font-extrabold bg-gradient-to-r from-accent to-purple-400 bg-clip-text text-transparent leading-none" suppressHydrationWarning>
                    {mounted ? `${stat.prefix}${counter.count}${stat.suffix}` : '\u00A0'}
                  </p>
                  <p className="text-sm text-muted mt-2 font-medium">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── APPLE-STYLE SCROLL REVEAL — 4 Pillars ── */}
        <PillarScrollReveal categories={auditCategories} />
      </section>

      {/* ═══════════════════════════════════════════════════════
          AUDIT PREVIEW — simulated screens
          ═══════════════════════════════════════════════════════ */}
      <section id="see-it-in-action" className="relative py-28 px-4 md:px-6 lg:px-8 bg-surface-alt overflow-hidden scroll-mt-20">
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
              Every audit gets the full 95-point analysis.
            </p>
          </div>

          {/* ── Hero card: Single Audit ── */}
          <div className="rounded-2xl border border-border/40 dark:border-white/[0.06] bg-card p-8 sm:p-10 mb-4 relative overflow-hidden">
            {/* Subtle warm gradient like Sketch */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-50/40 via-orange-50/20 to-rose-50/30 dark:from-accent/[0.03] dark:via-transparent dark:to-transparent pointer-events-none" />

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
                  className="inline-flex items-center justify-center gap-2 bg-text dark:bg-white text-white dark:text-text font-semibold text-sm rounded-full px-8 py-3.5 hover:opacity-90 transition-opacity"
                >
                  Start an audit
                </Link>
              </div>

              {/* Right: What's included */}
              <div className="space-y-3.5">
                {[
                  '95-point deep analysis across 19 categories',
                  'AI-powered findings with severity scoring',
                  'Executive summary & prioritised recommendations',
                  'PDF & Word report downloads',
                  'Issue screenshots with element highlighting',
                  '6 languages supported',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
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
              { name: 'Growth', credits: 5, price: 399, per: '$79.80', save: 19, desc: 'For growing teams' },
              { name: 'Agency', credits: 15, price: 999, per: '$66.60', save: 33, desc: 'For agencies & studios' },
              { name: 'Scale', credits: 50, price: 2499, per: '$49.98', save: 50, desc: 'Enterprise volume' },
            ].map((pack, idx) => (
              <div
                key={idx}
                className="group rounded-2xl border border-border/40 dark:border-white/[0.06] bg-card p-6 hover:border-border/70 dark:hover:border-white/[0.1] hover:shadow-lg hover:shadow-black/[0.03] hover:-translate-y-0.5 transition-all duration-300"
              >
                {/* Pack name + badge */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-manrope font-bold text-lg text-text">{pack.name}</h3>
                  <span className="text-xs font-bold text-accent bg-accent/10 px-2.5 py-1 rounded-full">
                    Save {pack.save}%
                  </span>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-0.5">
                  <span className="text-muted text-sm">$</span>
                  <span className="font-manrope text-4xl font-extrabold text-text">{pack.price.toLocaleString()}</span>
                </div>
                <p className="text-muted text-sm mb-5">
                  {pack.per} per audit <span className="text-muted/50">·</span> {pack.credits} audits
                </p>

                {/* Desc */}
                <p className="text-xs text-muted mb-5">{pack.desc}</p>

                {/* CTA */}
                <Link
                  href="/register"
                  className="flex items-center justify-center gap-2 text-sm font-semibold rounded-full py-3 border border-text/15 dark:border-white/15 text-text hover:bg-text hover:text-white dark:hover:bg-white dark:hover:text-text transition-all duration-200"
                >
                  Get {pack.credits} audits
                </Link>
              </div>
            ))}
          </div>

          {/* ── All audits include — footer strip ── */}
          <div className="mt-14 pt-10 border-t border-border/30 dark:border-white/[0.04]">
            <div className="grid sm:grid-cols-4 gap-6 sm:gap-8">
              <div>
                <p className="font-manrope text-lg font-bold text-text mb-1 leading-snug">All audits<br />include</p>
              </div>
              {[
                { title: 'Full 95-point analysis', desc: 'Every category, every checkpoint. No feature tiers or locked sections.' },
                { title: 'Credits never expire', desc: 'Buy once, use whenever you need. No monthly fees, no pressure.' },
                { title: 'Secure payments via Stripe', desc: 'SSL encrypted. Visa, Mastercard, Apple Pay, and Google Pay accepted.' },
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
              { q: 'How long does an audit take?', a: 'Most audits complete in under 10 minutes. Our AI crawls your website, analyses every page against 95 checkpoints across 19 categories, and generates a full professional report.' },
              { q: 'What does the audit cover?', a: 'We evaluate 19 categories across 4 pillars: Foundation (First Impression, Value Proposition, Navigation, Visual Hierarchy, Content Quality, CTAs), Human Experience (Trust, Ethical UX, Emotional Intelligence, Cognitive Accessibility, Digital Wellbeing, Age Inclusivity), Technical Excellence (Performance, Mobile, Accessibility, SEO), and Future Readiness (AI Discoverability, AI Agent Readiness, Cultural Sensitivity).' },
              { q: 'How do credits work?', a: 'One credit = one full audit. Credits never expire. Every audit includes all 95 checkpoints across 19 categories, PDF & Word reports, and prioritised recommendations.' },
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
      <section className="relative py-32 sm:py-40 px-4 md:px-6 lg:px-8 overflow-hidden" style={{ backgroundColor: 'var(--accent-lt)' }}>
        {/* Subtle radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full bg-accent/[0.06] blur-[150px] pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center relative">
          {/* Small label */}
          <p className="text-accent text-sm font-semibold tracking-wide uppercase mb-6">Start your audit today</p>

          {/* Big headline */}
          <h2 className="font-manrope text-4xl sm:text-5xl md:text-6xl font-bold text-text mb-6" style={{ lineHeight: '1.1' }}>
            Ready to see what<br className="hidden sm:block" />
            you&apos;re missing?
          </h2>

          {/* Subtitle */}
          <p className="text-muted text-lg md:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
            95 checkpoints. 19 categories. Real findings your team can act on — delivered in minutes, not weeks.
          </p>

          {/* URL input — mirrors the hero */}
          <form onSubmit={handleHeroSubmit} className="max-w-lg mx-auto mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <label htmlFor="cta-url-input" className="sr-only">Website URL to audit</label>
                <input
                  id="cta-url-input"
                  type="text"
                  value={heroUrl}
                  onChange={(e) => setHeroUrl(e.target.value)}
                  placeholder="yourwebsite.com"
                  aria-label="Website URL to audit"
                  className="w-full px-5 py-4 text-base rounded-2xl bg-white dark:bg-card border border-border/40 dark:border-white/[0.06] text-text placeholder:text-placeholder focus:outline-none focus:border-accent/50 focus:shadow-[0_0_0_4px_rgba(124,58,237,0.08)] transition-all shadow-sm"
                />
              </div>
              <button
                type="submit"
                className="group inline-flex items-center justify-center gap-2 px-7 py-4 bg-text dark:bg-white text-white dark:text-text rounded-2xl font-semibold hover:opacity-90 transition-all shadow-lg flex-shrink-0"
              >
                Get My UX Report
                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </form>

          {/* Trust line */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-muted">
            <span>From $99</span>
            <span className="opacity-30">·</span>
            <span>No subscription</span>
            <span className="opacity-30">·</span>
            <span>Credits never expire</span>
          </div>
        </div>
      </section>

      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
}
