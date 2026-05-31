import { SectionMarker } from './SectionMarker'
import { Filter, Layers, Code2, GitCompareArrows, Scale } from 'lucide-react'

/**
 * HomeDifferentiator — "Why we are different" section.
 * Shows HOW Fixpath works differently in detail — not just contrast statements.
 * Each card explains a real product behavior with depth.
 */

const FEATURES = [
  {
    Icon: Filter,
    color: '#10B981',
    title: 'Aggressive noise filtering',
    desc: 'Every finding passes through speculative detection, evidence verification, and relevance scoring before it reaches your report. If something cannot be proven from your actual content, it is dropped.',
    detail: 'Result: reports with 15–30 findings, not 200.',
  },
  {
    Icon: Scale,
    color: '#3B82F6',
    title: 'Deterministic scoring',
    desc: 'Your Website Health Score is calculated from a fixed formula — severity weights, scope multipliers, and confidence factors. Same inputs always produce the same score. No black-box AI scoring.',
    detail: 'Critical: -18pts · High: -12pts · Medium: -6pts · Low: -2pts',
  },
  {
    Icon: Code2,
    color: '#8B5CF6',
    title: 'Surgical fix generation',
    desc: 'For code-level issues, Fixpath reads your actual source file, generates a minimal diff that fixes only the flagged problem, and lets you preview and edit before deploying via FTP.',
    detail: 'Not a template. A fix built from your code.',
  },
  {
    Icon: GitCompareArrows,
    color: '#EC4899',
    title: 'Issue lifecycle tracking',
    desc: 'Every finding has a lifecycle state: new, still present, improved, fixed, or regressed. Re-audits reconcile against previous findings so resolved issues get credit and regressions get flagged.',
    detail: 'Fixes are verified. Progress is provable.',
  },
  {
    Icon: Layers,
    color: '#F59E0B',
    title: 'Seven-module depth',
    desc: 'Not just SEO and performance. Fixpath audits trust signals, accessibility (WCAG 2.1 AA), AI readiness, brand consistency, and ethical UX — all in a single run with 112 checkpoints.',
    detail: '28 categories · 4 per module · evidence-based.',
  },
]

export function HomeDifferentiator() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="03" label="How it actually works" />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5"
          style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
        >
          Built around truth,{' '}
          <em className="italic text-signal">not noise.</em>
        </h2>
        <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mb-14 font-sans">
          Every design decision in Fixpath serves one goal: give teams useful truth
          they can act on — and proof that acting on it made things better.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl p-6 flex flex-col"
              style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
            >
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 shrink-0"
                style={{ background: `color-mix(in srgb, ${f.color} 12%, transparent)`, color: f.color }}
              >
                <f.Icon size={20} strokeWidth={1.5} />
              </span>
              <h3 className="font-sans text-[15px] font-semibold text-ink mb-2">{f.title}</h3>
              <p className="font-sans text-[13px] text-ink-2 leading-[1.6] mb-3 flex-1">{f.desc}</p>
              <p className="font-mono text-[11px] tracking-[0.04em] text-m-muted pt-3" style={{ borderTop: '1px solid var(--rule)' }}>
                {f.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
