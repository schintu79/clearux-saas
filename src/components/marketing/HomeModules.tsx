import { SectionMarker } from './SectionMarker'
import { Scale, Heart, Accessibility, Brain, FileSearch, Eye } from 'lucide-react'

/* Dashboard-matching MODULE_TINTS colors */
const MODULE_TINTS: Record<string, string> = {
  'Foundation': '#3B82F6',
  'Human experience': '#EC4899',
  'Inclusive design': '#8B5CF6',
  'Future readiness': '#F59E0B',
  'Brand consistency': '#06B6D4',
  'SEO structure': '#10B981',
}

const MODULES = [
  {
    name: 'Foundation',
    count: 16,
    desc: 'Site structure, navigation, page speed, mobile responsiveness, and technical baseline.',
    checks: ['Page load speed', 'Mobile layout', 'Navigation depth', 'Link integrity'],
    Icon: Scale,
  },
  {
    name: 'Human experience',
    count: 16,
    desc: 'Usability patterns, dark patterns, cognitive load, emotional design, and conversion friction.',
    checks: ['Dark pattern detection', 'Cognitive load', 'Form usability', 'Trust signals'],
    Icon: Heart,
  },
  {
    name: 'Inclusive design',
    count: 16,
    desc: 'WCAG 2.1 AA compliance, keyboard navigation, screen reader compatibility, and colour contrast.',
    checks: ['Colour contrast', 'Keyboard navigation', 'Screen readers', 'Touch targets'],
    Icon: Accessibility,
  },
  {
    name: 'Future readiness',
    count: 16,
    desc: 'AI discoverability, structured data, llms.txt, LLM probe accuracy, and citation quality.',
    checks: ['LLM probe testing', 'Structured data', 'AI discovery files', 'Citation accuracy'],
    Icon: Brain,
  },
  {
    name: 'Brand consistency',
    count: 16,
    desc: 'Visual identity alignment, tone of voice, messaging clarity, and cross-page coherence.',
    checks: ['Visual identity', 'Tone of voice', 'Messaging clarity', 'Cross-page coherence'],
    Icon: Eye,
  },
  {
    name: 'SEO structure',
    count: 16,
    desc: 'Meta tags, heading hierarchy, canonical URLs, internal linking, and indexability.',
    checks: ['Meta tags', 'Heading hierarchy', 'Canonical URLs', 'Internal linking'],
    Icon: FileSearch,
  },
]

export function HomeModules() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="02" label="What we audit" />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5"
          style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
        >
          96 checkpoints.{' '}
          <em className="italic text-signal">Six modules.</em>
        </h2>
        <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mb-14 font-sans">
          Every audit covers six modules, each with 16 checkpoints. Findings are severity-ranked
          with evidence, affected pages, and a concrete fix path.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: 'var(--rule)' }}>
          {MODULES.map((mod) => {
            const tint = MODULE_TINTS[mod.name] || 'var(--signal)'
            const IconComp = mod.Icon
            return (
            <div key={mod.name} className="p-7" style={{ background: 'var(--paper)' }}>
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="w-9 h-9 rounded-[6px] flex items-center justify-center shrink-0"
                  style={{ background: `color-mix(in srgb, ${tint} 12%, transparent)`, color: tint }}
                >
                  <IconComp size={20} strokeWidth={1.5} />
                </span>
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <h3 className="font-sans text-[16px] font-semibold text-ink">{mod.name}</h3>
                  <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted shrink-0 ml-2">{mod.count}</span>
                </div>
              </div>
              <p className="font-sans text-[14px] text-ink-2 leading-[1.65] mb-4">{mod.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {mod.checks.map((check) => (
                  <span
                    key={check}
                    className="font-mono text-[9px] tracking-[0.04em] px-2 py-1 rounded-[3px]"
                    style={{ background: 'var(--paper-2)', color: 'var(--ink-2)' }}
                  >
                    {check}
                  </span>
                ))}
              </div>
            </div>
          )})}
        </div>
      </div>
    </section>
  )
}
