'use client';

import { CheckCircle, Search, BarChart3, Building2, Zap, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import AllAuditsInclude from '@/components/ui/AllAuditsInclude';

export default function PricingContent() {
  return (
    <div className="flex flex-col min-h-screen bg-[#080818]">
      <main id="main-content" className="flex-1">
        {/* ── Dark Hero ── */}
        <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden" style={{ background: '#080818' }}>
          {/* Aurora glows */}
          <div className="absolute top-[-10%] left-[15%] w-[600px] h-[500px] rounded-full bg-indigo-500/[0.05] blur-[160px] pointer-events-none" />
          <div className="absolute bottom-[-20%] right-[10%] w-[500px] h-[400px] rounded-full bg-indigo-500/[0.03] blur-[120px] pointer-events-none" />

          <div className="max-w-5xl mx-auto relative z-10">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6"
            >
              <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/70 text-sm font-medium">
                <Sparkles size={14} className="text-indigo-400" />
                No subscriptions, no feature gates
              </span>
            </motion.div>

            {/* Title */}
            <motion.h1
              className="font-heading font-semibold text-4xl sm:text-5xl md:text-6xl text-white mb-4"
              style={{ lineHeight: '1.1' }}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Transparent pricing
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className="text-white/50 text-base md:text-lg max-w-lg mb-10"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Pay per audit. Every audit runs the same 64-checkpoint analysis — packs simply lower the per-audit cost.
            </motion.p>

            {/* Free Audit Banner inside hero */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="rounded-xl p-6 sm:p-8 relative overflow-hidden" style={{ background: '#4F46E5' }}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={18} className="text-white" />
                      <h2 className="font-heading font-semibold text-xl text-white">Start with a Free Audit</h2>
                    </div>
                    <p className="text-sm text-white/70 max-w-md">
                      No credit card required. Sign up, enter a URL, and get your full report in minutes. Buy credits when you need more.
                    </p>
                  </div>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 bg-white text-[#080818] text-[15px] font-semibold px-6 py-3 min-h-[48px] rounded-xl transition-all hover:brightness-110 hover:-translate-y-0.5 flex-shrink-0"
                  >
                    Start Free Audit
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Decision Framework ── */}
        <section className="px-4 sm:px-6 lg:px-8 pt-16 pb-8">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-7 sm:p-9"
            >
              <h2 className="font-heading font-semibold text-lg text-white mb-4">Which plan fits your workflow?</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#6366F1]/10 flex items-center justify-center flex-shrink-0">
                    <Search size={16} className="text-[#6366F1]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">&ldquo;I need to know where my site stands&rdquo;</p>
                    <p className="text-xs text-white/50 mt-0.5">Single Audit ($99) &mdash; full report, shareable link, re-audit to track improvement</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                    <BarChart3 size={16} className="text-pink-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">&ldquo;I want to prove improvement each quarter&rdquo;</p>
                    <p className="text-xs text-white/50 mt-0.5">Growth (5 credits, $79.80 each) &mdash; re-audit quarterly, compare scores over time</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Building2 size={16} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">&ldquo;I manage multiple client sites&rdquo;</p>
                    <p className="text-xs text-white/50 mt-0.5">Agency (15 credits, $66.60 each) &mdash; white-label reports with your branding</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#22C55E]/10 flex items-center justify-center flex-shrink-0">
                    <Zap size={16} className="text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">&ldquo;We audit continuously across teams&rdquo;</p>
                    <p className="text-xs text-white/50 mt-0.5">Scale (50 credits, $49.98 each) &mdash; lowest cost, priority support</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-white/50 mt-5 pt-4 border-t border-white/[0.06]">
                <strong className="text-white">Every audit is identical</strong> &mdash; same 64 checkpoints, same depth. Packs lower the per-audit cost and let you re-audit to measure progress. No features are locked behind tiers.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ── Hero card: Single Audit ── */}
        <section className="px-4 sm:px-6 lg:px-8 pb-4">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8 sm:p-10 relative overflow-hidden"
            >
              {/* Subtle warm gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.03] via-transparent to-transparent pointer-events-none" />

              <div className="relative grid sm:grid-cols-2 gap-8 items-center">
                {/* Left: Price */}
                <div>
                  <h2 className="font-heading text-2xl font-semibold text-white mb-1">Single Audit</h2>
                  <p className="text-white/50 text-sm mb-6">For founders and teams who need a one-time baseline</p>

                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-white/50 text-lg">$</span>
                    <span className="font-heading text-6xl sm:text-7xl font-bold text-white tracking-tight">99</span>
                  </div>
                  <p className="text-white/50 text-sm mb-8">One-time payment per audit</p>

                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center gap-2 bg-white text-[#080818] font-semibold text-[15px] rounded-xl px-6 py-3 min-h-[48px] hover:opacity-90 transition-opacity"
                  >
                    Buy 1 audit
                  </Link>
                  <p className="text-xs text-white/50 mt-3">No account needed to preview</p>
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
                      <CheckCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-white">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Divider ── */}
        <section className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-white/50 font-medium tracking-wide uppercase">Need more audits? Save with packs</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>
        </section>

        {/* ── Credit packs ── */}
        <section className="px-4 sm:px-6 lg:px-8 pb-12">
          <div className="max-w-5xl mx-auto">
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { name: 'Growth', credits: 5, price: 399, per: '$79.80', save: 19, desc: 'Quarterly audits to catch issues each release cycle', cta: 'Buy 5 audits', popular: true },
                { name: 'Agency', credits: 15, price: 999, per: '$66.60', save: 33, desc: 'Manage multiple client sites with white-label reports', cta: 'Buy 15 audits', popular: false },
                { name: 'Scale', credits: 50, price: 2499, per: '$49.98', save: 50, desc: 'Continuous auditing across teams and products', cta: 'Buy 50 audits', popular: false },
              ].map((pack, idx) => (
                <motion.div
                  key={pack.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className={`group rounded-2xl border bg-white/[0.03] p-7 hover:shadow-lg hover:shadow-black/[0.04] hover:-translate-y-0.5 transition-all duration-300 ${pack.popular ? 'border-indigo-500/40 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/30' : 'border-white/[0.06] hover:border-white/[0.1]'}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-heading font-semibold text-lg text-white">{pack.name}</h3>
                    {pack.popular ? (
                      <span className="text-[11px] font-bold bg-indigo-500 text-white px-3 py-1 rounded-full shadow-sm">Most Popular</span>
                    ) : (
                      <span className="text-xs font-bold text-white/60 px-2.5 py-1 rounded-full bg-white/[0.06]">
                        {pack.per}/audit
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1 mb-0.5">
                    <span className="text-white/50 text-sm">$</span>
                    <span className="font-heading text-4xl font-bold text-white">{pack.price.toLocaleString()}</span>
                  </div>
                  <p className="text-white/50 text-sm mb-5">
                    {pack.per} per audit <span className="text-white/30">·</span> {pack.credits} audits
                  </p>

                  <p className="text-xs text-white/50 mb-5">{pack.desc}</p>

                  <Link
                    href="/register"
                    className="flex items-center justify-center gap-2 text-[15px] font-semibold rounded-xl py-3 px-6 min-h-[48px] bg-indigo-500 text-white transition-all duration-200 hover:-translate-y-0.5"
                  >
                    {pack.cta}
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── All audits include strip ── */}
        <section className="px-4 sm:px-6 lg:px-8 pb-16">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <AllAuditsInclude />
            </motion.div>
          </div>
        </section>

        {/* ── Money-Back Guarantee ── */}
        <section className="px-4 sm:px-6 lg:px-8 pb-16">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-indigo-500/15 bg-indigo-500/[0.04] p-8 sm:p-10 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-5">
                <ShieldCheck size={28} className="text-indigo-400" />
              </div>
              <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-white tracking-tight mb-3">
                30-day money-back guarantee
              </h2>
              <p className="text-white/50 text-base max-w-lg mx-auto leading-relaxed">
                Not satisfied with your audit? We will refund your credits within 30 days, no questions asked. We stand behind the quality of every report.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ── Pricing Comparison Table ── */}
        <section className="px-4 sm:px-6 lg:px-8 pb-16">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-center mb-10">
                <p className="text-[13px] font-semibold tracking-widest uppercase mb-4 text-white">At a glance</p>
                <h2 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-white tracking-tight">Compare plans</h2>
              </div>

              <div className="rounded-2xl border border-white/[0.06] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#060614]">
                        <th className="text-left px-6 py-4 text-[11px] font-bold text-white/50 uppercase tracking-widest">Plan</th>
                        <th className="text-left px-6 py-4 text-[11px] font-bold text-white/50 uppercase tracking-widest">Price</th>
                        <th className="text-left px-6 py-4 text-[11px] font-bold text-white/50 uppercase tracking-widest">Per Audit</th>
                        <th className="text-left px-6 py-4 text-[11px] font-bold text-white/50 uppercase tracking-widest">Best For</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-indigo-500/[0.04] border-b border-white/[0.04]">
                        <td className="px-6 py-5 font-semibold text-white">Free Audit</td>
                        <td className="px-6 py-5 font-bold text-indigo-400 text-lg">$0</td>
                        <td className="px-6 py-5 text-white/50">Free (1 audit)</td>
                        <td className="px-6 py-5 text-white/50">First-time users evaluating the platform</td>
                      </tr>
                      <tr className="bg-white/[0.03] border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors">
                        <td className="px-6 py-5 font-semibold text-white">Single Audit</td>
                        <td className="px-6 py-5 font-bold text-white text-lg">$99</td>
                        <td className="px-6 py-5 text-white/50">$99.00</td>
                        <td className="px-6 py-5 text-white/50">One-off baseline or pre-launch check</td>
                      </tr>
                      <tr className="bg-indigo-500/[0.04] border-b border-white/[0.04] ring-1 ring-inset ring-indigo-500/10">
                        <td className="px-6 py-5 font-semibold text-white">
                          <span className="flex items-center gap-2">
                            Growth
                            <span className="text-[10px] font-bold bg-indigo-500 text-white px-2 py-0.5 rounded-full leading-tight">Popular</span>
                          </span>
                        </td>
                        <td className="px-6 py-5 font-bold text-white text-lg">$399</td>
                        <td className="px-6 py-5">
                          <span className="text-white font-medium">$79.80</span>
                          <span className="ml-2 text-[11px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">save 19%</span>
                        </td>
                        <td className="px-6 py-5 text-white/50">Quarterly audits per release cycle</td>
                      </tr>
                      <tr className="bg-white/[0.03] border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors">
                        <td className="px-6 py-5 font-semibold text-white">Agency</td>
                        <td className="px-6 py-5 font-bold text-white text-lg">$999</td>
                        <td className="px-6 py-5">
                          <span className="text-white font-medium">$66.60</span>
                          <span className="ml-2 text-[11px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">save 33%</span>
                        </td>
                        <td className="px-6 py-5 text-white/50">Multiple client sites + white-label</td>
                      </tr>
                      <tr className="bg-white/[0.03] hover:bg-white/[0.04] transition-colors">
                        <td className="px-6 py-5 font-semibold text-white">Scale</td>
                        <td className="px-6 py-5 font-bold text-white text-lg">$2,499</td>
                        <td className="px-6 py-5">
                          <span className="text-white font-medium">$49.98</span>
                          <span className="ml-2 text-[11px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">save 50%</span>
                        </td>
                        <td className="px-6 py-5 text-white/50">Continuous auditing across teams</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Value anchor */}
              <p className="text-sm text-white/50 mt-6 text-center">
                At $99 per audit, that&apos;s <span className="font-semibold text-white">$1.55 per checkpoint</span> across 64 checks — compared to $100+ per checkpoint with traditional UX consultants.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ── Lime CTA Band ── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: '#4F46E5' }}>
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="font-heading font-semibold text-3xl sm:text-4xl md:text-[2.75rem] text-white tracking-tight mb-4">
                Start your audit today
              </h2>
              <p className="text-white/70 text-base md:text-lg max-w-md mx-auto mb-8">
                Your first audit is free. No credit card, no commitment — just actionable UX insights in minutes.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-white text-[#080818] text-[15px] font-semibold px-8 py-4 min-h-[52px] rounded-xl transition-all hover:brightness-110 hover:-translate-y-0.5"
              >
                Start Free Audit
                <ArrowRight size={16} />
              </Link>
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  );
}
