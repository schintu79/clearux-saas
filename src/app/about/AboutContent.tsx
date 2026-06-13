'use client'

import { Eye, Shield, Wrench, Crosshair, Code2, TrendingUp } from 'lucide-react'
import { SectionMarker } from '@/components/marketing/SectionMarker'
import { HomeCta } from '@/components/marketing/HomeCta'

export default function AboutContent() {
  return (
    <main id="main-content">
      {/* Section 00 — Mission */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5 text-center">
          <SectionMarker number="00" label="Mission" centered />
          <h1
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            Built around truth,{' '}
            <em className="italic text-signal">not noise.</em>
          </h1>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[580px] mx-auto font-sans">
            Fixpath exists because too many teams get reports they cannot trust and scores
            they cannot act on. We built a system that helps people see what matters, fix it
            with confidence, and track whether it improved.
          </p>
        </div>
      </section>

      {/* Section 01 — What we believe */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="01" label="What we believe" centered />
          <h2
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            Truth. Trust.{' '}
            <em className="italic text-signal">Usefulness.</em>
          </h2>

          <div
            className="max-w-[720px] mx-auto rounded-xl overflow-hidden mt-14"
            style={{ border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-3">
              {[
                {
                  title: 'Truth',
                  desc: 'Evidence over opinion, and no invented urgency.',
                  Icon: Eye,
                },
                {
                  title: 'Trust',
                  desc: 'Clear findings, explainable scores, and specific recommendations.',
                  Icon: Shield,
                },
                {
                  title: 'Usefulness',
                  desc: 'Every finding should help someone make a better next decision.',
                  Icon: Wrench,
                },
              ].map((p, i) => (
                <div
                  key={p.title}
                  className="flex items-start gap-3.5 px-6 py-6 max-sm:px-5 max-sm:py-5"
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
                      className="font-sans text-[14px] font-semibold tracking-[-0.01em] mb-1"
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

      {/* Section 02 — In practice */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="02" label="In practice" centered />
          <h2
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            What that means{' '}
            <em className="italic text-signal">in the product.</em>
          </h2>

          <div
            className="max-w-[640px] mx-auto rounded-xl overflow-hidden px-8 py-8 mt-14 max-sm:px-6 max-sm:py-6"
            style={{ border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}
          >
            <div className="space-y-5">
              {[
                {
                  label: 'Priority first',
                  desc: 'Surface what is actually hurting the site now.',
                  Icon: Crosshair,
                },
                {
                  label: 'Concrete action',
                  desc: 'Show what to change, where, and how to verify it.',
                  Icon: Code2,
                },
                {
                  label: 'Progress you can prove',
                  desc: 'Re-audit, compare, and see what improved over time.',
                  Icon: TrendingUp,
                },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3.5">
                  <item.Icon
                    size={15}
                    strokeWidth={1.5}
                    style={{ color: 'var(--ink-2)' }}
                    className="shrink-0 mt-0.5"
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

      {/* CTA */}
      <HomeCta />
    </main>
  )
}
