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
              style={{ fontSize: 'clamp(36px, 4.5vw, 56px)' }}
            >
              Fix issues directly{' '}
              <em className="italic text-signal">inside WordPress.</em>
            </h2>
            <p className="text-[17px] leading-[1.6] text-ink-2 mb-8 font-sans">
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

          {/* WordPress dashboard mockup */}
          <div className="rounded-[4px] overflow-hidden border border-rule" style={{ background: 'var(--paper-2)' }}>
            <div className="px-5 py-3 border-b border-rule flex items-center gap-2.5">
              <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted">
                WordPress admin
              </span>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-7 h-7 rounded bg-signal flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7.5L5.5 10L11 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <span className="font-sans text-[14px] font-medium text-ink">Fixpath Audit Results</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { page: '/about', issues: 3, score: 71 },
                  { page: '/pricing', issues: 5, score: 58 },
                  { page: '/contact', issues: 1, score: 84 },
                ].map((p) => (
                  <div key={p.page} className="flex items-center justify-between p-3 rounded border border-rule" style={{ background: 'var(--paper)' }}>
                    <span className="font-mono text-[12px] text-ink">{p.page}</span>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-[11px] text-m-muted">{p.issues} issues</span>
                      <span className="font-mono text-[11px] font-medium" style={{ color: p.score >= 70 ? 'var(--ok)' : p.score >= 50 ? 'var(--warn)' : 'var(--severe)' }}>{p.score}</span>
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
