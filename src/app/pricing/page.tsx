import { CheckCircle, Search, BarChart3, Building2, Zap, ArrowRight, Sparkles } from 'lucide-react';
import { Sparkle, Spiral } from '@/components/ui/Doodles';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'Pricing',
  description: 'AI-powered UX audits starting at $99. First audit free. Simple credit-based pricing — no subscriptions.',
};

export default function PricingPage() {
  const faqs = [
    // Getting Started & Billing
    {
      question: 'Is my first audit really free?',
      answer:
        'Yes. No credit card, no hidden charges. Create an account and run your first UX audit completely free. You only pay for additional audits after that.',
    },
    {
      question: 'What happens after my free audit?',
      answer:
        'You\u2019ll see a full report with findings ranked by severity and business impact, an executive summary, top 3 priority recommendations, and downloadable PDF & Word reports. From there, you can purchase credits to run more audits or buy a pack if you audit regularly.',
    },
    {
      question: 'How does the free-to-paid transition work?',
      answer:
        'After your free audit, you buy credits. One credit = one audit. Credits never expire. Buy a single audit for $99, or save up to 50% with credit packs. No subscription, no recurring charges \u2014 pay only when you audit.',
    },
    {
      question: 'Can I cancel anytime?',
      answer:
        'There\u2019s nothing to cancel. ClearUX uses a credit system, not subscriptions. Buy credits when you need them, use them whenever. No lock-in, no recurring fees, no cancellation process.',
    },
    // Standard pricing FAQs
    {
      question: 'How do credits work?',
      answer:
        'One credit = one full audit. Credits never expire. Every audit includes all 64 checkpoints, PDF & Word reports, finding tracking, shareable links, and prioritised recommendations.',
    },
    {
      question: 'What does every audit include?',
      answer:
        'Every audit includes the full 64-point analysis across 16 UX categories, AI discoverability review, severity-ranked findings with status tracking, shareable read-only links, re-audit comparison, and downloadable PDF + Word reports.',
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
        {/* ── Free Audit Banner ── */}
        <section className="pt-20 pb-4 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-xl p-6 sm:p-8 relative overflow-hidden" style={{ background: 'var(--gradient-brand-subtle)' }}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={18} className="text-brand" />
                    <h2 className="font-heading font-semibold text-xl text-text">Start with a Free Audit</h2>
                  </div>
                  <p className="text-sm text-text/70 max-w-md">
                    No credit card required. Run your first UX audit free, then choose a plan that scales with your team.
                  </p>
                </div>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 bg-brand text-surface dark:text-[#111111] text-sm font-semibold px-6 py-3 rounded-lg transition-all hover:brightness-110 hover:-translate-y-0.5 flex-shrink-0"
                >
                  Start Free Audit
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Header ── */}
        <section className="pt-8 pb-6 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="font-heading font-semibold text-4xl sm:text-5xl text-text mb-3" style={{ lineHeight: '1.1' }}>
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
            <div className="rounded-xl border border-border/40 dark:border-white/[0.06] bg-surface-alt p-6 sm:p-8">
              <h2 className="font-heading font-semibold text-lg text-text mb-4">Which plan fits your workflow?</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#6366F1]/10 flex items-center justify-center flex-shrink-0">
                    <Search size={16} className="text-[#6366F1]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">Establish a baseline, then track improvement</p>
                    <p className="text-xs text-muted mt-0.5">Single Audit — one site, full report, shareable results, $99</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                    <BarChart3 size={16} className="text-pink-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">Re-audit quarterly and prove progress to stakeholders</p>
                    <p className="text-xs text-muted mt-0.5">Growth — 5 audits/year, score comparison over time, $79.80 each</p>
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
                  <div className="w-8 h-8 rounded-lg bg-[#22C55E]/10 flex items-center justify-center flex-shrink-0">
                    <Zap size={16} className="text-[#22C55E]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">Continuous auditing across teams</p>
                    <p className="text-xs text-muted mt-0.5">Scale — 50+ audits/year, dedicated support</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted mt-5 pt-4 border-t border-border/20 dark:border-white/[0.04]">
                <strong className="text-text">Every audit includes</strong> finding status tracking, shareable read-only links for your team, and re-audit comparison so you can prove improvement.
                White-label reports let agencies add their own branding. Packs simply lower the per-audit cost.
              </p>
            </div>
          </div>
        </section>

        {/* ── Hero card: Single Audit ── */}
        <section className="px-4 sm:px-6 lg:px-8 pb-4">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-xl border border-border/40 dark:border-white/[0.06] bg-card p-8 sm:p-10 relative overflow-hidden">
              {/* Subtle warm gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-50/40 via-orange-50/20 to-rose-50/30 dark:from-accent/[0.03] dark:via-transparent dark:to-transparent pointer-events-none" />

              <div className="relative grid sm:grid-cols-2 gap-8 items-center">
                {/* Left: Price */}
                <div>
                  <h2 className="font-heading text-2xl font-semibold text-text mb-1">Single Audit</h2>
                  <p className="text-muted text-sm mb-6">For individuals and small teams</p>

                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-muted text-lg">$</span>
                    <span className="font-heading text-6xl sm:text-7xl font-extrabold text-text tracking-tight">99</span>
                  </div>
                  <p className="text-muted text-sm mb-8">One-time payment per audit</p>

                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center gap-2 bg-text dark:bg-white text-white dark:text-gray-900 font-semibold text-sm rounded-lg px-8 py-3.5 hover:opacity-90 transition-opacity"
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
                      <CheckCircle className="w-4 h-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
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
                  className={`group rounded-xl border bg-card p-6 hover:shadow-md hover:shadow-black/[0.03] hover:-translate-y-0.5 transition-all duration-300 ${pack.popular ? 'border-brand dark:border-brand/40 shadow-md shadow-brand/10 ring-1 ring-brand/30' : 'border-border/40 dark:border-white/[0.06] hover:border-border/70 dark:hover:border-white/[0.1]'}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading font-semibold text-lg text-text">{pack.name}</h3>
                    {pack.popular ? (
                      <span className="text-[11px] font-bold bg-brand text-surface dark:text-[#111111] px-3 py-1 rounded-full shadow-sm">Most Popular</span>
                    ) : (
                      <span className="text-xs font-bold text-text/60 px-2.5 py-1 rounded-full bg-surface-alt">
                        {pack.per}/audit
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1 mb-0.5">
                    <span className="text-muted text-sm">$</span>
                    <span className="font-heading text-4xl font-extrabold text-text">{pack.price.toLocaleString()}</span>
                  </div>
                  <p className="text-muted text-sm mb-5">
                    {pack.per} per audit <span className="text-muted/50">·</span> {pack.credits} audits
                  </p>

                  <p className="text-xs text-muted mb-5">{pack.desc}</p>

                  <Link
                    href="/register"
                    className="flex items-center justify-center gap-2 text-sm font-semibold rounded-lg py-3 bg-brand text-surface dark:text-[#111111] transition-all duration-200 hover:-translate-y-0.5"
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
                <p className="font-heading text-lg font-semibold text-text mb-1 leading-snug">All audits<br />include</p>
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

        {/* ── Pricing Comparison Table ── */}
        <section className="px-4 sm:px-6 lg:px-8 pb-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-heading font-semibold text-2xl text-text mb-6">Compare plans</h2>
            <div className="rounded-xl border border-border/40 dark:border-white/[0.06] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-off/50 dark:bg-white/[0.03]">
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted uppercase tracking-wide">Plan</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted uppercase tracking-wide">Price</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted uppercase tracking-wide">Per Audit</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted uppercase tracking-wide">Best For</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 dark:divide-white/[0.04]">
                    <tr className="bg-[#22C55E]/5">
                      <td className="px-5 py-3.5 font-semibold text-text">Free Audit</td>
                      <td className="px-5 py-3.5 font-bold text-[#22C55E]">$0</td>
                      <td className="px-5 py-3.5 text-muted">Free (1 audit)</td>
                      <td className="px-5 py-3.5 text-muted">First-time users evaluating the platform</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3.5 font-semibold text-text">Single Audit</td>
                      <td className="px-5 py-3.5 font-bold text-text">$99</td>
                      <td className="px-5 py-3.5 text-muted">$99.00</td>
                      <td className="px-5 py-3.5 text-muted">One-off baseline or pre-launch check</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3.5 font-semibold text-text">Growth <span className="text-[9px] font-bold bg-brand text-surface dark:text-[#111111] px-1.5 py-0.5 rounded-full ml-1">Popular</span></td>
                      <td className="px-5 py-3.5 font-bold text-text">$399</td>
                      <td className="px-5 py-3.5 text-muted">$79.80 <span className="text-[#22C55E] text-xs font-semibold">save 19%</span></td>
                      <td className="px-5 py-3.5 text-muted">Quarterly audits per release cycle</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3.5 font-semibold text-text">Agency</td>
                      <td className="px-5 py-3.5 font-bold text-text">$999</td>
                      <td className="px-5 py-3.5 text-muted">$66.60 <span className="text-[#22C55E] text-xs font-semibold">save 33%</span></td>
                      <td className="px-5 py-3.5 text-muted">Multiple client sites + white-label</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3.5 font-semibold text-text">Scale</td>
                      <td className="px-5 py-3.5 font-bold text-text">$2,499</td>
                      <td className="px-5 py-3.5 text-muted">$49.98 <span className="text-[#22C55E] text-xs font-semibold">save 50%</span></td>
                      <td className="px-5 py-3.5 text-muted">Continuous auditing across teams</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            {/* Value anchor */}
            <p className="text-xs text-muted mt-4 text-center">
              At $99 per audit, that&apos;s <span className="font-semibold text-text">$1.55 per checkpoint</span> across 64 checks — compared to $100+ per checkpoint with traditional UX consultants.
            </p>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-surface-alt bg-dotgrid relative">
          <Sparkle className="hidden lg:block absolute top-10 right-[8%]" color="var(--color-tech)" />
          <Spiral className="hidden lg:block absolute bottom-12 left-[5%]" color="var(--color-foundation)" />
          <div className="max-w-3xl mx-auto">
            <h2 className="font-heading font-semibold text-3xl text-text mb-10">
              Frequently asked questions
            </h2>

            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <details
                  key={i}
                  className="group bg-card border border-border/40 dark:border-white/[0.06] rounded-xl overflow-hidden"
                >
                  <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-card-hover transition-colors">
                    <h3 className="font-medium text-text text-sm pr-4">{faq.question}</h3>
                    <ArrowRight size={14} className="text-muted flex-shrink-0 transform group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="mx-5 pb-5 pt-1 border-t border-border/20 dark:border-white/[0.04]">
                    <p className="text-muted text-sm leading-relaxed pt-4">{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>

            {/* Cross-link */}
            <div className="text-center mt-10">
              <Link
                href="/about"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:opacity-80 transition-opacity"
              >
                Learn how ClearUX works
                <ArrowRight size={14} className="text-brand" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
