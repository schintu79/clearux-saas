import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { Heart, Shield, Brain, Eye, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About',
  description: 'ClearUX is a human-centered, AI-powered UX audit platform. We believe ethical design is good business.',
}

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[70vh] bg-surface">
        {/* ── Hero ── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-28 pb-16">
          <p className="text-sm font-semibold tracking-wide uppercase mb-4 bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>About ClearUX</p>
          <h1 className="font-manrope font-bold text-3xl sm:text-4xl md:text-5xl text-text mb-6" style={{ lineHeight: '1.15' }}>
            We believe great UX<br className="hidden sm:block" />
            <span className="text-muted">starts with honesty.</span>
          </h1>
          <p className="text-text/80 text-lg leading-relaxed max-w-2xl">
            ClearUX was built on a simple idea: every digital product deserves the kind of thorough, human-centered audit that used to cost $10,000+ and take weeks. We make that accessible to everyone — in minutes, for a fraction of the cost.
          </p>
        </section>

        {/* ── What makes us different ── */}
        <section className="bg-surface-alt py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-manrope font-bold text-2xl sm:text-3xl text-text mb-12">
              What makes us different
            </h2>

            <div className="space-y-10">
              {[
                {
                  icon: Heart,
                  title: 'Human-centered, not just metric-driven',
                  body: 'Most audit tools count errors. We look at how real people experience your product. Our 19 categories include emotional intelligence, cognitive accessibility, digital wellbeing, and age inclusivity — things a simple Lighthouse score will never catch.',
                },
                {
                  icon: Shield,
                  title: 'We detect dark patterns — and refuse to use them',
                  body: 'Our Human Experience pillar actively scans for confirmshaming, fake urgency, hidden costs, and manipulative flows. We hold ourselves to the same standard: no subscription traps, no artificial scarcity, no pressure tactics. Credits never expire. Cancel nothing because there\'s nothing to cancel.',
                },
                {
                  icon: Brain,
                  title: 'Future-ready, not just backward-looking',
                  body: 'We\'re the first audit platform to evaluate AI discoverability and AI agent readiness. As LLMs and AI assistants become how people find products, your site needs to be readable by machines too. We check structured data, semantic markup, and whether an AI agent can navigate your flows.',
                },
                {
                  icon: Eye,
                  title: 'Consultant depth at tool speed',
                  body: 'Each audit runs 95 checkpoints across 4 pillars: Foundation, Human Experience, Technical Excellence, and Future Readiness. The output isn\'t a generic checklist — it\'s a prioritised, severity-ranked report with specific recommendations and estimated impact, written like a senior consultant would deliver it.',
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-5">
                  <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <item.icon size={20} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="font-manrope font-bold text-lg text-text mb-2">{item.title}</h3>
                    <p className="text-text/70 leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Our ethical commitment ── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="font-manrope font-bold text-2xl sm:text-3xl text-text mb-6">
            Our ethical commitment
          </h2>
          <div className="space-y-5 text-text/80 text-base leading-relaxed">
            <p>
              We started ClearUX because we saw too many products that treat users as targets instead of people. Dark patterns, manipulative copy, inaccessible interfaces — these aren't just bad UX, they're harmful.
            </p>
            <p>
              Our audit framework is built on the principle that ethical design is good business. Products that respect users build trust. Trust drives retention. Retention drives growth. We give you the data to prove it.
            </p>
            <p>
              We practice what we preach. ClearUX has no subscription lock-in, no hidden fees, no manipulative upsells. You pay per audit, credits never expire, and every audit gets the full analysis. We believe that if our product is good enough, you'll come back — no tricks needed.
            </p>
          </div>
        </section>

        {/* ── Who it's for ── */}
        <section className="bg-surface-alt py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-manrope font-bold text-2xl sm:text-3xl text-text mb-6">
              Built for people who ship products
            </h2>
            <p className="text-text/80 text-base leading-relaxed mb-8">
              ClearUX is for product managers who need to justify UX investment with data. For founders who can't afford a $15k consultancy but refuse to ship a mediocre experience. For agencies who want to add audit capabilities to their offering. For UX designers who want an objective second opinion before launch.
            </p>
            <p className="text-text/80 text-base leading-relaxed">
              Paste your URL, get your report, fix what matters. That's it.
            </p>
          </div>
        </section>

        {/* ── CTA + Contact ── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="font-manrope font-bold text-2xl sm:text-3xl text-text mb-4">
            Ready to see what you're missing?
          </h2>
          <p className="text-muted text-base mb-8 max-w-lg mx-auto">
            Run your first audit today. No account needed to get started.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-accent text-white rounded-xl font-semibold hover:bg-accent-dk transition-all shadow-lg shadow-accent/20"
            >
              Start an audit
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-card border border-border text-text rounded-xl font-semibold hover:bg-surface-alt transition-all"
            >
              Contact us
            </Link>
          </div>
          <p className="text-sm text-muted mt-6">
            Questions? Reach us at{' '}
            <a href="mailto:support@clearux.ai" className="text-accent hover:underline">support@clearux.ai</a>
          </p>
        </section>
      </main>
      <Footer />
    </>
  )
}
