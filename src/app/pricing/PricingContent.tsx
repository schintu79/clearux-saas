'use client';

import { CheckCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

const FEATURES = [
  'All 16 categories, all 4 pillars',
  'PDF & Word reports included',
  'AI-powered severity scoring',
  'Issue screenshots with highlights',
  'Track fixes and re-audit anytime',
  'Credits never expire',
];

const PACKS = [
  { name: 'Growth', credits: 5, price: 399, per: '$79.80', save: 19, desc: 'Quarterly audits to track improvement', popular: true },
  { name: 'Agency', credits: 15, price: 999, per: '$66.60', save: 33, desc: 'White-label reports for client sites', popular: false },
  { name: 'Scale', credits: 50, price: 2499, per: '$49.98', save: 50, desc: 'Continuous auditing across teams', popular: false },
];

export default function PricingContent() {
  return (
    <main id="main-content" className="flex-1">

      {/* ── HERO: Big $99 ── */}
      <section className="relative py-28 sm:py-36 lg:py-44 overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <img src="/gradients/bg-pricing.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#111114] via-transparent to-[#111114]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
            Transparent Pricing
          </p>

          <div className="mb-6">
            <h1 className="font-heading text-white max-w-4xl" style={{ lineHeight: '1.05', marginBottom: 0 }}>
              <span className="text-lime-gradient font-medium text-[4rem] sm:text-[5rem] md:text-[6rem] lg:text-[8rem]">$99</span>
              <span className="text-[2rem] sm:text-[2.5rem] md:text-[3rem] lg:text-[3.5rem] font-light text-white/60 ml-3 sm:ml-5">per audit</span>
            </h1>
          </div>

          <p className="font-heading text-[1.5rem] sm:text-[2rem] md:text-[2.5rem] font-light text-lime-gradient mb-6">
            First one free.
          </p>

          <p className="text-white/65 text-base md:text-lg max-w-2xl leading-relaxed mb-12">
            No subscription. No feature gates. Every audit runs the full 64-checkpoint
            analysis across all 16 categories and 4 pillars. Credits never expire.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <Link
              href="/register"
              className="group inline-flex items-center justify-center gap-2.5 px-7 py-[1.2rem] rounded-full bg-lime-gradient text-[#111114] text-base font-medium transition-all hover:opacity-90 whitespace-nowrap min-h-[48px]"
            >
              Start Free Audit
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#packs"
              className="group inline-flex items-center justify-center gap-2.5 px-7 py-[1.2rem] rounded-full border border-white/20 text-white text-base font-medium transition-all hover:border-white/40 whitespace-nowrap min-h-[48px]"
            >
              View Packs
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </section>

      {/* ── WHAT'S INCLUDED — glass strip ── */}
      <section className="relative py-14 sm:py-32 overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <img src="/gradients/bg-features.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#111114] via-transparent to-[#111114]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
            Every audit includes
          </p>
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] font-light text-white mb-10" style={{ lineHeight: '1.1' }}>
            64 checkpoints. <span className="text-lime-gradient">Zero compromises.</span>
          </h2>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-6 sm:p-8 lg:p-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {FEATURES.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#84CC16] flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-white/70 font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Value anchor */}
          <p className="text-sm text-white/60 mt-6">
            At $99 per audit, that&apos;s <span className="font-medium text-white/70">$1.55 per checkpoint</span> — compared to $100+ per checkpoint with traditional UX consultants.
          </p>

          {/* Delivery & fulfillment clarity */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { title: 'Delivered in minutes', desc: 'Report arrives via email and your dashboard within 10 minutes of purchase. Download as PDF or Word.' },
              { title: 'Credits never expire', desc: 'Use credits whenever you\'re ready. Share across your team. Re-audit the same site as often as you like.' },
              { title: 'Satisfaction guaranteed', desc: 'Not happy? Contact support@clearux.ai and we\'ll resolve it or provide a credit for a new audit.' },
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <p className="text-sm font-medium text-white mb-1.5">{item.title}</p>
                <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CREDIT PACKS ── */}
      <section id="packs" className="relative py-14 sm:py-32 overflow-hidden scroll-mt-8">
        <div className="absolute inset-0 bg-[#111114]" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">
            Need more audits?
          </p>
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] font-light text-white mb-3" style={{ lineHeight: '1.1' }}>
            Save up to <span className="text-lime-gradient">50%</span> with packs
          </h2>
          <p className="text-white/65 text-base max-w-xl mb-14 leading-relaxed">
            Same 64-checkpoint audit. Packs simply lower the per-audit cost. No features are locked behind tiers.
          </p>

          <div className="grid sm:grid-cols-3 gap-5">
            {PACKS.map((pack) => (
              <div
                key={pack.name}
                className={`group relative rounded-2xl border p-7 sm:p-8 transition-all duration-300 overflow-hidden ${
                  pack.popular
                    ? 'border-[#84CC16]/30 bg-white/[0.04]'
                    : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]'
                }`}
              >
                {/* Popular glow */}
                {pack.popular && (
                  <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-[#84CC16]/[0.06] blur-3xl pointer-events-none" />
                )}

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-heading text-xl font-light text-white" style={{ marginBottom: 0 }}>{pack.name}</h3>
                    {pack.popular && (
                      <span className="text-[10px] font-medium tracking-[0.15em] uppercase px-2.5 py-1 rounded-full bg-[#84CC16]/10 text-[#84CC16] border border-[#84CC16]/20">
                        Most Popular
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-lime-gradient text-lg font-medium">$</span>
                    <span className="font-heading text-5xl sm:text-6xl font-medium text-lime-gradient">{pack.price.toLocaleString()}</span>
                  </div>
                  <p className="text-white/65 text-sm mb-1">
                    {pack.per} per audit <span className="text-white/20">|</span> {pack.credits} audits
                  </p>
                  <p className="text-sm text-[#84CC16] font-medium mb-6">Save {pack.save}%</p>

                  <p className="text-sm text-white/60 mb-8 leading-relaxed">{pack.desc}</p>

                  <Link
                    href="/register"
                    className={`group/btn inline-flex items-center justify-center gap-2.5 px-7 py-[1.2rem] rounded-full text-base font-medium transition-all whitespace-nowrap w-full min-h-[48px] ${
                      pack.popular
                        ? 'bg-lime-gradient text-[#111114] hover:opacity-90'
                        : 'bg-white text-[#111114] hover:bg-white/90'
                    }`}
                  >
                    Buy {pack.credits} audits
                    <ArrowRight size={15} className="group-hover/btn:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARE TABLE ── */}
      <section className="relative py-14 sm:py-32 overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <img src="/gradients/bg-howitworks.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#111114] via-transparent to-[#111114]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/40 mb-4">At a glance</p>
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] font-light text-white mb-10" style={{ lineHeight: '1.1' }}>
            Compare plans
          </h2>

          <div className="rounded-2xl border border-white/[0.08] overflow-hidden backdrop-blur-sm">
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm border-collapse min-w-[540px]">
                <thead>
                  <tr className="bg-white/[0.04]">
                    <th className="text-left px-4 sm:px-6 py-4 text-[11px] font-medium text-white/40 uppercase tracking-[0.2em]">Plan</th>
                    <th className="text-left px-4 sm:px-6 py-4 text-[11px] font-medium text-white/40 uppercase tracking-[0.2em]">Price</th>
                    <th className="text-left px-4 sm:px-6 py-4 text-[11px] font-medium text-white/40 uppercase tracking-[0.2em]">Per Audit</th>
                    <th className="text-left px-4 sm:px-6 py-4 text-[11px] font-medium text-white/40 uppercase tracking-[0.2em]">Best For</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { plan: 'Free Audit', price: '$0', per: 'Free (1 audit)', best: 'First-time users evaluating the platform', badge: null, save: null },
                    { plan: 'Single Audit', price: '$99', per: '$99.00', best: 'One-off baseline or pre-launch check', badge: null, save: null },
                    { plan: 'Growth', price: '$399', per: '$79.80', best: 'Quarterly audits per release cycle', badge: 'Popular', save: '19%' },
                    { plan: 'Agency', price: '$999', per: '$66.60', best: 'Multiple client sites + white-label', badge: null, save: '33%' },
                    { plan: 'Scale', price: '$2,499', per: '$49.98', best: 'Continuous auditing across teams', badge: null, save: '50%' },
                  ].map((row, i) => (
                    <tr key={i} className={`border-t border-white/[0.06] ${i % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.04]'}`}>
                      <td className="px-4 sm:px-6 py-4 sm:py-5 font-medium text-white">
                        <span className="flex items-center gap-3">
                          {row.plan}
                          {row.badge && (
                            <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#84CC16]/80">{row.badge}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 sm:py-5 font-heading font-medium text-lime-gradient text-lg">{row.price}</td>
                      <td className="px-4 sm:px-6 py-4 sm:py-5">
                        <span className="text-white font-medium">{row.per}</span>
                        {row.save && (
                          <span className="ml-2 text-[11px] font-medium text-[#84CC16]">save {row.save}</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 sm:py-5 text-white/65">{row.best}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── GUARANTEE ── */}
      <section className="py-14 sm:py-32 bg-[#111114]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 sm:p-12 flex flex-col sm:flex-row items-start gap-6">
            <div className="w-14 h-14 rounded-xl bg-[#84CC16]/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={28} className="text-[#84CC16]" />
            </div>
            <div>
              <h2 className="font-heading text-2xl sm:text-3xl font-light text-white mb-3">
                30-day money-back guarantee
              </h2>
              <p className="text-sm sm:text-base text-white/65 leading-relaxed max-w-lg">
                Not satisfied with your audit? We will refund your credits within 30 days, no questions asked. We stand behind the quality of every report.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative py-28 sm:py-36 overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <img src="/gradients/bg-cta.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#111114] via-transparent to-[#111114]" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 text-center">
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-light text-white mb-4" style={{ lineHeight: '1.1' }}>
            Start your audit <span className="text-lime-gradient">today</span>
          </h2>
          <p className="text-white/65 text-base md:text-lg max-w-md mx-auto leading-relaxed mb-10">
            Your first audit is free. No credit card, no commitment — just actionable UX insights in minutes.
          </p>
          <Link
            href="/register"
            className="group inline-flex items-center gap-2.5 px-7 py-[1.2rem] rounded-full bg-white text-[#111114] text-base font-medium transition-all hover:bg-white/90 whitespace-nowrap min-h-[48px]"
          >
            Start Free Audit
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>
    </main>
  );
}
