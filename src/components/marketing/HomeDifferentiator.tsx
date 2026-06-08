import { SectionMarker } from './SectionMarker'
import { ShieldCheck, Eye, Lightbulb, Rocket, GitCompareArrows, BarChart3 } from 'lucide-react'

/**
 * HomeDifferentiator — "Built around truth, not noise."
 * 6 proof blocks in a 3×2 grid with soft internal dividers.
 * Each block: icon → strong title → one tight sentence.
 *
 * Top row introduces the 3-tier trust model (Verified, Observed, Heuristic).
 * Bottom row reinforces product mechanics that support trust.
 */

const BLOCKS = [
  {
    Icon: ShieldCheck,
    title: 'Verified',
    desc: 'Direct checks for issues that can be tested: missing metadata, broken links, accessibility violations.',
  },
  {
    Icon: Eye,
    title: 'Observed',
    desc: 'Page evidence extracted from the real site — layout consistency, messaging clarity, structural weaknesses.',
  },
  {
    Icon: Lightbulb,
    title: 'Heuristic',
    desc: 'Applied where human judgment matters: perception, differentiation, and clarity of positioning.',
  },
  {
    Icon: BarChart3,
    title: 'Confidence and coverage visible',
    desc: 'Every audit shows how much of the site was analyzed and how strong the evidence is behind each result.',
  },
  {
    Icon: Rocket,
    title: 'Deploy-ready fixes',
    desc: 'Code diffs built from your source. Preview, edit, deploy — not just a list of recommendations.',
  },
  {
    Icon: GitCompareArrows,
    title: 'Lifecycle tracking',
    desc: 'New, improved, fixed, or regressed. Progress is provable, not assumed.',
  },
]

export function HomeDifferentiator() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="03" label="Why it works" centered />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
          style={{ fontSize: 'clamp(36px, 7vw, 96px)' }}
        >
          Built around truth,{' '}
          <em className="italic text-signal">not noise.</em>
        </h2>
        <p className="text-[18px] max-sm:text-[15px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto mb-16 max-sm:mb-10 font-sans text-center">
          Some issues can be verified directly. Some need interpretation.
          Fixpath shows the difference — so teams act with clarity, not guesswork.
        </p>

        {/* 3×2 grid with soft internal dividers */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {BLOCKS.map((block, i) => {
              const col = i % 3
              const isLastItem = i === BLOCKS.length - 1
              return (
                <div
                  key={block.title}
                  className="flex flex-col items-center text-center px-8 py-10 max-sm:px-6 max-sm:py-8"
                  style={{
                    borderRight: col < 2 ? '1px solid color-mix(in srgb, var(--ink) 6%, transparent)' : 'none',
                    borderBottom: isLastItem ? 'none' : '1px solid color-mix(in srgb, var(--ink) 6%, transparent)',
                  }}
                >
                  <block.Icon
                    size={20}
                    strokeWidth={1.5}
                    style={{ color: 'var(--ink-2)' }}
                    className="mb-4"
                  />
                  <h3
                    className="font-sans text-[15px] font-semibold tracking-[-0.01em] mb-2"
                    style={{ color: 'var(--ink)' }}
                  >
                    {block.title}
                  </h3>
                  <p
                    className="font-sans text-[13px] leading-[1.55] max-w-[220px]"
                    style={{ color: 'var(--m-muted)' }}
                  >
                    {block.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
