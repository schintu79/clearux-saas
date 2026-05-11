import { SectionMarker } from './SectionMarker'

/* ── Mock finding data ─────────────────────────────────────── */

const seoFindings = [
  { severity: 'high', title: 'Missing meta description', detail: 'Page /pricing has no meta description tag. Search engines will auto-generate a snippet.' },
  { severity: 'medium', title: 'Broken link detected', detail: '/blog/old-post returns HTTP 404. Crawled from homepage footer.' },
  { severity: 'medium', title: 'Image missing alt text', detail: '3 images on /about lack alt attributes. Affects SEO and screen readers.' },
  { severity: 'low', title: 'Title tag too long', detail: 'Homepage title is 72 characters. Recommended max is 60 for full SERP display.' },
  { severity: 'low', title: 'Duplicate H1 tag', detail: 'Pages /features and /product both use identical H1 text.' },
]

const clearuxFindings = [
  { severity: 'critical', title: 'Forced urgency creates false scarcity', detail: '"Only 2 left!" counter resets on every visit. Users who notice lose trust in all pricing claims. Violates FTC guidance on deceptive countdown timers.', category: 'Dark Patterns' },
  { severity: 'high', title: 'Error message uses shame language', detail: '"Are you sure you want to miss out?" on newsletter dismiss. Shame-based copy increases immediate conversions but drives long-term churn and negative brand sentiment.', category: 'Human Experience' },
  { severity: 'high', title: 'Checkout flow not keyboard-operable', detail: 'Payment form traps focus inside the card number field. Tab key skips the "Pay" button entirely. Users relying on keyboard or switch devices cannot complete purchase.', category: 'Inclusive Design' },
  { severity: 'high', title: 'Content invisible to AI assistants', detail: 'Product pricing is rendered via client-side JS only. LLMs and AI agents cannot extract your plans or features. You are invisible in AI-generated recommendations.', category: 'AI Readiness' },
  { severity: 'medium', title: 'Brand voice inconsistent across pages', detail: 'Homepage uses casual first-person ("We love building...") while legal pages switch to cold third-person ("The Company shall..."). Erodes perceived authenticity.', category: 'Brand Consistency' },
]

/* ── Severity styling ──────────────────────────────────────── */

function sevDot(s: string) {
  if (s === 'critical') return 'bg-[var(--severe)]'
  if (s === 'high') return 'bg-[var(--warn)]'
  if (s === 'medium') return 'bg-[var(--signal)]'
  return 'bg-[var(--m-muted)]'
}

function sevLabel(s: string) {
  if (s === 'critical') return 'text-[var(--severe)]'
  if (s === 'high') return 'text-[var(--warn)]'
  if (s === 'medium') return 'text-[var(--signal)]'
  return 'text-[var(--m-muted)]'
}

/* ── Component ─────────────────────────────────────────────── */

export function Comparison() {
  return (
    <section className="py-[120px] border-b border-rule">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">

        {/* Header */}
        <div className="mb-20 grid lg:grid-cols-[1fr_1.2fr] gap-20 items-end max-lg:grid-cols-1 max-lg:gap-8">
          <div>
            <SectionMarker number="02" label="The difference" />
            <h2
              className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.022em]"
              style={{ fontSize: 'clamp(42px, 5.6vw, 80px)' }}
            >
              SEO tools audit{' '}
              <em className="italic text-m-muted">websites.</em>
              <br />
              ClearUX audits{' '}
              <em className="italic text-signal">experiences.</em>
            </h2>
          </div>
          <div>
            <p className="text-[19px] leading-[1.55] text-ink-2 font-sans">
              Semrush, Ahrefs, Screaming Frog — they tell you what Google sees. Missing meta tags, broken links, slow pages. Infrastructure problems.
            </p>
            <p className="text-[19px] leading-[1.55] text-ink-2 font-sans mt-5">
              ClearUX tells you what your <em className="font-serif italic">users</em> feel. Dark patterns that erode trust. Shame language that drives churn. Inaccessible flows that lock people out. Content invisible to AI. The problems that cost you customers even when your SEO score is 95.
            </p>
          </div>
        </div>

        {/* Side by side comparison */}
        <div className="grid lg:grid-cols-2 gap-0 border border-ink">

          {/* LEFT — SEO tools */}
          <div className="border-b lg:border-b-0 lg:border-r border-ink">
            {/* Column header */}
            <div className="px-7 py-5 border-b border-ink bg-paper-2/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-m-muted mb-1">
                    What SEO tools find
                  </h3>
                  <p className="text-[13px] text-m-muted font-sans">Technical health. Infrastructure. What Google sees.</p>
                </div>
                <div className="font-mono text-[11px] text-m-muted/50 tracking-[0.06em] uppercase">
                  Typical
                </div>
              </div>
            </div>

            {/* Findings */}
            <div>
              {seoFindings.map((f, i) => (
                <div key={i} className={`px-7 py-5 ${i < seoFindings.length - 1 ? 'border-b border-rule' : ''}`}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sevDot(f.severity)}`} />
                    <span className={`font-mono text-[10px] tracking-[0.08em] uppercase font-medium ${sevLabel(f.severity)}`}>
                      {f.severity}
                    </span>
                  </div>
                  <p className="text-[15px] font-sans font-medium text-ink leading-[1.35] mb-1.5">{f.title}</p>
                  <p className="text-[13px] font-sans text-m-muted leading-[1.5]">{f.detail}</p>
                </div>
              ))}
            </div>

            {/* Summary strip */}
            <div className="px-7 py-4 border-t border-ink bg-paper-2/30">
              <p className="font-mono text-[11px] text-m-muted tracking-[0.06em] uppercase">
                Useful. But your users never see these problems.
              </p>
            </div>
          </div>

          {/* RIGHT — ClearUX */}
          <div>
            {/* Column header */}
            <div className="px-7 py-5 border-b border-ink bg-signal/[0.04]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-signal mb-1">
                    What ClearUX finds
                  </h3>
                  <p className="text-[13px] text-ink-2 font-sans">Experience quality. Trust. What your users feel.</p>
                </div>
                <div className="font-mono text-[11px] text-signal/60 tracking-[0.06em] uppercase">
                  ClearUX
                </div>
              </div>
            </div>

            {/* Findings */}
            <div>
              {clearuxFindings.map((f, i) => (
                <div key={i} className={`px-7 py-5 ${i < clearuxFindings.length - 1 ? 'border-b border-rule' : ''}`}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sevDot(f.severity)}`} />
                    <span className={`font-mono text-[10px] tracking-[0.08em] uppercase font-medium ${sevLabel(f.severity)}`}>
                      {f.severity}
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.06em] uppercase text-m-muted/60 ml-auto">
                      {f.category}
                    </span>
                  </div>
                  <p className="text-[15px] font-sans font-medium text-ink leading-[1.35] mb-1.5">{f.title}</p>
                  <p className="text-[13px] font-sans text-ink-2 leading-[1.5]">{f.detail}</p>
                </div>
              ))}
            </div>

            {/* Summary strip */}
            <div className="px-7 py-4 border-t border-ink bg-signal/[0.04]">
              <p className="font-mono text-[11px] text-signal tracking-[0.06em] uppercase">
                The problems that cost you customers. Even when Google says you are fine.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom stat strip */}
        <div className="grid sm:grid-cols-3 mt-12 gap-8 sm:gap-0 sm:divide-x sm:divide-rule">
          <div className="text-center sm:px-6">
            <p className="font-serif text-[48px] text-ink tracking-[-0.02em] leading-none mb-2">96</p>
            <p className="font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase">UX checkpoints per audit</p>
          </div>
          <div className="text-center sm:px-6">
            <p className="font-serif text-[48px] text-ink tracking-[-0.02em] leading-none mb-2">6</p>
            <p className="font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase">modules — foundation to AI readiness</p>
          </div>
          <div className="text-center sm:px-6">
            <p className="font-serif text-[48px] text-signal tracking-[-0.02em] leading-none mb-2">$0</p>
            <p className="font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase">first audit, no card required</p>
          </div>
        </div>

      </div>
    </section>
  )
}
