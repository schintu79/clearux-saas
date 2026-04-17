import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowRight, Sparkles, Heart, Shield, Brain, Eye, Users, BarChart3, Rocket, Tag, Target, Accessibility, HeartHandshake, BrainCircuit, Zap, ShieldCheck, Flower2 } from 'lucide-react'
import { ArrowCurvy, Sparkle, Spiral, Squiggle } from '@/components/ui/Doodles'

export const metadata: Metadata = {
  title: 'About ClearUX — Human-Centered AI Audit Platform',
  description: 'ClearUX was built by a team that spent 20+ years watching companies ship products that ignored their users. Learn why we exist and what drives us.',
}

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-[70vh] bg-surface">

        {/* ═══════════════════════════════════════════════════════
            1. HERO — full width, gradient ambient glows
            ═══════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden py-24 sm:py-32 px-4 md:px-6 lg:px-8" style={{ background: 'var(--gradient-brand-subtle)' }}>
          {/* Ambient glows */}
          <div className="absolute top-[-10%] left-[15%] w-[600px] h-[500px] rounded-full bg-brand/[0.06] blur-[160px] pointer-events-none" />
          <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] rounded-full bg-pink-500/[0.04] blur-[140px] pointer-events-none" />
          <div className="absolute bottom-[10%] left-[40%] w-[350px] h-[350px] rounded-full bg-[#2D7A4F]/[0.04] blur-[120px] pointer-events-none" />

          <div className="max-w-5xl mx-auto text-center relative">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-8" style={{ background: 'var(--gradient-brand-subtle)' }}>
              <div className="w-2 h-2 rounded-full animate-pulse bg-brand" />
              <span className="text-sm font-semibold tracking-wide text-brand">About ClearUX</span>
            </div>

            <h1 className="font-heading font-semibold text-4xl sm:text-5xl md:text-6xl text-text mb-6" style={{ lineHeight: '1.1' }}>
              Every product deserves<br className="hidden sm:block" />{' '}
              <span className="text-muted">an honest audit.</span>
            </h1>
            <p className="text-text/70 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
              ClearUX exists because great user experience shouldn&apos;t be a luxury reserved for companies with six-figure consultancy budgets.
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            2. BEYOND TRADITIONAL AUDITS
            ═══════════════════════════════════════════════════════ */}
        <section className="relative py-24 sm:py-28 px-4 md:px-6 lg:px-8 bg-surface overflow-hidden">
          <div className="absolute top-[10%] right-[5%] w-[500px] h-[500px] rounded-full bg-[#2D7A4F]/[0.03] blur-[160px] pointer-events-none" />
          <div className="absolute bottom-[15%] left-[10%] w-[400px] h-[400px] rounded-full bg-brand/[0.03] blur-[140px] pointer-events-none" />

          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-8">
              <p className="text-sm font-semibold tracking-wide uppercase mb-3 text-brand">Beyond traditional audits</p>
              <h2 className="font-heading font-semibold text-3xl sm:text-4xl text-text mb-5">
                Traditional audit tools still check the same<br className="hidden sm:block" /> boxes from 2015. We don&apos;t.
              </h2>
              <p className="text-text/65 text-base sm:text-lg leading-relaxed max-w-3xl mx-auto">
                The digital landscape is shifting. Most audits haven&apos;t caught up. AI agents are becoming how people discover products. Neurodiversity affects 1 in 5 users. Emotional design is no longer a nice-to-have — it&apos;s a competitive advantage.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-14">
              {/* Card 1 — AI Readiness */}
              <div className="group relative rounded-xl border border-[#2D7A4F]/20 dark:border-[#2D7A4F]/15 bg-card p-7 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-[#2D7A4F]/10 flex items-center justify-center mb-5">
                  <BrainCircuit size={20} className="text-[#2D7A4F]" />
                </div>
                <h3 className="font-heading font-semibold text-lg text-text mb-2.5">AI Agent Readiness</h3>
                <p className="text-text/60 text-[14px] leading-relaxed">
                  LLMs and AI agents are the new search engines. We evaluate whether your product is discoverable, navigable, and interpretable by AI — structured data, semantic markup, and machine-readable content.
                </p>
              </div>

              {/* Card 2 — Cognitive Accessibility & Neurodiversity */}
              <div className="group relative rounded-xl border border-[#6B5B95]/20 dark:border-[#6B5B95]/15 bg-card p-7 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-[#6B5B95]/10 flex items-center justify-center mb-5">
                  <Accessibility size={20} className="text-[#6B5B95]" />
                </div>
                <h3 className="font-heading font-semibold text-lg text-text mb-2.5">Cognitive Accessibility & Neurodiversity</h3>
                <p className="text-text/60 text-[14px] leading-relaxed">
                  ADHD, dyslexia, autism spectrum, sensory processing — your users are diverse. We assess cognitive load, sensory overwhelm, predictable navigation, and clear information hierarchy for all minds.
                </p>
              </div>

              {/* Card 3 — Psychological Safety */}
              <div className="group relative rounded-xl border border-pink-400/20 dark:border-pink-500/15 bg-card p-7 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-pink-500/10 flex items-center justify-center mb-5">
                  <ShieldCheck size={20} className="text-pink-500" />
                </div>
                <h3 className="font-heading font-semibold text-lg text-text mb-2.5">Psychological Safety</h3>
                <p className="text-text/60 text-[14px] leading-relaxed">
                  Anxiety-inducing countdowns, guilt-driven copy, and dark patterns erode trust. We detect manipulative flows and evaluate whether your product makes users feel safe, respected, and in control.
                </p>
              </div>

              {/* Card 4 — Emotional Design */}
              <div className="group relative rounded-xl border border-amber-400/20 dark:border-amber-500/15 bg-card p-7 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center mb-5">
                  <HeartHandshake size={20} className="text-amber-500" />
                </div>
                <h3 className="font-heading font-semibold text-lg text-text mb-2.5">Emotional Intelligence</h3>
                <p className="text-text/60 text-[14px] leading-relaxed">
                  The best products understand how users feel. We assess tone, microcopy, error messaging, and delight moments — because the emotional experience is what users remember long after they close the tab.
                </p>
              </div>

              {/* Card 5 — Digital Wellbeing */}
              <div className="group relative rounded-xl border border-teal-400/20 dark:border-teal-500/15 bg-card p-7 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-teal-500/10 flex items-center justify-center mb-5">
                  <Flower2 size={20} className="text-teal-500" />
                </div>
                <h3 className="font-heading font-semibold text-lg text-text mb-2.5">Digital Wellbeing</h3>
                <p className="text-text/60 text-[14px] leading-relaxed">
                  Addictive patterns, endless scrolls, and notification overload damage user health. We evaluate whether your product respects attention, promotes healthy usage, and empowers users to disengage.
                </p>
              </div>

              {/* Card 6 — Future-Proof Design */}
              <div className="group relative rounded-xl border border-indigo-400/20 dark:border-indigo-500/15 bg-card p-7 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-5">
                  <Zap size={20} className="text-indigo-500" />
                </div>
                <h3 className="font-heading font-semibold text-lg text-text mb-2.5">Future-Proof Design</h3>
                <p className="text-text/60 text-[14px] leading-relaxed">
                  Responsive design was yesterday&apos;s challenge. Tomorrow&apos;s is multi-modal: voice, gesture, AI-assisted navigation. We assess whether your product is ready for how people will interact with technology next.
                </p>
              </div>
            </div>

            {/* Bottom callout + cross-link */}
            <div className="mt-14 text-center">
              <p className="text-text/50 text-sm max-w-2xl mx-auto leading-relaxed mb-6">
                These aren&apos;t edge cases. They&apos;re the new baseline. As AI reshapes discovery and neurodiversity gains visibility, the products that adapt first will lead their markets.
              </p>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:opacity-80 transition-opacity"
              >
                See pricing and plans
                <ArrowRight size={14} className="text-brand" />
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            3. MISSION — full width gradient band
            ═══════════════════════════════════════════════════════ */}
        <section className="relative py-24 overflow-hidden bg-brand">
          <div className="absolute inset-0 bg-black/[0.06] pointer-events-none" />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/15 mb-6">
              <Sparkles size={24} className="text-white" />
            </div>
            <h2 className="font-heading font-semibold text-3xl sm:text-4xl text-white mb-6">
              Our commitment
            </h2>
            <p className="text-white/90 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-4">
              Make professional-grade UX auditing accessible to every team that builds digital products — so that better experiences become the norm, not the exception.
            </p>
            <p className="text-white/70 text-base leading-relaxed max-w-2xl mx-auto">
              Ethical design is good business. Products that respect users build trust. Trust drives retention.<br className="hidden sm:block" /> Retention drives growth. We give you the evidence to prove it.
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            4. FOUNDER STORY — full width, side-by-side
            ═══════════════════════════════════════════════════════ */}
        <section className="relative py-24 sm:py-28 px-4 md:px-6 lg:px-8 bg-surface-alt overflow-hidden bg-dotgrid">
          <ArrowCurvy className="hidden lg:block absolute top-12 right-[7%] rotate-6" color="var(--color-foundation)" />
          <Sparkle className="hidden lg:block absolute bottom-16 left-[4%]" color="var(--color-tech)" />

          <div className="max-w-6xl mx-auto relative">
            <div className="flex flex-col lg:flex-row gap-14 lg:gap-20 items-center">

              {/* Photo column */}
              <div className="flex-shrink-0 w-full lg:w-auto flex flex-col items-center lg:items-start">
                <div className="relative w-[260px] h-[340px] sm:w-[280px] sm:h-[370px] rounded-2xl overflow-hidden shadow-2xl shadow-black/10 dark:shadow-black/40">
                  {/* Gradient border effect */}
                  <div className="absolute inset-0 rounded-2xl p-[2px] bg-brand">
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
                  <h3 className="font-heading font-semibold text-xl text-text">Stefano Schintu</h3>
                  <p className="text-sm text-muted mt-0.5">Founder &amp; CEO</p>
                  <a
                    href="https://www.linkedin.com/in/stefanoschintu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline mt-2.5 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                    Connect on LinkedIn
                  </a>
                </div>
              </div>

              {/* Story text */}
              <div className="flex-1 max-w-2xl">
                <p className="text-sm font-semibold tracking-wide uppercase mb-4 text-brand">The founding story</p>
                <h2 className="font-heading text-3xl sm:text-4xl text-text mb-8" style={{ lineHeight: '1.15' }}>
                  Why ClearUX exists
                </h2>
                <div className="space-y-6 text-text/75 text-base sm:text-[17px] leading-relaxed">
                  <p className="text-text font-medium text-lg sm:text-xl border-l-4 border-brand pl-5 py-2 italic">
                    What if the depth of a senior consultant&apos;s review could be available to anyone, in minutes, at a fraction of the cost?
                  </p>

                  <h3 className="font-heading text-lg text-text pt-2">The problem we kept seeing</h3>
                  <p>
                    After 20+ years designing digital experiences across industries and continents, we kept running into the same problem: the companies that needed UX audits the most were the ones that couldn&apos;t afford them.
                  </p>
                  <p>
                    Enterprise clients would commission $15,000 consultancy engagements and get genuine insights. Startups, agencies, and growing teams? They were stuck guessing — or relying on automated tools that counted errors without understanding people.
                  </p>

                  <h3 className="font-heading text-lg text-text pt-2">What we saw going wrong</h3>
                  <p>
                    We&apos;d seen firsthand how dark patterns erode trust, how inaccessible interfaces exclude real users, and how products that ignore emotional design fail to connect. These aren&apos;t abstract problems — they cost businesses revenue and cost users their time, dignity, and confidence.
                  </p>

                  <h3 className="font-heading text-lg text-text pt-2">What we built instead</h3>
                  <p>
                    Not a checklist tool. Not another automated scanner. A genuine, human-centered audit framework — 16 categories, 4 pillars — that examines your product the way a skilled UX researcher would: with empathy, evidence, and actionable clarity.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            5. OUR APPROACH — What makes us different
            ═══════════════════════════════════════════════════════ */}
        <section className="relative py-24 sm:py-28 px-4 md:px-6 lg:px-8 bg-surface overflow-hidden">
          <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-amber-500/[0.03] blur-[120px] pointer-events-none" />

          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-16">
              <p className="text-sm font-semibold tracking-wide uppercase mb-3 text-brand">Our approach</p>
              <h2 className="font-heading font-semibold text-3xl sm:text-4xl text-text">
                What makes us different
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="rounded-xl border border-pink-400/30 dark:border-pink-500/20 bg-card p-8 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center mb-6">
                  <Heart size={22} className="text-pink-500" />
                </div>
                <h3 className="font-heading font-semibold text-xl text-text mb-3">Human-centered, not just metric-driven</h3>
                <p className="text-text/65 text-[15px] leading-relaxed">Most tools count errors. We look at how real people experience your product — emotional design, cognitive accessibility, digital wellbeing, age inclusivity. The blind spots other tools miss.</p>
              </div>

              <div className="rounded-xl border border-[#6B5B95]/30 dark:border-[#6B5B95]/20 bg-card p-8 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-[#6B5B95]/10 flex items-center justify-center mb-6">
                  <Shield size={22} className="text-[#6B5B95]" />
                </div>
                <h3 className="font-heading font-semibold text-xl text-text mb-3">We detect dark patterns — and refuse to use them</h3>
                <p className="text-text/65 text-[15px] leading-relaxed">Our Human Experience pillar scans for confirmshaming, fake urgency, hidden costs, and manipulative flows. We hold ourselves to the same standard: no subscription traps, no pressure tactics.</p>
              </div>

              <div className="rounded-xl border border-[#2D7A4F]/30 dark:border-[#2D7A4F]/20 bg-card p-8 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-[#2D7A4F]/10 flex items-center justify-center mb-6">
                  <Brain size={22} className="text-[#2D7A4F]" />
                </div>
                <h3 className="font-heading font-semibold text-xl text-text mb-3">Future-ready, not just backward-looking</h3>
                <p className="text-text/65 text-[15px] leading-relaxed">We&apos;re the first audit platform to evaluate AI discoverability and AI agent readiness. As LLMs become how people find products, your site needs to be readable by machines too.</p>
              </div>

              <div className="rounded-xl border border-amber-400/30 dark:border-amber-500/20 bg-card p-8 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-6">
                  <Eye size={22} className="text-amber-500" />
                </div>
                <h3 className="font-heading font-semibold text-xl text-text mb-3">Audit once, improve continuously</h3>
                <p className="text-text/65 text-[15px] leading-relaxed">64 checkpoints across 4 pillars. Track each finding from open to fixed, share results with your team, and re-audit to compare scores over time. Not just a one-time report — an ongoing improvement system.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            6. BUILT FOR — same 2-col card style
            ═══════════════════════════════════════════════════════ */}
        <section className="relative py-24 sm:py-28 px-4 md:px-6 lg:px-8 bg-surface-alt overflow-hidden bg-dotgrid">
          <Spiral className="hidden lg:block absolute top-10 left-[5%]" color="var(--color-future)" />
          <Squiggle className="hidden lg:block absolute bottom-14 right-[6%]" color="var(--color-human)" />

          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-16">
              <p className="text-sm font-semibold tracking-wide uppercase mb-3 text-brand">Who we serve</p>
              <h2 className="font-heading font-semibold text-3xl sm:text-4xl text-text">
                Built for people who ship products
              </h2>
              <p className="text-muted text-base mt-3 max-w-lg mx-auto">Not another enterprise tool. Built for teams that move fast.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="rounded-xl border border-[#6B5B95]/30 dark:border-[#6B5B95]/20 bg-card p-8 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-[#6B5B95]/10 flex items-center justify-center mb-6">
                  <BarChart3 size={22} className="text-[#6B5B95]" />
                </div>
                <h3 className="font-heading font-semibold text-xl text-text mb-3">Product Managers</h3>
                <p className="text-text/65 text-[15px] leading-relaxed">Need to justify UX investment with data? Track findings from open to fixed, share results with stakeholders via read-only links, and re-audit to show measurable improvement over time.</p>
              </div>

              <div className="rounded-xl border border-pink-400/30 dark:border-pink-500/20 bg-card p-8 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center mb-6">
                  <Rocket size={22} className="text-pink-500" />
                </div>
                <h3 className="font-heading font-semibold text-xl text-text mb-3">Founders & Startups</h3>
                <p className="text-text/65 text-[15px] leading-relaxed">Can&apos;t afford a $15k consultancy but refuse to ship mediocre? Get consultant-grade audits at a fraction of the cost, in minutes instead of weeks.</p>
              </div>

              <div className="rounded-xl border border-[#2D7A4F]/30 dark:border-[#2D7A4F]/20 bg-card p-8 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-[#2D7A4F]/10 flex items-center justify-center mb-6">
                  <Tag size={22} className="text-[#2D7A4F]" />
                </div>
                <h3 className="font-heading font-semibold text-xl text-text mb-3">Agencies</h3>
                <p className="text-text/65 text-[15px] leading-relaxed">White-label reports for your clients, shareable result links for stakeholders, and re-audit tracking to prove the value of your work over time. Upload your logo and deliver under your own banner.</p>
              </div>

              <div className="rounded-xl border border-amber-400/30 dark:border-amber-500/20 bg-card p-8 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-6">
                  <Target size={22} className="text-amber-500" />
                </div>
                <h3 className="font-heading font-semibold text-xl text-text mb-3">UX Designers</h3>
                <p className="text-text/65 text-[15px] leading-relaxed">Want an objective second opinion before launch? Get a comprehensive, evidence-based review across 16 categories that catches what fresh eyes would.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            7. CTA — Start your audit today
            ═══════════════════════════════════════════════════════ */}
        <section className="relative py-28 sm:py-36 px-4 md:px-6 lg:px-8 overflow-hidden" style={{ background: 'var(--gradient-brand-subtle)' }}>
          <div className="absolute top-[20%] left-[15%] w-[400px] h-[400px] rounded-full bg-brand/[0.06] blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[20%] right-[15%] w-[350px] h-[350px] rounded-full bg-[#2D7A4F]/[0.05] blur-[120px] pointer-events-none" />

          <div className="max-w-3xl mx-auto text-center relative">
            <p className="text-sm font-semibold tracking-wide uppercase mb-6 text-brand">Start your audit today</p>
            <h2 className="font-heading font-semibold text-4xl sm:text-5xl text-text mb-6" style={{ lineHeight: '1.1' }}>
              Ready to see what<br className="hidden sm:block" /> you&apos;re missing?
            </h2>
            <p className="text-muted text-lg mb-10 max-w-lg mx-auto">
              64 checkpoints. 16 categories. Results in minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-8 py-4 bg-brand text-surface dark:text-[#1C1C1C] rounded-lg font-semibold hover:brightness-110 hover:-translate-y-0.5 transition-all shadow-md"
              >
                Start an audit
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-8 py-4 border-2 border-border text-text rounded-lg font-semibold hover:bg-card transition-all"
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
