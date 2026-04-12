import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { Heart, Shield, Brain, Eye, ArrowRight, Sparkles, Users, CheckCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About ClearUX — Human-Centered AI Audit Platform',
  description: 'ClearUX combines AI precision with human-centered design principles. 19 audit categories across 4 pillars — Foundation, Human Experience, Technical Excellence, Future Readiness.',
}

const DIFFERENTIATORS = [
  {
    icon: Heart,
    color: 'text-pink-500',
    bg: 'bg-pink-500/10',
    title: 'Human-centered, not just metric-driven',
    body: 'Most audit tools count errors. We look at how real people experience your product. Our 19 categories include emotional intelligence, cognitive accessibility, digital wellbeing, and age inclusivity — things a simple Lighthouse score will never catch.',
  },
  {
    icon: Shield,
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
    title: 'We detect dark patterns — and refuse to use them',
    body: 'Our Human Experience pillar actively scans for confirmshaming, fake urgency, hidden costs, and manipulative flows. We hold ourselves to the same standard: no subscription traps, no artificial scarcity, no pressure tactics. Credits never expire.',
  },
  {
    icon: Brain,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    title: 'Future-ready, not just backward-looking',
    body: "We're the first audit platform to evaluate AI discoverability and AI agent readiness. As LLMs and AI assistants become how people find products, your site needs to be readable by machines too.",
  },
  {
    icon: Eye,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    title: 'Consultant depth at tool speed',
    body: "Each audit runs 95 checkpoints across 4 pillars: Foundation, Human Experience, Technical Excellence, and Future Readiness. The output isn't a generic checklist — it's a prioritised, severity-ranked report with specific recommendations.",
  },
]

const WHO_ITS_FOR = [
  'Product managers who need to justify UX investment with data',
  'Founders who can\'t afford a $15k consultancy but refuse to ship mediocre',
  'Agencies who want to add audit capabilities to their offering',
  'UX designers who want an objective second opinion before launch',
]

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-[70vh] bg-surface">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          {/* Subtle kaleidoscope glow */}
          <div className="absolute top-[-10%] left-[15%] w-[500px] h-[400px] rounded-full bg-violet-500/[0.04] blur-[140px] pointer-events-none" />
          <div className="absolute top-[20%] right-[10%] w-[400px] h-[350px] rounded-full bg-pink-500/[0.03] blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[10%] left-[40%] w-[300px] h-[300px] rounded-full bg-emerald-500/[0.03] blur-[100px] pointer-events-none" />

          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-28 pb-16 relative">
            <p className="text-sm font-semibold tracking-wide uppercase mb-4 bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>About ClearUX</p>
            <h1 className="font-manrope font-bold text-3xl sm:text-4xl md:text-5xl text-text mb-6" style={{ lineHeight: '1.15' }}>
              We believe great UX<br className="hidden sm:block" />{' '}
              <span className="text-muted">starts with honesty.</span>
            </h1>
            <p className="text-text/80 text-lg leading-relaxed max-w-2xl">
              ClearUX was built on a simple idea: every digital product deserves the kind of thorough, human-centered audit that used to cost $10,000+ and take weeks. We make that accessible to everyone — in minutes, for a fraction of the cost.
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
              {DIFFERENTIATORS.map((item) => (
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

        {/* ── Our ethical commitment ── */}
        <section className="relative py-20 overflow-hidden" style={{ background: 'var(--gradient-brand-subtle)' }}>
          <div className="absolute top-[30%] right-[10%] w-[300px] h-[300px] rounded-full bg-violet-500/[0.04] blur-[100px] pointer-events-none" />
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-brand)' }}>
                <Sparkles size={18} className="text-white" />
              </div>
              <h2 className="font-manrope font-bold text-2xl sm:text-3xl text-text">
                Our ethical commitment
              </h2>
            </div>
            <div className="space-y-5 text-text/80 text-base leading-relaxed">
              <p>
                We started ClearUX because we saw too many products that treat users as targets instead of people. Dark patterns, manipulative copy, inaccessible interfaces — these aren&apos;t just bad UX, they&apos;re harmful.
              </p>
              <p>
                Our audit framework is built on the principle that ethical design is good business. Products that respect users build trust. Trust drives retention. Retention drives growth. We give you the data to prove it.
              </p>
              <p>
                We practice what we preach. ClearUX has no subscription lock-in, no hidden fees, no manipulative upsells. You pay per audit, credits never expire, and every audit gets the full analysis. We believe that if our product is good enough, you&apos;ll come back — no tricks needed.
              </p>
            </div>
          </div>
        </section>

        {/* ── Who it's for ── */}
        <section className="py-20 bg-surface">
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
              {WHO_ITS_FOR.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <p className="text-text/80 text-base leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
            <p className="text-text/80 text-base leading-relaxed mt-8">
              Paste your URL, get your report, fix what matters. That&apos;s it.
            </p>
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
              Run your first audit today. 95 checkpoints, 19 categories, results in minutes.
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
