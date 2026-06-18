'use client'

import { useRef } from 'react'
import { SectionMarker } from './SectionMarker'
import { useTheme } from '@/context/ThemeContext'

const PILLARS = [
  {
    title: 'Cognitive load',
    desc: 'We measure how much mental effort your interface demands. Forms that exhaust, navigation that confuses, layouts that overwhelm — before users bounce.',
  },
  {
    title: 'Dark patterns',
    desc: 'Forced urgency, confirm-shaming, hidden costs. We flag manipulative design that erodes trust — not just GDPR violations, but the subtle ones users feel but can\'t name.',
  },
  {
    title: 'User wellbeing',
    desc: 'Checkout flows that create unnecessary anxiety. Error states that blame the user. Consent patterns that pressure. We audit how your product treats people under stress.',
  },
]

/* ── Highlight cards shown in the scrolling strip ── */
const HX_CARDS = [
  {
    label: 'Dark patterns',
    title: 'Every manipulative trick, flagged',
    desc: 'Confirmshaming, forced continuity, hidden costs, fake urgency — all detected with severity and evidence.',
    visual: (
      <div className="w-full border border-[rgba(255,255,255,0.12)] rounded-lg overflow-hidden" style={{ fontSize: 0 }}>
        {[
          { name: 'Confirmshaming detected', fail: true, sev: 'High' },
          { name: 'Forced continuity warning', fail: true, sev: 'Medium' },
          { name: 'Clear opt-out available', fail: false, sev: '' },
          { name: 'Honest pricing display', fail: false, sev: '' },
        ].map((c, i) => (
          <div key={i} className="px-3 py-2 flex items-center gap-2" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
            {c.fail ? (
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2}><circle cx={12} cy={12} r={10} /><line x1={15} y1={9} x2={9} y2={15} /><line x1={9} y1={9} x2={15} y2={15} /></svg>
            ) : (
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
            )}
            <span className="text-[10px] flex-1" style={{ color: 'rgba(255,255,255,0.8)' }}>{c.name}</span>
            {c.sev && <span className="text-[7px] font-semibold px-1 py-0.5 rounded-full bg-red-500/20 text-red-400">{c.sev}</span>}
          </div>
        ))}
      </div>
    ),
  },
  {
    label: 'Cognitive load',
    title: 'Measure mental effort per page',
    desc: 'Too many choices, unclear hierarchy, competing CTAs — we score what makes users hesitate and leave.',
    visual: (
      <div className="w-full space-y-2">
        {[
          { page: '/pricing', load: 82, color: '#ef4444' },
          { page: '/checkout', load: 67, color: '#f59e0b' },
          { page: '/', load: 34, color: '#22c55e' },
          { page: '/docs', load: 41, color: '#f59e0b' },
        ].map((p, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{p.page}</span>
              <span className="text-[9px] font-semibold" style={{ color: p.color }}>{p.load}%</span>
            </div>
            <div className="w-full h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full" style={{ width: `${p.load}%`, background: p.color }} />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    label: 'Conversion friction',
    title: 'Where users drop off and why',
    desc: 'We trace the path from landing to conversion and flag every point of hesitation, confusion, or abandonment.',
    visual: (
      <div className="w-full border border-[rgba(255,255,255,0.12)] rounded-lg overflow-hidden" style={{ fontSize: 0 }}>
        {[
          { step: 'Landing page', pct: '100%', ok: true },
          { step: 'Pricing click', pct: '64%', ok: true },
          { step: 'Sign up form', pct: '38%', ok: false },
          { step: 'Checkout', pct: '12%', ok: false },
        ].map((s, i) => (
          <div key={i} className="px-3 py-2 flex items-center gap-2" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
            <span className="text-[10px] flex-1" style={{ color: 'rgba(255,255,255,0.8)' }}>{s.step}</span>
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{
              color: s.ok ? '#22c55e' : '#ef4444',
              background: s.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            }}>{s.pct}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    label: 'Wellbeing',
    title: 'Does your site respect users?',
    desc: 'Anxiety-inducing checkout, blame-shifting error states, pressure tactics — we check if your UX treats people well.',
    visual: (
      <div className="w-full border border-[rgba(255,255,255,0.12)] rounded-lg p-3 space-y-2" style={{ fontSize: 0 }}>
        {[
          { label: 'Anxiety-free checkout', score: 72 },
          { label: 'Neutral error messaging', score: 88 },
          { label: 'Consent transparency', score: 45 },
          { label: 'No pressure tactics', score: 31 },
        ].map((w, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.65)' }}>{w.label}</span>
              <span className="text-[8px] font-semibold" style={{ color: w.score >= 70 ? '#22c55e' : w.score >= 50 ? '#f59e0b' : '#ef4444' }}>{w.score}</span>
            </div>
            <div className="w-full h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full" style={{ width: `${w.score}%`, background: w.score >= 70 ? '#22c55e' : w.score >= 50 ? '#f59e0b' : '#ef4444' }} />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    label: 'Responsive',
    title: 'Tested at 4 viewport sizes',
    desc: 'Desktop, laptop, tablet, and mobile — layout breaks, touch targets, and overflow issues caught automatically.',
    visual: (
      <div className="w-full border border-[rgba(255,255,255,0.12)] rounded-lg overflow-hidden" style={{ fontSize: 0 }}>
        {[
          { name: 'Desktop 1440', status: 'pass' },
          { name: 'Laptop 1024', status: 'pass' },
          { name: 'Tablet 768', status: 'warn' },
          { name: 'Mobile 375', status: 'fail' },
        ].map((v, i) => (
          <div key={i} className="px-3 py-2 flex items-center gap-2" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
            <span className="text-[10px] flex-1" style={{ color: 'rgba(255,255,255,0.8)' }}>{v.name}</span>
            <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full" style={{
              color: v.status === 'pass' ? '#22c55e' : v.status === 'warn' ? '#f59e0b' : '#ef4444',
              background: v.status === 'pass' ? 'rgba(34,197,94,0.15)' : v.status === 'warn' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
            }}>
              {v.status === 'pass' ? 'OK' : v.status === 'warn' ? 'Issues' : 'Broken'}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    label: 'Accessibility',
    title: 'WCAG compliance, checked',
    desc: 'Color contrast, keyboard navigation, screen reader support, focus management — every page scored for inclusivity.',
    visual: (
      <div className="w-full border border-[rgba(255,255,255,0.12)] rounded-lg p-3" style={{ fontSize: 0 }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="relative" style={{ width: 44, height: 44 }}>
            <svg width={44} height={44} className="-rotate-90">
              <circle cx={22} cy={22} r={18} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={3} />
              <circle cx={22} cy={22} r={18} fill="none" stroke="#22c55e" strokeWidth={3} strokeLinecap="round"
                strokeDasharray={113} strokeDashoffset={113 * (1 - 0.74)} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-semibold" style={{ color: '#22c55e' }}>74</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>Accessibility score</p>
            <p className="text-[8px]" style={{ color: 'rgba(255,255,255,0.5)' }}>WCAG 2.1 AA baseline</p>
          </div>
        </div>
        <div className="space-y-1">
          {['Color contrast', 'Keyboard nav', 'Alt text', 'Focus order'].map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke={i < 3 ? '#22c55e' : '#f59e0b'} strokeWidth={2}>
                {i < 3 ? <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></> : <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1={12} y1={9} x2={12} y2={13} /><line x1={12} y1={17} x2={12.01} y2={17} /></>}
              </svg>
              <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
]

export function HumanExperience() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const scrollRef = useRef<HTMLDivElement>(null)
  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -440 : 440, behavior: 'smooth' })
  }

  const borderColor = isDark ? 'var(--rule)' : 'rgba(255,255,255,0.15)'

  return (
    <section
      className="py-[120px] max-sm:py-[80px] overflow-hidden"
      style={{
        background: isDark ? 'var(--paper)' : 'var(--ink)',
        color: isDark ? 'var(--ink)' : '#ffffff',
      }}
    >
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        {/* Section heading */}
        <div className="mb-20 max-sm:mb-12">
          <SectionMarker number="04" label="Human experience" dark={!isDark} />
          <h2
            className="font-serif font-normal leading-[0.96] tracking-[-0.025em] mb-6"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)', color: isDark ? 'var(--ink)' : '#ffffff' }}
          >
            We audit how it{' '}
            <em className="italic" style={{ color: isDark ? 'var(--signal)' : '#A4B26A' }}>feels,</em>{' '}
            not just how it works.
          </h2>
          <p
            className="text-[19px] leading-[1.55] font-sans max-w-[600px]"
            style={{ color: isDark ? 'var(--m-muted)' : 'rgba(255,255,255,0.55)' }}
          >
            Cognitive load, dark patterns, and user wellbeing are first-class checks — not edge cases. This is what separates a UX audit from a tech scan.
          </p>
        </div>

        {/* Scroll arrows */}
        <div className="flex gap-2 justify-end mb-4">
          <button onClick={() => scroll('left')} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors" style={{ border: `1px solid ${borderColor}`, color: isDark ? 'var(--ink)' : '#fff' }} aria-label="Scroll left">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button onClick={() => scroll('right')} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors" style={{ border: `1px solid ${borderColor}`, color: isDark ? 'var(--ink)' : '#fff' }} aria-label="Scroll right">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      {/* Card strip — edge-to-edge scroll */}
      <div ref={scrollRef} className="flex gap-5 overflow-x-auto px-8 max-sm:px-5 pb-4 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        <div className="flex-shrink-0" style={{ width: 'max(0px, calc((100vw - 1200px) / 2 - 32px))' }} />
        {HX_CARDS.map((card, i) => (
          <div key={i} className="flex-shrink-0 w-[440px] max-sm:w-[340px] snap-start rounded-xl overflow-hidden transition-colors" style={{ border: `1px solid ${borderColor}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)' }}>
            <div className="h-[260px] p-6 flex items-center justify-center overflow-hidden" style={{ borderBottom: `1px solid ${borderColor}` }}>
              {/* Decorative mockup (tiny text) — hidden from a11y/audit checkers; real copy is below. */}
              <div aria-hidden="true" style={{ transform: 'scale(1.18)', transformOrigin: 'center center', width: '85%' }}>
                {card.visual}
              </div>
            </div>
            <div className="p-5">
              <span className="text-[10px] font-mono tracking-[0.08em] uppercase font-semibold block mb-2" style={{ color: isDark ? 'var(--signal)' : '#A4B26A' }}>{card.label}</span>
              <h4 className="font-sans text-[15px] font-semibold mb-2 leading-snug" style={{ color: isDark ? 'var(--ink)' : '#fff' }}>{card.title}</h4>
              <p className="font-sans text-[13px] leading-[1.55]" style={{ color: isDark ? 'var(--m-muted)' : 'rgba(255,255,255,0.55)' }}>{card.desc}</p>
            </div>
          </div>
        ))}
        <div className="flex-shrink-0 w-8" />
      </div>
    </section>
  )
}
