import { SectionMarker } from './SectionMarker'

/**
 * HomeWorkflow — "How it works" section.
 * Brief requirement: "one of the cleanest sections on the entire site."
 * Diagram-first, concise, shows the Find → Fix → Track flow.
 */

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
        <SectionMarker number="02" label="How it works" />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6"
          style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
        >
          Find. Fix. Track.
        </h2>
        <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mb-16 font-sans">
          Enter your URL. Get severity-ranked findings in minutes. Fix issues with
          concrete guidance. Re-audit to confirm improvement.
        </p>

        <div className="grid lg:grid-cols-3 gap-4 max-lg:grid-cols-1">
          {/* Find */}
          <div className="rounded-xl p-8 sm:p-10" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <StepNumber n="1" />
            <h3 className="font-sans text-[20px] font-semibold text-ink mt-5 mb-3">Find</h3>
            <p className="font-sans text-[15px] text-ink-2 leading-[1.65] mb-6">
              Fixpath crawls your pages, runs 112 checkpoints across seven modules,
              and delivers severity-ranked findings with evidence from your actual
              content. Most audits complete in under ten minutes.
            </p>
            <div className="space-y-3">
              {['Clarity and trust signals', 'Accessibility (WCAG 2.1)', 'AI visibility and readiness', 'SEO structure and content', 'Brand consistency', 'Technical performance'].map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <span className="w-1 h-1 rounded-full bg-signal shrink-0" />
                  <span className="font-sans text-[13px] text-ink-2">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fix */}
          <div className="rounded-xl p-8 sm:p-10" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <StepNumber n="2" />
            <h3 className="font-sans text-[20px] font-semibold text-ink mt-5 mb-3">Fix</h3>
            <p className="font-sans text-[15px] text-ink-2 leading-[1.65] mb-6">
              Every finding includes a concrete fix. Preview code diffs, edit them,
              and deploy to your server. For content issues, get clear recommendations
              your team can act on immediately.
            </p>
            <div className="space-y-3">
              {['Concrete code fixes with diff preview', 'One-click deploy via FTP/SFTP', 'Copy and content suggestions', 'Team-ready recommendation export', 'WordPress plugin integration', 'PDF and Word reports'].map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <span className="w-1 h-1 rounded-full bg-signal shrink-0" />
                  <span className="font-sans text-[13px] text-ink-2">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Track */}
          <div className="rounded-xl p-8 sm:p-10" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <StepNumber n="3" />
            <h3 className="font-sans text-[20px] font-semibold text-ink mt-5 mb-3">Track</h3>
            <p className="font-sans text-[15px] text-ink-2 leading-[1.65] mb-6">
              Re-audit after changes to confirm fixes landed. Compare scores,
              see which improvements had the biggest impact, and track
              progress over time with a single clear metric.
            </p>
            <div className="space-y-3">
              {['Score history and trends', 'Before/after comparison', 'Issue lifecycle tracking', 'Regression detection', 'Competitor benchmarking', 'Shareable progress reports'].map((item) => (
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
