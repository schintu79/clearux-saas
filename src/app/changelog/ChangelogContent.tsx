'use client'

/* ── Static placeholder entries (will be replaced by Supabase CMS) ── */
const ENTRIES = [
  {
    date: '2026-05-18',
    title: 'WordPress plugin beta',
    description: 'The Fixpath WordPress plugin is now available in beta. Install it to see audit findings directly in your WordPress admin panel and apply content fixes without leaving your CMS.',
    tags: ['New feature', 'WordPress'],
  },
  {
    date: '2026-05-12',
    title: 'One-click deploy via FTP/SFTP',
    description: 'Connect your server and deploy code fixes directly from the Fix console. Fixpath generates a surgical diff, lets you preview and edit it, then pushes the change to your site.',
    tags: ['New feature', 'Fix'],
  },
  {
    date: '2026-05-05',
    title: 'WCAG 2.1 AA checklist',
    description: 'Every audit now includes a full WCAG 2.1 AA compliance checklist. See which criteria pass, fail, or need manual review, with direct links to the relevant findings.',
    tags: ['New feature', 'Accessibility'],
  },
  {
    date: '2026-04-28',
    title: 'Multi-model AI benchmarking',
    description: 'The AI X-Ray tab now tests your site against GPT-4, Claude, Gemini, and more. See how each model describes your business and where the gaps are.',
    tags: ['Improvement', 'AI'],
  },
  {
    date: '2026-04-20',
    title: 'Competitor benchmarking',
    description: 'Compare your Website Health Score against up to three competitors. See where you lead and where to focus your next sprint.',
    tags: ['New feature', 'Track'],
  },
  {
    date: '2026-04-14',
    title: 'Score history and trends',
    description: 'Track your Website Health Score over time. The new Track page shows score history, resolved findings, and which fixes had the biggest impact.',
    tags: ['New feature', 'Track'],
  },
]

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function ChangelogContent() {
  return (
    <main>
      {/* Hero */}
      <section className="py-20 sm:py-[100px] border-b border-rule">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <p className="font-mono text-[11px] tracking-[0.12em] uppercase text-signal mb-6">Changelog</p>
          <h1 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6" style={{ fontSize: 'clamp(44px, 6vw, 80px)' }}>
            What&apos;s{' '}
            <em className="italic text-signal">new.</em>
          </h1>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] font-sans">
            Product updates, new features, and improvements to Fixpath.
          </p>
        </div>
      </section>

      {/* Entries */}
      <section className="py-[80px] max-sm:py-12">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <div className="max-w-3xl">
            {ENTRIES.map((entry, i) => (
              <article
                key={entry.date + entry.title}
                className={`py-10 ${i < ENTRIES.length - 1 ? 'border-b border-rule' : ''}`}
              >
                <time className="font-mono text-[11px] tracking-[0.08em] uppercase text-m-muted block mb-3">
                  {formatDate(entry.date)}
                </time>
                <h2 className="font-sans text-[20px] font-semibold text-ink mb-2">{entry.title}</h2>
                <p className="font-sans text-[15px] text-ink-2 leading-[1.65] mb-4">{entry.description}</p>
                <div className="flex gap-2 flex-wrap">
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="font-mono text-[10px] tracking-[0.06em] uppercase px-2.5 py-1 rounded-full border border-rule text-m-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
