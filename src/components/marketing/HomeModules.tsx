import { SectionMarker } from './SectionMarker'

const MODULES = [
  {
    name: 'Foundation',
    count: 16,
    desc: 'Site structure, navigation, page speed, mobile responsiveness, and technical baseline.',
  },
  {
    name: 'Human experience',
    count: 16,
    desc: 'Usability patterns, dark patterns, cognitive load, emotional design, and conversion friction.',
  },
  {
    name: 'Inclusive design',
    count: 16,
    desc: 'WCAG 2.1 AA compliance, keyboard navigation, screen reader compatibility, and colour contrast.',
  },
  {
    name: 'Future readiness',
    count: 16,
    desc: 'AI discoverability, structured data, llms.txt, LLM probe accuracy, and citation quality.',
  },
  {
    name: 'Brand consistency',
    count: 16,
    desc: 'Visual identity alignment, tone of voice, messaging clarity, and cross-page coherence.',
  },
  {
    name: 'SEO structure',
    count: 16,
    desc: 'Meta tags, heading hierarchy, canonical URLs, internal linking, and indexability.',
  },
]

export function HomeModules() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="02" label="What we audit" />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5"
          style={{ fontSize: 'clamp(40px, 5.5vw, 72px)' }}
        >
          96 checkpoints.{' '}
          <em className="italic text-signal">Six modules.</em>
        </h2>
        <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mb-14 font-sans">
          Every audit covers six modules, each with 16 checkpoints. Findings are severity-ranked
          with evidence, affected pages, and a concrete fix path.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: 'var(--rule)' }}>
          {MODULES.map((mod) => (
            <div key={mod.name} className="p-7" style={{ background: 'var(--paper)' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-sans text-[16px] font-semibold text-ink">{mod.name}</h3>
                <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted">{mod.count} checks</span>
              </div>
              <p className="font-sans text-[14px] text-ink-2 leading-[1.65]">{mod.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
