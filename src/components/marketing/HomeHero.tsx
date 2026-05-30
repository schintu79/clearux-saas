import { Button } from './Button'
import { SectionMarker } from './SectionMarker'
import { ArrowRightIcon } from './icons'

export function HomeHero() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="00" label="Website audit engine" />
        <h1
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-8"
          style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
        >
          Find what hurts trust.{' '}
          <em className="italic text-signal">Fix what matters.</em>
        </h1>
        <p className="text-[19px] leading-[1.55] text-ink-2 max-w-[640px] font-sans mb-10">
          Fixpath finds real issues across clarity, trust, accessibility, and technical quality
          — prioritizes them by impact, gives you fix guidance, and tracks whether
          things improve. No noise. No inflated scores. Just useful truth.
        </p>
        <div className="flex gap-3.5 max-sm:flex-col max-sm:items-stretch">
          <Button href="/register">
            Start free audit
            <ArrowRightIcon size={14} />
          </Button>
          <Button href="/how-it-works" variant="ghost">
            See how it works
          </Button>
        </div>

        {/* Dashboard preview — mirrors real Fixpath overview layout */}
        <div className="mt-16 rounded-xl overflow-hidden border border-rule shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)]" style={{ background: 'var(--paper-2)' }}>
          {/* Browser chrome */}
          <div className="px-5 py-3 border-b border-rule flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FF5F57' }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FEBC2E' }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#28C840' }} />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-2 px-4 py-1 rounded-md" style={{ background: 'var(--paper)' }}>
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--m-muted)" strokeWidth={2}><rect x={3} y={11} width={18} height={11} rx={2} /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                <span className="font-mono text-[10px] tracking-[0.04em] text-m-muted">
                  fixpath.ai/dashboard/overview
                </span>
              </div>
            </div>
          </div>
          <div className="p-5 sm:p-8">
            {/* Top row: Score + severity breakdown + score trend */}
            <div className="grid sm:grid-cols-[180px_1fr_1fr] gap-4 mb-5">
              {/* Health score card */}
              <div className="rounded-lg p-5 border border-rule flex flex-col items-center justify-center" style={{ background: 'var(--paper)' }}>
                <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-m-muted mb-2">Health score</p>
                <p className="font-serif text-[56px] font-normal tracking-[-0.04em] text-ink leading-none mb-1">62</p>
                <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-warn">Needs work</p>
              </div>
              {/* Severity breakdown */}
              <div className="rounded-lg p-5 border border-rule" style={{ background: 'var(--paper)' }}>
                <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-m-muted mb-3">Findings by severity</p>
                <div className="space-y-2.5">
                  {[
                    { label: 'Critical', count: 3, color: 'var(--severe)', width: '20%' },
                    { label: 'High', count: 7, color: '#F97316', width: '45%' },
                    { label: 'Medium', count: 12, color: 'var(--warn)', width: '70%' },
                    { label: 'Low', count: 5, color: 'var(--m-muted)', width: '30%' },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-3">
                      <span className="font-mono text-[10px] w-[56px] shrink-0" style={{ color: s.color }}>{s.count} {s.label.toLowerCase()}</span>
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--rule)' }}>
                        <div className="h-full rounded-full" style={{ width: s.width, background: s.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Score trend mini-chart */}
              <div className="rounded-lg p-5 border border-rule" style={{ background: 'var(--paper)' }}>
                <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-m-muted mb-3">Score trend</p>
                <div className="flex items-end gap-2 h-[52px]">
                  {[42, 48, 55, 58, 62].map((score, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-[3px]"
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

            {/* Module scores grid — mirrors real 7-module layout */}
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-px rounded-lg overflow-hidden mb-5" style={{ background: 'var(--rule)' }}>
              {[
                { name: 'Foundation', score: 68, color: '#3B82F6' },
                { name: 'Human exp.', score: 55, color: '#EC4899' },
                { name: 'Inclusive', score: 72, color: '#8B5CF6' },
                { name: 'Future', score: 48, color: '#F59E0B' },
                { name: 'Accessibility', score: 64, color: '#EF4444' },
                { name: 'Brand', score: 71, color: '#06B6D4' },
                { name: 'SEO', score: 66, color: '#10B981' },
              ].map((mod) => (
                <div key={mod.name} className="p-3 text-center" style={{ background: 'var(--paper)' }}>
                  <p className="font-mono text-[8px] tracking-[0.06em] uppercase text-m-muted mb-1">{mod.name}</p>
                  <p className="font-serif text-[22px] font-normal tracking-[-0.02em] leading-none" style={{ color: mod.score >= 70 ? 'var(--ok)' : mod.score >= 50 ? 'var(--warn)' : 'var(--severe)' }}>{mod.score}</p>
                </div>
              ))}
            </div>

            {/* Top findings list — mirrors real findings table */}
            <div className="rounded-lg border border-rule overflow-hidden" style={{ background: 'var(--paper)' }}>
              <div className="px-4 py-2.5 border-b border-rule flex items-center justify-between" style={{ background: 'var(--paper-2)' }}>
                <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-m-muted">Top findings</span>
                <span className="font-mono text-[9px] tracking-[0.06em] text-m-muted">27 total</span>
              </div>
              {[
                { sev: 'Critical', sevColor: 'var(--severe)', label: 'Login flow uses 3 dark-pattern signals that erode trust', cat: 'Human exp.', pages: 2 },
                { sev: 'High', sevColor: '#F97316', label: 'LLM agents misread your pricing page structure', cat: 'Future', pages: 1 },
                { sev: 'High', sevColor: '#F97316', label: 'Missing keyboard focus indicators on interactive elements', cat: 'Accessibility', pages: 4 },
                { sev: 'Medium', sevColor: 'var(--warn)', label: 'Primary CTA contrast fails WCAG AA on hover state', cat: 'Inclusive', pages: 3 },
                { sev: 'Low', sevColor: 'var(--m-muted)', label: 'Hero meta description exceeds 158 characters', cat: 'SEO', pages: 1 },
              ].map((f, i) => (
                <div key={f.label} className={`px-4 py-3 flex items-center gap-3 ${i < 4 ? 'border-b border-rule' : ''}`}>
                  <span
                    className="font-mono text-[8px] font-semibold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-[3px] shrink-0"
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
      </div>
    </section>
  )
}
