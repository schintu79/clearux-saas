'use client';

import { useState, useEffect, useRef } from 'react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight, Zap, Shield, Clock, CheckCircle, Sparkles,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { HomeJsonLd } from "@/components/seo/JsonLd";
import { useAuth } from '@/context/AuthContext';
import HowItWorks from '@/components/motion/HowItWorks';
import WhyClearUX from '@/components/motion/WhyClearUX';
import BeyondTheReport from '@/components/motion/BeyondTheReport';
import { HeroReportMockup, ReportShowcase } from '@/components/motion/ProductMockup';
import { ScrollReveal, StaggerReveal, StaggerItem } from '@/components/motion';

/* ── FAQ ──────────────────────────────────────────────────── */
const TOP_FAQS = [
  { q: 'How long does an audit take?', a: 'Most audits complete in under 10 minutes. Our AI crawls your website, analyses every page against 64 checkpoints across 16 categories, and generates a full professional report.' },
  { q: 'What does the audit cover?', a: 'We evaluate 16 categories across 4 pillars: Foundation, Human Experience, Inclusive Design, and Future Readiness. Every audit includes accessibility, ethical UX, AI readiness, conversion analysis, and more.' },
  { q: 'Is ClearUX 100% accurate?', a: 'No automated tool is perfect, and we believe honesty about this builds trust. Our AI catches what other tools miss, but we recommend human review for critical accessibility findings. You can dismiss any finding with a reason, and the AI learns from your feedback on re-audits.' },
  { q: 'How do credits work?', a: 'One credit = one full audit. Credits never expire. Every audit includes all 64 checkpoints, PDF & Word reports, finding status tracking, shareable team links, and prioritised recommendations.' },
  { q: 'Can I re-audit the same site to track improvement?', a: 'Yes. Re-audits run in Baseline mode by default — they only verify whether previous findings are fixed, still present, or dismissed. Your score improves predictably as you resolve issues. When you\'re ready to discover new issues beyond the baseline, hit "Dig Deeper" for a full Deep mode analysis.' },
];

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

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [heroUrl, setHeroUrl] = useState('');
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

  return (
    <div className="bg-surface text-text min-h-screen">
      <HomeJsonLd />
      <Navbar />
      <main id="main-content">

      {/* ═══════════════════════════════════════════════════════
          SECTION 1 — HERO
          Dark, cinematic, parallax + product mockup
          ═══════════════════════════════════════════════════════ */}
      <section ref={heroRef} className="section-dark dark-forced relative min-h-screen flex flex-col px-4 md:px-6 lg:px-8 overflow-hidden" style={{ background: '#080808' }}>

        {/* Aurora background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-[130%] h-[300px] -left-[15%] top-[8%]" style={{
            background: 'linear-gradient(90deg, transparent 0%, #22C55E 10%, #B9FF66 30%, #B9FF66 50%, #22C55E 70%, transparent 100%)',
            filter: 'blur(80px)',
            opacity: 0.30,
            animation: 'auroraDrift 20s ease-in-out infinite',
          }} />
          <div className="absolute w-[120%] h-[260px] -left-[10%] top-[35%]" style={{
            background: 'linear-gradient(90deg, transparent 0%, #6366F1 15%, #818CF8 40%, #6366F1 65%, transparent 100%)',
            filter: 'blur(70px)',
            opacity: 0.22,
            animation: 'auroraDrift2 25s ease-in-out infinite',
          }} />
          <div className="absolute w-[110%] h-[240px] -left-[5%] top-[60%]" style={{
            background: 'linear-gradient(90deg, transparent 0%, #F59E0B 20%, #EF4444 40%, #EC4899 60%, transparent 100%)',
            filter: 'blur(75px)',
            opacity: 0.20,
            animation: 'auroraDrift 22s ease-in-out infinite reverse',
          }} />
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse 60% 40% at 50% 38%, rgba(185,255,102,0.08) 0%, transparent 60%)',
            animation: 'auroraPulse 8s ease-in-out infinite',
          }} />
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(185,255,102,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(185,255,102,.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            animation: 'gridMove 20s linear infinite',
          }} />
          <div className="absolute left-0 w-full h-[1px]" style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(185,255,102,0.2) 20%, rgba(185,255,102,0.35) 50%, rgba(185,255,102,0.2) 80%, transparent 100%)',
            animation: 'scanLineH 8s linear infinite',
          }} />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to bottom, #080808 0%, transparent 20%, transparent 80%, #080808 100%)',
          }} />
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 40%, #080808 100%)',
          }} />
        </div>

        {/* Hero text content */}
        <motion.div
          style={{ opacity: heroOpacity, y: heroY }}
          className="max-w-7xl mx-auto text-center relative z-10 pt-28 sm:pt-36"
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

          {/* Headline */}
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
            64 checkpoints. 4 pillars. Accessibility, dark patterns, conversion psychology, and AI readiness — delivered as a prioritised, actionable report.
          </motion.p>

          {/* CTA Form */}
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
                Start Free Audit
                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </motion.form>

          {/* Trust KSPs */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 mb-16 sm:mb-20"
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
        </motion.div>

        {/* ── Product mockup — the centerpiece ─────────────── */}
        <div className="relative z-10 pb-16 sm:pb-24 px-2 sm:px-4">
          <HeroReportMockup />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2 — HOW IT WORKS
          Animated 3-step walkthrough + lime CTA band
          ═══════════════════════════════════════════════════════ */}
      <div id="how-it-works">
        <HowItWorks />
      </div>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3 — PRODUCT SHOWCASE
          "See exactly what you get" — full report demo
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-32 sm:py-40 px-4 md:px-6 lg:px-8 overflow-hidden" style={{ background: '#080808' }}>
        {/* Subtle glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 50% 40% at 50% 30%, rgba(185,255,102,0.05) 0%, transparent 60%)',
        }} />

        <div className="max-w-5xl mx-auto relative">
          <ScrollReveal className="text-center mb-16 sm:mb-20">
            <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-[#B9FF66]">What you get</p>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-white mb-5 tracking-tight" style={{ lineHeight: '1.1' }}>
              A report your team can<br className="hidden sm:block" />
              <span className="text-white/40">actually act on.</span>
            </h2>
            <p className="text-white/40 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
              Every finding ranked by severity and business impact, with clear fixes and category scores that show exactly where to focus.
            </p>
          </ScrollReveal>

          <ReportShowcase />

          {/* Feature highlights below the showcase */}
          <StaggerReveal className="grid sm:grid-cols-3 gap-6 mt-16" staggerDelay={0.1}>
            {[
              { icon: CheckCircle, title: 'Prioritised findings', desc: 'Critical issues surface first so you fix what matters most.' },
              { icon: Sparkles, title: 'Clear, actionable fixes', desc: 'Every finding includes specific steps to resolve it.' },
              { icon: Shield, title: 'PDF & Word export', desc: 'Share professional reports with stakeholders in one click.' },
            ].map((item, i) => {
              const Icon = item.icon
              return (
                <StaggerItem key={i}>
                  <div className="text-center sm:text-left">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.06] mb-3">
                      <Icon size={18} className="text-[#B9FF66]" />
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1">{item.title}</h3>
                    <p className="text-xs text-white/40 leading-relaxed">{item.desc}</p>
                  </div>
                </StaggerItem>
              )
            })}
          </StaggerReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — WHY CLEARUX
          Animated scroll-driven differentiators on lime bg
          ═══════════════════════════════════════════════════════ */}
      <WhyClearUX />

      {/* ═══════════════════════════════════════════════════════
          SECTION 5 — BEYOND THE REPORT
          Track fixes, re-audit, share
          ═══════════════════════════════════════════════════════ */}
      <BeyondTheReport />

      {/* ═══════════════════════════════════════════════════════
          SECTION 6 — PRICING TEASER + FAQ
          Light, breathing room, trust signals
          ═══════════════════════════════════════════════════════ */}
      <section className="py-32 sm:py-40 px-4 md:px-6 lg:px-8 bg-surface">
        <div className="max-w-4xl mx-auto">
          {/* Pricing teaser */}
          <ScrollReveal className="mb-24 sm:mb-32">
            <div className="rounded-2xl border border-border/30 dark:border-white/[0.05] bg-card p-8 sm:p-12">
              <div className="grid sm:grid-cols-2 gap-8 items-center">
                <div>
                  <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-text">Simple pricing</p>
                  <h2 className="font-heading text-3xl sm:text-4xl font-semibold text-text mb-3 tracking-tight" style={{ lineHeight: '1.1' }}>
                    $99 per audit.
                  </h2>
                  <p className="text-muted text-base mb-6 leading-relaxed">
                    No subscription. No feature gates. Every audit gets the full 64-checkpoint analysis. First audit free.
                  </p>
                  <div className="space-y-2.5 mb-8">
                    {[
                      'All 16 categories, all 4 pillars',
                      'PDF & Word reports included',
                      'Track fixes and re-audit anytime',
                      'Credits never expire',
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span className="text-sm text-text">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row items-start gap-3">
                    <Link
                      href="/register"
                      className="inline-flex items-center gap-2 bg-text dark:bg-white text-white dark:text-gray-900 font-semibold text-[15px] rounded-xl px-6 py-3 min-h-[48px] hover:opacity-90 transition-opacity"
                    >
                      Start Free Audit
                      <ArrowRight size={16} />
                    </Link>
                    <Link
                      href="/pricing"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-text transition-colors py-3 px-2"
                    >
                      View all plans
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-center justify-center">
                  <div className="text-center">
                    <div className="flex items-baseline justify-center gap-1 mb-2">
                      <span className="text-muted text-2xl">$</span>
                      <span className="font-heading text-8xl font-semibold text-text tracking-tight">99</span>
                    </div>
                    <p className="text-muted text-sm">per audit, one-time</p>
                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <Sparkles size={12} className="text-emerald-500" />
                      <span className="text-xs font-bold text-emerald-500">First audit free</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* FAQ */}
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
          SECTION 7 — FINAL CTA
          Full-width lime band
          ═══════════════════════════════════════════════════════ */}
      <section className="relative py-36 sm:py-44 px-4 md:px-6 lg:px-8 overflow-hidden bg-[#B9FF66]">
        <ScrollReveal className="max-w-3xl mx-auto text-center relative z-10">
          <p className="text-[13px] font-semibold tracking-widest uppercase mb-6 text-[#111111]/60">Start your audit today</p>

          <h2 className="font-heading text-4xl sm:text-5xl md:text-6xl font-semibold text-[#111111] mb-6 tracking-tight" style={{ lineHeight: '1.08' }}>
            Ready to see what<br className="hidden sm:block" />
            you&apos;re missing?
          </h2>

          <p className="text-[#111111]/60 text-lg md:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
            Real findings your team can act on — prioritised by impact, trackable as you fix them, and re-auditable to prove the improvement.
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
                {user ? 'Get My Audit' : 'Start Free Audit'}
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
