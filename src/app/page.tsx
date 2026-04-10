'use client';

import { useState, useEffect, useRef } from 'react';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { Brain, CheckCircle, Star, Eye, Target, Map, MousePointerClick, Zap, Smartphone, Shield, Type, Gauge, ArrowRight, Layers, Accessibility, FileCheck } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { HomeJsonLd } from "@/components/seo/JsonLd";
import { useUser } from '@/hooks/useUser';

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

/* ── Rotating words ──────────────────────────────────────── */
const HERO_WORDS = [
  'Conversions',
  'Usability',
  'Engagement',
  'Discoverability',
  'Mobile UX',
  'Trust',
  'Accessibility',
];

function RotatingWord() {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => { setIdx((i) => (i + 1) % HERO_WORDS.length); setFade(true); }, 250);
    }, 2800);
    return () => clearInterval(interval);
  }, []);
  return (
    <span className={`inline-block transition-all duration-300 text-accent ${fade ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}>
      {HERO_WORDS[idx]}
    </span>
  );
}

export default function Home() {
  const router = useRouter();
  const { user } = useUser();
  const [heroUrl, setHeroUrl] = useState('');

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = heroUrl.trim();
    if (!trimmed) return;
    const encoded = encodeURIComponent(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    router.push(user ? `/dashboard/new-audit?url=${encoded}` : `/register?url=${encoded}`);
  };

  const howRef = useScrollReveal();
  const catRef = useScrollReveal();
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
    { quote: "ClearUX identified critical issues we completely missed. The audit was thorough and actionable.", author: "Sarah Chen", title: "Product Manager", company: "TechFlow" },
    { quote: "Worth every penny. We implemented the recommendations and saw a 34% increase in conversions.", author: "Marcus Webb", title: "Founder", company: "Velocity Labs" },
    { quote: "The AI-powered analysis is impressive. It caught UX issues that our internal team had overlooked for months.", author: "Elena Rodriguez", title: "Design Lead", company: "Creative Studio" },
  ];

  return (
    <div className="bg-[#0A0A0F] text-white min-h-screen">
      <HomeJsonLd />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold">
        Skip to content
      </a>
      <Navbar />
      <main id="main-content">

      {/* ═══════════════════════════════════════════════════════
          HERO — minimal, dark, centered
          ═══════════════════════════════════════════════════════ */}
      <section className="relative pt-36 pb-32 px-4 md:px-6 lg:px-8 overflow-hidden">
        {/* Subtle gradient glow behind hero */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-accent/[0.07] blur-[150px] pointer-events-none" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full bg-purple-600/[0.04] blur-[120px] pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center relative">
          <h1 className="animate-fade-up font-manrope text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6" style={{ lineHeight: '1.15' }}>
            Find &amp; fix UX issues{' '}
            <br className="hidden sm:block" />
            impacting <RotatingWord />
          </h1>

          <p className="animate-fade-up delay-200 text-lg md:text-xl text-[#8B8B9E] mb-12 max-w-xl mx-auto" style={{ lineHeight: '1.7' }}>
            AI-powered audits across 48 checkpoints. Professional report with prioritised fixes — delivered in minutes.
          </p>

          {/* URL Input */}
          <form onSubmit={handleHeroSubmit} className="animate-fade-up delay-300 max-w-xl mx-auto mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <label htmlFor="hero-url-input" className="sr-only">Website URL to audit</label>
                <input
                  id="hero-url-input"
                  type="url"
                  value={heroUrl}
                  onChange={(e) => setHeroUrl(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  aria-label="Website URL to audit"
                  className="w-full px-5 py-4 text-base rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder:text-[#4A4A5E] focus:outline-none focus:border-accent/50 focus:bg-white/[0.08] transition-all"
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

          <p className="animate-fade-up delay-400 text-sm text-[#5A5A6E]">
            From $29 per audit · No subscription · Results in minutes
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          STATS BAR — simple, quiet
          ═══════════════════════════════════════════════════════ */}
      <section className="border-t border-b border-white/[0.06] py-12 px-4 md:px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '48', label: 'UX Checkpoints' },
            { value: '12', label: 'Audit Categories' },
            { value: '6', label: 'Languages' },
            { value: '<10 min', label: 'Delivery Time' },
          ].map((stat, idx) => (
            <div key={idx}>
              <p className="font-manrope text-2xl md:text-3xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-sm text-[#6B6B80]">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          HOW IT WORKS — 3 steps
          ═══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-28 px-4 md:px-6 lg:px-8">
        <div
          ref={howRef.ref}
          className={`max-w-5xl mx-auto transition-all duration-700 ${howRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-16">
            <p className="text-accent text-sm font-medium tracking-wide uppercase mb-3">How it works</p>
            <h2 className="font-manrope text-3xl md:text-4xl font-bold text-white">
              Three steps. That&apos;s it.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: '1', icon: Target, title: 'Paste your URL', desc: 'Just the link — we automatically detect your industry, audience, and tech stack.' },
              { step: '2', icon: Brain, title: 'AI audits your site', desc: 'We crawl every page and evaluate 48 checkpoints across 12 UX categories.' },
              { step: '3', icon: FileCheck, title: 'Get your report', desc: 'A detailed PDF + Word report with scores, issues, and actionable recommendations.' },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="relative group"
                  style={howRef.visible ? { animation: `fade-up 0.6s ease-out ${200 + idx * 150}ms both` } : { opacity: 0 }}
                >
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 h-full hover:border-accent/20 hover:bg-white/[0.04] transition-all duration-300">
                    <div className="flex items-center justify-center mb-6">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                          <Icon size={24} className="text-accent" />
                        </div>
                        <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center font-manrope font-bold text-[11px]">
                          {item.step}
                        </div>
                      </div>
                    </div>
                    <h3 className="font-manrope text-lg font-bold text-white mb-2 text-center">{item.title}</h3>
                    <p className="text-[#6B6B80] text-sm leading-relaxed text-center">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          WHAT WE AUDIT — 12 categories grid
          ═══════════════════════════════════════════════════════ */}
      <section id="features" className="py-28 px-4 md:px-6 lg:px-8 border-t border-white/[0.06]">
        <div
          ref={catRef.ref}
          className={`max-w-6xl mx-auto transition-all duration-700 ${catRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-16">
            <p className="text-accent text-sm font-medium tracking-wide uppercase mb-3">What we audit</p>
            <h2 className="font-manrope text-3xl md:text-4xl font-bold text-white mb-4">
              12 categories. 48 checkpoints.
            </h2>
            <p className="text-[#6B6B80] text-lg max-w-xl mx-auto">
              Every audit covers the full spectrum of user experience.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {auditCategories.map((cat, idx) => {
              const Icon = cat.icon;
              const isFeatured = 'featured' in cat && cat.featured;
              return (
                <div
                  key={idx}
                  className={`rounded-xl p-5 border transition-all duration-300 group ${
                    isFeatured
                      ? 'bg-accent/[0.06] border-accent/20 hover:border-accent/40'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isFeatured ? 'bg-accent/15' : 'bg-white/[0.06]'
                    }`}>
                      <Icon size={18} className="text-accent" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm mb-1">{cat.title}</h3>
                      <p className="text-[#6B6B80] text-xs leading-relaxed">{cat.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          PRICING
          ═══════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-28 px-4 md:px-6 lg:px-8 border-t border-white/[0.06]">
        <div
          ref={priceRef.ref}
          className={`max-w-5xl mx-auto transition-all duration-700 ${priceRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-14">
            <p className="text-accent text-sm font-medium tracking-wide uppercase mb-3">Pricing</p>
            <h2 className="font-manrope text-3xl md:text-4xl font-bold text-white mb-4">
              Simple credit-based pricing
            </h2>
            <p className="text-[#6B6B80] text-lg max-w-xl mx-auto">
              1 credit = 1 full audit. No tiers. No feature limits.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: 'Starter', credits: 1, price: 29, per: '$29', save: null, cta: 'Start Auditing', popular: false },
              { name: 'Growth', credits: 5, price: 99, per: '$19.80', save: 'Save 32%', cta: 'Get 5 Audits', popular: true },
              { name: 'Agency', credits: 15, price: 249, per: '$16.60', save: 'Save 43%', cta: 'Get 15 Audits', popular: false },
              { name: 'Scale', credits: 50, price: 599, per: '$11.98', save: 'Save 59%', cta: 'Get 50 Audits', popular: false },
            ].map((tier, idx) => (
              <div
                key={idx}
                className={`relative rounded-2xl p-6 flex flex-col transition-all duration-300 ${
                  tier.popular
                    ? 'bg-accent/[0.08] border-2 border-accent/30 hover:border-accent/50'
                    : 'bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                {tier.popular && (
                  <span className="absolute -top-2.5 right-4 bg-accent text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    Most Popular
                  </span>
                )}

                <h3 className="font-manrope font-bold text-lg text-white mb-1">{tier.name}</h3>
                <div className="mb-1">
                  <span className="font-manrope text-3xl font-bold text-white">${tier.price}</span>
                </div>
                <p className="text-xs text-[#6B6B80] mb-4">
                  {tier.credits} credit{tier.credits !== 1 ? 's' : ''} · {tier.per}/audit
                </p>

                {tier.save && (
                  <div className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mb-4 bg-accent/15 text-accent w-fit">
                    {tier.save}
                  </div>
                )}
                {!tier.save && <div className="mb-4" />}

                <div className="space-y-2.5 mb-6 flex-1">
                  {[
                    '48-point deep analysis',
                    '12 UX categories',
                    'AI discoverability audit',
                    'PDF + DOCX reports',
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 text-accent" />
                      <span className="text-xs text-[#8B8B9E]">{f}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/register"
                  className={`block text-center text-sm font-bold rounded-lg py-2.5 transition-all ${
                    tier.popular
                      ? 'bg-accent text-white hover:bg-accent-dk shadow-lg shadow-accent/20'
                      : 'bg-white/[0.06] text-white hover:bg-white/[0.1] border border-white/[0.08]'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-[#5A5A6E] text-xs mt-8">
            Credits never expire · Secure payment via Stripe
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          TESTIMONIALS
          ═══════════════════════════════════════════════════════ */}
      <section className="py-28 px-4 md:px-6 lg:px-8 border-t border-white/[0.06]">
        <div
          ref={testRef.ref}
          className={`max-w-5xl mx-auto transition-all duration-700 ${testRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-16">
            <p className="text-accent text-sm font-medium tracking-wide uppercase mb-3">Testimonials</p>
            <h2 className="font-manrope text-3xl md:text-4xl font-bold text-white">
              Loved by product teams
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, idx) => (
              <div
                key={idx}
                className="rounded-xl p-6 border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] transition-all duration-300"
              >
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-[#C0C0D0] text-sm mb-6 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <div className="pt-4 border-t border-white/[0.06]">
                  <p className="font-semibold text-white text-sm">{t.author}</p>
                  <p className="text-xs text-[#6B6B80]">{t.title}, {t.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FAQ
          ═══════════════════════════════════════════════════════ */}
      <section id="faq" className="py-28 px-4 md:px-6 lg:px-8 border-t border-white/[0.06]">
        <div
          ref={faqRef.ref}
          className={`max-w-2xl mx-auto transition-all duration-700 ${faqRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="text-center mb-14">
            <p className="text-accent text-sm font-medium tracking-wide uppercase mb-3">FAQ</p>
            <h2 className="font-manrope text-3xl md:text-4xl font-bold text-white">
              Frequently asked questions
            </h2>
          </div>
          <div className="space-y-3">
            {[
              { q: 'How long does an audit take?', a: 'Most audits complete in under 10 minutes. Our AI crawls your website, analyses every page against 48 checkpoints, and generates a full professional report.' },
              { q: 'What does the audit cover?', a: 'We evaluate 12 categories: First Impression, AI Discoverability, Value Proposition, Navigation, Conversion & CTAs, Onboarding, Mobile Experience, Trust & Credibility, Content Quality, Performance, Visual Hierarchy, and Accessibility.' },
              { q: 'How do credits work?', a: 'One credit = one full audit. Credits never expire. Every audit includes all 48 checkpoints, PDF & Word reports, and prioritised recommendations. No feature tiers.' },
              { q: 'What format is the report?', a: 'You get both a professional PDF and a Word document with overall scores, category breakdowns, detailed findings with severity levels, and actionable recommendations.' },
              { q: 'Can I audit any website?', a: 'Yes. ClearUX works with any publicly accessible URL. We handle JavaScript-rendered sites, SPAs, and multi-page websites.' },
              { q: 'Is my data secure?', a: 'We only analyse publicly visible content. Payments are processed securely via Stripe. We do not store or share your website data beyond generating your report.' },
              { q: 'What languages are supported?', a: 'Reports are available in English, Spanish, French, German, Italian, and Portuguese.' },
              { q: 'Can I get a refund?', a: 'If you\u2019re unsatisfied, contact support@clearux.ai and we\u2019ll resolve it or provide a credit for a new audit.' },
            ].map((item, idx) => (
              <details key={idx} className="group rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.03] transition-colors">
                  <h3 className="font-medium text-white text-sm pr-4">{item.q}</h3>
                  <ArrowRight size={14} className="text-[#6B6B80] flex-shrink-0 transform group-open:rotate-90 transition-transform" />
                </summary>
                <div className="px-5 pb-5">
                  <p className="text-[#8B8B9E] text-sm leading-relaxed">{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════════════════════ */}
      <section className="py-28 px-4 md:px-6 lg:px-8 border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-manrope text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to improve your UX?
          </h2>
          <p className="text-[#6B6B80] text-lg mb-8">
            Get your comprehensive audit report in minutes.
          </p>
          <Link
            href="/register"
            className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-accent text-white rounded-xl text-base font-semibold hover:bg-accent-dk transition-all shadow-lg shadow-accent/20"
          >
            Audit My Site Now
            <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <p className="text-[#4A4A5E] text-sm mt-4">No subscription required.</p>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  );
}
