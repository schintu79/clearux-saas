'use client';

import { CheckCircle, Search, BarChart3, Building2, Zap, ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import AllAuditsInclude from '@/components/ui/AllAuditsInclude';

export default function PricingContent() {
  return (
    <main id="main-content" className="flex-1">
      {/* ── Hero ── */}
      <section className="py-24 sm:py-32 bg-[#111114]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40 mb-6">
            Transparent Pricing
          </p>

          <h1 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light tracking-tight text-white mb-4" style={{ lineHeight: '1.1' }}>
            Pay per audit, <span className="italic text-white/40">no subscriptions</span>
          </h1>

          <p className="font-body text-sm sm:text-base text-white/50 leading-relaxed max-w-lg mb-12">
            Every audit runs the same 64-checkpoint analysis — packs simply lower the per-audit cost. No feature gates, no hidden fees.
          </p>

          {/* Free Audit Banner */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-heading text-xl font-light text-white mb-2">Start with a Free Audit</h2>
                <p className="font-body text-sm text-white/50 max-w-md">
                  No credit card required. Sign up, enter a URL, and get your full report in minutes. Buy credits when you need more.
                </p>
              </div>
              <Link
                href="/register"
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-white text-[#111114] text-sm font-semibold tracking-wide uppercase transition-all hover:bg-white/90 whitespace-nowrap"
              >
                Start Free Audit
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Decision Framework ── */}
      <section className="py-24 sm:py-32 bg-[#141418]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-7 sm:p-9">
            <h2 className="font-heading text-lg font-light text-white mb-6">Which plan fits your workflow?</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                  <Search size={16} className="text-white/50" />
                </div>
                <div>
                  <p className="font-body text-sm font-semibold text-white">&ldquo;I need to know where my site stands&rdquo;</p>
                  <p className="font-body text-xs text-white/50 mt-0.5">Single Audit ($99) &mdash; full report, shareable link, re-audit to track improvement</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                  <BarChart3 size={16} className="text-white/50" />
                </div>
                <div>
                  <p className="font-body text-sm font-semibold text-white">&ldquo;I want to prove improvement each quarter&rdquo;</p>
                  <p className="font-body text-xs text-white/50 mt-0.5">Growth (5 credits, $79.80 each) &mdash; re-audit quarterly, compare scores over time</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                  <Building2 size={16} className="text-white/50" />
                </div>
                <div>
                  <p className="font-body text-sm font-semibold text-white">&ldquo;I manage multiple client sites&rdquo;</p>
                  <p className="font-body text-xs text-white/50 mt-0.5">Agency (15 credits, $66.60 each) &mdash; white-label reports with your branding</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                  <Zap size={16} className="text-white/50" />
                </div>
                <div>
                  <p className="font-body text-sm font-semibold text-white">&ldquo;We audit continuously across teams&rdquo;</p>
                  <p className="font-body text-xs text-white/50 mt-0.5">Scale (50 credits, $49.98 each) &mdash; lowest cost, priority support</p>
                </div>
              </div>
            </div>
            <p className="font-body text-xs text-white/50 mt-5 pt-4 border-t border-white/[0.06]">
              <strong className="text-white">Every audit is identical</strong> &mdash; same 64 checkpoints, same depth. Packs lower the per-audit cost and let you re-audit to measure progress. No features are locked behind tiers.
            </p>
          </div>
        </div>
      </section>

      {/* ── Hero card: Single Audit ── */}
      <section className="py-24 sm:py-32 bg-[#111114]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-8 sm:p-10">
            <div className="grid sm:grid-cols-2 gap-8 items-center">
              {/* Left: Price */}
              <div>
                <h2 className="font-heading text-2xl font-light text-white mb-1">Single Audit</h2>
                <p className="font-body text-white/50 text-sm mb-6">For founders and teams who need a one-time baseline</p>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-white/50 text-lg">$</span>
                  <span className="font-heading text-6xl sm:text-7xl font-light text-white tracking-tight">99</span>
                </div>
                <p className="font-body text-white/50 text-sm mb-8">One-time payment per audit</p>

                <Link
                  href="/register"
                  className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-white text-[#111114] text-sm font-semibold tracking-wide uppercase transition-all hover:bg-white/90 whitespace-nowrap"
                >
                  Buy 1 audit
                </Link>
                <p className="font-body text-xs text-white/50 mt-3">No account needed to preview</p>
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
                    <CheckCircle className="w-4 h-4 text-white/40 flex-shrink-0 mt-0.5" />
                    <span className="font-body text-sm text-white">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <section className="bg-[#111114]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 flex items-center gap-4">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40 whitespace-nowrap">Need more audits? Save with packs</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>
      </section>

      {/* ── Credit Packs ── */}
      <section className="py-24 sm:py-32 bg-[#111114]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { name: 'Growth', credits: 5, price: 399, per: '$79.80', save: 19, desc: 'Quarterly audits to catch issues each release cycle', cta: 'Buy 5 audits', popular: true },
              { name: 'Agency', credits: 15, price: 999, per: '$66.60', save: 33, desc: 'Manage multiple client sites with white-label reports', cta: 'Buy 15 audits', popular: false },
              { name: 'Scale', credits: 50, price: 2499, per: '$49.98', save: 50, desc: 'Continuous auditing across teams and products', cta: 'Buy 50 audits', popular: false },
            ].map((pack) => (
              <div
                key={pack.name}
                className={`rounded-xl border bg-white/[0.03] p-7 transition-all duration-300 ${
                  pack.popular
                    ? 'border-white/[0.15]'
                    : 'border-white/[0.06] hover:border-white/[0.1]'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading text-lg font-light text-white">{pack.name}</h3>
                  {pack.popular ? (
                    <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40">Most Popular</span>
                  ) : (
                    <span className="font-body text-xs text-white/40">
                      {pack.per}/audit
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1 mb-0.5">
                  <span className="text-white/50 text-sm">$</span>
                  <span className="font-heading text-4xl font-light text-white">{pack.price.toLocaleString()}</span>
                </div>
                <p className="font-body text-white/50 text-sm mb-5">
                  {pack.per} per audit <span className="text-white/30">/</span> {pack.credits} audits
                </p>

                <p className="font-body text-xs text-white/50 mb-5">{pack.desc}</p>

                <Link
                  href="/register"
                  className="group inline-flex items-center gap-2.5 px-7 py-3.5 border border-white/20 text-white text-sm font-semibold tracking-wide uppercase transition-all hover:border-white/40 whitespace-nowrap"
                >
                  {pack.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── All Audits Include Strip ── */}
      <section className="py-24 sm:py-32 bg-[#141418]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <AllAuditsInclude />
        </div>
      </section>

      {/* ── Money-Back Guarantee ── */}
      <section className="py-24 sm:py-32 bg-[#111114]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-8 sm:p-10">
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={24} className="text-white/40" />
              </div>
              <div>
                <h2 className="font-heading text-2xl sm:text-3xl font-light text-white tracking-tight mb-3">
                  30-day money-back guarantee
                </h2>
                <p className="font-body text-sm sm:text-base text-white/50 leading-relaxed max-w-lg">
                  Not satisfied with your audit? We will refund your credits within 30 days, no questions asked. We stand behind the quality of every report.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing Comparison Table ── */}
      <section className="py-24 sm:py-32 bg-[#141418]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40 mb-4">At a glance</p>
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light tracking-tight text-white mb-10">
            Compare plans
          </h2>

          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#0C0C0F]">
                    <th className="text-left px-6 py-4 text-[11px] font-semibold text-white/40 uppercase tracking-[0.2em]">Plan</th>
                    <th className="text-left px-6 py-4 text-[11px] font-semibold text-white/40 uppercase tracking-[0.2em]">Price</th>
                    <th className="text-left px-6 py-4 text-[11px] font-semibold text-white/40 uppercase tracking-[0.2em]">Per Audit</th>
                    <th className="text-left px-6 py-4 text-[11px] font-semibold text-white/40 uppercase tracking-[0.2em]">Best For</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white/[0.02] border-b border-white/[0.04]">
                    <td className="px-6 py-5 font-semibold text-white font-body">Free Audit</td>
                    <td className="px-6 py-5 font-semibold text-white text-lg font-body">$0</td>
                    <td className="px-6 py-5 text-white/50 font-body">Free (1 audit)</td>
                    <td className="px-6 py-5 text-white/50 font-body">First-time users evaluating the platform</td>
                  </tr>
                  <tr className="bg-white/[0.03] border-b border-white/[0.04]">
                    <td className="px-6 py-5 font-semibold text-white font-body">Single Audit</td>
                    <td className="px-6 py-5 font-semibold text-white text-lg font-body">$99</td>
                    <td className="px-6 py-5 text-white/50 font-body">$99.00</td>
                    <td className="px-6 py-5 text-white/50 font-body">One-off baseline or pre-launch check</td>
                  </tr>
                  <tr className="bg-white/[0.02] border-b border-white/[0.04]">
                    <td className="px-6 py-5 font-semibold text-white font-body">
                      <span className="flex items-center gap-3">
                        Growth
                        <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40">Popular</span>
                      </span>
                    </td>
                    <td className="px-6 py-5 font-semibold text-white text-lg font-body">$399</td>
                    <td className="px-6 py-5 font-body">
                      <span className="text-white font-medium">$79.80</span>
                      <span className="ml-2 text-[11px] font-semibold text-white/40">save 19%</span>
                    </td>
                    <td className="px-6 py-5 text-white/50 font-body">Quarterly audits per release cycle</td>
                  </tr>
                  <tr className="bg-white/[0.03] border-b border-white/[0.04]">
                    <td className="px-6 py-5 font-semibold text-white font-body">Agency</td>
                    <td className="px-6 py-5 font-semibold text-white text-lg font-body">$999</td>
                    <td className="px-6 py-5 font-body">
                      <span className="text-white font-medium">$66.60</span>
                      <span className="ml-2 text-[11px] font-semibold text-white/40">save 33%</span>
                    </td>
                    <td className="px-6 py-5 text-white/50 font-body">Multiple client sites + white-label</td>
                  </tr>
                  <tr className="bg-white/[0.02]">
                    <td className="px-6 py-5 font-semibold text-white font-body">Scale</td>
                    <td className="px-6 py-5 font-semibold text-white text-lg font-body">$2,499</td>
                    <td className="px-6 py-5 font-body">
                      <span className="text-white font-medium">$49.98</span>
                      <span className="ml-2 text-[11px] font-semibold text-white/40">save 50%</span>
                    </td>
                    <td className="px-6 py-5 text-white/50 font-body">Continuous auditing across teams</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          {/* Value anchor */}
          <p className="font-body text-sm text-white/50 mt-6">
            At $99 per audit, that&apos;s <span className="font-semibold text-white">$1.55 per checkpoint</span> across 64 checks — compared to $100+ per checkpoint with traditional UX consultants.
          </p>
        </div>
      </section>

      {/* ── Final CTA Band ── */}
      <section className="py-24 sm:py-32 bg-[#141418]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40 mb-4">Get Started</p>
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light tracking-tight text-white mb-4">
            Start your audit <span className="italic text-white/40">today</span>
          </h2>
          <p className="font-body text-sm sm:text-base text-white/50 leading-relaxed max-w-md mb-8">
            Your first audit is free. No credit card, no commitment — just actionable UX insights in minutes.
          </p>
          <Link
            href="/register"
            className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-white text-[#111114] text-sm font-semibold tracking-wide uppercase transition-all hover:bg-white/90 whitespace-nowrap"
          >
            Start Free Audit
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
