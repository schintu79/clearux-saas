import { Button } from './Button'
import { ArrowRightIcon } from './icons'

export function HomeHero() {
  return (
    <section className="py-20 sm:py-[100px] border-b border-rule">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="max-w-[780px]">
          <p className="font-mono text-[11px] tracking-[0.12em] uppercase text-signal mb-6">
            AI-powered website audits
          </p>
          <h1
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-7"
            style={{ fontSize: 'clamp(48px, 6.5vw, 88px)' }}
          >
            Find the issues hurting your site.{' '}
            <em className="italic text-signal">Follow the path to fix them.</em>
          </h1>
          <p className="text-[19px] leading-[1.6] text-ink-2 max-w-[600px] mb-10 font-sans">
            Fixpath audits your website across 96 checkpoints, turns every issue into a clear
            action, and tracks improvement over time. Your first audit is free.
          </p>
          <div className="flex gap-3.5 max-sm:flex-col max-sm:items-stretch">
            <Button href="/register" size="large">
              Start free audit
              <ArrowRightIcon size={14} />
            </Button>
            <Button href="/product" variant="ghost" size="large">
              See how it works
            </Button>
          </div>
        </div>

        {/* Dashboard preview — mirrors real Fixpath overview layout */}
        <div className="mt-16 rounded-[6px] overflow-hidden border border-rule" style={{ background: 'var(--paper-2)' }}>
          <div className="px-5 py-3.5 border-b border-rule flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--rule-2)' }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--rule-2)' }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--rule-2)' }} />
            </div>
            <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted">
              fixpath.ai / dashboard / overview
            </span>
          </div>
          <div className="p-5 sm:p-8">
            {/* Top row: Score + severity breakdown + score trend */}
            <div className="grid sm:grid-cols-[180px_1fr_1fr] gap-4 mb-5">
              {/* Health score card */}
              <div className="rounded-[4px] p-5 border border-rule flex flex-col items-center justify-center" style={{ background: 'var(--paper)' }}>
                <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-m-muted mb-2">Health Score</p>
                <p className="font-serif text-[56px] font-normal tracking-[-0.04em] text-ink leading-none mb-1">62</p>
                <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-warn">Needs work</p>
              </div>
              {/* Severity breakdown */}
              <div className="rounded-[4px] p-5 border border-rule" style={{ background: 'var(--paper)' }}>
                <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-m-muted mb-3">Findings by severity</p>
                <div className="space-y-2">
                  {[
                    { label: 'Critical', count: 4, color: 'var(--severe)', width: '25%' },
                    { label: 'Medium', count: 11, color: 'var(--warn)', width: '65%' },
                    { label: 'Minor', count: 8, color: 'var(--m-muted)', width: '45%' },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-3">
                      <span className="font-mono text-[10px] w-[52px] shrink-0" style={{ color: s.color }}>{s.count} {s.label.toLowerCase()}</span>
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--rule)' }}>
                        <div className="h-full rounded-full" style={{ width: s.width, background: s.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Score trend mini-chart */}
              <div className="rounded-[4px] p-5 border border-rule" style={{ background: 'var(--paper)' }}>
                <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-m-muted mb-3">Score trend</p>
                <div className="flex items-end gap-2 h-[52px]">
                  {[42, 48, 55, 58, 62].map((score, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-[2px]"
                        style={{
                          height: `${score * 0.7}px`,
                          background: i === 4 ? 'var(--signal)' : 'var(--rule-2)',
                        }}
                      />
                      <span className="font-mono text-[8px] text-m-muted">{score}</span>
                    </div>
                  ))}
                </div>
                <p className="font-mono text-[9px] text-signal mt-2">+20 pts over 5 audits</p>
              </div>
            </div>

            {/* Module scores grid — mirrors real 6-module layout */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-px rounded-[4px] overflow-hidden mb-5" style={{ background: 'var(--rule)' }}>
              {[
                { name: 'Foundation', score: 68 },
                { name: 'Human exp.', score: 55 },
                { name: 'Inclusive', score: 72 },
                { name: 'Future', score: 48 },
                { name: 'Brand', score: 71 },
                { name: 'SEO', score: 66 },
              ].map((mod) => (
                <div key={mod.name} className="p-3 text-center" style={{ background: 'var(--paper)' }}>
                  <p className="font-mono text-[8px] tracking-[0.06em] uppercase text-m-muted mb-1">{mod.name}</p>
                  <p className="font-serif text-[22px] font-normal tracking-[-0.02em] leading-none" style={{ color: mod.score >= 70 ? 'var(--ok)' : mod.score >= 50 ? 'var(--warn)' : 'var(--severe)' }}>{mod.score}</p>
                </div>
              ))}
            </div>

            {/* Top findings list — mirrors real findings table */}
            <div className="rounded-[4px] border border-rule overflow-hidden" style={{ background: 'var(--paper)' }}>
              <div className="px-4 py-2.5 border-b border-rule" style={{ background: 'var(--paper-2)' }}>
                <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-m-muted">Top findings</span>
              </div>
              {[
                { sev: 'Critical', sevColor: 'var(--severe)', label: 'Login flow uses 3 dark-pattern signals that erode trust', cat: 'Human exp.', pages: 2 },
                { sev: 'Critical', sevColor: 'var(--severe)', label: 'LLM agents misread your pricing page structure', cat: 'Future', pages: 1 },
                { sev: 'Medium', sevColor: 'var(--warn)', label: 'Primary CTA contrast fails WCAG AA on hover state', cat: 'Inclusive', pages: 4 },
                { sev: 'Minor', sevColor: 'var(--m-muted)', label: 'Hero meta description exceeds 158 characters', cat: 'SEO', pages: 1 },
              ].map((f, i) => (
                <div key={f.label} className={`px-4 py-3 flex items-center gap-3 ${i < 3 ? 'border-b border-rule' : ''}`}>
                  <span
                    className="font-mono text-[8px] font-semibold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-[2px] shrink-0"
                    style={{ color: f.sevColor, background: `color-mix(in srgb, ${f.sevColor} 12%, transparent)` }}
                  >
                    {f.sev}
                  </span>
                  <p className="font-sans text-[13px] text-ink leading-snug flex-1 min-w-0 truncate">{f.label}</p>
                  <span className="font-mono text-[9px] text-m-muted tracking-[0.06em] uppercase shrink-0 hidden sm:block">{f.cat}</span>
                  <span className="font-mono text-[9px] text-m-muted shrink-0 hidden sm:block">{f.pages}p</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 sm:gap-9 pt-10 mt-10 border-t border-rule font-mono text-[11px] text-m-muted tracking-[0.06em] uppercase">
          <div>
            <strong className="block font-serif text-[28px] sm:text-[36px] text-ink font-normal tracking-[-0.02em] normal-case mb-0.5">96</strong>
            Checkpoints per audit
          </div>
          <div>
            <strong className="block font-serif text-[28px] sm:text-[36px] text-ink font-normal tracking-[-0.02em] normal-case mb-0.5">&lt; 10 min</strong>
            Audit delivery
          </div>
          <div>
            <strong className="block font-serif text-[28px] sm:text-[36px] text-ink font-normal tracking-[-0.02em] normal-case mb-0.5">Free</strong>
            First audit, no card
          </div>
        </div>
      </div>
    </section>
  )
}
