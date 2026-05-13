'use client'

import { SectionMarker } from '@/components/marketing/SectionMarker'
import { Button } from '@/components/marketing/Button'
import { ArrowRightIcon } from '@/components/marketing/icons'
import { Coda } from '@/components/marketing/Coda'
import { useTheme } from '@/context/ThemeContext'

/* ── Three audit types — equal weight ─────────────────────── */

const AUDIT_TYPES = [
  {
    id: 'website',
    marker: '01',
    label: 'Website UX audit',
    title: 'Audit your website.',
    titleAccent: 'Fix what matters.',
    subtitle: 'Paste any URL and get a complete UX audit in minutes. We crawl your pages, check 96 quality points, and surface the issues that actually affect your users — ranked by severity with evidence and specific fixes.',
    features: [
      { name: '96 checkpoints', desc: 'Every page scored across usability, accessibility, performance, content, SEO, and AI readiness.' },
      { name: 'Multi-page crawl', desc: 'We don\'t just check the homepage. ClearUX follows links and audits your key pages automatically.' },
      { name: 'Severity ranking', desc: 'Critical, high, medium, low. Know exactly what to fix first and why it matters.' },
      { name: 'Mobile responsiveness', desc: 'Every page tested at 4 viewport sizes. Layout breaks, touch targets, overflow — all checked.' },
    ],
    mockup: {
      type: 'score' as const,
      domain: 'yoursite.com',
      score: 72,
      modules: [
        { name: 'Foundation', score: 81, dot: '#6366F1' },
        { name: 'Human Experience', score: 68, dot: '#EC4899' },
        { name: 'Inclusive Design', score: 74, dot: '#10B981' },
        { name: 'Future Readiness', score: 65, dot: '#F59E0B' },
        { name: 'Brand Consistency', score: 78, dot: '#3B82F6' },
        { name: 'SEO Structure', score: 70, dot: '#06B6D4' },
      ],
    },
  },
  {
    id: 'brand',
    marker: '02',
    label: 'Brand identity audit',
    title: 'Audit your brand.',
    titleAccent: 'Cross-check the live site.',
    subtitle: 'Upload your brand guidelines (PDF, images, documents) and we\'ll audit them for consistency, clarity, and completeness. Then cross-reference against your live website to find every place your brand falls short.',
    features: [
      { name: 'Guidelines review', desc: 'We analyze your brand book — logo usage, typography, color systems, tone of voice, and more.' },
      { name: 'Live site cross-check', desc: 'Compare your brand guidelines against what\'s actually deployed. Spot mismatches instantly.' },
      { name: 'Voice and tone', desc: 'Is your website copy consistent with your brand personality? We check messaging across pages.' },
      { name: 'Visual consistency', desc: 'Color usage, font implementation, spacing, and image style reviewed against your standards.' },
    ],
    mockup: {
      type: 'brand' as const,
      categories: [
        { name: 'Logo usage', score: 88 },
        { name: 'Color system', score: 72 },
        { name: 'Typography', score: 91 },
        { name: 'Voice and tone', score: 65 },
        { name: 'Visual consistency', score: 78 },
      ],
    },
  },
  {
    id: 'ai',
    marker: '03',
    label: 'AI visibility',
    title: 'See how AI sees you.',
    titleAccent: 'Control the narrative.',
    subtitle: 'AI assistants are the new front page. We ask leading AI models about your business and grade their answers against your actual content. Find out what they get right, what they hallucinate, and how to fix it.',
    features: [
      { name: 'AI probe', desc: 'We query AI models about your company — identity, products, pricing, reputation — and grade each answer.' },
      { name: 'Citation audit', desc: 'Which of your pages get cited by AI? Which get ignored? Know exactly where you stand.' },
      { name: 'Multi-model benchmark', desc: 'Claude, GPT-4o, Gemini. Compare how different AI models represent your brand.' },
      { name: 'Fix playbooks', desc: 'Ready-to-paste JSON-LD, meta tags, and llms.txt snippets that help AI understand you correctly.' },
    ],
    mockup: {
      type: 'ai' as const,
      probes: [
        { question: 'What is yoursite.com?', accuracy: 'accurate' as const },
        { question: 'What products do they offer?', accuracy: 'partial' as const },
        { question: 'What is the pricing?', accuracy: 'hallucinated' as const },
        { question: 'What makes them different?', accuracy: 'accurate' as const },
      ],
    },
  },
]

/* ── Platform features ────────────────────────────────────── */

const PLATFORM_FEATURES = [
  { title: 'Re-audit after every release', desc: 'Ship a fix, re-run the audit, see the score change. Track progress over time with historical scoring.', icon: 'refresh' },
  { title: 'Export PDF and Word reports', desc: 'Download professional reports your team can share with stakeholders, clients, or leadership.', icon: 'download' },
  { title: 'Share with a link', desc: 'Generate a shareable link to your audit results. No login required for viewers.', icon: 'share' },
  { title: 'Competitor comparison', desc: 'Run the same audit on a competitor. See where you lead and where you trail, side by side.', icon: 'compare' },
  { title: 'Score trends over time', desc: 'Every audit is saved. Watch your score improve as you ship fixes. Evidence your team is making progress.', icon: 'trend' },
  { title: 'AI vs human interpretation', desc: 'Each finding shows how a human reads the issue alongside how an AI model interprets it.', icon: 'brain' },
]

/* ── How it works — 3 steps ───────────────────────────────── */

const STEPS = [
  { num: '01', title: 'Choose your audit', desc: 'Paste a website URL for a UX audit. Upload brand guidelines for a brand audit. Both get AI visibility analysis included.' },
  { num: '02', title: 'We run the engine', desc: '96 checkpoints across 6 modules. Multi-page crawl. AI model probing. Everything runs in parallel — results in minutes, not weeks.' },
  { num: '03', title: 'You act on findings', desc: 'Every issue ranked by severity with evidence screenshots, specific recommendations, and exportable reports. Fix the critical items first.' },
]

/* ── Six modules ──────────────────────────────────────────── */

const MODULES = [
  { num: '01', title: 'Foundation', desc: 'Visual design, messaging, navigation, content quality. The structural baseline every great experience needs.', count: 16 },
  { num: '02', title: 'Human Experience', desc: 'Clarity, cognitive load, dark patterns, conversion friction. Whether your UX respects real users.', count: 22 },
  { num: '03', title: 'Inclusive Design', desc: 'WCAG compliance, cognitive accessibility, mobile context, equity across abilities.', count: 18 },
  { num: '04', title: 'Future Readiness', desc: 'How AI models read your product. Performance, agent readiness, structured data.', count: 14 },
  { num: '05', title: 'Brand Consistency', desc: 'Voice, visual identity, tone alignment. Whether what users see matches what your brand promises.', count: 14 },
  { num: '06', title: 'SEO Structure', desc: 'Heading hierarchy, meta tags, structured data, crawlability. Be found and ranked properly.', count: 12 },
]

/* ── Mockup sub-components ────────────────────────────────── */

function ScoreMockup({ data }: { data: typeof AUDIT_TYPES[0]['mockup'] }) {
  if (data.type !== 'score') return null
  const d = data as typeof AUDIT_TYPES[0]['mockup'] & { domain: string; score: number; modules: Array<{ name: string; score: number; dot: string }> }
  const color = d.score >= 70 ? 'var(--ok)' : 'var(--warn)'
  return (
    <div className="border border-rule rounded-xl overflow-hidden bg-paper shadow-sm">
      <div className="p-6 flex items-center gap-5">
        <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
          <svg width={80} height={80} className="-rotate-90">
            <circle cx={40} cy={40} r={36} fill="none" stroke="var(--rule)" strokeWidth={6} />
            <circle cx={40} cy={40} r={36} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
              strokeDasharray={226} strokeDashoffset={226 * (1 - d.score / 100)} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-serif text-[22px] text-ink">{d.score}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-[15px] text-ink font-medium mb-1">{d.domain}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {d.modules.map(m => (
              <div key={m.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.dot }} />
                <span className="text-[11px] text-m-muted">{m.name}</span>
                <span className="text-[11px] font-medium" style={{ color: m.score >= 70 ? 'var(--ok)' : 'var(--warn)' }}>{m.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-rule px-6 py-3 flex gap-2">
        {['32 findings', '6 modules', 'Re-audit'].map(a => (
          <span key={a} className="text-[10px] font-mono tracking-[0.06em] uppercase text-m-muted px-2.5 py-1 rounded border border-rule">{a}</span>
        ))}
      </div>
    </div>
  )
}

function BrandMockup({ data }: { data: typeof AUDIT_TYPES[1]['mockup'] }) {
  if (data.type !== 'brand') return null
  const d = data as typeof AUDIT_TYPES[1]['mockup'] & { categories: Array<{ name: string; score: number }> }
  return (
    <div className="border border-rule rounded-xl overflow-hidden bg-paper shadow-sm">
      <div className="px-6 py-4 border-b border-rule flex items-center justify-between">
        <p className="font-sans text-[14px] font-medium text-ink">Brand identity audit</p>
        <span className="text-[10px] font-mono tracking-[0.06em] uppercase text-m-muted">5 categories</span>
      </div>
      <div className="p-6 space-y-3.5">
        {d.categories.map(cat => {
          const color = cat.score >= 80 ? 'var(--ok)' : cat.score >= 65 ? 'var(--warn)' : 'var(--severe)'
          return (
            <div key={cat.name}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] text-ink">{cat.name}</span>
                <span className="text-[13px] font-medium" style={{ color }}>{cat.score}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-paper-2">
                <div className="h-full rounded-full transition-all" style={{ width: `${cat.score}%`, background: color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AIMockup({ data }: { data: typeof AUDIT_TYPES[2]['mockup'] }) {
  if (data.type !== 'ai') return null
  const d = data as typeof AUDIT_TYPES[2]['mockup'] & { probes: Array<{ question: string; accuracy: 'accurate' | 'partial' | 'hallucinated' }> }
  const accColors = { accurate: { text: 'var(--ok)', bg: 'color-mix(in srgb, var(--ok) 10%, transparent)', label: 'Correct' }, partial: { text: 'var(--warn)', bg: 'color-mix(in srgb, var(--warn) 10%, transparent)', label: 'Partial' }, hallucinated: { text: 'var(--severe)', bg: 'color-mix(in srgb, var(--severe) 10%, transparent)', label: 'Hallucinated' } }
  return (
    <div className="border border-rule rounded-xl overflow-hidden bg-paper shadow-sm">
      <div className="px-6 py-4 border-b border-rule flex items-center justify-between">
        <p className="font-sans text-[14px] font-medium text-ink">AI probe results</p>
        <span className="text-[10px] font-mono tracking-[0.06em] uppercase text-m-muted">{d.probes.length} questions</span>
      </div>
      <div className="divide-y divide-rule">
        {d.probes.map(p => {
          const acc = accColors[p.accuracy]
          return (
            <div key={p.question} className="px-6 py-3.5 flex items-center justify-between gap-3">
              <span className="text-[13px] text-ink">{p.question}</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: acc.text, background: acc.bg }}>{acc.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Feature icon (inline SVG) ────────────────────────────── */

function FeatureIcon({ type }: { type: string }) {
  const cls = "text-signal"
  const props = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: cls }
  switch (type) {
    case 'refresh': return <svg {...props}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></svg>
    case 'download': return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
    case 'share': return <svg {...props}><circle cx={18} cy={5} r={3} /><circle cx={6} cy={12} r={3} /><circle cx={18} cy={19} r={3} /><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" /></svg>
    case 'compare': return <svg {...props}><rect x={3} y={3} width={18} height={18} rx={2} /><path d="M12 3v18" /></svg>
    case 'trend': return <svg {...props}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
    case 'brain': return <svg {...props}><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" /><path d="M9 22h6" /><path d="M12 17v5" /></svg>
    default: return null
  }
}

/* ── Main component ───────────────────────────────────────── */

export default function HowItWorksContent() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <main>
      {/* ── Product Hero ─────────────────────────────────────── */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="00" label="Product" />
          <h1 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-8" style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}>
            One platform.{' '}<em className="italic text-signal">Three audits.</em>
          </h1>
          <p className="text-[19px] leading-[1.55] text-ink-2 max-w-[640px] font-sans mb-10">
            ClearUX is the UX audit platform that checks your website, your brand identity, and how AI models represent you — all in one place. Paste a URL or upload your brand files. Get severity-ranked findings with evidence and specific fixes, in minutes.
          </p>
          <div className="flex gap-3.5 max-sm:flex-col max-sm:items-stretch">
            <Button href="/register">
              Start free audit
              <ArrowRightIcon size={14} />
            </Button>
            <Button href="/demo-report" variant="ghost">See a real report</Button>
          </div>
        </div>
      </section>

      {/* ── Three audit types — SimilarWeb-style feature sections ── */}
      {AUDIT_TYPES.map((audit, idx) => (
        <section key={audit.id} className="py-[100px] border-b border-rule max-sm:py-16">
          <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
            <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
              {/* Text side */}
              <div className={idx % 2 === 1 ? 'lg:order-2' : ''}>
                <SectionMarker number={audit.marker} label={audit.label} />
                <h2 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.022em] mb-5" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
                  {audit.title}{' '}<em className="italic text-signal">{audit.titleAccent}</em>
                </h2>
                <p className="text-[17px] leading-[1.55] text-ink-2 font-sans mb-10">
                  {audit.subtitle}
                </p>

                {/* Feature list */}
                <div className="space-y-0">
                  {audit.features.map((f) => (
                    <div key={f.name} className="py-4 border-b border-rule last:border-b-0">
                      <div className="flex items-baseline gap-3">
                        <span className="text-signal font-mono text-[12px]">+</span>
                        <div>
                          <p className="text-[15px] font-sans font-semibold text-ink leading-snug mb-1">{f.name}</p>
                          <p className="text-[14px] font-sans text-ink-2 leading-[1.55]">{f.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mockup side */}
              <div className={idx % 2 === 1 ? 'lg:order-1' : ''}>
                <div className="sticky top-32">
                  {audit.id === 'website' && <ScoreMockup data={audit.mockup} />}
                  {audit.id === 'brand' && <BrandMockup data={audit.mockup} />}
                  {audit.id === 'ai' && <AIMockup data={audit.mockup} />}
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* ── Interstitial ─────────────────────────────────────── */}
      <section
        className="py-[100px] max-sm:py-[80px]"
        style={{ background: isDark ? 'var(--paper)' : 'var(--ink)', color: isDark ? 'var(--ink)' : '#ffffff' }}
      >
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5 text-center">
          <p className="font-sans font-normal leading-[1.3] tracking-[-0.01em] mx-auto mb-6 max-sm:mb-4"
            style={{ fontSize: '19px', color: isDark ? 'var(--m-muted)' : 'rgba(255,255,255,0.4)', maxWidth: '700px' }}>
            Other tools give you a score and a checklist.
          </p>
          <h2 className="font-serif font-normal leading-[1.05] tracking-[-0.03em] mx-auto"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)', color: isDark ? 'var(--ink)' : '#ffffff', maxWidth: '960px' }}>
            ClearUX tells you{' '}<em className="italic text-signal">what to fix</em>{' '}and{' '}<em className="italic text-signal">why.</em>
          </h2>
        </div>
      </section>

      {/* ── How it works — 3 steps ────────────────────────────── */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="04" label="How it works" />
          <h2 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.02em] mb-14" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Three steps. <em className="italic text-signal">Minutes, not weeks.</em>
          </h2>

          <div className="grid md:grid-cols-3 gap-0 border border-ink">
            {STEPS.map((step, i) => (
              <div key={step.num} className={`p-8 ${i < STEPS.length - 1 ? 'md:border-r border-ink max-md:border-b' : ''}`}>
                <span className="font-serif text-[56px] text-m-muted-2 font-normal leading-none block mb-5" style={{ color: 'color-mix(in srgb, var(--ink) 12%, transparent)' }}>
                  {step.num}
                </span>
                <h3 className="font-sans text-[17px] font-medium text-ink mb-3">{step.title}</h3>
                <p className="font-sans text-[15px] text-ink-2 leading-[1.6]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform features ─────────────────────────────────── */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="05" label="Platform" />
          <h2 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.02em] mb-5" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Everything you need to{' '}<em className="italic text-signal">ship better.</em>
          </h2>
          <p className="text-[17px] text-ink-2 leading-[1.55] max-w-[540px] font-sans mb-14">
            Beyond findings — ClearUX gives you the tools to track progress, share results, and prove your work.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-rule">
            {PLATFORM_FEATURES.map((feat) => (
              <div key={feat.title} className="border-r border-b border-rule p-7 hover:bg-paper-2/50 transition-colors">
                <div className="mb-4">
                  <FeatureIcon type={feat.icon} />
                </div>
                <h3 className="font-sans text-[15px] font-semibold text-ink mb-2">{feat.title}</h3>
                <p className="font-sans text-[14px] text-ink-2 leading-[1.55]">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Six modules ──────────────────────────────────────── */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <div className="mb-16 grid lg:grid-cols-[1fr_1.2fr] gap-20 items-end max-lg:grid-cols-1 max-lg:gap-6">
            <div>
              <SectionMarker number="06" label="The instrument" />
              <h2 className="font-serif font-normal text-ink leading-[0.98] tracking-[-0.022em]" style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}>
                Six modules. <em className="italic text-signal">96</em> checkpoints.
              </h2>
            </div>
            <p className="text-[17px] text-ink-2 leading-[1.55] max-w-[540px] font-sans">
              Every audit runs the full battery. No tiered plans, no &ldquo;upgrade to unlock.&rdquo; Foundation through SEO Structure — same depth, every time.
            </p>
          </div>

          <div className="grid grid-cols-3 border-t border-l border-ink max-md:grid-cols-2 max-sm:grid-cols-1">
            {MODULES.map((mod) => (
              <div key={mod.num} className="border-r border-b border-ink p-7 sm:p-8 bg-paper hover:bg-paper-2 transition-colors min-h-[240px] flex flex-col">
                <div className="font-mono text-[11px] text-signal font-semibold tracking-[0.08em] mb-3">
                  {mod.num} / {mod.title}
                </div>
                <h3 className="font-serif font-normal text-[28px] tracking-[-0.015em] leading-[1.05] mb-3 text-ink">
                  {mod.title}
                </h3>
                <p className="text-[14px] leading-[1.55] text-ink-2 mb-auto pb-5 font-sans">
                  {mod.desc}
                </p>
                <div className="flex items-baseline pt-4 border-t border-dashed border-rule-2 font-mono text-[10px] text-m-muted tracking-[0.06em] uppercase">
                  <strong className="font-serif text-[24px] font-normal text-ink normal-case tracking-[-0.02em] mr-2">{mod.count}</strong>
                  checkpoints
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom stat strip ─────────────────────────────────── */}
      <section className="py-[80px] border-b border-rule max-sm:py-14">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <div className="grid sm:grid-cols-4 gap-8 sm:gap-0 sm:divide-x sm:divide-rule">
            <div className="text-center sm:px-6">
              <p className="font-serif text-[48px] text-ink tracking-[-0.02em] leading-none mb-2">96</p>
              <p className="font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase">Checkpoints per audit</p>
            </div>
            <div className="text-center sm:px-6">
              <p className="font-serif text-[48px] text-ink tracking-[-0.02em] leading-none mb-2">6</p>
              <p className="font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase">Modules</p>
            </div>
            <div className="text-center sm:px-6">
              <p className="font-serif text-[48px] text-ink tracking-[-0.02em] leading-none mb-2">3</p>
              <p className="font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase">Audit types</p>
            </div>
            <div className="text-center sm:px-6">
              <p className="font-serif text-[48px] text-ink tracking-[-0.02em] leading-none mb-2">$0</p>
              <p className="font-mono text-[11px] text-m-muted tracking-[0.08em] uppercase">First audit, no card needed</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <Coda />
    </main>
  )
}
