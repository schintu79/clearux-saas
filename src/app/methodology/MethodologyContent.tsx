import { ShieldCheck, Sparkles, HelpCircle, Gauge, AlertTriangle } from 'lucide-react'
import { SectionMarker } from '@/components/marketing/SectionMarker'
import { HomeCta } from '@/components/marketing/HomeCta'

/**
 * /methodology — the "show your work" page (Phase 1, item 6).
 * Every number on this page is the REAL value the engine uses:
 *   • Evidence tiers          → trust-summary.ts (evidenceDisplayLabel)
 *   • Overall cap table       → severity-cap.ts applySeverityCapFromCounts
 *   • Module cap table        → severity-cap.ts applyModuleSeverityCap
 *   • Score bands             → audit-findings-presentation.ts healthLabel
 *   • Refund policy           → process-audit.ts zero-findings-policy
 * If any of those change, this page must change in the same commit.
 */

const EVIDENCE_TIERS = [
  {
    Icon: ShieldCheck,
    label: 'Verified',
    color: 'var(--ok)',
    desc: 'An instrument measured it. Deterministic checks with a concrete artifact — element selectors, response headers, parsed markup, rendered colours.',
    sources: 'axe-core accessibility scan, WCAG checker, schema/structured-data validator, responsive browser test, PageSpeed (Core Web Vitals), SEO/head-tag parser.',
  },
  {
    Icon: Sparkles,
    label: 'AI-assessed',
    color: 'var(--signal)',
    desc: 'Expert AI review concluded it, grounded in quoted page evidence — clarity, messaging, structure, positioning. Always labeled as AI-assessed, never dressed up as measured.',
    sources: 'The analysis model, reading your real crawled content under a quote-to-critique rule: it must cite what it saw, and it may not claim something is absent without structural evidence.',
  },
  {
    Icon: HelpCircle,
    label: 'Not enough evidence',
    color: 'var(--m-muted)',
    desc: 'We could not test this with confidence — and we say so, rather than guess. A finding with no quotable proof is flagged, never inflated into a confident claim.',
    sources: 'Low-confidence observations and honest coverage gaps (e.g. a page we could not render).',
  },
]

const OVERALL_CAPS = [
  { profile: '1 or more open critical issues', cap: '55' },
  { profile: '6 or more open high-severity issues', cap: '65' },
  { profile: '3–5 open high-severity issues', cap: '72' },
  { profile: '1–2 open high-severity issues', cap: '80' },
  { profile: '6 or more open medium-severity issues', cap: '85' },
  { profile: 'Below those thresholds', cap: 'No cap — score stands on its checks' },
]

const MODULE_CAPS = [
  { profile: '1 or more open critical issues', cap: '55' },
  { profile: '3 or more open high-severity issues', cap: '65' },
  { profile: '2 open high-severity issues', cap: '72' },
  { profile: '1 open high-severity issue', cap: '80' },
  { profile: '3 or more open medium-severity issues', cap: '85' },
]

const BANDS = [
  { band: 'Excellent', range: '90–100, zero open findings', color: 'var(--ok)' },
  { band: 'Healthy', range: '70–100', color: 'var(--ok)' },
  { band: 'Needs work', range: '40–69', color: 'var(--warn)' },
  { band: 'At risk', range: 'Below 40', color: 'var(--severe)' },
]

const SEVERITIES = [
  { sev: 'Critical', desc: 'A genuine blocker — keyboard traps, globally removed focus, unlabeled inputs on a conversion path. Caps the whole site at 55. Reserved for issues that truly stop people.' },
  { sev: 'High', desc: 'A real problem that materially hurts experience, conversion, or compliance. Several of these pull the ceiling down hard.' },
  { sev: 'Medium', desc: 'Worth addressing — friction or weakness that degrades quality without blocking.' },
  { sev: 'Low', desc: 'Minor polish; safe to batch.' },
]

function CapTable({ rows }: { rows: Array<{ profile: string; cap: string }> }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 px-5 py-3.5"
          style={{ borderTop: i === 0 ? undefined : '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}
        >
          <span className="text-[14px] text-ink-2 font-sans">{r.profile}</span>
          <span className="text-[15px] font-semibold tabular-nums text-ink font-sans flex-shrink-0">{r.cap}</span>
        </div>
      ))}
    </div>
  )
}

export default function MethodologyContent() {
  return (
    <main id="main-content">
      {/* 00 — Intro */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5 text-center">
          <SectionMarker number="00" label="Methodology" centered />
          <h1
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6"
            style={{ fontSize: 'clamp(44px, 7vw, 92px)' }}
          >
            We show{' '}
            <em className="italic text-signal">our work.</em>
          </h1>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[620px] mx-auto font-sans">
            Every number Fixpath puts on screen is derived, capped, and traceable to evidence.
            Here is exactly how scoring works, what each finding is backed by, and when we refund.
            No invented urgency, no fabricated numbers, no black box.
          </p>
        </div>
      </section>

      {/* 01 — Evidence tiers */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="01" label="Evidence behind every finding" centered />
          <h2 className="font-serif font-normal text-ink leading-[1.0] tracking-[-0.02em] mb-5 text-center" style={{ fontSize: 'clamp(34px, 5vw, 64px)' }}>
            Two tiers, plus honesty.
          </h2>
          <p className="text-[16px] leading-[1.6] text-ink-2 max-w-[620px] mx-auto mb-12 font-sans text-center">
            Some issues an instrument can measure. Some need expert interpretation. We never blur
            the two — each finding is tagged so you know precisely what is behind it.
          </p>
          <div className="max-w-[820px] mx-auto grid grid-cols-1 gap-4">
            {EVIDENCE_TIERS.map((t) => (
              <div key={t.label} className="rounded-xl px-6 py-5 flex items-start gap-4" style={{ border: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)', background: 'var(--card)' }}>
                <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${t.color} 12%, transparent)` }}>
                  <t.Icon size={18} style={{ color: t.color }} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[16px] font-semibold text-ink font-sans mb-1">{t.label}</h3>
                  <p className="text-[14px] leading-[1.55] text-ink-2 font-sans mb-2">{t.desc}</p>
                  <p className="text-[12.5px] leading-[1.5] text-ink-3 font-sans" style={{ color: 'var(--m-muted)' }}><span className="font-medium">Sources:</span> {t.sources}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[13px] leading-[1.6] text-ink-2 max-w-[620px] mx-auto mt-8 font-sans text-center" style={{ color: 'var(--m-muted)' }}>
            A clean, well-built site will show a smaller share of &ldquo;Verified&rdquo; findings — not because we
            measured less, but because there were fewer hard defects to measure. Low verified share on a
            polished site is honest, not a gap.
          </p>
        </div>
      </section>

      {/* 02 — How the score works */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="02" label="How the score is built" centered />
          <h2 className="font-serif font-normal text-ink leading-[1.0] tracking-[-0.02em] mb-5 text-center" style={{ fontSize: 'clamp(34px, 5vw, 64px)' }}>
            A verdict, not an average.
          </h2>
          <p className="text-[16px] leading-[1.6] text-ink-2 max-w-[680px] mx-auto mb-10 font-sans text-center">
            Your overall score is <span className="text-ink font-medium">capped by your most severe open issues</span>,
            not averaged across categories. A site can score well on twenty-seven checks and still be held
            down by one critical defect — because that defect is what actually hurts your visitors. We
            don&rsquo;t water down the coffee.
          </p>

          <div className="max-w-[680px] mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <Gauge size={15} style={{ color: 'var(--ink)' }} />
              <h3 className="text-[14px] font-semibold text-ink font-sans">Overall site score ceiling</h3>
            </div>
            <CapTable rows={OVERALL_CAPS} />

            <div className="flex items-center gap-2 mb-3 mt-10">
              <Gauge size={15} style={{ color: 'var(--ink)' }} />
              <h3 className="text-[14px] font-semibold text-ink font-sans">Per-module ceiling (stricter)</h3>
            </div>
            <p className="text-[13px] leading-[1.55] text-ink-2 mb-4 font-sans" style={{ color: 'var(--m-muted)' }}>
              Each module covers a quarter of the audit, so its thresholds are tighter — two high-severity
              issues in one module is proportionally worse than two spread across the whole site.
            </p>
            <CapTable rows={MODULE_CAPS} />
          </div>

          {/* Score bands */}
          <div className="max-w-[680px] mx-auto mt-14">
            <h3 className="text-[14px] font-semibold text-ink font-sans mb-4 text-center">What the number means</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {BANDS.map((b) => (
                <div key={b.band} className="rounded-xl px-4 py-4 text-center" style={{ border: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
                  <div className="text-[14px] font-semibold font-sans" style={{ color: b.color }}>{b.band}</div>
                  <div className="text-[12px] mt-1 font-sans" style={{ color: 'var(--m-muted)' }}>{b.range}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 03 — Severity */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="03" label="What severity means" centered />
          <h2 className="font-serif font-normal text-ink leading-[1.0] tracking-[-0.02em] mb-12 text-center" style={{ fontSize: 'clamp(34px, 5vw, 64px)' }}>
            Severity is earned.
          </h2>
          <div className="max-w-[760px] mx-auto rounded-xl overflow-hidden" style={{ border: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)' }}>
            {SEVERITIES.map((s, i) => (
              <div key={s.sev} className="flex items-start gap-4 px-6 py-4" style={{ borderTop: i === 0 ? undefined : '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}>
                <span className="text-[14px] font-semibold text-ink font-sans w-[72px] flex-shrink-0">{s.sev}</span>
                <span className="text-[14px] leading-[1.55] text-ink-2 font-sans">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 04 — Refund */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5 text-center">
          <SectionMarker number="04" label="When we refund" centered />
          <h2 className="font-serif font-normal text-ink leading-[1.0] tracking-[-0.02em] mb-6" style={{ fontSize: 'clamp(34px, 5vw, 64px)' }}>
            We only charge when we have something{' '}
            <em className="italic text-signal">of value.</em>
          </h2>
          <div className="max-w-[640px] mx-auto flex items-start gap-3 text-left rounded-xl px-6 py-5" style={{ border: '1px solid color-mix(in srgb, var(--ink) 10%, transparent)', background: 'var(--card)' }}>
            <AlertTriangle size={18} style={{ color: 'var(--warn)' }} className="flex-shrink-0 mt-0.5" />
            <p className="text-[15px] leading-[1.6] text-ink-2 font-sans">
              If an audit produces zero findings because something on our side failed, we
              <span className="text-ink font-medium"> fail the audit and refund the credit</span> — we never ship a
              fabricated score to cover a broken run. If an audit genuinely finds nothing because your
              site is clean, that is a real, verified result and it stands. You are charged for evidence,
              not for activity.
            </p>
          </div>
        </div>
      </section>

      <HomeCta />
    </main>
  )
}
