import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowRight, Sparkles, Heart, Shield, Brain, Eye, Users, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About ClearUX — Human-Centered AI Audit Platform',
  description: 'ClearUX was built by a design leader who spent 15+ years watching companies ship products that ignored their users. Learn why we exist and what drives us.',
}

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-[70vh] bg-surface">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div className="absolute top-[-10%] left-[15%] w-[500px] h-[400px] rounded-full bg-violet-500/[0.04] blur-[140px] pointer-events-none" />
          <div className="absolute top-[20%] right-[10%] w-[400px] h-[350px] rounded-full bg-pink-500/[0.03] blur-[120px] pointer-events-none" />

          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-28 pb-12 relative">
            <p className="text-sm font-semibold tracking-wide uppercase mb-4 bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>About ClearUX</p>
            <h1 className="font-manrope font-bold text-3xl sm:text-4xl md:text-5xl text-text mb-6" style={{ lineHeight: '1.15' }}>
              Every product deserves<br className="hidden sm:block" />{' '}
              <span className="text-muted">an honest audit.</span>
            </h1>
            <p className="text-text/80 text-lg leading-relaxed max-w-2xl">
              ClearUX exists because great user experience shouldn&apos;t be a luxury reserved for companies with six-figure consultancy budgets.
            </p>
          </div>
        </section>

        {/* ── Founding Story ── */}
        <section className="py-16 bg-surface">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row gap-10 md:gap-14 items-start">

              {/* Photo + name */}
              <div className="flex-shrink-0 w-full md:w-[240px]">
                <div className="relative w-[200px] h-[260px] rounded-2xl overflow-hidden bg-surface-alt border border-border/30 shadow-lg mx-auto md:mx-0">
                  <Image
                    src="/team-stefano.jpg"
                    alt="Stefano Schintu — Founder of ClearUX"
                    fill
                    className="object-cover object-top"
                    sizes="200px"
                  />
                </div>
                <div className="text-center md:text-left mt-4">
                  <h3 className="font-manrope font-bold text-lg text-text">Stefano Schintu</h3>
                  <p className="text-sm text-muted">Founder &amp; CEO</p>
                  <a
                    href="https://www.linkedin.com/in/stefanoschintu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline mt-2"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                    LinkedIn
                  </a>
                </div>
              </div>

              {/* Story */}
              <div className="flex-1">
                <h2 className="font-manrope font-bold text-2xl sm:text-3xl text-text mb-6">
                  Why ClearUX exists
                </h2>
                <div className="space-y-4 text-text/80 text-base leading-relaxed">
                  <p>
                    After 15+ years designing digital experiences across industries and continents, I kept running into the same problem: the companies that needed UX audits the most were the ones that couldn&apos;t afford them.
                  </p>
                  <p>
                    Enterprise clients would commission $15,000 consultancy engagements and get genuine insights. Startups, agencies, and growing teams? They were stuck guessing — or relying on automated tools that counted errors without understanding people.
                  </p>
                  <p>
                    I&apos;d seen firsthand how dark patterns erode trust, how inaccessible interfaces exclude real users, and how products that ignore emotional design fail to connect. These aren&apos;t abstract problems — they cost businesses revenue and cost users their time, dignity, and confidence.
                  </p>
                  <p>
                    ClearUX was born from a conviction: <strong className="text-text">what if the depth of a senior consultant&apos;s review could be available to anyone, in minutes, at a fraction of the cost?</strong>
                  </p>
                  <p>
                    That&apos;s what we built. Not a checklist tool. Not another Lighthouse wrapper. A genuine, human-centered audit framework — 16 categories, 4 pillars — that examines your product the way a skilled UX researcher would: with empathy, evidence, and actionable clarity.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Mission ── */}
        <section className="relative py-16 overflow-hidden" style={{ background: 'var(--gradient-brand-subtle)' }}>
          <div className="absolute top-[30%] right-[10%] w-[300px] h-[300px] rounded-full bg-violet-500/[0.04] blur-[100px] pointer-events-none" />
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-brand)' }}>
                <Sparkles size={18} className="text-white" />
              </div>
              <h2 className="font-manrope font-bold text-2xl sm:text-3xl text-text">
                Our mission
              </h2>
            </div>
            <p className="text-text/80 text-lg leading-relaxed mb-6">
              Make professional-grade UX auditing accessible to every team that builds digital products — so that better experiences become the norm, not the exception.
            </p>
            <p className="text-text/70 text-base leading-relaxed">
              We believe ethical design is good business. Products that respect users build trust. Trust drives retention. Retention drives growth. We give you the evidence to prove it — and the roadmap to act on it.
            </p>
          </div>
        </section>

        {/* ── What makes us different ── */}
        <section className="bg-surface-alt py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-manrope font-bold text-2xl sm:text-3xl text-text mb-12">
              What makes us different
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                {
                  icon: Heart,
                  color: 'text-pink-500',
                  bg: 'bg-pink-500/10',
                  title: 'Human-centered, not just metric-driven',
                  body: 'Most tools count errors. We look at how real people experience your product — emotional design, cognitive accessibility, digital wellbeing, age inclusivity. Things a Lighthouse score will never catch.',
                },
                {
                  icon: Shield,
                  color: 'text-violet-500',
                  bg: 'bg-violet-500/10',
                  title: 'We detect dark patterns — and refuse to use them',
                  body: 'Our Human Experience pillar scans for confirmshaming, fake urgency, hidden costs, and manipulative flows. We hold ourselves to the same standard: no subscription traps, no pressure tactics. Credits never expire.',
                },
                {
                  icon: Brain,
                  color: 'text-emerald-500',
                  bg: 'bg-emerald-500/10',
                  title: 'Future-ready, not just backward-looking',
                  body: "We're the first audit platform to evaluate AI discoverability and AI agent readiness. As LLMs become how people find products, your site needs to be readable by machines too.",
                },
                {
                  icon: Eye,
                  color: 'text-amber-500',
                  bg: 'bg-amber-500/10',
                  title: 'Consultant depth at tool speed',
                  body: "64 checkpoints across 4 pillars — Foundation, Human Experience, Inclusive Design, Future Readiness. Not a generic checklist. A prioritised, severity-ranked report with specific recommendations.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-border/40 dark:border-white/[0.06] bg-card p-7 hover:shadow-lg hover:shadow-black/[0.03] transition-all duration-300">
                  <div className={`w-11 h-11 rounded-xl ${item.bg} flex items-center justify-center mb-5`}>
                    <item.icon size={20} className={item.color} />
                  </div>
                  <h3 className="font-manrope font-bold text-lg text-text mb-3">{item.title}</h3>
                  <p className="text-text/70 text-sm leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Built for ── */}
        <section className="py-16 bg-surface">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Users size={18} className="text-amber-500" />
              </div>
              <h2 className="font-manrope font-bold text-2xl sm:text-3xl text-text">
                Built for people who ship products
              </h2>
            </div>
            <div className="space-y-3 mt-8">
              {[
                'Product managers who need to justify UX investment with data',
                'Founders who can\'t afford a $15k consultancy but refuse to ship mediocre',
                'Agencies who want white-label audit capabilities for their clients',
                'UX designers who want an objective second opinion before launch',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <p className="text-text/80 text-base leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="relative py-20 overflow-hidden" style={{ background: 'var(--gradient-brand)' }}>
          <div className="absolute inset-0 bg-black/[0.06] pointer-events-none" />
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
            <h2 className="font-manrope font-bold text-2xl sm:text-3xl text-white mb-4">
              Ready to see what you&apos;re missing?
            </h2>
            <p className="text-white/80 text-base mb-8 max-w-lg mx-auto">
              Run your first audit today. 64 checkpoints, 16 categories, results in minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-gray-900 rounded-xl font-semibold hover:bg-white/90 transition-all shadow-lg"
              >
                Start an audit
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white/10 border border-white/20 text-white rounded-xl font-semibold hover:bg-white/20 transition-all"
              >
                Contact us
              </Link>
            </div>
            <p className="text-sm text-white/70 mt-6">
              Questions? Reach us at{' '}
              <a href="mailto:support@clearux.ai" className="text-white hover:underline">support@clearux.ai</a>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
