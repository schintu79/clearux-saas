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

        {/* Dashboard preview */}
        <div className="mt-16 rounded-[6px] overflow-hidden border border-rule" style={{ background: 'var(--paper-2)' }}>
          <div className="px-5 py-3.5 border-b border-rule flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--rule-2)' }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--rule-2)' }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--rule-2)' }} />
            </div>
            <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted">
              fixpath.ai/dashboard
            </span>
          </div>
          <div className="p-6 sm:p-10">
            {/* Simulated dashboard content */}
            <div className="grid sm:grid-cols-[1fr_2fr] gap-6">
              {/* Score column */}
              <div className="rounded-[4px] p-6 border border-rule" style={{ background: 'var(--paper)' }}>
                <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-m-muted mb-3">Website Health Score</p>
                <p className="font-serif text-[64px] font-normal tracking-[-0.04em] text-ink leading-none mb-2">62</p>
                <p className="font-mono text-[10px] tracking-[0.08em] uppercase text-severe">4 critical issues</p>
                <div className="mt-5 pt-4 border-t border-rule space-y-2.5">
                  {['Foundation', 'Human experience', 'Inclusive design', 'Future readiness', 'Brand consistency', 'SEO structure'].map((mod, i) => (
                    <div key={mod} className="flex items-center justify-between">
                      <span className="font-sans text-[12px] text-ink-2">{mod}</span>
                      <span className="font-mono text-[11px] text-m-muted">{[68, 55, 72, 48, 71, 66][i]}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Findings column */}
              <div className="space-y-3">
                {[
                  { sev: 'Critical', sevColor: 'var(--severe)', label: 'Login flow uses 3 dark-pattern signals that erode trust', cat: 'Human experience' },
                  { sev: 'Critical', sevColor: 'var(--severe)', label: 'LLM agents misread your pricing page structure', cat: 'Future readiness' },
                  { sev: 'Medium', sevColor: 'var(--warn)', label: 'Primary CTA contrast fails WCAG AA on hover state', cat: 'Inclusive design' },
                  { sev: 'Minor', sevColor: 'var(--m-muted)', label: 'Hero meta description exceeds 158 characters', cat: 'SEO structure' },
                ].map((f) => (
                  <div key={f.label} className="rounded-[4px] p-4 border border-rule" style={{ background: 'var(--paper)' }}>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span
                        className="font-mono text-[9px] font-semibold tracking-[0.08em] uppercase px-2 py-0.5 rounded-[2px]"
                        style={{ color: f.sevColor, background: `color-mix(in srgb, ${f.sevColor} 12%, transparent)` }}
                      >
                        {f.sev}
                      </span>
                      <span className="font-mono text-[10px] text-m-muted tracking-[0.06em] uppercase">{f.cat}</span>
                    </div>
                    <p className="font-sans text-[14px] text-ink leading-snug">{f.label}</p>
                  </div>
                ))}
              </div>
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
