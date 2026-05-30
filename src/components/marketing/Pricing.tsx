'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SectionMarker } from './SectionMarker'
import { Button } from './Button'
import { ArrowRightIcon } from './icons'
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

export function Pricing() {
  const [mode, setMode] = useState<PricingMode>('subscribe')
  const [interval, setInterval] = useState<BillingInterval>('monthly')

  return (
    <section className="py-[100px] max-sm:py-16 border-b border-rule" id="pricing">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="text-center mb-16">
          <SectionMarker number="09" label="The economics" centered />
          <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 max-w-[900px] mx-auto" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            One tool. <em className="italic text-signal">Two ways in.</em>
          </h2>
          <p className="text-[18px] text-ink-2 max-w-[560px] mx-auto leading-[1.55] mb-10 font-sans">
            Subscribe for regular audits, or buy credit packs when you need them. Every audit gets all 112 checkpoints, all 7 modules, full exports. First audit free, always.
          </p>

          {/* Mode toggle */}
          <div className="inline-flex rounded-full border border-rule p-1 mb-4">
            <button
              onClick={() => setMode('subscribe')}
              className={`px-6 py-2.5 rounded-full text-[13px] font-medium font-sans transition-all ${
                mode === 'subscribe'
                  ? 'bg-ink text-paper'
                  : 'text-ink-2 hover:text-ink'
              }`}
            >
              Subscriptions
            </button>
            <button
              onClick={() => setMode('credits')}
              className={`px-6 py-2.5 rounded-full text-[13px] font-medium font-sans transition-all ${
                mode === 'credits'
                  ? 'bg-ink text-paper'
                  : 'text-ink-2 hover:text-ink'
              }`}
            >
              Credit packs
            </button>
          </div>

          {/* Billing interval toggle (subscriptions only) */}
          {mode === 'subscribe' && (
            <div className="flex items-center justify-center gap-3 mt-4">
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
                    {plan.auditsPerMonth} audits per month
                  </p>
                  <ul className="list-none space-y-3 mb-9">
                    {plan.features.slice(1).map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[14px] font-sans" style={{ color: plan.popular ? 'color-mix(in srgb, var(--paper) 78%, transparent)' : 'var(--ink-2)' }}>
                        <CheckIcon />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    {plan.popular ? (
                      <Link
                        href="/register"
                        className="w-full justify-center inline-flex items-center gap-2 font-sans font-medium border rounded-full no-underline cursor-pointer transition-all px-[22px] py-[11px] text-[14px] border-signal hover:opacity-90"
                        style={{ background: 'var(--signal)', color: 'var(--paper)' }}
                      >
                        Start free trial
                        <ArrowRightIcon size={14} />
                      </Link>
                    ) : (
                      <Button href="/register" variant="ghost" className="w-full justify-center">
                        Start free trial
                        <ArrowRightIcon size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Credit pack cards */}
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
                <ul className="list-none space-y-3 mb-9">
                  {pack.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[14px] font-sans" style={{ color: pack.popular ? 'color-mix(in srgb, var(--paper) 78%, transparent)' : 'var(--ink-2)' }}>
                      <CheckIcon />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  {pack.popular ? (
                    <Link
                      href="/register"
                      className="w-full justify-center inline-flex items-center gap-2 font-sans font-medium border rounded-full no-underline cursor-pointer transition-all px-[22px] py-[11px] text-[14px] border-signal hover:opacity-90"
                      style={{ background: 'var(--signal)', color: 'var(--paper)' }}
                    >
                      Buy credits
                      <ArrowRightIcon size={14} />
                    </Link>
                  ) : (
                    <Button href="/register" variant="ghost" className="w-full justify-center">
                      Buy credits
                      <ArrowRightIcon size={14} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom features row — contextual per mode */}
        <div className="flex justify-center gap-10 mt-12 font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase flex-wrap max-sm:flex-col max-sm:gap-4">
          {(mode === 'subscribe'
            ? ['112 checkpoints', 'PDF + Word export', 'Unlimited re-audits']
            : ['First audit free', '112 checkpoints', 'Credits never expire']
          ).map((f) => (
            <span key={f} className="before:content-['◆_'] before:text-signal">{f}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
