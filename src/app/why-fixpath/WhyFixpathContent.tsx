'use client'

import { SectionMarker } from '@/components/marketing/SectionMarker'
import { Button } from '@/components/marketing/Button'
import { ArrowRightIcon } from '@/components/marketing/icons'
import { HomeCta } from '@/components/marketing/HomeCta'
import { AlertTriangle, ShieldOff, RefreshCcw, HelpCircle, Eye, Shield, Wrench, Crosshair, Code2, TrendingUp, Scale, Tags } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * WhyFixpathContent — "Why Fixpath" trust/differentiation page.
 *
 * Sections:
 * 00. Hero — noise vs clarity
 * 01. The problem — why teams stop trusting audit tools (4 cards)
 * 02. What teams need — 5 bullet checklist
 * 03. Philosophy — truth, trust, usefulness (3 cards)
 * 04. CTA
 */

const NOISE_PROBLEMS: { title: string; desc: string; Icon: LucideIcon }[] = [
  {
    title: 'Everything sounds equally certain',
    desc: 'Most AI audits flatten every result into one output. No distinction between verified checks and vague interpretation.',
    Icon: AlertTriangle,
  },
  {
    title: 'Coverage is invisible',
    desc: 'Tools hide how much of the site they actually reviewed. Scores feel confident even when evidence is thin.',
    Icon: ShieldOff,
  },
  {
    title: 'Repeated findings kill credibility',
    desc: 'When the same issues reappear after fixes, confidence in the system drops fast.',
    Icon: RefreshCcw,
  },
  {
    title: 'Advice stays vague',
    desc: 'Most tools tell you something is wrong, but not what was checked, how certain they are, or what to do next.',
    Icon: HelpCircle,
  },
]

const TEAM_NEEDS: { label: string; desc: string; Icon: LucideIcon }[] = [
  { label: 'Clear priority', desc: 'Findings ranked by evidence strength and impact — verified issues first.', Icon: Crosshair },
  { label: 'Concrete fixes', desc: 'What to change, where it lives, and how confident the recommendation is.', Icon: Code2 },
  { label: 'Visible coverage', desc: 'How much of the site was actually reviewed, not just a score with no context.', Icon: TrendingUp },
  { label: 'Honest scoring', desc: 'Confidence and coverage visible on every finding. No inflated urgency.', Icon: Scale },
  { label: 'Useful categories', desc: 'Trust, clarity, accessibility, AI readiness, design consistency, and SEO.', Icon: Tags },
]

const PHILOSOPHY_PILLARS: { title: string; desc: string; Icon: LucideIcon }[] = [
  {
    title: 'Truth',
    desc: 'Every finding is tagged as verified, observed, or heuristic. We do not invent issues to fill a report.',
    Icon: Eye,
  },
  {
    title: 'Trust',
    desc: 'Confidence and coverage are visible on every finding. Every score should be explainable from the evidence behind it.',
    Icon: Shield,
  },
  {
    title: 'Usefulness',
    desc: 'Every issue leads to a next step: fix it, send it, or track the result. High-confidence problems first.',
    Icon: Wrench,
  },
]

export function WhyFixpathContent() {
  return (
    <main id="main-content">
      {/* Hero */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5 text-center">
          <SectionMarker number="00" label="Why Fixpath" centered />
          <h1
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            Noise is the norm.{' '}
            <em className="italic text-signal">We built clarity.</em>
          </h1>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto font-sans">
            Most audit tools generate more findings, more repetition, and less confidence.
            Fixpath separates verified checks from interpretation — so teams see what to trust and what to fix first.
          </p>
          <div className="flex gap-3.5 justify-center mt-10 max-sm:flex-col max-sm:items-stretch">
            <Button href="/register" size="large">
              Start free audit
              <ArrowRightIcon size={14} />
            </Button>
            <Button href="/product" variant="ghost" size="large">
              See the product
            </Button>
          </div>
        </div>
      </section>

      {/* Section 01 — The problem with generic audits */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="01" label="The problem" centered />
          <h2
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            Why teams stop trusting{' '}
            <em className="italic text-signal">audit tools.</em>
          </h2>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto mb-16 font-sans text-center">
            Too many tools create volume without priority, scores without consistency,
            and advice without a clear next step.
          </p>

          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {NOISE_PROBLEMS.map((item, i) => {
                const isLeftCol = i % 2 === 0
                const isTopRow = i < 2
                return (
                  <div
                    key={item.title}
                    className="flex items-start gap-4 px-8 py-8 max-sm:px-6 max-sm:py-6"
                    style={{
                      borderRight: isLeftCol ? '1px solid color-mix(in srgb, var(--ink) 6%, transparent)' : 'none',
                      borderBottom: isTopRow ? '1px solid color-mix(in srgb, var(--ink) 6%, transparent)' : 'none',
                    }}
                  >
                    <item.Icon
                      size={16}
                      strokeWidth={1.5}
                      style={{ color: 'var(--ink-2)' }}
                      className="shrink-0 mt-0.5"
                    />
                    <div>
                      <h3
                        className="font-sans text-[14px] font-semibold tracking-[-0.01em] mb-1.5"
                        style={{ color: 'var(--ink)' }}
                      >
                        {item.title}
                      </h3>
                      <p
                        className="font-sans text-[13px] leading-[1.55]"
                        style={{ color: 'var(--m-muted)' }}
                      >
                        {item.desc}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Section 02 — What teams actually need */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="02" label="What teams need" centered />
          <h2
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            Not more findings.{' '}
            <em className="italic text-signal">Better answers.</em>
          </h2>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto mb-14 font-sans text-center">
            Teams need priority, evidence, and clear action — not another report to decode.
          </p>

          <div
            className="max-w-[640px] mx-auto rounded-xl overflow-hidden px-8 py-8 max-sm:px-6 max-sm:py-6"
            style={{ border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}
          >
            <div className="space-y-5">
              {TEAM_NEEDS.map((need) => (
                <div key={need.label} className="flex items-start gap-3.5">
                  <need.Icon
                    size={15}
                    strokeWidth={1.5}
                    style={{ color: 'var(--ink-2)' }}
                    className="shrink-0 mt-0.5"
                  />
                  <p className="font-sans text-[14px] leading-[1.6]" style={{ color: 'var(--ink)' }}>
                    <span className="font-semibold">{need.label}</span>
                    <span style={{ color: 'var(--m-muted)' }}> — {need.desc}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 03 — The Fixpath philosophy */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="03" label="Our philosophy" centered />
          <h2
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            Truth. Trust.{' '}
            <em className="italic text-signal">Usefulness.</em>
          </h2>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto mb-16 font-sans text-center">
            Three standards behind every score, finding, and recommendation.
          </p>

          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-3">
              {PHILOSOPHY_PILLARS.map((p, i) => (
                <div
                  key={p.title}
                  className="flex items-start gap-4 px-8 py-8 max-sm:px-6 max-sm:py-6"
                  style={{
                    borderRight: i < 2 ? '1px solid color-mix(in srgb, var(--ink) 6%, transparent)' : 'none',
                  }}
                >
                  <p.Icon
                    size={16}
                    strokeWidth={1.5}
                    style={{ color: 'var(--ink-2)' }}
                    className="shrink-0 mt-0.5"
                  />
                  <div>
                    <h3
                      className="font-sans text-[14px] font-semibold tracking-[-0.01em] mb-1.5"
                      style={{ color: 'var(--ink)' }}
                    >
                      {p.title}
                    </h3>
                    <p
                      className="font-sans text-[13px] leading-[1.55]"
                      style={{ color: 'var(--m-muted)' }}
                    >
                      {p.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <HomeCta />
    </main>
  )
}
