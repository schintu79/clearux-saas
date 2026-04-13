import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowRight, Sparkles, Heart, Shield, Brain, Eye, Users, BarChart3, Rocket, Tag, Target, Accessibility, HeartHandshake, Globe, Zap, ShieldCheck, Flower2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About ClearUX — Human-Centered AI Audit Platform',
  description: 'ClearUX was built by a design leader who spent 20+ years watching companies ship products that ignored their users. Learn why we exist and what drives us.',
}

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-[70vh] bg-surface">

        {/* ═══════════════════════════════════════════════════════
            HERO — full width, gradient ambient glows
            ═══════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden py-24 sm:py-32 px-4 md:px-6 lg:px-8" style={{ background: 'var(--gradient-brand-subtle)' }}>
          {/* Ambient glows */}
          <div className="absolute top-[-10%] left-[15%] w-[600px] h-[500px] rounded-full bg-violet-500/[0.06] blur-[160px] pointer-events-none" />
          <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] rounded-full bg-pink-500/[0.04] blur-[140px] pointer-events-none" />
          <div className="absolute bottom-[10%] left-[40%] w-[350px] h-[350px] rounded-full bg-emerald-500/[0.04] blur-[120px] pointer-events-none" />

          <div className="max-w-5xl mx-auto text-center relative">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-8" style={{ background: 'var(--gradient-brand-subtle)' }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--gradient-brand)' }} />
              <span className="text-sm font-semibold tracking-wide bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>About ClearUX</span>
            </div>

            <h1 className="font-manrope font-bold text-4xl sm:text-5xl md:text-6xl text-text mb-6" style={{ lineHeight: '1.1' }}>
              Every product deserves<br className="hidden sm:block" />{' '}
              <span className="text-muted">an honest audit.</span>
            </h1>
            <p className="text-text/70 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
              ClearUX exists because great user experience shouldn&apos;t be a luxury reserved for companies with six-figure consultancy budgets.
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            FOUNDER STORY — full width, side-by-side
            ═══════════════════════════════════════════════════════ */}
        <section className="relative py-24 sm:py-28 px-4 md:px-6 lg:px-8 bg-surface overflow-hidden">
          {/* Subtle glow behind photo */}
          <div className="absolute top-[20%] left-[5%] w-[400px] h-[400px] rounded-full bg-violet-500/[0.03] blur-[140px] pointer-events-none" />

          <div className="max-w-6xl mx-auto relative">
            <div className="flex flex-col lg:flex-row gap-14 lg:gap-20 items-center">

              {/* Photo column */}
              <div className="flex-shrink-0 w-full lg:w-auto flex flex-col items-center lg:items-start">
                <div className="relative w-[260px] h-[340px] sm:w-[280px] sm:h-[370px] rounded-2xl overflow-hidden shadow-2xl shadow-black/10 dark:shadow-black/40">
                  {/* Gradient border effect */}
                  <div className="absolute inset-0 rounded-2xl p-[2px]" style={{ background: 'var(--gradient-brand)' }}>
                    <div className="w-full h-full rounded-[14px] overflow-hidden bg-surface-alt">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/team-stefano.jpg"
                        alt="Stefano Schintu — Founder of ClearUX"
                        className="w-full h-full object-cover object-top relative z-10"
                      />
                      {/* Fallback initials shown behind image if it fails to load */}
                      <div className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-muted/30">
                        SS
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-center lg:text-left mt-6">
                  <h3 className="font-manrope font-bold text-xl text-text">Stefano Schintu</h3>
                  <p className="text-sm text-muted mt-0.5">Founder &amp; CEO</p>
                  <a
                    href="https://www.linkedin.com/in/stefanoschintu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline mt-2.5 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                    Connect on LinkedIn
                  </a>
                </div>
              </div>

              {/* Story text */}
              <div className="flex-1 max-w-2xl">
                <p className="text-sm font-semibold tracking-wide uppercase mb-4 bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>The founding story</p>
                <h2 className="font-manrope font-bold text-3xl sm:text-4xl text-text mb-8" style={{ lineHeight: '1.15' }}>
                  Why ClearUX exists
                </h2>
                <div className="space-y-5 text-text/75 text-base sm:text-[17px] leading-relaxed">
                  <p className="text-text font-medium text-lg sm:text-xl border-l-4 border-violet-500 pl-5 py-2 italic">
                    What if the depth of a senior consultant&apos;s review could be available to anyone, in minutes, at a fraction of the cost?
                  </p>
                  <p>
                    After 20+ years designing digital experiences across industries and continents, I kept running into the same problem: the companies that needed UX audits the most were the ones that couldn&apos;t afford them.
                  </p>
                  <p>
                    Enterprise clients would commission $15,000 consultancy engagements and get genuine insights. Startups, agencies, and growing teams? They were stuck guessing — or relying on automated tools that counted errors without understanding people.
                  </p>
                  <p>
                    I&apos;d seen firsthand how dark patterns erode trust, how inaccessible interfaces exclude real users, and how products that ignore emotional design fail to connect. These aren&apos;t abstract problems — they cost businesses revenue and cost users their time, dignity, and confidence.
                  </p>
                  <p>
                    That&apos;s what we built. Not a checklist tool. Not another Lighthouse wrapper. A genuine, human-centered audit framework — 16 categories, 4 pillars — that examines your product the way a skilled UX researcher would: with empathy, evidence, and actionable clarity.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            MISSION — full width gradient band
            ═══════════════════════════════════════════════════════ */}
        <section className="relative py-24 overflow-hidden" style={{ background: 'var(--gradient-brand)' }}>
          <div className="absolute inset-0 bg-black/[0.06] pointer-events-none" />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/15 mb-6">
              <Sparkles size={24} className="text-white" />
            </div>
            <h2 className="font-manrope font-bold text-3xl sm:text-4xl text-white mb-6">
              Our mission
            </h2>
            <p className="text-white/90 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-4">
              Make professional-grade UX auditing accessible to every team that builds digital products — so that better experiences become the norm, not the exception.
            </p>
            <p className="text-white/70 text-base leading-relaxed max-w-xl mx-auto">
              Ethical design is good business. Products that respect users build trust. Trust drives retention. Retention drives growth. We give you the evidence to prove it.
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            WHAT MAKES US DIFFERENT — full width cards
            ═══════════════════════════════════════════════════════ */}
        <section className="relative py-24 sm:py-28 px-4 md:px-6 lg:px-8 bg-surface-alt overflow-hidden">
          <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-amber-500/[0.03] blur-[120px] pointer-events-none" />

          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-16">
              <p className="text-sm font-semibold tracking-wide uppercase mb-3 bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>Our approach</p>
              <h2 className="font-manrope font-bold text-3xl sm:text-4xl text-text">
                What makes us different
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-pink-400/30 dark:border-pink-500/20 bg-card p-8 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center mb-6">
                  <Heart size={22} className="text-pink-500" />
                </div>
                <h3 className="font-manrope font-bold text-xl text-text mb-3">Human-centered, not just metric-driven</h3>
                <p className="text-text/65 text-[15px] leading-relaxed">Most tools count errors. We look at how real people experience your product — emotional design, cognitive accessibility, digital wellbeing, age inclusivity. Things a Lighthouse score will never catch.</p>
              </div>

              <div className="rounded-2xl border border-violet-400/30 dark:border-violet-500/20 bg-card p-8 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center mb-6">
                  <Shield size={22} className="text-violet-500" />
                </div>
                <h3 className="font-manrope font-bold text-xl text-text mb-3">We detect dark patterns — and refuse to use them</h3>
                <p className="text-text/65 text-[15px] leading-relaxed">Our Human Experience pillar scans for confirmshaming, fake urgency, hidden costs, and manipulative flows. We hold ourselves to the same standard: no subscription traps, no pressure tactics.</p>
              </div>

              <div className="rounded-2xl border border-emerald-400/30 dark:border-emerald-500/20 bg-card p-8 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6">
                  <Brain size={22} className="text-emerald-500" />
                </div>
                <h3 className="font-manrope font-bold text-xl text-text mb-3">Future-ready, not just backward-looking</h3>
                <p className="text-text/65 text-[15px] leading-relaxed">We&apos;re the first audit platform to evaluate AI discoverability and AI agent readiness. As LLMs become how people find products, your site needs to be readable by machines too.</p>
              </div>

              <div className="rounded-2xl border border-amber-400/30 dark:border-amber-500/20 bg-card p-8 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-6">
                  <Eye size={22} className="text-amber-500" />
                </div>
                <h3 className="font-manrope font-bold text-xl text-text mb-3">Consultant depth at tool speed</h3>
                <p className="text-text/65 text-[15px] leading-relaxed">64 checkpoints across 4 pillars — Foundation, Human Experience, Inclusive Design, Future Readiness. Not a generic checklist. A prioritised, severity-ranked report with specific recommendations.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            THE DIGITAL LANDSCAPE IS SHIFTING — new section
            ═══════════════════════════════════════════════════════ */}
        <section className="relative py-24 sm:py-28 px-4 md:px-6 lg:px-8 bg-surface overflow-hidden">
          <div className="absolute top-[10%] right-[5%] w-[500px] h-[500px] rounded-full bg-emerald-500/[0.03] blur-[160px] pointer-events-none" />
          <div className="absolute bottom-[15%] left-[10%] w-[400px] h-[400px] rounded-full bg-violet-500/[0.03] blur-[140px] pointer-events-none" />

          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-8">
              <p className="text-sm font-semibold tracking-wide uppercase mb-3 bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>Beyond traditional audits</p>
              <h2 className="font-manrope font-bold text-3xl sm:text-4xl text-text mb-5">
                The digital landscape is shifting.<br className="hidden sm:block" /> Most audits haven&apos;t caught up.
              </h2>
              <p className="text-text/65 text-base sm:text-lg leading-relaxed max-w-3xl mx-auto">
                AI agents are becoming how people discover products. Neurodiversity affects 1 in 5 users. Emotional design is no longer a nice-to-have — it&apos;s a competitive advantage. Traditional audit tools still check the same boxes from 2015. We don&apos;t.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-14">
              {/* Card 1 — AI Readiness */}
              <div className="group relative rounded-2xl border border-emerald-400/20 dark:border-emerald-500/15 bg-card p-7 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-5">
                  <Globe size={20} className="text-emerald-500" />
                </div>
                <h3 className="font-manrope font-bold text-lg text-text mb-2.5">AI Agent Readiness</h3>
                <p className="text-text/60 text-[14px] leading-relaxed">
                  LLMs and AI agents are the new search engines. We evaluate whether your product is discoverable, navigable, and interpretable by AI — structured data, semantic markup, and machine-readable content.
                </p>
              </div>

              {/* Card 2 — Cognitive Accessibility & Neurodiversity */}
              <div className="group relative rounded-2xl border border-violet-400/20 dark:border-violet-500/15 bg-card p-7 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center mb-5">
                  <Accessibility size={20} className="text-violet-500" />
                </div>
                <h3 className="font-manrope font-bold text-lg text-text mb-2.5">Cognitive Accessibility & Neurodiversity</h3>
                <p className="text-text/60 text-[14px] leading-relaxed">
                  ADHD, dyslexia, autism spectrum, sensory processing — your users are diverse. We assess cognitive load, sensory overwhelm, predictable navigation, and clear information hierarchy for all minds.
                </p>
              </div>

              {/* Card 3 — Psychological Safety */}
              <div className="group relative rounded-2xl border border-pink-400/20 dark:border-pink-500/15 bg-card p-7 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-pink-500/10 flex items-center justify-center mb-5">
                  <ShieldCheck size={20} className="text-pink-500" />
                </div>
                <h3 className="font-manrope font-bold text-lg text-text mb-2.5">Psychological Safety</h3>
                <p className="text-text/60 text-[14px] leading-relaxed">
                  Anxiety-inducing countdowns, guilt-driven copy, and dark patterns erode trust. We detect manipulative flows and evaluate whether your product makes users feel safe, respected, and in control.
                </p>
              </div>

              {/* Card 4 — Emotional Design */}
              <div className="group relative rounded-2xl border border-amber-400/20 dark:border-amber-500/15 bg-card p-7 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center mb-5">
                  <HeartHandshake size={20} className="text-amber-500" />
                </div>
                <h3 className="font-manrope font-bold text-lg text-text mb-2.5">Emotional Intelligence</h3>
                <p className="text-text/60 text-[14px] leading-relaxed">
                  The best products understand how users feel. We assess tone, microcopy, error messaging, and delight moments — because the emotional experience is what users remember long after they close the tab.
                </p>
              </div>

              {/* Card 5 — Digital Wellbeing */}
              <div className="group relative rounded-2xl border border-teal-400/20 dark:border-teal-500/15 bg-card p-7 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-teal-500/10 flex items-center justify-center mb-5">
                  <Flower2 size={20} className="text-teal-500" />
                </div>
                <h3 className="font-manrope font-bold text-lg text-text mb-2.5">Digital Wellbeing</h3>
                <p className="text-text/60 text-[14px] leading-relaxed">
                  Addictive patterns, endless scrolls, and notification overload damage user health. We evaluate whether your product respects attention, promotes healthy usage, and empowers users to disengage.
                </p>
              </div>

              {/* Card 6 — Future-Proof Design */}
              <div className="group relative rounded-2xl border border-indigo-400/20 dark:border-indigo-500/15 bg-card p-7 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-5">
                  <Zap size={20} className="text-indigo-500" />
                </div>
                <h3 className="font-manrope font-bold text-lg text-text mb-2.5">Future-Proof Design</h3>
                <p className="text-text/60 text-[14px] leading-relaxed">
                  Responsive design was yesterday&apos;s challenge. Tomorrow&apos;s is multi-modal: voice, gesture, AI-assisted navigation. We assess whether your product is ready for how people will interact with technology next.
                </p>
              </div>
            </div>

            {/* Bottom callout */}
            <div className="mt-14 text-center">
              <p className="text-text/50 text-sm max-w-2xl mx-auto leading-relaxed">
                These aren&apos;t edge cases. They&apos;re the new baseline. As AI reshapes discovery and neurodiversity gains visibility, the products that adapt first will lead their markets.
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            BUILT FOR — full width
            ═══════════════════════════════════════════════════════ */}
        <section className="py-24 px-4 md:px-6 lg:px-8 bg-surface">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-12 mb-10">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Users size={22} className="text-amber-500" />
              </div>
              <div>
                <h2 className="font-manrope font-bold text-3xl sm:text-4xl text-text mb-2">
                  Built for people who ship products
                </h2>
                <p className="text-muted text-base">Not another enterprise tool. Built for teams that move fast.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border/20 dark:border-white/[0.04]">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <BarChart3 size={20} className="text-violet-500" />
                </div>
                <p className="text-text/80 text-[15px] leading-relaxed">Product managers who need to justify UX investment with data</p>
              </div>
              <div className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border/20 dark:border-white/[0.04]">
                <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                  <Rocket size={20} className="text-pink-500" />
                </div>
                <p className="text-text/80 text-[15px] leading-relaxed">Founders who can&apos;t afford a $15k consultancy but refuse to ship mediocre</p>
              </div>
              <div className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border/20 dark:border-white/[0.04]">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Tag size={20} className="text-emerald-500" />
                </div>
                <p className="text-text/80 text-[15px] leading-relaxed">Agencies who want white-label audit capabilities for their clients</p>
              </div>
              <div className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border/20 dark:border-white/[0.04]">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Target size={20} className="text-amber-500" />
                </div>
                <p className="text-text/80 text-[15px] leading-relaxed">UX designers who want an objective second opinion before launch</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            CTA — full width gradient
            ═══════════════════════════════════════════════════════ */}
        <section className="relative py-28 sm:py-36 px-4 md:px-6 lg:px-8 overflow-hidden" style={{ background: 'var(--gradient-brand-subtle)' }}>
          <div className="absolute top-[20%] left-[15%] w-[400px] h-[400px] rounded-full bg-violet-500/[0.06] blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[20%] right-[15%] w-[350px] h-[350px] rounded-full bg-emerald-500/[0.05] blur-[120px] pointer-events-none" />

          <div className="max-w-3xl mx-auto text-center relative">
            <p className="text-sm font-semibold tracking-wide uppercase mb-6 bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>Start your audit today</p>
            <h2 className="font-manrope font-bold text-4xl sm:text-5xl text-text mb-6" style={{ lineHeight: '1.1' }}>
              Ready to see what<br className="hidden sm:block" /> you&apos;re missing?
            </h2>
            <p className="text-muted text-lg mb-10 max-w-lg mx-auto">
              64 checkpoints. 16 categories. Results in minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-8 py-4 text-white rounded-xl font-semibold hover:brightness-110 hover:-translate-y-0.5 transition-all shadow-lg"
                style={{ background: 'var(--gradient-brand)', boxShadow: '0 8px 24px rgba(124,58,237,.2), 0 4px 12px rgba(236,72,153,.1)' }}
              >
                Start an audit
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-8 py-4 border-2 border-border text-text rounded-xl font-semibold hover:bg-card transition-all"
              >
                Contact us
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
