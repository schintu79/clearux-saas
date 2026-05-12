'use client'

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

export function HumanExperience() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <section
      className="py-[120px] max-sm:py-[80px]"
      style={{
        background: isDark ? 'var(--paper)' : 'var(--ink)',
        color: isDark ? 'var(--ink)' : '#ffffff',
      }}
    >
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        {/* Big statement heading */}
        <div className="mb-20 max-sm:mb-12">
          <SectionMarker number="03" label="Human experience" dark={!isDark} />
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

        {/* Three pillar cards */}
        <div className="grid md:grid-cols-3 gap-0" style={{ border: `1px solid ${isDark ? 'var(--rule)' : 'rgba(255,255,255,0.15)'}` }}>
          {PILLARS.map((pillar, i) => (
            <div
              key={pillar.title}
              className={`p-8 max-sm:p-6 ${i < PILLARS.length - 1 ? 'md:border-r max-md:border-b' : ''}`}
              style={{ borderColor: isDark ? 'var(--rule)' : 'rgba(255,255,255,0.15)' }}
            >
              <h3
                className="font-sans text-[17px] font-semibold mb-3"
                style={{ color: isDark ? 'var(--ink)' : '#ffffff' }}
              >
                {pillar.title}
              </h3>
              <p
                className="font-sans text-[14px] leading-[1.65]"
                style={{ color: isDark ? 'var(--m-muted)' : 'rgba(255,255,255,0.6)' }}
              >
                {pillar.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
