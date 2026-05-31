import { SectionMarker } from './SectionMarker'
import { FileCheck, Calculator, Rocket, GitCompareArrows, Accessibility, Globe } from 'lucide-react'

/**
 * HomeDifferentiator — "Built around truth, not noise."
 * 6 proof blocks in a 3×2 grid with soft internal dividers.
 * Each block: icon → strong title → one tight sentence.
 */

const BLOCKS = [
  {
    Icon: FileCheck,
    title: 'Evidence-based findings',
    desc: 'Every issue is proven from your actual content — nothing speculative.',
  },
  {
    Icon: Calculator,
    title: 'Deterministic scoring',
    desc: 'Fixed formula, fixed weights. Same inputs, same score.',
  },
  {
    Icon: Rocket,
    title: 'Deploy-ready fixes',
    desc: 'Code diffs built from your source. Preview, edit, deploy.',
  },
  {
    Icon: GitCompareArrows,
    title: 'Lifecycle tracking',
    desc: 'New, improved, fixed, or regressed. Progress is provable.',
  },
  {
    Icon: Accessibility,
    title: 'Accessibility built in',
    desc: 'WCAG 2.1 AA checks in every audit, automatically.',
  },
  {
    Icon: Globe,
    title: 'Website and brand in one audit',
    desc: 'Technical quality and brand perception. One run, full picture.',
  },
]

export function HomeDifferentiator() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="03" label="Why it works" centered />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
          style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
        >
          Built around truth,{' '}
          <em className="italic text-signal">not noise.</em>
        </h2>
        <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto mb-16 font-sans text-center">
          Every design decision serves one goal: give teams useful truth they can
          act on, and proof that acting on it worked.
        </p>

        {/* 3×2 grid with soft internal dividers */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {BLOCKS.map((block, i) => {
              const isLastCol = (i + 1) % 3 === 0
              const isTopRow = i < 3
              return (
                <div
                  key={block.title}
                  className="flex flex-col items-center text-center px-8 py-10 max-sm:px-6 max-sm:py-8"
                  style={{
                    borderRight: isLastCol ? 'none' : '1px solid color-mix(in srgb, var(--ink) 6%, transparent)',
                    borderBottom: isTopRow ? '1px solid color-mix(in srgb, var(--ink) 6%, transparent)' : 'none',
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
