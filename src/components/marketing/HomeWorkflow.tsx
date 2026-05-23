import { SectionMarker } from './SectionMarker'

function StepNumber({ n }: { n: string }) {
  return (
    <span
      className="w-10 h-10 rounded-full inline-flex items-center justify-center font-mono text-[13px] font-semibold shrink-0"
      style={{ background: 'var(--signal-soft)', color: 'var(--signal)' }}
    >
      {n}
    </span>
  )
}

export function HomeWorkflow() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="01" label="How it works" />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6"
          style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
        >
          Find. Fix. Track.{' '}
          <em className="italic text-signal">The complete path.</em>
        </h2>
        <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mb-16 font-sans">
          Most audit tools stop at a list of problems. Fixpath gives you every step after:
          find what matters, fix it directly in the dashboard, and track improvement over time.
        </p>

        <div className="grid lg:grid-cols-3 gap-0 border border-rule rounded-[4px] overflow-hidden max-lg:grid-cols-1">
          {/* Find */}
          <div className="p-8 sm:p-10 lg:border-r border-rule max-lg:border-b">
            <StepNumber n="1" />
            <h3 className="font-sans text-[20px] font-semibold text-ink mt-5 mb-3">Find</h3>
            <p className="font-sans text-[15px] text-ink-2 leading-[1.65] mb-6">
              Enter your URL. Fixpath crawls every page, runs 96 checkpoints across six
              modules, and delivers severity-ranked findings with real evidence from your
              site content. Most audits complete in under ten minutes.
            </p>
            <div className="space-y-3">
              {['UX and usability', 'Accessibility (WCAG 2.1)', 'AI visibility and readiness', 'SEO structure', 'Brand consistency', 'Performance and trust'].map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <span className="w-1 h-1 rounded-full bg-signal shrink-0" />
                  <span className="font-sans text-[13px] text-ink-2">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fix */}
          <div className="p-8 sm:p-10 lg:border-r border-rule max-lg:border-b">
            <StepNumber n="2" />
            <h3 className="font-sans text-[20px] font-semibold text-ink mt-5 mb-3">Fix</h3>
            <p className="font-sans text-[15px] text-ink-2 leading-[1.65] mb-6">
              Every finding includes a concrete fix. Preview the code diff, edit it, and
              deploy directly to your server. For content issues, export a recommendation
              your team can act on. No ambiguous advice.
            </p>
            <div className="space-y-3">
              {['AI-generated code fixes', 'One-click deploy via FTP/SFTP', 'Editable diff preview', 'Team-ready recommendation export', 'WordPress plugin integration', 'PDF and Word reports'].map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <span className="w-1 h-1 rounded-full bg-signal shrink-0" />
                  <span className="font-sans text-[13px] text-ink-2">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Track */}
          <div className="p-8 sm:p-10">
            <StepNumber n="3" />
            <h3 className="font-sans text-[20px] font-semibold text-ink mt-5 mb-3">Track</h3>
            <p className="font-sans text-[15px] text-ink-2 leading-[1.65] mb-6">
              Re-audit after making changes to confirm fixes landed. Compare scores
              side by side, see which fixes had the biggest impact, and prove progress
              to your team over time.
            </p>
            <div className="space-y-3">
              {['Score history and trends', 'Before/after comparison', 'Competitor benchmarking', 'Finding status tracking', 'AI visibility over time', 'Shareable progress reports'].map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <span className="w-1 h-1 rounded-full bg-signal shrink-0" />
                  <span className="font-sans text-[13px] text-ink-2">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
