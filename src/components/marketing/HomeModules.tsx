import { SectionMarker } from './SectionMarker'
import { Scale, Heart, Accessibility, Brain, FileSearch, Eye, Focus } from 'lucide-react'

/* Dashboard-matching MODULE_TINTS colors */
const MODULE_TINTS: Record<string, string> = {
  'Foundation': '#3B82F6',
  'Human experience': '#EC4899',
  'Inclusive design': '#8B5CF6',
  'Future readiness': '#F59E0B',
  'Accessibility readiness': '#EF4444',
  'Brand consistency': '#06B6D4',
  'SEO structure': '#10B981',
}

const MODULES = [
  {
    name: 'Foundation',
    count: 16,
    Icon: Scale,
    categories: ['Visual design and first impression', 'Value proposition and messaging', 'Navigation and information architecture', 'Content quality and readability'],
  },
  {
    name: 'Human experience',
    count: 16,
    Icon: Heart,
    categories: ['Conversion paths and CTAs', 'Trust and credibility signals', 'Ethical design and dark patterns', 'Emotional design and engagement'],
  },
  {
    name: 'Inclusive design',
    count: 16,
    Icon: Accessibility,
    categories: ['WCAG 2.1 AA accessibility', 'Cognitive accessibility', 'Digital wellbeing and responsibility', 'Responsive and device support'],
  },
  {
    name: 'Future readiness',
    count: 16,
    Icon: Brain,
    categories: ['Performance and core web vitals', 'AI discoverability and structured data', 'AI agent readiness', 'Cultural and global readiness'],
  },
  {
    name: 'Accessibility readiness',
    count: 16,
    Icon: Focus,
    categories: ['Keyboard navigation and focus management', 'Screen-reader compatibility', 'Color contrast and visual clarity', 'ARIA landmarks and semantic structure'],
  },
  {
    name: 'Brand consistency',
    count: 16,
    Icon: Eye,
    categories: ['Brand identity and guidelines', 'Brand experience and story', 'Visual asset consistency', 'Brand communication and tone'],
  },
  {
    name: 'SEO structure',
    count: 16,
    Icon: FileSearch,
    categories: ['On-page SEO and metadata', 'Technical SEO and crawlability', 'Rich snippets and social markup', 'Content strategy and link structure'],
  },
]

export function HomeModules() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="04" label="Categories we cover" />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5"
          style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
        >
          28 categories.{' '}
          <em className="italic text-signal">Seven modules.</em>
        </h2>
        <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mb-14 font-sans">
          Every audit covers seven modules with four categories each — 112 checkpoints total.
          Findings are severity-ranked with evidence, affected pages, and a concrete fix path.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((mod) => {
            const tint = MODULE_TINTS[mod.name] || 'var(--signal)'
            const IconComp = mod.Icon
            return (
            <div key={mod.name} className="rounded-xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `color-mix(in srgb, ${tint} 12%, transparent)`, color: tint }}
                >
                  <IconComp size={20} strokeWidth={1.5} />
                </span>
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <h3 className="font-sans text-[16px] font-semibold text-ink">{mod.name}</h3>
                  <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted shrink-0 ml-2">{mod.count} checks</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {mod.categories.map((cat) => (
                  <div key={cat} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-[5px]" style={{ background: tint }} />
                    <span className="font-sans text-[13px] text-ink-2 leading-snug">{cat}</span>
                  </div>
                ))}
              </div>
            </div>
          )})}
        </div>
      </div>
    </section>
  )
}
