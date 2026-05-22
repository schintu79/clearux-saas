import { SectionMarker } from './SectionMarker'
import { Button } from './Button'
import { ArrowRightIcon } from './icons'

export function HomeWordPress() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <SectionMarker number="04" label="WordPress" />
            <h2
              className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5"
              style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
            >
              Fix issues directly{' '}
              <em className="italic text-signal">inside WordPress.</em>
            </h2>
            <p className="text-[18px] leading-[1.6] text-ink-2 mb-8 font-sans">
              The Fixpath WordPress plugin brings audit findings into your admin panel.
              See which pages need attention, apply recommended fixes, and re-audit without
              leaving your CMS.
            </p>
            <div className="flex gap-3.5 max-sm:flex-col">
              <Button href="/wordpress">
                Learn more
                <ArrowRightIcon size={14} />
              </Button>
            </div>
          </div>

          {/* WordPress admin mockup — mirrors real plugin panel */}
          <div className="rounded-[4px] overflow-hidden border border-rule" style={{ background: 'var(--paper-2)' }}>
            <div className="px-5 py-3 border-b border-rule flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded bg-signal flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M3 7.5L5.5 10L11 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted">
                  Fixpath / WordPress
                </span>
              </div>
              <span className="font-mono text-[9px] tracking-[0.06em] uppercase text-signal">Connected</span>
            </div>
            {/* Score summary */}
            <div className="px-5 py-4 border-b border-rule flex items-center gap-5">
              <div className="text-center">
                <p className="font-serif text-[32px] font-normal tracking-[-0.02em] text-ink leading-none">62</p>
                <p className="font-mono text-[8px] tracking-[0.08em] uppercase text-m-muted mt-1">Score</p>
              </div>
              <div className="flex-1 space-y-1.5">
                {[
                  { label: 'Critical', count: 4, color: 'var(--severe)' },
                  { label: 'Medium', count: 8, color: 'var(--warn)' },
                  { label: 'Minor', count: 5, color: 'var(--m-muted)' },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="font-mono text-[10px] text-ink-2">{s.count} {s.label.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Page-level findings */}
            <div className="p-5">
              <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-m-muted mb-3">Pages with issues</p>
              <div className="space-y-2">
                {[
                  { page: '/about', issues: 3, sev: 'medium', score: 71 },
                  { page: '/pricing', issues: 5, sev: 'critical', score: 58 },
                  { page: '/contact', issues: 1, sev: 'minor', score: 84 },
                  { page: '/blog', issues: 4, sev: 'medium', score: 63 },
                ].map((p) => (
                  <div key={p.page} className="flex items-center justify-between p-2.5 rounded border border-rule" style={{ background: 'var(--paper)' }}>
                    <div className="flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.sev === 'critical' ? 'var(--severe)' : p.sev === 'medium' ? 'var(--warn)' : 'var(--m-muted)' }} />
                      <span className="font-mono text-[11px] text-ink">{p.page}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-m-muted">{p.issues}</span>
                      <span className="font-mono text-[10px] font-medium" style={{ color: p.score >= 70 ? 'var(--ok)' : p.score >= 50 ? 'var(--warn)' : 'var(--severe)' }}>{p.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
