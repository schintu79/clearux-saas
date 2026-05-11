'use client';

import { useState } from 'react';
import { CheckCircle, ArrowRight, ShieldCheck, CreditCard, Zap } from 'lucide-react';
import Link from 'next/link';
import SmartCta from '@/components/ui/SmartCta';
import { SUBSCRIPTION_PLANS, CREDIT_PACKS, formatPrice } from '@/lib/pricing';

const FEATURES = [
  'All 6 modules, 360 coverage',
  'PDF + Word reports included',
  'ClearUX AI severity scoring',
  'Issue screenshots with highlights',
  'Track fixes and re-audit anytime',
  '96 checkpoints per audit',
];

type PricingMode = 'subscription' | 'credits';
type BillingInterval = 'monthly' | 'yearly';

export default function PricingContent() {
  const [mode, setMode] = useState<PricingMode>('subscription');
  const [interval, setInterval] = useState<BillingInterval>('monthly');

  return (
    <main id="main-content" className="flex-1">
      {/* ── Background ── */}
      <div className="fixed inset-0" aria-hidden="true">
        <img src="/gradients/bg-hero.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-80 hidden dark:block" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface via-transparent to-surface" />
      </div>

      {/* ── HERO ── */}
      <section className="relative py-28 sm:py-36 lg:py-44 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted mb-4">
            Transparent pricing
          </p>

          <h1 className="font-heading text-text max-w-4xl mb-6" style={{ lineHeight: '1.05' }}>
            <span className="text-[2.5rem] sm:text-[3.5rem] md:text-[4.5rem] lg:text-[5.5rem] font-bold">
              Plans that <span className="text-lime-gradient">scale with you</span>
            </span>
          </h1>

          <p className="font-heading text-[1.5rem] sm:text-[2rem] font-bold text-volt mb-6">
            First audit free. Always.
          </p>

          <p className="text-muted text-base sm:text-lg max-w-3xl leading-relaxed mb-12">
            Subscribe for unlimited re-audits and ongoing monitoring, or buy credit packs for
            project-based work. Every plan runs the full 96-checkpoint analysis. No feature gates.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <SmartCta
              className="group inline-flex items-center justify-center gap-2.5 px-7 py-[1.2rem] rounded-full bg-lime-gradient text-[#111114] text-base font-medium transition-all hover:opacity-90 whitespace-nowrap min-h-[48px]"
              iconSize={15}
            />
            <a
              href="#plans"
              className="group inline-flex items-center justify-center gap-2.5 px-7 py-[1.2rem] rounded-full border border-border text-text text-base font-medium transition-all hover:border-border whitespace-nowrap min-h-[48px]"
            >
              View plans
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </section>

      {/* ── WHAT'S INCLUDED ── */}
      <section className="relative py-14 sm:py-32 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted mb-4">
            Every audit includes
          </p>
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] font-bold text-text mb-10" style={{ lineHeight: '1.1' }}>
            96 checkpoints. <span className="text-lime-gradient">Zero compromises.</span>
          </h2>

          <div className="rounded-2xl border border-border bg-card backdrop-blur-sm p-6 sm:p-8 lg:p-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {FEATURES.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#6B9A2E] dark:text-[#BFFA60] flex-shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base text-muted font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Free audit callout */}
          <div className="mt-8 rounded-2xl border border-[#BFFA60]/20 bg-[#BFFA60]/[0.04] p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#A8E54A]/15 dark:bg-[#BFFA60]/10 flex items-center justify-center flex-shrink-0">
                <Zap size={20} className="text-[#6B9A2E] dark:text-[#BFFA60]" />
              </div>
              <div>
                <p className="text-base font-medium text-text mb-1">Your first audit is free</p>
                <p className="text-sm text-muted leading-relaxed">
                  Full 96-checkpoint analysis, viewable in your dashboard. PDF and DOCX downloads
                  are available on paid plans.
                  No credit card required to get started.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PLANS ── */}
      <section id="plans" className="relative py-14 sm:py-32 overflow-hidden scroll-mt-8">
        <div className="absolute inset-0 bg-surface" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted mb-4">
            Choose your plan
          </p>
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] font-bold text-text mb-3" style={{ lineHeight: '1.1' }}>
            Subscribe or <span className="text-lime-gradient">pay as you go</span>
          </h2>
          <p className="text-muted text-base max-w-xl mb-10 leading-relaxed">
            Subscriptions include unlimited re-audits. Credit packs never expire.
          </p>

          {/* Mode toggle */}
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={() => setMode('subscription')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                mode === 'subscription'
                  ? 'bg-white text-[#111114] shadow-sm'
                  : 'bg-transparent text-muted border border-border hover:text-text'
              }`}
            >
              <CreditCard size={15} />
              Subscriptions
            </button>
            <button
              onClick={() => setMode('credits')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                mode === 'credits'
                  ? 'bg-white text-[#111114] shadow-sm'
                  : 'bg-transparent text-muted border border-border hover:text-text'
              }`}
            >
              <Zap size={15} />
              Credit packs
            </button>
          </div>

          {/* Subscription plans */}
          {mode === 'subscription' && (
            <>
              {/* Billing interval toggle */}
              <div className="flex items-center gap-3 mb-8">
                <button
                  onClick={() => setInterval('monthly')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    interval === 'monthly'
                      ? 'bg-off text-text'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setInterval('yearly')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                    interval === 'yearly'
                      ? 'bg-off text-text'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  Yearly
                  <span className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#6B9A2E] dark:text-[#BFFA60]">
                    save 20%
                  </span>
                </button>
              </div>

              <div className="grid sm:grid-cols-3 gap-5">
                {SUBSCRIPTION_PLANS.map((plan) => {
                  const price = interval === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
                  return (
                    <div
                      key={plan.id}
                      className={`group relative rounded-2xl border p-7 sm:p-8 transition-all duration-300 overflow-hidden ${
                        plan.popular
                          ? 'border-[#BFFA60]/30 bg-card'
                          : 'border-border bg-card hover:border-muted hover:bg-card'
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-[#BFFA60]/[0.06] blur-3xl pointer-events-none hidden dark:block" />
                      )}

                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="font-heading text-xl font-bold text-text" style={{ marginBottom: 0 }}>{plan.name}</h3>
                          {plan.popular && (
                            <span className="text-[10px] font-medium tracking-[0.15em] uppercase px-2.5 py-1 rounded-full bg-[#A8E54A]/15 dark:bg-[#BFFA60]/10 text-[#6B9A2E] dark:text-[#BFFA60] border border-[#A8E54A]/25 dark:border-[#BFFA60]/20">
                              Most popular
                            </span>
                          )}
                        </div>

                        {/* Price */}
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-volt text-lg font-medium">$</span>
                          <span className="font-heading text-5xl sm:text-6xl font-medium text-volt">
                            {Math.round(price / 100)}
                          </span>
                          <span className="text-muted text-base ml-1">/mo</span>
                        </div>
                        {interval === 'yearly' && (
                          <p className="text-sm text-muted mb-1">
                            <span className="line-through opacity-50">{formatPrice(plan.monthlyPrice)}/mo</span>
                            {' '}billed annually
                          </p>
                        )}
                        <p className="text-sm text-muted mb-6">
                          {plan.auditsPerMonth} new audits/mo + unlimited re-audits
                        </p>

                        <div className="space-y-3 mb-8">
                          {plan.features.map((feat, i) => (
                            <div key={i} className="flex items-start gap-2.5">
                              <CheckCircle size={15} className="text-[#6B9A2E] dark:text-[#BFFA60] flex-shrink-0 mt-0.5" />
                              <span className="text-sm text-muted">{feat}</span>
                            </div>
                          ))}
                        </div>

                        <Link
                          href="/register"
                          className={`group/btn inline-flex items-center justify-center gap-2.5 px-7 py-[1.2rem] rounded-full text-base font-medium transition-all whitespace-nowrap w-full min-h-[48px] ${
                            plan.popular
                              ? 'bg-lime-gradient text-[#111114] hover:opacity-90'
                              : 'bg-white text-[#111114] hover:bg-white/90'
                          }`}
                        >
                          Start free trial
                          <ArrowRight size={15} className="group-hover/btn:translate-x-0.5 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Credit packs */}
          {mode === 'credits' && (
            <>
              <p className="text-sm text-muted mb-8">
                No subscription. Buy credits, use anytime. Credits never expire. Re-audits cost 1 credit.
              </p>
              <div className="grid sm:grid-cols-3 gap-5">
                {CREDIT_PACKS.map((pack) => (
                  <div
                    key={pack.id}
                    className={`group relative rounded-2xl border p-7 sm:p-8 transition-all duration-300 overflow-hidden ${
                      pack.popular
                        ? 'border-[#BFFA60]/30 bg-card'
                        : 'border-border bg-card hover:border-muted hover:bg-card'
                    }`}
                  >
                    {pack.popular && (
                      <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-[#BFFA60]/[0.06] blur-3xl pointer-events-none hidden dark:block" />
                    )}

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-heading text-xl font-bold text-text" style={{ marginBottom: 0 }}>{pack.name}</h3>
                        {pack.popular && (
                          <span className="text-[10px] font-medium tracking-[0.15em] uppercase px-2.5 py-1 rounded-full bg-[#A8E54A]/15 dark:bg-[#BFFA60]/10 text-[#6B9A2E] dark:text-[#BFFA60] border border-[#A8E54A]/25 dark:border-[#BFFA60]/20">
                            Best value
                          </span>
                        )}
                      </div>

                      {/* Price */}
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-volt text-lg font-medium">$</span>
                        <span className="font-heading text-5xl sm:text-6xl font-medium text-volt">
                          {Math.round(pack.price / 100)}
                        </span>
                      </div>
                      <p className="text-muted text-sm mb-1">
                        {pack.perAudit} per audit <span className="opacity-30">|</span> {pack.credits} credits
                      </p>
                      {pack.savePercent && (
                        <p className="text-sm text-[#6B9A2E] dark:text-[#BFFA60] font-medium mb-6">Save {pack.savePercent}%</p>
                      )}
                      {!pack.savePercent && <div className="mb-6" />}

                      <div className="space-y-3 mb-8">
                        {pack.features.map((feat, i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <CheckCircle size={15} className="text-[#6B9A2E] dark:text-[#BFFA60] flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-muted">{feat}</span>
                          </div>
                        ))}
                      </div>

                      <Link
                        href="/register"
                        className={`group/btn inline-flex items-center justify-center gap-2.5 px-7 py-[1.2rem] rounded-full text-base font-medium transition-all whitespace-nowrap w-full min-h-[48px] ${
                          pack.popular
                            ? 'bg-lime-gradient text-[#111114] hover:opacity-90'
                            : 'bg-white text-[#111114] hover:bg-white/90'
                        }`}
                      >
                        Buy {pack.credits} credits
                        <ArrowRight size={15} className="group-hover/btn:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── COMPARE TABLE ── */}
      <section className="relative py-14 sm:py-32 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted mb-4">At a glance</p>
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] font-bold text-text mb-10" style={{ lineHeight: '1.1' }}>
            Compare plans
          </h2>

          <div className="rounded-2xl border border-border overflow-hidden backdrop-blur-sm">
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-card">
                    <th className="text-left px-4 sm:px-6 py-4 text-[11px] font-medium text-muted uppercase tracking-[0.2em]">Feature</th>
                    <th className="text-center px-4 sm:px-6 py-4 text-[11px] font-medium text-muted uppercase tracking-[0.2em]">Free</th>
                    <th className="text-center px-4 sm:px-6 py-4 text-[11px] font-medium text-muted uppercase tracking-[0.2em]">Credits</th>
                    <th className="text-center px-4 sm:px-6 py-4 text-[11px] font-medium text-muted uppercase tracking-[0.2em]">Subscription</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    { feature: '96-checkpoint analysis', free: true, credits: true, sub: true },
                    { feature: 'Dashboard access', free: true, credits: true, sub: true },
                    { feature: 'PDF + DOCX reports', free: false, credits: true, sub: true },
                    { feature: 'Re-audits', free: '-', credits: '1 credit each', sub: 'Unlimited' },
                    { feature: 'White-label reports', free: false, credits: 'Scale pack', sub: 'Pro + Agency' },
                    { feature: 'Priority processing', free: false, credits: false, sub: 'Pro + Agency' },
                    { feature: 'Team seats', free: false, credits: false, sub: 'Agency (5)' },
                    { feature: 'API access', free: false, credits: false, sub: 'Agency' },
                  ] as { feature: string; free: boolean | string; credits: boolean | string; sub: boolean | string }[]).map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 sm:px-6 py-4 sm:py-5 font-medium text-text">{row.feature}</td>
                      {(['free', 'credits', 'sub'] as const).map((col) => {
                        const val = row[col];
                        return (
                          <td key={col} className="px-4 sm:px-6 py-4 sm:py-5 text-center">
                            {val === true ? (
                              <CheckCircle size={16} className="text-[#6B9A2E] dark:text-[#BFFA60] mx-auto" />
                            ) : val === false ? (
                              <span className="text-muted opacity-40">-</span>
                            ) : (
                              <span className="text-sm text-muted">{val}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── GUARANTEE ── */}
      <section className="relative z-10 py-14 sm:py-32 bg-surface">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="rounded-2xl border border-border bg-card p-8 sm:p-12 flex flex-col sm:flex-row items-start gap-6">
            <div className="w-14 h-14 rounded-xl bg-[#A8E54A]/15 dark:bg-[#BFFA60]/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={28} className="text-[#6B9A2E] dark:text-[#BFFA60]" />
            </div>
            <div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text mb-3">
                30-day money-back guarantee
              </h2>
              <p className="text-sm sm:text-base text-muted leading-relaxed max-w-lg">
                Not satisfied with your audit? We&apos;ll refund your purchase within 30 days, no questions asked.
                Cancel subscriptions anytime with no penalty.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CROSS-LINKS ── */}
      <section className="relative z-10 py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted">
            <span>Learn more:</span>
            <Link href="/how-it-works" className="underline hover:text-text transition-colors">How it works</Link>
            <span className="opacity-30">|</span>
            <Link href="/demo-report" className="underline hover:text-text transition-colors">See a demo report</Link>
            <span className="opacity-30">|</span>
            <Link href="/faq" className="underline hover:text-text transition-colors">FAQ</Link>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative z-10 py-28 sm:py-36 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 text-center">
          <h2 className="font-heading text-[2rem] sm:text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-bold text-text mb-4" style={{ lineHeight: '1.1' }}>
            Start your audit <span className="text-lime-gradient">today</span>
          </h2>
          <p className="text-muted text-base sm:text-lg max-w-md mx-auto leading-relaxed mb-10">
            Your first audit is free. No credit card, no commitment. Actionable UX insights in minutes.
          </p>
          <SmartCta
            className="group inline-flex items-center gap-2.5 px-7 py-[1.2rem] rounded-full bg-white text-[#111114] text-base font-medium transition-all hover:bg-white/90 whitespace-nowrap min-h-[48px]"
          />
        </div>
      </section>
    </main>
  );
}
