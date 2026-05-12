import { SectionMarker } from './SectionMarker'

/* ── Card data — 3 severity tiers, each with competitor vs ClearUX ── */

const cards = [
  {
    severity: 'critical' as const,
    label: 'Critical',
    category: 'Dark Patterns',
    competitor: {
      tool: 'SEO tools',
      title: 'Missing meta description',
      detail: 'Page /pricing has no meta description tag. Search engines will auto-generate a snippet.',
      verdict: 'Technical. Fixable in 2 minutes.',
    },
    clearux: {
      title: 'Forced urgency creates false scarcity',
      detail: '"Only 2 left!" counter resets on every visit. Users who notice lose trust in all pricing claims.',
      verdict: 'Trust-destroying. Costing you customers silently.',
    },
  },
  {
    severity: 'high' as const,
    label: 'High',
    category: 'Inclusive Design',
    competitor: {
      tool: 'Accessibility scanners',
      title: 'Image missing alt text',
      detail: '3 images on /about lack alt attributes. Automated check — no context on impact or priority.',
      verdict: 'A checklist item. No business context.',
    },
    clearux: {
      title: 'Checkout flow not keyboard-operable',
      detail: 'Payment form traps focus inside the card number field. Tab key skips the "Pay" button. Users on keyboard or switch devices cannot complete purchase.',
      verdict: 'Revenue lost. Real users blocked from paying.',
    },
  },
  {
    severity: 'medium' as const,
    label: 'Medium',
    category: 'AI Readiness',
    competitor: {
      tool: 'Performance tools',
      title: 'Render-blocking JavaScript',
      detail: 'Two scripts delay first contentful paint by 0.4s. Lighthouse flags it as an optimization opportunity.',
      verdict: 'A speed metric. Marginal improvement.',
    },
    clearux: {
      title: 'Content invisible to AI assistants',
      detail: 'Product pricing is rendered via client-side JS only. LLMs and AI agents cannot extract your plans. You are invisible in AI-generated recommendations.',
      verdict: 'Invisible to the next generation of discovery.',
    },
  },
]

/* ── Severity colors ──────────────────────────────────────── */

const sevColors: Record<string, { dot: string; text: string }> = {
  critical: { dot: 'var(--severe)', text: 'var(--severe)' },
  high:     { dot: 'var(--warn)',   text: 'var(--warn)' },
  medium:   { dot: 'var(--signal)', text: 'var(--signal)' },
}

/* ── Component ─────────────────────────────────────────────── */

export function Comparison() {
  return (
    <>
      {/* ── Dark interstitial banner ────────────────────────── */}
      <section
        className="py-[120px] max-sm:py-[80px]"
        style={{ background: 'var(--ink)', color: 'var(--paper)' }}
      >
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5 text-center">
          {/* Line 1 — smaller, muted: the competitor reality */}
          <p
            className="font-serif font-normal italic leading-[1.2] tracking-[-0.01em] mx-auto mb-5 max-sm:mb-4"
            style={{ fontSize: 'clamp(18px, 2.4vw, 28px)', color: 'var(--m-muted)', maxWidth: '720px' }}
          >
            Other tools measure how happy Google is with your site.
          </p>
          {/* Line 2 — larger, bright signal: our promise */}
          <p
            className="font-serif font-normal leading-[1.05] tracking-[-0.025em] mx-auto"
            style={{ fontSize: 'clamp(36px, 5.6vw, 72px)', color: 'var(--signal)', maxWidth: '820px' }}
          >
            ClearUX audits the human experience.
          </p>
        </div>
      </section>

      {/* ── The difference — 3 comparison cards ─────────────── */}
      <section className="py-[120px] max-sm:py-[80px] border-b border-rule">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">

          {/* Section header */}
          <div className="mb-16 max-sm:mb-10">
            <SectionMarker number="02" label="The difference" />
            <h2
              className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.022em]"
              style={{ fontSize: 'clamp(36px, 4.8vw, 64px)' }}
            >
              Same site.{' '}
              <em className="italic text-m-muted">Different</em>{' '}
              findings.
            </h2>
            <p className="text-[17px] leading-[1.55] text-ink-2 font-sans mt-5 max-w-[540px]">
              Three real findings, side by side. What traditional tools flag versus what ClearUX surfaces.
            </p>
          </div>

          {/* 3 cards */}
          <div className="grid lg:grid-cols-3 gap-5 max-lg:grid-cols-1">
            {cards.map((card) => {
              const colors = sevColors[card.severity]
              return (
                <div
                  key={card.severity}
                  className="rounded-xl overflow-hidden flex flex-col"
                  style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}
                >
                  {/* Card header — severity + category */}
                  <div
                    className="px-6 py-4 flex items-center justify-between"
                    style={{ borderBottom: '1px solid var(--rule)' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: colors.dot }}
                      />
                      <span
                        className="font-mono text-[11px] tracking-[0.1em] uppercase font-semibold"
                        style={{ color: colors.text }}
                      >
                        {card.label}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] tracking-[0.06em] uppercase text-m-muted">
                      {card.category}
                    </span>
                  </div>

                  {/* Competitor side — faded, forgettable */}
                  <div className="px-6 py-5 opacity-60" style={{ borderBottom: '1px solid var(--rule)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="font-mono text-[10px] tracking-[0.08em] uppercase font-medium px-2 py-0.5 rounded"
                        style={{ background: 'var(--paper-2)', color: 'var(--m-muted)' }}
                      >
                        {card.competitor.tool}
                      </span>
                    </div>
                    <p className="text-[13px] font-sans font-medium text-m-muted leading-[1.35] mb-1.5">
                      {card.competitor.title}
                    </p>
                    <p className="text-[12px] font-sans text-m-muted/80 leading-[1.5] mb-3">
                      {card.competitor.detail}
                    </p>
                    <p className="text-[11px] font-mono tracking-[0.02em] text-m-muted/60 italic">
                      {card.competitor.verdict}
                    </p>
                  </div>

                  {/* ClearUX side — bold, high-contrast, unmissable */}
                  <div
                    className="px-6 py-5 flex-1"
                    style={{ background: 'color-mix(in srgb, var(--signal) 6%, transparent)' }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="font-mono text-[10px] tracking-[0.08em] uppercase font-semibold px-2.5 py-1 rounded"
                        style={{ background: 'color-mix(in srgb, var(--signal) 16%, transparent)', color: 'var(--signal)' }}
                      >
                        ClearUX
                      </span>
                    </div>
                    <p className="text-[15px] font-sans font-semibold text-ink leading-[1.35] mb-2">
                      {card.clearux.title}
                    </p>
                    <p className="text-[13px] font-sans text-ink-2 leading-[1.55] mb-3">
                      {card.clearux.detail}
                    </p>
                    <p
                      className="text-[12px] font-mono tracking-[0.02em] font-semibold"
                      style={{ color: 'var(--signal)' }}
                    >
                      {card.clearux.verdict}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bottom stat strip */}
          <div className="grid sm:grid-cols-3 mt-14 gap-8 sm:gap-0 sm:divide-x sm:divide-rule">
            <div className="text-center sm:px-6">
              <p className="font-serif text-[48px] text-ink tracking-[-0.02em] leading-none mb-2">96</p>
              <p className="font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase">UX checkpoints per audit</p>
            </div>
            <div className="text-center sm:px-6">
              <p className="font-serif text-[48px] text-ink tracking-[-0.02em] leading-none mb-2">6</p>
              <p className="font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase">modules — foundation to AI readiness</p>
            </div>
            <div className="text-center sm:px-6">
              <p className="font-serif text-[48px] tracking-[-0.02em] leading-none mb-2" style={{ color: 'var(--signal)' }}>$0</p>
              <p className="font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase">first audit, no card required</p>
            </div>
          </div>

        </div>
      </section>
    </>
  )
}
