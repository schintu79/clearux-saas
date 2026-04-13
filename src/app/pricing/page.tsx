import { CheckCircle, Search, BarChart3, Building2, Zap } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'Pricing',
  description: 'AI-powered UX audits starting at $99. Simple credit-based pricing — no subscriptions.',
};

export default function PricingPage() {
  const faqs = [
    {
      question: 'How do credits work?',
      answer:
        'One credit = one full audit. Credits never expire. Every audit includes all 64 checkpoints, PDF & Word reports, and prioritised recommendations.',
    },
    {
      question: 'How fast is the audit delivered?',
      answer:
        'Most audits complete in under 10 minutes. Our AI-powered engine crawls your site and generates a comprehensive report automatically.',
    },
    {
      question: 'What does every audit include?',
      answer:
        'Every audit — regardless of which pack you buy — includes the full 64-point analysis across 16 UX categories, AI discoverability review, severity-ranked findings, and downloadable PDF + Word reports.',
    },
    {
      question: 'Can I buy more credits later?',
      answer:
        'Yes. You can purchase additional credit packs at any time. Credits from different purchases stack together and never expire.',
    },
    {
      question: 'Is there a refund policy?',
      answer:
        'If you\'re not satisfied with your audit, contact support@clearux.ai and we\'ll resolve it or provide a credit for a new audit.',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <Navbar />

      <main id="main-content" className="flex-1">
        {/* ── Header ── */}
        <section className="pt-20 pb-6 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="font-manrope font-bold text-4xl sm:text-5xl text-text mb-3" style={{ lineHeight: '1.1' }}>
              Transparent pricing
            </h1>
            <p className="text-muted text-base md:text-lg max-w-lg">
              Pay per audit. No subscription, no feature gates.
              Every audit gets the full 64-checkpoint analysis — nothing locked behind tiers.
            </p>
          </div>
        </section>

        {/* ── Decision Framework ── */}
        <section className="px-4 sm:px-6 lg:px-8 pb-8">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-border/40 dark:border-white/[0.06] bg-surface-alt p-6 sm:p-8">
              <h2 className="font-manrope font-bold text-lg text-text mb-4">Which plan fits your workflow?</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    <Search size={16} className="text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">Audit once to establish a baseline</p>
                    <p className="text-xs text-muted mt-0.5">Single Audit — one site, one report, $99</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                    <BarChart3 size={16} className="text-pink-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">Run quarterly audits each release cycle</p>
                    <p className="text-xs text-muted mt-0.5">Growth — 5 audits/year, $79.80 each</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Building2 size={16} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">Manage multiple client sites</p>
                    <p className="text-xs text-muted mt-0.5">Agency — 15+ audits/year, white-label reports included</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Zap size={16} className="text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">Continuous auditing across teams</p>
                    <p className="text-xs text-muted mt-0.5">Scale — 50+ audits/year, dedicated support</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted mt-5 pt-4 border-t border-border/20 dark:border-white/[0.04]">
                <strong className="text-text">White-label reports</strong> let you add your own logo and company name — agencies often send these directly to clients.
                All plans include the same full 64-checkpoint analysis. Packs simply lower the per-audit cost.
              </p>
            </div>
          </div>
        </section>

        {/* ── Hero card: Single Audit ── */}
        <section className="px-4 sm:px-6 lg:px-8 pb-4">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-border/40 dark:border-white/[0.06] bg-card p-8 sm:p-10 relative overflow-hidden">
              {/* Subtle warm gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-50/40 via-orange-50/20 to-rose-50/30 dark:from-accent/[0.03] dark:via-transparent dark:to-transparent pointer-events-none" />

              <div className="relative grid sm:grid-cols-2 gap-8 items-center">
                {/* Left: Price */}
                <div>
                  <h2 className="font-manrope text-2xl font-bold text-text mb-1">Single Audit</h2>
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
                  <p className="text-xs text-muted mt-3">No account needed to preview</p>
                </div>

                {/* Right: What's included */}
                <div className="space-y-3.5">
                  {[
                    '64-point deep analysis across 16 categories',
                    'AI-powered findings with severity scoring',
                    'Executive summary & prioritised recommendations',
                    'PDF & Word report downloads',
                    'Issue screenshots with element highlighting',
                    '6 languages supported',
                    'Results in under 10 minutes',
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-text">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Divider ── */}
        <section className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <div className="flex-1 h-px bg-border/30 dark:bg-white/[0.04]" />
            <span className="text-xs text-muted font-medium tracking-wide uppercase">Need more audits? Save with packs</span>
            <div className="flex-1 h-px bg-border/30 dark:bg-white/[0.04]" />
          </div>
        </section>

        {/* ── Credit packs ── */}
        <section className="px-4 sm:px-6 lg:px-8 pb-12">
          <div className="max-w-4xl mx-auto">
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { name: 'Growth', credits: 5, price: 399, per: '$79.80', save: 19, desc: 'Quarterly audits to catch issues each release cycle', cta: 'Buy 5 audits', popular: true },
                { name: 'Agency', credits: 15, price: 999, per: '$66.60', save: 33, desc: 'Manage multiple client sites with white-label reports', cta: 'Buy 15 audits', popular: false },
                { name: 'Scale', credits: 50, price: 2499, per: '$49.98', save: 50, desc: 'Continuous auditing across teams and products', cta: 'Buy 50 audits', popular: false },
              ].map((pack) => (
                <div
                  key={pack.name}
                  className={`group rounded-2xl border bg-card p-6 hover:shadow-lg hover:shadow-black/[0.03] hover:-translate-y-0.5 transition-all duration-300 ${pack.popular ? 'border-violet-400 dark:border-violet-500/40 shadow-lg shadow-violet-500/10 ring-1 ring-violet-400/30' : 'border-border/40 dark:border-white/[0.06] hover:border-border/70 dark:hover:border-white/[0.1]'}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-manrope font-bold text-lg text-text">{pack.name}</h3>
                    {pack.popular ? (
                      <span className="text-[11px] font-bold text-white px-3 py-1 rounded-full shadow-sm" style={{ background: 'var(--gradient-brand)' }}>Most Popular</span>
                    ) : (
                      <span className="text-xs font-bold text-text/60 px-2.5 py-1 rounded-full bg-surface-alt">
                        {pack.per}/audit
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1 mb-0.5">
                    <span className="text-muted text-sm">$</span>
                    <span className="font-manrope text-4xl font-extrabold text-text">{pack.price.toLocaleString()}</span>
                  </div>
                  <p className="text-muted text-sm mb-5">
                    {pack.per} per audit <span className="text-muted/50">·</span> {pack.credits} audits
                  </p>

                  <p className="text-xs text-muted mb-5">{pack.desc}</p>

                  <Link
                    href="/register"
                    className="flex items-center justify-center gap-2 text-sm font-semibold rounded-full py-3 text-white transition-all duration-200 hover:-translate-y-0.5"
                    style={{ background: 'var(--gradient-brand)', boxShadow: '0 4px 16px rgba(124,58,237,.15), 0 2px 8px rgba(236,72,153,.08)' }}
                  >
                    {pack.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── All audits include strip ── */}
        <section className="px-4 sm:px-6 lg:px-8 pb-16">
          <div className="max-w-4xl mx-auto pt-10 border-t border-border/30 dark:border-white/[0.04]">
            <div className="grid sm:grid-cols-4 gap-6 sm:gap-8">
              <div>
                <p className="font-manrope text-lg font-bold text-text mb-1 leading-snug">All audits<br />include</p>
              </div>
              {[
                { title: 'Full 64-point analysis', desc: 'Every category, every checkpoint. No feature tiers or locked sections.' },
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
        </section>

        {/* ── FAQ ── */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-surface-alt">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-manrope font-bold text-3xl text-text mb-10">
              Frequently asked questions
            </h2>

            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <details
                  key={i}
                  className="group bg-card border border-border/40 dark:border-white/[0.06] rounded-2xl overflow-hidden"
                >
                  <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-card-hover transition-colors">
                    <h3 className="font-medium text-text text-sm pr-4">{faq.question}</h3>
                    <span className="text-muted text-xs flex-shrink-0 group-open:rotate-90 transition-transform">&#9654;</span>
                  </summary>
                  <div className="mx-5 pb-5 pt-1 border-t border-border/20 dark:border-white/[0.04]">
                    <p className="text-muted text-sm leading-relaxed pt-4">{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
