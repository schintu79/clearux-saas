'use client'

import { useRef } from 'react'
import { SectionMarker } from './SectionMarker'

const callouts = [
  { num: '01', title: 'Severity, ranked.', desc: 'Critical, medium, or minor — calibrated to business impact, not severity-theatre.' },
  { num: '02', title: 'Evidence, not opinion.', desc: 'The exact element, the exact pattern, the exact reason it fails.' },
  { num: '03', title: 'The fix, shippable.', desc: 'Copy-paste ready. No "consider refactoring." Concrete and specific.' },
]

/* ── Cards for the scrolling strip ── */
const FINDING_CARDS = [
  {
    label: '3-panel findings',
    title: 'Issue, fix, and impact — at a glance',
    desc: 'Every finding shows the problem, how to fix it, and the business impact. No guesswork, no extra clicks.',
    visual: (
      <div className="w-full border border-rule rounded-lg overflow-hidden" style={{ fontSize: 0 }}>
        <div className="px-3 py-2 flex items-center gap-2 border-b border-rule">
          <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full text-red-600 bg-red-50">Critical</span>
          <span className="text-[10px] font-semibold text-gray-900 flex-1">CTA button uses vague label</span>
        </div>
        <div className="grid grid-cols-3 text-left">
          {['Issue', 'How to fix', 'Impact'].map((h, i) => (
            <div key={h} className={`p-2.5 ${i < 2 ? 'border-r border-rule' : ''}`}>
              <span className="text-[7px] font-semibold text-gray-400 tracking-[0.04em] uppercase block mb-1">{h}</span>
              <p className="text-[8px] text-gray-600 leading-[1.4]">
                {i === 0 && 'Button says "Click here" without context.'}
                {i === 1 && 'Change to "Start free trial" — specific, action-oriented.'}
                {i === 2 && 'Conversion rate increase of 22%.'}
              </p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    label: 'AI vs human',
    title: 'Two perspectives on every issue',
    desc: 'Each finding shows how AI reads it alongside how a real user experiences it. Fix for both audiences at once.',
    visual: (
      <div className="w-full border border-rule rounded-lg overflow-hidden" style={{ fontSize: 0 }}>
        <div className="grid grid-cols-2">
          <div className="p-3 border-r border-rule">
            <div className="flex items-center gap-1 mb-1.5">
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth={1.5}><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" /></svg>
              <span className="text-[8px] font-semibold text-gray-400 tracking-[0.04em] uppercase">How AI reads this</span>
            </div>
            <p className="text-[9px] text-gray-600 leading-[1.5]">The CTA uses vague text. AI models can&apos;t determine the action.</p>
          </div>
          <div className="p-3">
            <div className="flex items-center gap-1 mb-1.5">
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={1.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx={9} cy={7} r={4} /></svg>
              <span className="text-[8px] font-semibold text-gray-400 tracking-[0.04em] uppercase">How a human sees this</span>
            </div>
            <p className="text-[9px] text-gray-600 leading-[1.5]">Users hesitate because the label doesn&apos;t tell them what happens next.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    label: 'Score overview',
    title: '6 modules, 96 checkpoints',
    desc: 'Every page scored across usability, accessibility, performance, content, SEO, and AI readiness — in one view.',
    visual: (
      <div className="w-full border border-rule rounded-lg overflow-hidden p-3" style={{ fontSize: 0 }}>
        <div className="flex items-center gap-3">
          <div className="relative" style={{ width: 48, height: 48 }}>
            <svg width={48} height={48} className="-rotate-90">
              <circle cx={24} cy={24} r={20} fill="none" stroke="#eee" strokeWidth={3} />
              <circle cx={24} cy={24} r={20} fill="none" stroke="#f59e0b" strokeWidth={3} strokeLinecap="round"
                strokeDasharray={125.6} strokeDashoffset={125.6 * (1 - 0.68)} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[12px] font-semibold text-gray-900">68</span>
            </div>
          </div>
          <div className="flex-1 space-y-1">
            {[
              { name: 'Foundation', s: 81, c: '#6366F1' },
              { name: 'Human Experience', s: 62, c: '#EC4899' },
              { name: 'Inclusive Design', s: 74, c: '#10B981' },
              { name: 'Future Readiness', s: 55, c: '#F59E0B' },
            ].map(m => (
              <div key={m.name} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.c }} />
                <span className="text-[8px] text-gray-500 flex-1">{m.name}</span>
                <span className="text-[8px] font-medium" style={{ color: m.s >= 70 ? '#22c55e' : '#f59e0b' }}>{m.s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    label: 'Fix playbooks',
    title: 'Copy-paste fixes you can ship today',
    desc: 'Ready-to-use JSON-LD, meta tags, and code snippets. Paste them in, re-audit, and watch your score climb.',
    visual: (
      <div className="w-full border border-rule rounded-lg overflow-hidden" style={{ fontSize: 0 }}>
        <div className="px-3 py-2 border-b border-rule flex items-center gap-1.5">
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth={1.5}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
          <span className="text-[10px] font-semibold text-gray-900">Fix playbooks</span>
          <span className="ml-auto text-[8px] text-gray-400">3 snippets</span>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[7px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">json_ld</span>
            <span className="text-[9px] font-medium text-gray-800">Organization schema</span>
          </div>
          <pre className="bg-gray-50 border border-gray-200 rounded p-2 text-[7px] font-mono text-gray-600 leading-relaxed overflow-hidden" style={{ maxHeight: 60 }}>
{`{
  "@type": "Organization",
  "name": "Acme Corp",
  "url": "https://acme.com"
}`}
          </pre>
        </div>
      </div>
    ),
  },
  {
    label: 'Brand audit',
    title: 'Cross-check your brand vs. live site',
    desc: 'Upload guidelines, we compare them against what is deployed. Spot every mismatch in logo, colors, tone, and typography.',
    visual: (
      <div className="w-full border border-rule rounded-lg overflow-hidden p-3 space-y-2" style={{ fontSize: 0 }}>
        {[
          { name: 'Logo usage', s: 88 },
          { name: 'Color system', s: 72 },
          { name: 'Typography', s: 91 },
          { name: 'Voice and tone', s: 65 },
        ].map(c => {
          const color = c.s >= 80 ? '#22c55e' : c.s >= 65 ? '#f59e0b' : '#ef4444'
          return (
            <div key={c.name}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-gray-700">{c.name}</span>
                <span className="text-[9px] font-medium" style={{ color }}>{c.s}</span>
              </div>
              <div className="w-full h-1 rounded-full bg-gray-100">
                <div className="h-full rounded-full" style={{ width: `${c.s}%`, background: color }} />
              </div>
            </div>
          )
        })}
      </div>
    ),
  },
  {
    label: 'Export',
    title: 'Professional reports, ready to share',
    desc: 'Download PDF or Word reports. Share a link with no login required. Copy findings into Jira, Notion, or Slack.',
    visual: (
      <div className="w-full border border-rule rounded-lg overflow-hidden" style={{ fontSize: 0 }}>
        {[
          { name: 'PDF report', icon: 'pdf', status: 'Ready' },
          { name: 'Word document', icon: 'doc', status: 'Ready' },
          { name: 'Shareable link', icon: 'link', status: 'Active' },
          { name: 'Jira / Notion', icon: 'copy', status: 'Copy' },
        ].map((f, i) => (
          <div key={i} className="px-3 py-2 flex items-center gap-2" style={{ borderTop: i > 0 ? '1px solid var(--rule)' : 'none' }}>
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth={1.5}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
            </svg>
            <span className="text-[10px] text-gray-800 flex-1">{f.name}</span>
            <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full text-indigo-600 bg-indigo-50">{f.status}</span>
          </div>
        ))}
      </div>
    ),
  },
]

export function FindingAnatomy() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -440 : 440, behavior: 'smooth' })
  }

  return (
    <section className="py-[100px] border-b border-rule overflow-hidden" id="anatomy">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="grid lg:grid-cols-[1fr_1.3fr] gap-16 items-start max-lg:grid-cols-1 mb-20 max-sm:mb-12">
          {/* Left */}
          <div>
            <SectionMarker number="08" label="Anatomy of a finding" />
            <h2 className="font-serif font-normal text-ink leading-[1.02] tracking-[-0.022em] mb-6" style={{ fontSize: 'clamp(40px, 4.5vw, 64px)' }}>
              What a <em className="italic text-signal">real</em> finding looks like.
            </h2>
            <p className="text-[17px] leading-[1.55] text-ink-2 mb-7 font-sans">
              Every checkpoint in a Fixpath report follows the same anatomy. Severity. Evidence. Business impact. A specific fix your engineer or designer can ship on Monday. This is what closes the loop between &ldquo;audit&rdquo; and &ldquo;outcome.&rdquo;
            </p>

            <ul className="list-none mt-9">
              {callouts.map((c) => (
                <li key={c.num} className="flex gap-3.5 py-3.5 border-t border-rule text-[14px] items-baseline last:border-b">
                  <span className="font-mono text-[11px] text-signal font-semibold min-w-[32px]">{c.num}</span>
                  <div>
                    <strong className="block font-semibold mb-0.5 text-ink">{c.title}</strong>
                    <span className="text-m-muted text-[13px]">{c.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right — finding card */}
          <div className="bg-paper border border-ink rounded-[2px] overflow-hidden" style={{ boxShadow: '8px 8px 0 var(--shadow-offset)' }}>
            {/* Head */}
            <div className="bg-ink text-paper px-7 py-5 flex justify-between items-center">
              <span className="font-mono text-[11px] tracking-[0.1em] uppercase" style={{ color: 'color-mix(in srgb, var(--paper) 55%, transparent)' }}>
                Finding · HX-04 · Audit #4827
              </span>
              <span className="bg-signal text-white font-mono text-[10px] font-semibold tracking-[0.12em] uppercase px-2.5 py-[5px] rounded-[2px]">
                Critical
              </span>
            </div>

            {/* Body */}
            <div className="px-7 py-8">
              <h3 className="font-serif font-normal text-[32px] tracking-[-0.02em] leading-[1.1] mb-2 text-ink">
                Subscription flow uses pre-checked consent box for marketing emails.
              </h3>
              <div className="font-mono text-[11px] text-m-muted tracking-[0.06em] uppercase mb-6 pb-5 border-b border-dashed border-rule-2">
                Module: Human Experience · Pattern: Confirmshaming + opt-out trap · Page: /checkout
              </div>

              {/* What we observed */}
              <div className="mb-[22px]">
                <div className="font-mono text-[10px] text-signal font-semibold tracking-[0.12em] uppercase mb-2">What we observed</div>
                <p className="text-[14.5px] leading-[1.55] text-ink-2 font-sans">
                  The checkout form&apos;s marketing-consent checkbox is checked by default. Below it, the opt-out copy reads &ldquo;No thanks, I prefer to miss exclusive offers.&rdquo; This combination triggers two recognised dark patterns simultaneously: pre-selection (GDPR Article 7) and confirmshaming.
                </p>
              </div>

              {/* Business impact */}
              <div className="mb-[22px]">
                <div className="font-mono text-[10px] text-signal font-semibold tracking-[0.12em] uppercase mb-2">Business impact</div>
                <p className="text-[14.5px] leading-[1.55] text-ink-2 font-sans">
                  Beyond regulatory exposure (estimated &euro;4k&ndash;&euro;20k per violation under GDPR), trust drops measurably post-checkout. Fixpath models a 6&ndash;11% lift in repeat purchase when consent patterns are clean.
                </p>
              </div>

              {/* The fix */}
              <div>
                <div className="font-mono text-[10px] text-signal font-semibold tracking-[0.12em] uppercase mb-2">The fix</div>
                <p className="text-[14.5px] leading-[1.55] text-ink-2 font-sans">Uncheck by default, rewrite copy in neutral voice:</p>
                <code className="block font-mono text-[12.5px] bg-paper-2 border border-rule px-3.5 py-3 mt-2 text-ink leading-[1.6] whitespace-pre-wrap">
{`<label>
  <input type="checkbox" name="marketing">
  Send me occasional updates and offers.
</label>`}
                </code>
              </div>
            </div>

            {/* Foot */}
            <div className="bg-paper-2 px-7 py-4 border-t border-rule flex justify-between font-mono text-[11px] text-m-muted tracking-[0.06em] uppercase">
              <span>Est. fix time: <strong className="text-ok">12 min</strong></span>
              <span>Confidence: <strong className="text-ok">97%</strong></span>
            </div>
          </div>
        </div>

        {/* Scroll arrows */}
        <div className="flex gap-2 justify-end mb-4">
          <button onClick={() => scroll('left')} className="w-10 h-10 rounded-full border border-rule flex items-center justify-center text-ink hover:bg-paper-2 transition-colors" aria-label="Scroll left">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button onClick={() => scroll('right')} className="w-10 h-10 rounded-full border border-rule flex items-center justify-center text-ink hover:bg-paper-2 transition-colors" aria-label="Scroll right">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      {/* Card strip */}
      <div ref={scrollRef} className="flex gap-5 overflow-x-auto px-8 max-sm:px-5 pb-4 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        <div className="flex-shrink-0" style={{ width: 'max(0px, calc((100vw - 1200px) / 2 - 32px))' }} />
        {FINDING_CARDS.map((card, i) => (
          <div key={i} className="flex-shrink-0 w-[440px] max-sm:w-[340px] snap-start border border-rule rounded-xl overflow-hidden bg-white/80 hover:border-signal/30 transition-colors">
            <div className="h-[260px] border-b border-rule p-6 flex items-center justify-center overflow-hidden">
              <div style={{ transform: 'scale(1.18)', transformOrigin: 'center center', width: '85%' }}>
                {card.visual}
              </div>
            </div>
            <div className="p-5">
              <span className="text-[10px] font-mono tracking-[0.08em] uppercase text-signal font-semibold block mb-2">{card.label}</span>
              <h4 className="font-sans text-[15px] font-semibold text-ink mb-2 leading-snug">{card.title}</h4>
              <p className="font-sans text-[13px] text-ink-2 leading-[1.55]">{card.desc}</p>
            </div>
          </div>
        ))}
        <div className="flex-shrink-0 w-8" />
      </div>
    </section>
  )
}
