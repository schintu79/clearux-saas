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

// Separate enterprise from the standard plans — it gets a distinct card
const STANDARD_PLANS = SUBSCRIPTION_PLANS.filter(p => p.id !== 'enterprise')
const ENTERPRISE_PLAN = SUBSCRIPTION_PLANS.find(p => p.id === 'enterprise')

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 mt-0.5">
      <path d="M3 7.5L5.5 10L11 4" stroke="var(--signal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function PricingContent() {
  const [mode, setMode] = useState<PricingMode>('subscribe')
  const [interval, setInterval] = useState<BillingInterval>('monthly')

  // Enterprise contact modal state
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false)
  const [entForm, setEntForm] = useState({ name: '', email: '', company: '', note: '' })
  const [entSubmitting, setEntSubmitting] = useState(false)
  const [entStatus, setEntStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [entError, setEntError] = useState('')

  const handleEnterpriseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entForm.name || !entForm.email || !entForm.company) return
    setEntSubmitting(true)
    setEntStatus('idle')
    setEntError('')
    try {
      const res = await fetch('/api/contact/enterprise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entForm),
      })
      if (res.ok) {
        setEntStatus('success')
        setEntForm({ name: '', email: '', company: '', note: '' })
      } else {
        const data = await res.json().catch(() => ({}))
        setEntError(data.error || 'Something went wrong. Please try again.')
        setEntStatus('error')
      }
    } catch {
      setEntError('Network error. Please try again.')
      setEntStatus('error')
    } finally {
      setEntSubmitting(false)
    }
  }

  return (
    <main>
      {/* Hero */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5 text-center">
          <SectionMarker number="00" label="Pricing" centered />
          <h1
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            Simple pricing for{' '}
            <em className="italic text-signal">ongoing improvement.</em>
          </h1>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto font-sans mb-10">
            Subscribe for continuous tracking, or use credit packs for one-time audits.
            Every plan includes full product access.
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
      </section>

      {/* Plans */}
      <section className="py-[80px] border-b border-rule max-sm:py-12">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          {/* Subscription cards */}
          {mode === 'subscribe' && (
            <>
              <div className="grid lg:grid-cols-3 gap-4 max-lg:grid-cols-1">
                {STANDARD_PLANS.map((plan) => {
                  const price = interval === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice
                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-xl px-8 py-10 flex flex-col ${
                        plan.popular ? 'bg-ink text-paper' : ''
                      }`}
                      style={plan.popular ? undefined : { background: 'var(--card)', border: '1px solid var(--rule)' }}
                    >
                      {plan.popular && (
                        <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-signal text-paper text-[10px] font-mono tracking-[0.1em] uppercase px-4 py-1 rounded-full">
                          Most popular
                        </span>
                      )}
                      <h3 className="font-mono text-[11px] tracking-[0.1em] uppercase mb-2" style={{ color: plan.popular ? 'color-mix(in srgb, var(--paper) 60%, transparent)' : 'var(--m-muted)' }}>
                        {plan.name}
                      </h3>
                      <p className="text-[14px] font-sans mb-6" style={{ color: plan.popular ? 'color-mix(in srgb, var(--paper) 75%, transparent)' : 'var(--ink-2)' }}>
                        {plan.bestFor}
                      </p>
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

                      {/* Key metrics */}
                      <div className="flex gap-2 mb-7">
                        <span
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-sans font-medium"
                          style={{
                            background: plan.popular ? 'color-mix(in srgb, var(--paper) 14%, transparent)' : 'color-mix(in srgb, var(--ink) 6%, transparent)',
                            color: plan.popular ? 'var(--paper)' : 'var(--ink)',
                          }}
                        >
                          {plan.workspaces} {plan.workspaces === 1 ? 'workspace' : 'workspaces'}
                        </span>
                        <span
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-sans font-medium"
                          style={{
                            background: plan.popular ? 'color-mix(in srgb, var(--paper) 14%, transparent)' : 'color-mix(in srgb, var(--ink) 6%, transparent)',
                            color: plan.popular ? 'var(--paper)' : 'var(--ink)',
                          }}
                        >
                          {plan.reAuditsPerMonth} re-audits / mo
                        </span>
                      </div>

                      <ul className="list-none space-y-3 mb-9 flex-1">
                        {plan.features.map((f) => (
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
                          Start free audit
                          <ArrowRightIcon size={14} />
                        </Link>
                      ) : (
                        <Button
                          href="/register"
                          variant="primary"
                          className="w-full justify-center"
                        >
                          Start free audit
                          <ArrowRightIcon size={14} />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Enterprise card — full width below the grid */}
              {ENTERPRISE_PLAN && (
                <div
                  className="mt-4 rounded-xl px-8 py-10 flex flex-col lg:flex-row lg:items-center gap-8"
                  style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
                >
                  <div className="flex-1">
                    <h3 className="font-mono text-[11px] tracking-[0.1em] uppercase mb-2" style={{ color: 'var(--m-muted)' }}>
                      {ENTERPRISE_PLAN.name}
                    </h3>
                    <p className="text-[14px] font-sans mb-4" style={{ color: 'var(--ink-2)' }}>
                      {ENTERPRISE_PLAN.bestFor}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-sans font-medium"
                        style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
                      >
                        {ENTERPRISE_PLAN.maxActiveWorkspaces}+ workspaces
                      </span>
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-sans font-medium"
                        style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
                      >
                        {ENTERPRISE_PLAN.reAuditsPerMonth}+ re-audits / mo
                      </span>
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-sans font-medium"
                        style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
                      >
                        {ENTERPRISE_PLAN.deepAuditsPerMonth}+ deep audits / mo
                      </span>
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-sans font-medium"
                        style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
                      >
                        SLA guarantee
                      </span>
                    </div>
                    <ul className="list-none space-y-2 max-lg:mb-2">
                      {ENTERPRISE_PLAN.features.slice(0, 5).map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-[14px] font-sans" style={{ color: 'var(--ink-2)' }}>
                          <CheckIcon />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="shrink-0 flex flex-col items-center gap-3 lg:min-w-[220px]">
                    <p className="font-serif text-[32px] font-normal tracking-[-0.03em] text-ink" style={{ lineHeight: 1 }}>
                      Custom pricing
                    </p>
                    <p className="text-[13px] font-sans text-m-muted mb-2">Tailored to your organisation</p>
                    <button
                      onClick={() => { setShowEnterpriseModal(true); setEntStatus('idle') }}
                      className="inline-flex items-center justify-center gap-2 w-full font-sans font-medium text-[14px] border rounded-full px-[22px] py-[11px] cursor-pointer transition-all hover:opacity-80"
                      style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}
                    >
                      Contact us
                      <ArrowRightIcon size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Credit packs */}
          {mode === 'credits' && (
            <>
              <p className="text-[15px] font-sans text-ink-2 mb-8 text-center max-w-[480px] mx-auto">
                One-time audits, no subscription required. Credits never expire and do not include re-audits.
              </p>
              <div className="grid lg:grid-cols-3 gap-4 max-lg:grid-cols-1">
                {CREDIT_PACKS.map((pack) => (
                  <div
                    key={pack.id}
                    className={`relative rounded-xl px-8 py-10 flex flex-col ${
                      pack.popular ? 'bg-ink text-paper' : ''
                    }`}
                    style={pack.popular ? undefined : { background: 'var(--card)', border: '1px solid var(--rule)' }}
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
            </>
          )}
        </div>
      </section>

      {/* Compare plans */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="02" label="Compare" centered />
          <h2
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            Choose by{' '}
            <em className="italic text-signal">how you work.</em>
          </h2>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto font-sans text-center mb-14">
            Subscriptions are for ongoing tracking. Credits are for one-time audits.
            Workspaces define scale. Re-audits define ongoing usage.
          </p>

          <div
            className="rounded-xl overflow-x-auto"
            style={{ border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}
          >
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr>
                  {['Plan', 'Best for', 'Workspaces', 'Re-audits / mo', 'Access'].map((h) => (
                    <th
                      key={h}
                      className="font-mono text-[10px] font-medium tracking-[0.1em] uppercase px-6 py-4 text-left"
                      style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', color: 'var(--ink-2)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([
                  { plan: 'Free', bestFor: 'Try Fixpath', workspaces: '1 (limited)', reAudits: '—', access: 'Preview only' },
                  { plan: 'Credits', bestFor: 'One-time audits', workspaces: 'Pay per use', reAudits: '—', access: 'Full output per credit' },
                  { plan: 'Starter', bestFor: 'One active site', workspaces: '1', reAudits: '4', access: 'Full product' },
                  { plan: 'Pro', bestFor: 'Multiple brands', workspaces: '3', reAudits: '12', access: 'Full product' },
                  { plan: 'Team', bestFor: 'Agencies and teams', workspaces: '10', reAudits: '40', access: 'Full product' },
                  { plan: 'Enterprise', bestFor: 'Large organisations', workspaces: '25+', reAudits: '100+', access: 'Full product + SLA' },
                ] as const).map((row, i) => (
                  <tr
                    key={row.plan}
                    className="transition-colors hover:bg-paper-2"
                    style={{ borderTop: '1px solid color-mix(in srgb, var(--ink) 6%, transparent)' }}
                  >
                    <td className="px-6 py-4 text-[14px] font-sans font-semibold text-ink">{row.plan}</td>
                    <td className="px-6 py-4 text-[13px] font-sans text-ink-2">{row.bestFor}</td>
                    <td className="px-6 py-4 text-[13px] font-sans text-ink-2">{row.workspaces}</td>
                    <td className="px-6 py-4 text-[13px] font-sans text-ink-2">{row.reAudits}</td>
                    <td className="px-6 py-4 text-[13px] font-sans text-ink-2">{row.access}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* How it works — clarification block */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="03" label="How it works" centered />
          <h2
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            Clear usage,{' '}
            <em className="italic text-signal">no surprises.</em>
          </h2>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto font-sans text-center mb-14">
            Everything resets monthly. Extra re-audits can be added when needed.
          </p>

          <div
            className="max-w-[640px] mx-auto rounded-xl overflow-hidden px-8 py-8 max-sm:px-6 max-sm:py-6"
            style={{ border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}
          >
            <div className="space-y-5">
              {[
                { label: 'Workspace', desc: 'One workspace = one active site or brand you want to track and improve.' },
                { label: 'Re-audits', desc: 'Included with subscriptions and reset monthly. Use them to verify fixes and track score changes.' },
                { label: 'Monthly reset', desc: 'Your re-audit allowance refreshes every billing cycle. Unused re-audits do not roll over.' },
                { label: 'Extra re-audits', desc: 'Need more than your plan includes? Add extra re-audits anytime without changing your subscription.' },
                { label: 'Credit packs', desc: 'For one-time audits without a subscription. No re-audits included. Credits never expire.' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0 mt-2"
                    style={{ background: 'var(--ink-2)' }}
                  />
                  <p className="font-sans text-[14px] leading-[1.6]" style={{ color: 'var(--ink)' }}>
                    <span className="font-semibold">{item.label}</span>
                    <span style={{ color: 'var(--m-muted)' }}> — {item.desc}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Guarantee */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5 text-center">
          <SectionMarker number="04" label="Guarantee" centered />
          <h2
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            Satisfied or{' '}
            <em className="italic text-signal">refunded.</em>
          </h2>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[480px] mx-auto font-sans">
            If Fixpath doesn&apos;t give you useful clarity, request a refund.
            No friction, no awkward back-and-forth.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <FaqPreview
        sectionNumber="05"
        items={[
          { q: 'What is a workspace?', a: 'A workspace represents one website or brand you want to audit and track over time. Each workspace has its own audit history, findings, and score progression.' },
          { q: 'Are re-audits unlimited?', a: 'No. Each subscription plan includes a fixed monthly re-audit allowance (4, 12, or 40 depending on plan). This keeps the system honest and our pricing sustainable. Extra re-audits can be added anytime.' },
          { q: 'Do unused re-audits roll over?', a: 'No. Your re-audit allowance resets each billing cycle. This keeps things simple and predictable.' },
          { q: 'What are credit packs for?', a: 'Credit packs are for one-time audits without a subscription. One credit = one full audit. Credits never expire but do not include re-audits or ongoing workspace access.' },
          { q: 'Can I switch plans?', a: 'Yes. Upgrade or downgrade anytime. Changes take effect on your next billing cycle. No penalties.' },
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
            <span className="opacity-30">|</span>
            <Link href="/contact" className="underline hover:text-signal transition-colors">Contact</Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <HomeCta />

      {/* Enterprise contact modal */}
      {showEnterpriseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'color-mix(in srgb, var(--ink) 50%, transparent)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowEnterpriseModal(false) }}
        >
          <div
            className="relative w-full max-w-[480px] rounded-xl px-8 py-10 max-sm:px-6 max-sm:py-8"
            style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}
          >
            <button
              onClick={() => setShowEnterpriseModal(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer"
              style={{ color: 'var(--m-muted)' }}
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>

            {entStatus === 'success' ? (
              <div className="text-center py-6">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'color-mix(in srgb, var(--signal) 12%, transparent)' }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 10.5L8.5 14L15 6" stroke="var(--signal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <h3 className="font-serif text-[24px] font-normal tracking-[-0.02em] text-ink mb-2">Message sent</h3>
                <p className="text-[14px] font-sans text-ink-2 mb-6">
                  We&apos;ll get back to you within one business day.
                </p>
                <button
                  onClick={() => setShowEnterpriseModal(false)}
                  className="inline-flex items-center justify-center font-sans font-medium text-[14px] border rounded-full px-[22px] py-[11px] cursor-pointer transition-all hover:opacity-80"
                  style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <h3 className="font-serif text-[24px] font-normal tracking-[-0.02em] text-ink mb-1">Enterprise inquiry</h3>
                <p className="text-[14px] font-sans text-ink-2 mb-6">
                  Tell us about your organisation and we&apos;ll put together a tailored plan.
                </p>

                <form onSubmit={handleEnterpriseSubmit} className="space-y-4">
                  <div>
                    <label className="block font-mono text-[10px] tracking-[0.1em] uppercase mb-1.5" style={{ color: 'var(--m-muted)' }}>
                      Name <span className="text-signal">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={entForm.name}
                      onChange={(e) => setEntForm({ ...entForm, name: e.target.value })}
                      className="w-full rounded-lg px-4 py-3 text-[14px] font-sans outline-none transition-colors"
                      style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] tracking-[0.1em] uppercase mb-1.5" style={{ color: 'var(--m-muted)' }}>
                      Email <span className="text-signal">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={entForm.email}
                      onChange={(e) => setEntForm({ ...entForm, email: e.target.value })}
                      className="w-full rounded-lg px-4 py-3 text-[14px] font-sans outline-none transition-colors"
                      style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                      placeholder="you@company.com"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] tracking-[0.1em] uppercase mb-1.5" style={{ color: 'var(--m-muted)' }}>
                      Company <span className="text-signal">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={entForm.company}
                      onChange={(e) => setEntForm({ ...entForm, company: e.target.value })}
                      className="w-full rounded-lg px-4 py-3 text-[14px] font-sans outline-none transition-colors"
                      style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                      placeholder="Company name"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] tracking-[0.1em] uppercase mb-1.5" style={{ color: 'var(--m-muted)' }}>
                      Additional note
                    </label>
                    <textarea
                      value={entForm.note}
                      onChange={(e) => setEntForm({ ...entForm, note: e.target.value })}
                      rows={3}
                      className="w-full rounded-lg px-4 py-3 text-[14px] font-sans outline-none transition-colors resize-none"
                      style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                      placeholder="Tell us about your needs, team size, timeline..."
                    />
                  </div>

                  {entStatus === 'error' && (
                    <p className="text-[13px] font-sans" style={{ color: '#dc2626' }}>{entError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={entSubmitting}
                    className="inline-flex items-center justify-center gap-2 w-full font-sans font-medium text-[14px] border rounded-full px-[22px] py-[11px] cursor-pointer transition-all hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}
                  >
                    {entSubmitting ? 'Sending...' : 'Send inquiry'}
                    {!entSubmitting && <ArrowRightIcon size={14} />}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
