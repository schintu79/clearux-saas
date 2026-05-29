'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SectionMarker } from '@/components/marketing/SectionMarker'
import { Button } from '@/components/marketing/Button'
import { ArrowRightIcon } from '@/components/marketing/icons'
import { HomeCta } from '@/components/marketing/HomeCta'
import { FaqPreview } from '@/components/marketing/FaqPreview'
import { SUBSCRIPTION_PLANS, CREDIT_PACKS, formatPrice } from '@/lib/pricing'
import type { BillingInterval } from '@/lib/pricing'

type PricingMode = 'subscribe' | 'credits'

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 mt-0.5">
      <path d="M3 7.5L5.5 10L11 4" stroke="var(--signal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckCell() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
      <path d="M3.5 8.5L6 11L12.5 5" stroke="var(--signal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function PricingContent() {
  const [mode, setMode] = useState<PricingMode>('subscribe')
  const [interval, setInterval] = useState<BillingInterval>('monthly')

  return (
    <main>
      {/* Hero */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="01" label="Pricing" />
          <h1 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6" style={{ fontSize: 'clamp(44px, 6vw, 80px)' }}>
            Plans that <em className="italic text-signal">scale with you.</em>
          </h1>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[600px] mb-10 font-sans">
            Every plan includes the full 96-checkpoint audit across six modules, concrete fix guidance, and progress tracking. Subscribe for ongoing monitoring or buy credit packs for project work. First audit free, always.
          </p>

          {/* Mode toggle */}
          <div className="inline-flex rounded-full border border-rule p-1 mb-4">
            <button
              onClick={() => setMode('subscribe')}
              className={`px-6 py-2.5 rounded-full text-[13px] font-medium font-sans transition-all ${
                mode === 'subscribe' ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'
              }`}
            >
              Subscriptions
            </button>
            <button
              onClick={() => setMode('credits')}
              className={`px-6 py-2.5 rounded-full text-[13px] font-medium font-sans transition-all ${
                mode === 'credits' ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'
              }`}
            >
              Credit packs
            </button>
          </div>

          {mode === 'subscribe' && (
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => setInterval('monthly')}
                className={`text-[13px] font-sans transition-colors ${interval === 'monthly' ? 'text-ink font-medium' : 'text-m-muted hover:text-ink-2'}`}
              >
                Monthly
              </button>
              <span className="text-rule">|</span>
              <button
                onClick={() => setInterval('yearly')}
                className={`text-[13px] font-sans transition-colors ${interval === 'yearly' ? 'text-ink font-medium' : 'text-m-muted hover:text-ink-2'}`}
              >
                Yearly
              </button>
              {interval === 'yearly' && (
                <span className="text-[11px] font-mono tracking-[0.06em] uppercase text-signal ml-1">Save 20%</span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Plans */}
      <section className="py-[80px] border-b border-rule max-sm:py-12">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          {/* Subscription cards */}
          {mode === 'subscribe' && (
            <div className="grid lg:grid-cols-3 gap-0 border border-ink max-lg:grid-cols-1">
              {SUBSCRIPTION_PLANS.map((plan, i) => {
                const price = interval === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice
                return (
                  <div
                    key={plan.id}
                    className={`relative px-8 py-10 flex flex-col ${i < SUBSCRIPTION_PLANS.length - 1 ? 'lg:border-r max-lg:border-b' : ''} border-ink ${
                      plan.popular ? 'bg-ink text-paper' : ''
                    }`}
                  >
                    {plan.popular && (
                      <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-signal text-paper text-[10px] font-mono tracking-[0.1em] uppercase px-4 py-1 rounded-full">
                        Most popular
                      </span>
                    )}
                    <h3 className="font-mono text-[11px] tracking-[0.1em] uppercase mb-6" style={{ color: plan.popular ? 'color-mix(in srgb, var(--paper) 60%, transparent)' : 'var(--m-muted)' }}>
                      {plan.name}
                    </h3>
                    <div className="mb-1">
                      <span className="font-serif text-[48px] font-normal tracking-[-0.03em]" style={{ lineHeight: 1 }}>
                        {formatPrice(price)}
                      </span>
                      <span className="text-[14px] font-sans ml-1" style={{ color: plan.popular ? 'color-mix(in srgb, var(--paper) 55%, transparent)' : 'var(--m-muted)' }}>
                        / mo
                      </span>
                    </div>
                    {interval === 'yearly' && (
                      <p className="text-[12px] font-sans mb-5" style={{ color: plan.popular ? 'color-mix(in srgb, var(--paper) 50%, transparent)' : 'var(--m-muted)' }}>
                        Billed yearly at {formatPrice(price * 12)}
                      </p>
                    )}
                    {interval === 'monthly' && <div className="mb-5" />}
                    <p className="text-[15px] font-sans font-medium mb-7" style={{ color: plan.popular ? 'var(--paper)' : 'var(--ink)' }}>
                      {plan.auditsPerMonth} audits per month + unlimited re-audits
                    </p>
                    <ul className="list-none space-y-3 mb-9 flex-1">
                      {plan.features.slice(1).map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-[14px] font-sans" style={{ color: plan.popular ? 'color-mix(in srgb, var(--paper) 78%, transparent)' : 'var(--ink-2)' }}>
                          <CheckIcon />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {plan.popular ? (
                      <Link
                        href="/register"
                        className="inline-flex items-center justify-center gap-2 w-full font-sans font-medium text-[14px] border rounded-full px-[22px] py-[11px] no-underline cursor-pointer transition-all bg-signal text-white border-signal hover:opacity-90"
                      >
                        Start free trial
                        <ArrowRightIcon size={14} />
                      </Link>
                    ) : (
                      <Button
                        href="/register"
                        variant="primary"
                        className="w-full justify-center"
                      >
                        Start free trial
                        <ArrowRightIcon size={14} />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Credit packs */}
          {mode === 'credits' && (
            <div className="grid lg:grid-cols-3 gap-0 border border-ink max-lg:grid-cols-1">
              {CREDIT_PACKS.map((pack, i) => (
                <div
                  key={pack.id}
                  className={`relative px-8 py-10 flex flex-col ${i < CREDIT_PACKS.length - 1 ? 'lg:border-r max-lg:border-b' : ''} border-ink ${
                    pack.popular ? 'bg-ink text-paper' : ''
                  }`}
                >
                  {pack.popular && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-signal text-paper text-[10px] font-mono tracking-[0.1em] uppercase px-4 py-1 rounded-full">
                      Best value
                    </span>
                  )}
                  <h3 className="font-mono text-[11px] tracking-[0.1em] uppercase mb-6" style={{ color: pack.popular ? 'color-mix(in srgb, var(--paper) 60%, transparent)' : 'var(--m-muted)' }}>
                    {pack.name}
                  </h3>
                  <div className="mb-1">
                    <span className="font-serif text-[48px] font-normal tracking-[-0.03em]" style={{ lineHeight: 1 }}>
                      {formatPrice(pack.price)}
                    </span>
                  </div>
                  <p className="text-[14px] font-sans mb-5" style={{ color: pack.popular ? 'color-mix(in srgb, var(--paper) 55%, transparent)' : 'var(--m-muted)' }}>
                    {pack.perAudit} per audit · {pack.credits} credits
                  </p>
                  {pack.savePercent && (
                    <span className="inline-block text-[11px] font-mono tracking-[0.06em] uppercase text-signal mb-5">
                      Save {pack.savePercent}%
                    </span>
                  )}
                  {!pack.savePercent && <div className="mb-5" />}
                  <ul className="list-none space-y-3 mb-9 flex-1">
                    {pack.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[14px] font-sans" style={{ color: pack.popular ? 'color-mix(in srgb, var(--paper) 78%, transparent)' : 'var(--ink-2)' }}>
                        <CheckIcon />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {pack.popular ? (
                    <Link
                      href="/register"
                      className="inline-flex items-center justify-center gap-2 w-full font-sans font-medium text-[14px] border rounded-full px-[22px] py-[11px] no-underline cursor-pointer transition-all bg-signal text-white border-signal hover:opacity-90"
                    >
                      Buy credits
                      <ArrowRightIcon size={14} />
                    </Link>
                  ) : (
                    <Button
                      href="/register"
                      variant="primary"
                      className="w-full justify-center"
                    >
                      Buy credits
                      <ArrowRightIcon size={14} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Compare table */}
      <section className="py-[80px] border-b border-rule max-sm:py-12">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="02" label="Compare" />
          <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-12" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Compare <em className="italic text-signal">plans</em>
          </h2>

          <div className="border border-ink overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px]">
              <thead>
                <tr>
                  {['Feature', 'Free', 'Credits', 'Subscription'].map((h) => (
                    <th key={h} className="bg-ink text-paper font-mono text-[10px] font-medium tracking-[0.1em] uppercase px-6 py-4 text-left first:text-left text-center">
                      {h}
                    </th>
                  ))}
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
                ] as { feature: string; free: boolean | string; credits: boolean | string; sub: boolean | string }[]).map((row, ri) => (
                  <tr key={ri} className="border-b border-rule last:border-b-0 hover:bg-paper-2 transition-colors">
                    <td className="px-6 py-4 text-[14px] font-sans font-medium text-ink">{row.feature}</td>
                    {(['free', 'credits', 'sub'] as const).map((col) => {
                      const val = row[col]
                      return (
                        <td key={col} className="px-6 py-4 text-center">
                          {val === true ? (
                            <CheckCell />
                          ) : val === false ? (
                            <span className="text-m-muted opacity-40">—</span>
                          ) : (
                            <span className="text-[13px] font-sans text-ink-2">{val}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Guarantee */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="04" label="Guarantee" />
          <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            30-day money-back <em className="italic text-signal">guarantee.</em>
          </h2>
          <p className="font-sans text-[17px] text-ink-2 leading-[1.6] max-w-[520px]">
            Not satisfied with your audit? We&apos;ll refund your purchase within 30 days, no questions asked. Cancel subscriptions anytime with no penalty.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <FaqPreview
        sectionNumber="05"
        items={[
          { q: 'How do credits work?', a: 'One credit = one full audit. Credits never expire. Every audit includes all six modules, 96 checkpoints, PDF & Word reports, finding status tracking, shareable team links, and prioritised recommendations. Buy in packs to lower the per-audit cost.' },
          { q: 'Can I get a refund?', a: "If you're unsatisfied with an audit, reach out via our contact form or email support@fixpath.ai and we'll resolve it or provide a credit for a new audit. We stand behind the quality of our reports." },
          { q: 'What is the free preview audit?', a: 'Anyone can run a free preview audit from the homepage without signing up. The preview shows your overall score, module scores, and severity breakdown. Individual findings, recommendations, and downloadable reports are available when you unlock the full audit.' },
          { q: 'What payment methods are accepted?', a: 'We accept Visa, Mastercard, American Express, Apple Pay, and Google Pay. All payments are processed securely via Stripe.' },
          { q: 'Can I buy more credits later?', a: 'Yes. You can purchase additional credit packs at any time. Credits from different purchases stack together and never expire.' },
        ]}
      />

      {/* Cross-links */}
      <section className="py-12 border-b border-rule">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <div className="flex flex-wrap items-center justify-center gap-4 text-[13px] font-sans text-m-muted">
            <span>Learn more:</span>
            <Link href="/product" className="underline hover:text-signal transition-colors">Product</Link>
            <span className="opacity-30">|</span>
            <Link href="/faq" className="underline hover:text-signal transition-colors">FAQ</Link>
          </div>
        </div>
      </section>

      {/* Enterprise / custom needs */}
      <section className="py-10">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5 text-center">
          <p className="text-[15px] text-m-muted font-sans">
            Need a custom plan, volume pricing, or white-label reports?{' '}
            <Link href="/contact" className="text-signal underline underline-offset-2 hover:text-ink transition-colors font-medium">
              Get in touch
            </Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <HomeCta />
    </main>
  )
}
