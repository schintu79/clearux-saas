'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { SectionMarker } from './SectionMarker'
import {
  /* Module pill icons */
  Ruler,
  Sparkles,
  PaintBucket,
  Accessibility,
  Cpu,
  Search,
  Fingerprint,
  /* Category icons */
  Eye,
  Target,
  Map as MapIcon,
  Type,
  MousePointerClick,
  Shield,
  AlertTriangle,
  Heart,
  Brain,
  Smartphone,
  Gauge,
  Zap,
  Globe,
  FileSearch,
  Link2,
  Share2,
  Scale,
  Keyboard,
  FileText,
  Code2,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CategoryGroup = {
  Icon: LucideIcon
  name: string
  checkpoints: string[]
}

type Issue = {
  severity: 'critical' | 'high' | 'medium'
  label: string
  detail: string
}

type ModuleData = {
  Icon: LucideIcon
  name: string
  tint: string
  description: string
  categories: CategoryGroup[]
  issues: Issue[]
  whyItMatters: string
  brandDna?: { without: string; withConnected: string }
}

/* ------------------------------------------------------------------ */
/*  Severity palette                                                   */
/* ------------------------------------------------------------------ */

const SEV: Record<Issue['severity'], { bg: string; fg: string; label: string }> = {
  critical: { bg: 'rgba(220,38,38,0.10)', fg: '#DC2626', label: 'critical' },
  high:     { bg: 'rgba(245,158,11,0.10)', fg: '#D97706', label: 'high' },
  medium:   { bg: 'rgba(99,102,241,0.08)', fg: '#6366F1', label: 'medium' },
}

/* ------------------------------------------------------------------ */
/*  Module data — 7 modules × 4 categories × 4 checkpoints = 112      */
/* ------------------------------------------------------------------ */

const MODULES: ModuleData[] = [
  /* ── 0  Foundation ─────────────────────────────────────────────── */
  {
    Icon: Ruler,
    name: 'Foundation',
    tint: '#3B82F6',
    description:
      'Core structural quality — the technical and perceptual baseline every page needs before anything else matters.',
    categories: [
      {
        Icon: Eye,
        name: 'Visual Design & First Impression',
        checkpoints: [
          'Above-the-fold clarity',
          'Visual hierarchy & flow',
          'Design consistency',
          'Professional quality',
        ],
      },
      {
        Icon: Target,
        name: 'Value Proposition & Messaging',
        checkpoints: [
          'Headline clarity',
          'Differentiation',
          'Audience fit',
          'Proof & evidence',
        ],
      },
      {
        Icon: MapIcon,
        name: 'Navigation & Information Architecture',
        checkpoints: [
          'Primary navigation',
          'Page structure',
          'Footer & secondary nav',
          'Internal linking',
        ],
      },
      {
        Icon: Type,
        name: 'Content Quality & Readability',
        checkpoints: [
          'Scannability',
          'Writing quality',
          'Tone & voice',
          'Media quality',
        ],
      },
    ],
    issues: [
      {
        severity: 'critical',
        label: 'No clear value proposition above the fold',
        detail: 'Visitors leave in <5 s — headline does not answer "what is this?"',
      },
      {
        severity: 'high',
        label: 'Navigation has 12+ ungrouped top-level items',
        detail: 'Cognitive overload reduces task-completion rate',
      },
      {
        severity: 'medium',
        label: 'Body copy at 13 px / 1.3 line-height',
        detail: 'Below WCAG readability threshold — strains sustained reading',
      },
    ],
    whyItMatters:
      'Foundation issues are invisible to most teams but erode trust silently. A slow, unclear, or broken page loses visitors before they read a single word.',
  },

  /* ── 1  Human experience ───────────────────────────────────────── */
  {
    Icon: Sparkles,
    name: 'Human experience',
    tint: '#EC4899',
    description:
      'Conversion psychology, trust signals, ethical patterns, and emotional safety — does the experience respect and convert real people?',
    categories: [
      {
        Icon: MousePointerClick,
        name: 'Calls-to-Action & Conversion Path',
        checkpoints: [
          'Primary CTA',
          'Conversion flow',
          'Supporting elements',
          'Secondary CTAs',
        ],
      },
      {
        Icon: Shield,
        name: 'Trust, Credibility & Social Proof',
        checkpoints: [
          'Social proof',
          'Authority signals',
          'Transparency',
          'Security & safety',
        ],
      },
      {
        Icon: AlertTriangle,
        name: 'Ethical UX & Dark Pattern Detection',
        checkpoints: [
          'Confirmshaming',
          'Fake urgency & scarcity',
          'Hidden costs',
          'Consent & privacy',
        ],
      },
      {
        Icon: Heart,
        name: 'Emotional Design & Psychological Safety',
        checkpoints: [
          'Anxiety reduction',
          'Error handling',
          'Tone & respect',
          'Process transparency',
        ],
      },
    ],
    issues: [
      {
        severity: 'critical',
        label: 'Three competing CTAs above the fold',
        detail: 'No clear next step — conversion path ambiguous',
      },
      {
        severity: 'high',
        label: 'Zero social proof on pricing page',
        detail: 'Trust gap at the highest-stakes decision point',
      },
      {
        severity: 'medium',
        label: 'Countdown timer resets on page reload',
        detail: 'Fake urgency pattern — erodes credibility when noticed',
      },
    ],
    whyItMatters:
      'People decide in seconds whether a page is for them. Human experience checks whether your site earns trust and guides action — or loses both.',
  },

  /* ── 2  Inclusive design ───────────────────────────────────────── */
  {
    Icon: PaintBucket,
    name: 'Inclusive design',
    tint: '#8B5CF6',
    description:
      'Accessibility compliance, cognitive load, digital wellbeing, and responsive design — does the site work for everyone, on every device?',
    categories: [
      {
        Icon: Accessibility,
        name: 'Accessibility & WCAG Compliance',
        checkpoints: [
          'Perceivable (contrast, alt text)',
          'Operable (keyboard, focus)',
          'Understandable (labels, errors)',
          'Robust (ARIA, semantic HTML)',
        ],
      },
      {
        Icon: Brain,
        name: 'Cognitive Accessibility & Neurodiversity',
        checkpoints: [
          'Cognitive load',
          'Readability (fonts, spacing)',
          'Predictability',
          'Multi-modal communication',
        ],
      },
      {
        Icon: Sparkles,
        name: 'Digital Wellbeing & Responsible Design',
        checkpoints: [
          'Respectful engagement',
          'Time respect',
          'Inclusive of all abilities',
          'Healthy defaults',
        ],
      },
      {
        Icon: Smartphone,
        name: 'Mobile Experience & Responsive Design',
        checkpoints: [
          'Viewport & responsiveness',
          'Touch targets (44 px+)',
          'Mobile navigation',
          'Mobile content priority',
        ],
      },
    ],
    issues: [
      {
        severity: 'critical',
        label: '6 interactive elements below 44 px touch target',
        detail: 'Fails mobile usability — tap errors on small screens',
      },
      {
        severity: 'high',
        label: 'Video auto-plays with no pause control',
        detail: 'Disrespects user attention and data; blocks screen readers',
      },
      {
        severity: 'medium',
        label: 'Status communicated by colour alone',
        detail: 'Invisible to ~8 % of male users with colour-vision deficiency',
      },
    ],
    whyItMatters:
      'Exclusion is rarely intentional — it hides in pixel sizes, animation choices, and missing labels. Inclusive design catches what good intentions miss.',
  },

  /* ── 3  Accessibility readiness ────────────────────────────────── */
  {
    Icon: Accessibility,
    name: 'Accessibility readiness',
    tint: '#14B8A6',
    description:
      'Deep WCAG 2.1 AA audit across all four principles — Perceivable, Operable, Understandable, and Robust.',
    categories: [
      {
        Icon: Eye,
        name: 'Perceivable — Text Alternatives & Contrast',
        checkpoints: [
          'Alt text completeness',
          'Colour contrast (WCAG AA)',
          'Media alternatives',
          'Non-text content labels',
        ],
      },
      {
        Icon: Keyboard,
        name: 'Operable — Keyboard & Navigation',
        checkpoints: [
          'Keyboard accessibility',
          'Focus management',
          'Skip links & bypass',
          'Touch target sizing',
        ],
      },
      {
        Icon: FileText,
        name: 'Understandable — Labels & Errors',
        checkpoints: [
          'Form label association',
          'Error identification',
          'Help text & instructions',
          'Consistent navigation',
        ],
      },
      {
        Icon: Code2,
        name: 'Robust — ARIA & Semantic HTML',
        checkpoints: [
          'ARIA usage correctness',
          'Landmark regions',
          'Semantic element structure',
          'Assistive technology support',
        ],
      },
    ],
    issues: [
      {
        severity: 'critical',
        label: 'Body text fails WCAG AA 4.5 : 1 contrast ratio',
        detail: '#999 on #FFF — 2.85 : 1 measured, 4.5 : 1 required',
      },
      {
        severity: 'high',
        label: 'Modal traps keyboard focus with no escape route',
        detail: 'Keyboard-only users cannot dismiss or navigate past the dialog',
      },
      {
        severity: 'medium',
        label: 'Form inputs missing associated <label> elements',
        detail: 'Screen readers announce "edit blank" — no context for the field',
      },
    ],
    whyItMatters:
      'Accessibility is not optional — it affects real people and carries legal weight. Automated checks catch the measurable gaps so your team can focus on the nuanced ones.',
  },

  /* ── 4  Future readiness ───────────────────────────────────────── */
  {
    Icon: Cpu,
    name: 'Future readiness',
    tint: '#F59E0B',
    description:
      'Performance, structured data, AI discoverability, and global readiness — is your site prepared for the next generation of search and discovery?',
    categories: [
      {
        Icon: Gauge,
        name: 'Performance & Technical Health',
        checkpoints: [
          'Page weight',
          'Render strategy',
          'Technical SEO',
          'Structured data / schema',
        ],
      },
      {
        Icon: Search,
        name: 'AI Discoverability & LLM Readiness',
        checkpoints: [
          'LLM comprehension',
          'Semantic structure',
          'Content accessibility',
          'Machine-readable identity',
        ],
      },
      {
        Icon: Zap,
        name: 'AI Agent Readiness',
        checkpoints: [
          'Agent navigability',
          'Interactive elements',
          'Crawl infrastructure',
          'Real-world AI test',
        ],
      },
      {
        Icon: Globe,
        name: 'Cultural Sensitivity & Global Readiness',
        checkpoints: [
          'Language clarity',
          'Internationalisation',
          'Cultural neutrality',
          'Legal & privacy',
        ],
      },
    ],
    issues: [
      {
        severity: 'critical',
        label: 'Zero structured data on the domain',
        detail: 'Invisible to AI assistants, rich results, and knowledge panels',
      },
      {
        severity: 'high',
        label: 'FAQ content not marked up with schema',
        detail: 'Missing voice-search and featured-snippet eligibility',
      },
      {
        severity: 'medium',
        label: 'Open Graph image returns 404',
        detail: 'Social shares render with blank preview — hurts click-through',
      },
    ],
    whyItMatters:
      'Search is shifting from links to answers. Future readiness ensures your content is structured for the systems that will surface it — not just the ones that do today.',
  },

  /* ── 5  SEO structure ──────────────────────────────────────────── */
  {
    Icon: Search,
    name: 'SEO structure',
    tint: '#10B981',
    description:
      'On-page fundamentals, crawlability, structured data, and link architecture — the signals search engines use to understand and rank your content.',
    categories: [
      {
        Icon: FileSearch,
        name: 'On-Page SEO Fundamentals',
        checkpoints: [
          'Title tags & meta descriptions',
          'Heading hierarchy (H1–H6)',
          'URL structure & slugs',
          'Image alt text & optimisation',
        ],
      },
      {
        Icon: Link2,
        name: 'Technical SEO & Crawlability',
        checkpoints: [
          'Robots.txt & sitemap.xml',
          'Canonical URLs',
          'Page speed & Core Web Vitals',
          'Mobile-first indexing',
        ],
      },
      {
        Icon: Share2,
        name: 'Structured Data & Rich Results',
        checkpoints: [
          'Schema.org markup',
          'JSON-LD implementation',
          'Rich snippet eligibility',
          'Knowledge graph signals',
        ],
      },
      {
        Icon: Scale,
        name: 'SEO Content & Link Strategy',
        checkpoints: [
          'Keyword targeting & density',
          'Internal link architecture',
          'Content depth & authority',
          'External link profile',
        ],
      },
    ],
    issues: [
      {
        severity: 'critical',
        label: 'Duplicate <title> on 40 % of pages',
        detail: 'Dilutes ranking signal — search engines cannot differentiate pages',
      },
      {
        severity: 'high',
        label: '12 landing pages with zero internal links',
        detail: 'Orphan pages get no crawl equity — effectively invisible to Google',
      },
      {
        severity: 'medium',
        label: 'Missing canonical on URL parameter variants',
        detail: 'Index bloat from ?utm_, ?ref=, and sort parameters',
      },
    ],
    whyItMatters:
      'Great content that search engines cannot parse is content that never gets found. SEO structure makes your quality visible to the systems that drive organic traffic.',
  },

  /* ── 6  Design consistency ─────────────────────────────────────── */
  {
    Icon: Fingerprint,
    name: 'Design consistency',
    tint: '#06B6D4',
    description:
      'Visual identity, voice alignment, messaging coherence, and brand standards — is the site telling one story or sending mixed signals?',
    categories: [
      {
        Icon: Eye,
        name: 'Visual Identity Alignment',
        checkpoints: [
          'Logo usage & placement',
          'Colour palette adherence',
          'Typography consistency',
          'Imagery & iconography style',
        ],
      },
      {
        Icon: MessageSquare,
        name: 'Voice & Tone Alignment',
        checkpoints: [
          'Brand voice consistency',
          'Tone-to-audience fit',
          'Messaging hierarchy',
          'Copy style guide adherence',
        ],
      },
      {
        Icon: Target,
        name: 'Messaging & Value Prop Alignment',
        checkpoints: [
          'Core value proposition clarity',
          'Tagline & headline alignment',
          'Feature-benefit framing',
          'Competitive differentiation',
        ],
      },
      {
        Icon: CheckCircle2,
        name: 'Brand Standards Compliance',
        checkpoints: [
          'Brand guideline adherence',
          'Cross-page consistency',
          'Template & layout standards',
          'Legal & trademark compliance',
        ],
      },
    ],
    issues: [
      {
        severity: 'critical',
        label: '5 different button styles across 4 pages',
        detail: 'Visual fragmentation — erodes the perception of a unified brand',
      },
      {
        severity: 'high',
        label: 'Blog uses a different font stack from marketing',
        detail: 'Typographic mismatch signals two separate products',
      },
      {
        severity: 'medium',
        label: 'Pricing tone is corporate, homepage is conversational',
        detail: 'Voice inconsistency at the decision page weakens trust',
      },
    ],
    whyItMatters:
      'Inconsistency signals carelessness. Every mismatched colour or tonal shift chips away at the perception of a professional, trustworthy brand.',
    brandDna: {
      without:
        'Checks internal consistency — are colours, fonts, spacing, and tone coherent across your own pages.',
      withConnected:
        'Also checks alignment against your uploaded brand identity — logo usage, colour palette, voice, tone, promise, and brand guide. The system compares the live site against the intended brand, not just against itself.',
    },
  },
]

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function HomeModules() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [animKey, setAnimKey] = useState(0)
  const active = MODULES[activeIndex]
  const scrollRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const sectionRef = useRef<HTMLElement>(null)

  // Scroll active tab into view on mobile
  const scrollActiveIntoView = useCallback((idx: number) => {
    const btn = btnRefs.current[idx]
    const container = scrollRef.current
    if (!btn || !container) return
    const cRect = container.getBoundingClientRect()
    const bRect = btn.getBoundingClientRect()
    const offset = bRect.left - cRect.left - (cRect.width / 2) + (bRect.width / 2)
    container.scrollBy({ left: offset, behavior: 'smooth' })
  }, [])

  const handleSelect = useCallback((idx: number) => {
    setActiveIndex(idx)
    setAnimKey((k) => k + 1)
    // Small delay so the DOM updates before scrolling
    requestAnimationFrame(() => scrollActiveIntoView(idx))
  }, [scrollActiveIntoView])

  // On mount, scroll active into view
  useEffect(() => { scrollActiveIntoView(activeIndex) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section ref={sectionRef} className="py-[100px] border-b border-rule max-sm:py-12">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="04" label="What we cover" centered />
        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-4 max-sm:mb-3 text-center"
          style={{ fontSize: 'clamp(36px, 7vw, 96px)' }}
        >
          Seven modules.{' '}
          <em className="italic text-signal">112 checkpoints.</em>
        </h2>
        <p className="text-[18px] max-sm:text-[15px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto mb-14 max-sm:mb-8 font-sans text-center">
          Technical quality, user experience, and brand perception — one
          system, one run, full picture.
        </p>
      </div>

      {/* ── Two-column: pills left · panel right ────────────────── */}
      <div className="max-w-[1080px] mx-auto px-8 max-sm:px-0">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">

          {/* ── Desktop: vertical pill list, sticky below nav ──── */}
          <nav
            className="hidden lg:flex flex-col gap-1 lg:sticky lg:self-start"
            style={{ top: 'calc(90px + 1.5rem)' }}
          >
            {MODULES.map((mod, i) => {
              const isActive = i === activeIndex
              return (
                <button
                  key={mod.name}
                  onClick={() => handleSelect(i)}
                  className="flex items-center gap-3 font-sans text-[13.5px] font-medium tracking-[-0.01em] px-4 py-3 rounded-lg transition-all duration-150 cursor-pointer text-left"
                  style={{
                    color: isActive ? 'var(--ink)' : 'var(--ink-2)',
                    background: isActive
                      ? `color-mix(in srgb, ${mod.tint} 6%, var(--paper))`
                      : 'transparent',
                    border: isActive
                      ? `1px solid color-mix(in srgb, ${mod.tint} 18%, transparent)`
                      : '1px solid transparent',
                  }}
                >
                  <mod.Icon
                    size={15}
                    strokeWidth={1.5}
                    className="shrink-0"
                    style={{ color: isActive ? mod.tint : 'var(--ink-2)' }}
                  />
                  <span className="flex-1">{mod.name}</span>
                  <span
                    className="text-[11px] tabular-nums font-normal"
                    style={{ color: 'var(--m-muted)' }}
                  >
                    16
                  </span>
                </button>
              )
            })}
          </nav>

          {/* ── Mobile / tablet: sticky horizontal scroll tab bar ── */}
          <div
            className="lg:hidden sticky z-20"
            style={{
              top: '64px', /* below nav */
              marginLeft: '-1px',
              marginRight: '-1px',
            }}
          >
            <div
              className="backdrop-blur-md"
              style={{
                background: 'color-mix(in srgb, var(--paper) 88%, transparent)',
                borderTop: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)',
                borderBottom: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)',
              }}
            >
              <div
                ref={scrollRef}
                className="flex gap-1 overflow-x-auto px-5 py-3.5 scrollbar-hide"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {MODULES.map((mod, i) => {
                  const isActive = i === activeIndex
                  return (
                    <button
                      key={mod.name}
                      ref={(el) => { btnRefs.current[i] = el }}
                      onClick={() => handleSelect(i)}
                      className="flex items-center gap-1.5 font-sans text-[12px] font-medium whitespace-nowrap px-3 py-2 rounded-full transition-all duration-150 cursor-pointer shrink-0"
                      style={{
                        color: isActive ? 'var(--ink)' : 'var(--ink-2)',
                        background: isActive
                          ? `color-mix(in srgb, ${mod.tint} 8%, var(--paper))`
                          : 'transparent',
                        border: isActive
                          ? `1px solid color-mix(in srgb, ${mod.tint} 20%, transparent)`
                          : '1px solid color-mix(in srgb, var(--ink) 6%, transparent)',
                      }}
                    >
                      <mod.Icon
                        size={13}
                        strokeWidth={1.5}
                        className="shrink-0"
                        style={{ color: isActive ? mod.tint : 'var(--m-muted)' }}
                      />
                      {mod.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Explainer panel ──────────────────────────────────── */}
          <div
            className="rounded-xl max-sm:rounded-none overflow-hidden max-sm:mx-0"
            style={{
              border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)',
              background: 'var(--paper)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-6 py-4 max-sm:px-4 max-sm:py-3"
              style={{
                borderBottom: '1px solid color-mix(in srgb, var(--ink) 6%, transparent)',
              }}
            >
              <span
                className="flex items-center justify-center w-7 h-7 max-sm:w-6 max-sm:h-6 rounded-md"
                style={{ background: `color-mix(in srgb, ${active.tint} 10%, transparent)` }}
              >
                <active.Icon size={15} strokeWidth={1.5} style={{ color: active.tint }} className="max-sm:!w-[13px] max-sm:!h-[13px]" />
              </span>
              <h3
                className="font-sans text-[16px] max-sm:text-[14px] font-semibold tracking-[-0.02em]"
                style={{ color: 'var(--ink)' }}
              >
                {active.name}
              </h3>
              <span
                className="ml-auto font-mono text-[10px] max-sm:text-[9px] uppercase tracking-[0.1em]"
                style={{ color: 'var(--m-muted)' }}
              >
                4 categories &middot; 16 checks
              </span>
            </div>

            {/* Body — keyed for fade transition */}
            <div
              key={animKey}
              className="px-6 py-5 max-sm:px-4 max-sm:py-4 space-y-5 max-sm:space-y-4"
              style={{ animation: 'fadeSlideIn 200ms ease-out' }}
            >
              {/* Description */}
              <p
                className="font-sans text-[14px] max-sm:text-[13px] leading-[1.7]"
                style={{ color: 'var(--ink)' }}
              >
                {active.description}
              </p>

              {/* ── What it checks ── 2×2 category grid ─────────── */}
              <div>
                <h4
                  className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] mb-3 max-sm:mb-2"
                  style={{ color: 'var(--m-muted)' }}
                >
                  What it checks
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-sm:gap-2">
                  {active.categories.map((cat) => (
                    <div
                      key={cat.name}
                      className="rounded-lg px-4 py-3.5 max-sm:px-3 max-sm:py-2.5"
                      style={{
                        background: 'color-mix(in srgb, var(--ink) 2.5%, transparent)',
                        borderLeft: `2px solid color-mix(in srgb, ${active.tint} 35%, transparent)`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2 max-sm:mb-1.5">
                        <cat.Icon
                          size={13}
                          strokeWidth={1.5}
                          style={{ color: active.tint }}
                          className="shrink-0"
                        />
                        <span
                          className="font-sans text-[12px] max-sm:text-[11.5px] font-semibold tracking-[-0.01em] leading-tight"
                          style={{ color: 'var(--ink)' }}
                        >
                          {cat.name}
                        </span>
                      </div>
                      <ul className="space-y-0.5">
                        {cat.checkpoints.map((cp) => (
                          <li
                            key={cp}
                            className="flex items-baseline gap-2 font-sans text-[11.5px] max-sm:text-[11px] leading-[1.5]"
                            style={{ color: 'var(--ink-2)' }}
                          >
                            <span
                              className="shrink-0 w-[3px] h-[3px] rounded-full mt-[5px]"
                              style={{ background: active.tint, opacity: 0.5 }}
                            />
                            {cp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Example issues ── lint / code-error style ────── */}
              <div>
                <h4
                  className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] mb-3 max-sm:mb-2"
                  style={{ color: 'var(--m-muted)' }}
                >
                  Example issues found
                </h4>
                <div
                  className="rounded-lg overflow-hidden"
                  style={{
                    background: 'color-mix(in srgb, var(--ink) 3%, var(--paper))',
                    border: '1px solid color-mix(in srgb, var(--ink) 6%, transparent)',
                  }}
                >
                  {active.issues.map((issue, i) => {
                    const sev = SEV[issue.severity]
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 max-sm:gap-2 px-4 py-3 max-sm:px-3 max-sm:py-2.5"
                        style={{
                          borderBottom:
                            i < active.issues.length - 1
                              ? '1px solid color-mix(in srgb, var(--ink) 5%, transparent)'
                              : 'none',
                        }}
                      >
                        <span
                          className="shrink-0 mt-[1px] font-mono text-[9px] font-bold uppercase tracking-[0.05em] px-1.5 py-[2px] rounded"
                          style={{ background: sev.bg, color: sev.fg }}
                        >
                          {sev.label}
                        </span>
                        <div className="min-w-0">
                          <p
                            className="font-sans text-[12.5px] max-sm:text-[12px] font-medium leading-[1.45]"
                            style={{ color: 'var(--ink)' }}
                          >
                            {issue.label}
                          </p>
                          <p
                            className="font-sans text-[11px] leading-[1.5] mt-0.5"
                            style={{ color: 'var(--m-muted)' }}
                          >
                            {issue.detail}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── Why it matters ── light green ─────────────────── */}
              <div
                className="rounded-lg px-5 py-4 max-sm:px-3.5 max-sm:py-3"
                style={{
                  background: 'color-mix(in srgb, var(--ok) 8%, var(--paper))',
                  border: '1px solid color-mix(in srgb, var(--ok) 15%, transparent)',
                }}
              >
                <h4
                  className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5"
                  style={{ color: 'var(--ok)' }}
                >
                  Why it matters
                </h4>
                <p
                  className="font-sans text-[13px] max-sm:text-[12px] leading-[1.65]"
                  style={{ color: 'var(--ink)' }}
                >
                  {active.whyItMatters}
                </p>
              </div>

              {/* ── Brand DNA callout (Design consistency only) ──── */}
              {active.brandDna && (
                <div
                  className="rounded-lg overflow-hidden"
                  style={{
                    border: '1px solid color-mix(in srgb, var(--signal) 25%, transparent)',
                    background: 'color-mix(in srgb, var(--signal) 4%, transparent)',
                  }}
                >
                  <div className="px-5 py-4 max-sm:px-3.5 max-sm:py-3">
                    <div className="flex items-center gap-2 mb-3 max-sm:mb-2">
                      <Zap size={13} strokeWidth={2} style={{ color: 'var(--signal)' }} />
                      <h4
                        className="font-sans text-[12px] font-semibold tracking-[-0.01em]"
                        style={{ color: 'var(--signal)' }}
                      >
                        Brand DNA upgrade
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-sm:gap-3">
                      <div>
                        <p
                          className="font-sans text-[10px] font-semibold uppercase tracking-[0.06em] mb-1"
                          style={{ color: 'var(--m-muted)' }}
                        >
                          Without Brand DNA
                        </p>
                        <p
                          className="font-sans text-[12.5px] max-sm:text-[12px] leading-[1.6]"
                          style={{ color: 'var(--ink-2)' }}
                        >
                          {active.brandDna.without}
                        </p>
                      </div>
                      <div>
                        <p
                          className="font-sans text-[10px] font-semibold uppercase tracking-[0.06em] mb-1"
                          style={{ color: 'var(--signal)' }}
                        >
                          With Brand DNA connected
                        </p>
                        <p
                          className="font-sans text-[12.5px] max-sm:text-[12px] leading-[1.6]"
                          style={{ color: 'var(--ink)' }}
                        >
                          {active.brandDna.withConnected}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
