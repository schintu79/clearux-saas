'use client'

import { SectionMarker } from '@/components/marketing/SectionMarker'
import { HomeCta } from '@/components/marketing/HomeCta'
import { AlertTriangle, ShieldOff, RefreshCcw, HelpCircle, Eye, Shield, Wrench, Filter, FileText, GitCompareArrows, AlertCircle, Scale, History, LineChart, Users } from 'lucide-react'

/**
 * WhyFixpathContent — "Why Fixpath" page per the brief.
 *
 * Sections:
 * 1. The problem with generic audits
 * 2. What teams actually need
 * 3. The Fixpath philosophy: truth, trust, usefulness
 * 4. How we report real issues
 * 5. Why tracking matters more than one-time reports
 * 6. CTA
 */

const NOISE_PROBLEMS = [
  {
    title: 'Reports feel noisy',
    desc: 'Generic audit tools flag everything. Teams get 200+ issues and no way to tell which ten actually matter. The result is analysis paralysis, not action.',
    Icon: AlertTriangle,
    color: '#F59E0B',
  },
  {
    title: 'Scores lose trust',
    desc: 'When every audit finds new problems regardless of what you fixed, scores stop meaning anything. Teams stop checking. Progress stalls.',
    Icon: ShieldOff,
    color: '#EF4444',
  },
  {
    title: 'Repeated findings kill credibility',
    desc: 'The same issues appear in every report, even after they have been addressed. Without lifecycle tracking, tools cannot distinguish old from new.',
    Icon: RefreshCcw,
    color: '#8B5CF6',
  },
  {
    title: 'Advice stays vague',
    desc: 'Most tools tell you something is wrong, but stop there. Teams are left guessing how to fix issues, who should own them, and how to verify the fix.',
    Icon: HelpCircle,
    color: '#6B7280',
  },
]

const TEAM_NEEDS = [
  'Clear priority: which issues are actually hurting the site right now',
  'Concrete fixes: what to do, where to do it, and how to verify it worked',
  'Progress evidence: proof that things are getting better over time',
  'Honest assessment: no inflated scores, no manufactured urgency',
  'Useful categories: not just SEO checklists, but trust, clarity, accessibility, AI readiness',
]

const PHILOSOPHY_PILLARS = [
  {
    title: 'Truth',
    desc: 'We never invent issues to fill a report. If a category is strong, we say so. Scores reflect reality, not engagement mechanics.',
    Icon: Eye,
    color: '#10B981',
  },
  {
    title: 'Trust',
    desc: 'Every finding includes evidence. Every recommendation is specific. Every score is earned. The product builds trust by telling the truth consistently.',
    Icon: Shield,
    color: '#3B82F6',
  },
  {
    title: 'Usefulness',
    desc: 'Findings without fix guidance are just noise. Every Fixpath finding comes with a concrete action: code diffs, copy suggestions, or step-by-step recommendations.',
    Icon: Wrench,
    color: '#F59E0B',
  },
]

const REPORTING_DIFFERENCES = [
  {
    label: 'Severity-ranked findings',
    desc: 'Critical issues surface first. Minor items stay accessible but never dominate the view.',
    Icon: Filter,
    color: '#EF4444',
  },
  {
    label: 'Real evidence per finding',
    desc: 'Every issue includes the affected page, element, current state, and proposed fix — not a generic description.',
    Icon: FileText,
    color: '#3B82F6',
  },
  {
    label: 'Issue lifecycle tracking',
    desc: 'Fixpath tracks whether findings are new, still active, improved, fixed, or regressed across audits.',
    Icon: GitCompareArrows,
    color: '#EC4899',
  },
  {
    label: 'Regression detection',
    desc: 'When something that was working starts failing again, Fixpath flags it as a regression — not a new issue.',
    Icon: AlertCircle,
    color: '#F59E0B',
  },
  {
    label: 'Honest scoring',
    desc: 'Recommendation-only items cap their score impact. Deep audits require higher evidence bars. Scores are never inflated.',
    Icon: Scale,
    color: '#10B981',
  },
]

export function WhyFixpathContent() {
  return (
    <main>
      {/* Hero */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="00" label="Why Fixpath" />
          <h1
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-8"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            Noise is the norm.{' '}
            <em className="italic text-signal">We built clarity.</em>
          </h1>
          <p className="text-[19px] leading-[1.55] text-ink-2 max-w-[640px] mb-10 font-sans">
            Fixpath exists because too many teams get generic reports full of low-signal
            findings instead of useful truth they can act on. We built a system around
            clarity, honest scoring, and real progress tracking.
          </p>
        </div>
      </section>

      {/* Section 1 — The problem with generic audits */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="01" label="The problem" />
          <h2
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-14"
            style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
          >
            Why teams stop trusting audit tools
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            {NOISE_PROBLEMS.map((item) => (
              <div key={item.title} className="rounded-xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)` }}>
                  <item.Icon size={20} style={{ color: item.color }} />
                </div>
                <h3 className="font-sans text-[16px] font-semibold text-ink mb-3">{item.title}</h3>
                <p className="font-sans text-[15px] text-ink-2 leading-[1.65]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2 — What teams actually need */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="02" label="What teams need" />
          <h2
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-14"
            style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
          >
            Not more findings.{' '}
            <em className="italic text-signal">Better answers.</em>
          </h2>

          <div className="max-w-[640px] rounded-xl p-6 sm:p-8" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <div className="space-y-5">
              {TEAM_NEEDS.map((need) => (
                <div key={need} className="flex items-start gap-3.5">
                  <span className="w-5 h-5 rounded-full shrink-0 mt-0.5 inline-flex items-center justify-center" style={{ background: 'var(--signal-soft)' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 6l2 2 4-4" stroke="var(--signal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span className="font-sans text-[15px] text-ink leading-[1.6]">{need}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 — The Fixpath philosophy */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="03" label="Our philosophy" />
          <h2
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-14"
            style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
          >
            Truth. Trust. Usefulness.
          </h2>

          <div className="grid lg:grid-cols-3 gap-4">
            {PHILOSOPHY_PILLARS.map((p) => (
              <div key={p.title} className="rounded-xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `color-mix(in srgb, ${p.color} 12%, transparent)` }}>
                  <p.Icon size={20} style={{ color: p.color }} />
                </div>
                <h3 className="font-serif text-[32px] font-normal text-ink tracking-[-0.02em] mb-4">{p.title}</h3>
                <p className="font-sans text-[15px] text-ink-2 leading-[1.65]">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4 — How we report real issues */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="04" label="How we report" />
          <h2
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5"
            style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
          >
            Real issues.{' '}
            <em className="italic text-signal">Real evidence.</em>
          </h2>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mb-14 font-sans">
            Every finding in Fixpath is backed by evidence from your actual site content,
            ranked by severity, and paired with a concrete fix.
          </p>

          <div className="space-y-3">
            {REPORTING_DIFFERENCES.map((d) => (
              <div key={d.label} className="rounded-xl p-6 flex items-start gap-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${d.color} 12%, transparent)` }}>
                  <d.Icon size={20} style={{ color: d.color }} />
                </div>
                <div>
                  <h3 className="font-sans text-[15px] font-semibold text-ink mb-1.5">{d.label}</h3>
                  <p className="font-sans text-[14px] text-ink-2 leading-[1.6]">{d.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5 — Why tracking matters */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="05" label="Why tracking matters" />
          <h2
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5"
            style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
          >
            One-time reports are not enough.
          </h2>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[600px] mb-14 font-sans">
            A single audit tells you where you stand. But websites change constantly — new
            content, design updates, third-party code, team turnover. Fixpath tracks your
            site over time so you always know whether things are getting better or worse.
          </p>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                title: 'Score history',
                desc: 'See your health score trend across every audit. Know exactly when things improved and when they regressed.',
                Icon: LineChart,
                color: '#3B82F6',
              },
              {
                title: 'Issue lifecycle',
                desc: 'Track every finding from discovery through fix to verification. Know what is new, what is still active, and what has been resolved.',
                Icon: History,
                color: '#8B5CF6',
              },
              {
                title: 'Proof for stakeholders',
                desc: 'Share concrete progress data with your team, clients, or leadership. One metric that shows real improvement over time.',
                Icon: Users,
                color: '#10B981',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)` }}>
                  <item.Icon size={20} style={{ color: item.color }} />
                </div>
                <h3 className="font-sans text-[15px] font-semibold text-ink mb-2">{item.title}</h3>
                <p className="font-sans text-[14px] text-ink-2 leading-[1.6]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <HomeCta />
    </main>
  )
}
