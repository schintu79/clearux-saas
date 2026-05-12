'use client'

import { SectionMarker } from '@/components/marketing/SectionMarker'
import { Coda } from '@/components/marketing/Coda'
import { HumanExperience } from '@/components/marketing/HumanExperience'

const MODULES = [
  { num: '01', title: 'Foundation', desc: 'Visual design, messaging, navigation, content quality. The structural baseline a great experience is built on.', count: 16, range: 'F-01 → F-16' },
  { num: '02', title: 'Human Experience', desc: 'Clarity, cognitive load, dark patterns, conversion friction. Whether your UX respects users in stressed or impaired states.', count: 22, range: 'HX-01 → HX-22' },
  { num: '03', title: 'Inclusive Design', desc: 'WCAG compliance, cognitive accessibility, mobile context, equity across abilities. Every user, every context.', count: 18, range: 'ID-01 → ID-18' },
  { num: '04', title: 'Future Readiness', desc: 'How LLMs and AI agents read your product. Performance, agent readiness, internationalisation. The discovery layer of the next decade.', count: 14, range: 'FR-01 → FR-14' },
  { num: '05', title: 'Brand Consistency', desc: 'Voice, visual identity, tone alignment. Whether what users see matches what your brand promises — surface to surface.', count: 14, range: 'BC-01 → BC-14' },
  { num: '06', title: 'SEO Structure', desc: 'Heading hierarchy, meta tags, structured data, crawlability. Whether your product is findable, legible, and ranked the way it deserves.', count: 12, range: 'SEO-01 → SEO-12' },
]

const STEPS = [
  { num: '01', title: 'Choose your audit', desc: 'Paste a website URL, upload brand identity files (PDF, DOCX, images), or submit a design. ClearUX handles all three.' },
  { num: '02', title: 'We run 96 checkpoints', desc: 'Every input analysed across six modules and 24 categories. Every score is evidence-based — no subjective hand-waving.' },
  { num: '03', title: 'You decide what to fix', desc: 'Every issue ranked and explained. Export as PDF or Word, share with a link. We identify. You decide.' },
]

export default function HowItWorksContent() {
  return (
    <main>
      {/* Hero */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="01" label="How it works" />
          <h1 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-8" style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}>
            Audit your product. Get <em className="italic text-signal">360° clarity.</em>
          </h1>
          <p className="text-[19px] leading-[1.55] text-ink-2 max-w-[640px] font-sans">
            ClearUX audits your website, brand identity, and design across 96 checkpoints in 6 modules. Prioritised findings with evidence, severity rankings, and specific fixes. Professional-grade depth in minutes.
          </p>
        </div>
      </section>

      {/* Three-step process */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="02" label="The process" />
          <h2 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.02em] mb-14" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Three steps to <em className="italic text-signal">clarity.</em>
          </h2>

          <div className="grid md:grid-cols-3 gap-0 border border-ink">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className={`p-8 ${i < STEPS.length - 1 ? 'md:border-r border-ink max-md:border-b' : ''}`}
              >
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

      {/* Human experience — reuses exact homepage component */}
      <HumanExperience />

      {/* Product preview — CSS-rendered screenshots */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="03" label="Inside the product" />
          <h2 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.02em] mb-6" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            See what you <em className="italic text-signal">get.</em>
          </h2>
          <p className="text-[17px] text-ink-2 leading-[1.55] max-w-[540px] font-sans mb-14">
            Every audit lives in your dashboard. Scores, findings, exports, re-audits, and progress tracking — all in one place.
          </p>

          {/* Screenshot 1: Audit overview / score card */}
          <div className="mb-10">
            <p className="font-mono text-[11px] tracking-[0.08em] uppercase text-m-muted mb-4">Audit score overview</p>
            <div className="border border-rule rounded-xl overflow-hidden bg-paper shadow-sm">
              <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Fake ScoreRing */}
                <div className="relative flex-shrink-0" style={{ width: 110, height: 110 }}>
                  <svg width={110} height={110} className="-rotate-90">
                    <circle cx={55} cy={55} r={50} fill="none" stroke="var(--rule)" strokeWidth={7} />
                    <circle cx={55} cy={55} r={50} fill="none" stroke="var(--ok)" strokeWidth={7} strokeLinecap="round"
                      strokeDasharray={314} strokeDashoffset={314 * (1 - 0.85)} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-serif text-[28px] text-ink">85</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <h3 className="font-sans text-[20px] text-ink font-medium tracking-[-0.01em] mb-0.5">clearux.ai</h3>
                  <p className="font-mono text-[11px] text-m-muted tracking-[0.06em] uppercase mb-3">32 findings · 6 modules</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                    {[
                      { name: 'Foundation', score: 88, dot: '#6366F1' },
                      { name: 'Human Experience', score: 82, dot: '#EC4899' },
                      { name: 'Inclusive Design', score: 79, dot: '#10B981' },
                      { name: 'Future Readiness', score: 91, dot: '#F59E0B' },
                      { name: 'Brand Consistency', score: 86, dot: '#3B82F6' },
                      { name: 'SEO Structure', score: 84, dot: '#06B6D4' },
                    ].map(m => (
                      <div key={m.name} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.dot }} />
                        <span className="text-xs text-m-muted">{m.name}</span>
                        <span className="text-xs font-medium text-ok">{m.score}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-[0.06em] uppercase text-severe">
                      <span className="w-2 h-2 rounded-full bg-severe" /> 2 critical
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-[0.06em] uppercase text-warn">
                      <span className="w-2 h-2 rounded-full bg-warn" /> 5 high
                    </span>
                    <span className="text-[11px] font-mono text-m-muted tracking-[0.06em] uppercase">25 more</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-rule px-6 sm:px-8 py-3.5 flex flex-wrap gap-2">
                {['PDF', 'Word', 'Re-audit', 'Share'].map(a => (
                  <span key={a} className="flex items-center gap-1.5 border border-rule text-ink text-[11px] font-mono tracking-[0.06em] uppercase px-3.5 py-1.5 rounded-lg cursor-default">{a}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Screenshot 2: Finding cards */}
          <div className="mb-10">
            <p className="font-mono text-[11px] tracking-[0.08em] uppercase text-m-muted mb-4">Finding cards with severity + recommendations</p>
            <div className="space-y-3">
              {[
                { sev: 'critical', dot: 'bg-severe', text: 'text-severe', title: 'No structured data (Schema.org) detected', cat: 'Future Readiness', tint: '#F59E0B', rec: 'Add JSON-LD blocks for Organization, Product, and FAQPage schemas.' },
                { sev: 'high', dot: 'bg-warn', text: 'text-warn', title: 'Primary CTA below the fold on mobile', cat: 'Human Experience', tint: '#EC4899', rec: 'Move the main call-to-action above the fold on viewports under 768px.' },
                { sev: 'medium', dot: 'bg-signal', text: 'text-signal', title: 'Touch targets under 44px on mobile nav', cat: 'Inclusive Design', tint: '#10B981', rec: 'Increase tap target size to minimum 44x44px per WCAG 2.5.5.' },
              ].map((f, i) => (
                <div key={i} className="border border-rule/60 rounded-xl bg-paper shadow-sm overflow-hidden">
                  <div className="flex items-start gap-3 p-4">
                    <span className={`w-2 h-2 rounded-full ${f.dot} flex-shrink-0 mt-1.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[11px] font-medium uppercase tracking-wider ${f.text}`}>{f.sev}</span>
                        <span className="text-[11px] text-m-muted">{f.cat}</span>
                      </div>
                      <p className="font-medium text-ink text-sm leading-snug">{f.title}</p>
                    </div>
                  </div>
                  {i === 0 && (
                    <div className="px-4 pb-4 pt-0 border-t border-rule/20 mx-4">
                      <div className="p-3 mt-3 bg-paper-2/60 rounded-lg border border-rule/30">
                        <div className="flex gap-2.5">
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={f.tint} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
                            <line x1="9" y1="18" x2="15" y2="18" /><line x1="10" y1="22" x2="14" y2="22" />
                            <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
                          </svg>
                          <div>
                            <p className="text-[11px] font-medium text-ink mb-1">Recommendation</p>
                            <p className="text-sm text-m-muted leading-relaxed">{f.rec}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Screenshot 3: Dashboard audit list */}
          <div>
            <p className="font-mono text-[11px] tracking-[0.08em] uppercase text-m-muted mb-4">Your audit dashboard</p>
            <div className="border border-rule rounded-xl overflow-hidden bg-paper shadow-sm">
              <div className="px-5 py-4 border-b border-rule flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-medium text-ink">Audits</p>
                  <p className="text-[11px] text-m-muted mt-0.5">5 audits total</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>New audit</span>
              </div>
              <div className="divide-y divide-rule">
                {[
                  { domain: 'clearux.ai', audits: 3, date: 'May 12', score: 85, delta: '+3' },
                  { domain: 'acme.com', audits: 1, date: 'May 10', score: 71, delta: null },
                  { domain: 'shopwave.io', audits: 1, date: 'May 8', score: 63, delta: null },
                ].map(row => (
                  <div key={row.domain} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-m-muted flex-shrink-0"><circle cx={12} cy={12} r={10} /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10" /></svg>
                        <p className="font-medium text-sm text-ink truncate">{row.domain}</p>
                        {row.audits > 1 && <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 8%, transparent)' }}>{row.audits} audits</span>}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-m-muted">
                        <span>{row.audits > 1 ? `Latest: ${row.date}` : row.date}</span>
                        <span className="text-rule">·</span>
                        <span>Completed</span>
                        {row.delta && <><span className="text-rule">·</span><span className="font-medium text-ok">{row.delta} pts</span></>}
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-md border flex items-center justify-center flex-shrink-0 ml-3"
                      style={{
                        background: `color-mix(in srgb, ${row.score >= 70 ? 'var(--ok)' : 'var(--warn)'} 10%, transparent)`,
                        borderColor: `color-mix(in srgb, ${row.score >= 70 ? 'var(--ok)' : 'var(--warn)'} 25%, transparent)`,
                      }}>
                      <span className="font-sans font-medium text-sm leading-none" style={{ color: row.score >= 70 ? 'var(--ok)' : 'var(--warn)' }}>{row.score}</span>
                    </div>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-m-muted flex-shrink-0 ml-2"><path d="M9 18l6-6-6-6" /></svg>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Six modules — matches homepage InstrumentGrid */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <div className="mb-16 grid lg:grid-cols-[1fr_1.2fr] gap-20 items-end max-lg:grid-cols-1 max-lg:gap-6">
            <div>
              <SectionMarker number="05" label="The instrument" />
              <h2 className="font-serif font-normal text-ink leading-[0.98] tracking-[-0.022em]" style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}>
                Six modules. <em className="italic text-signal">Ninety-six</em> checkpoints.
              </h2>
            </div>
            <p className="text-[17px] text-ink-2 leading-[1.55] max-w-[540px] font-sans">
              Each audit runs the full battery. No tiered plans, no &ldquo;upgrade to unlock accessibility.&rdquo; Foundation through SEO Structure — same depth, every time, every input.
            </p>
          </div>

          <div className="grid grid-cols-3 border-t border-l border-ink max-md:grid-cols-2 max-sm:grid-cols-1">
            {MODULES.map((mod) => (
              <div
                key={mod.num}
                className="border-r border-b border-ink p-7 sm:p-8 bg-paper hover:bg-paper-2 transition-colors min-h-[280px] flex flex-col"
              >
                <div className="font-mono text-[11px] text-signal font-semibold tracking-[0.08em] mb-3.5">
                  {mod.num} / {mod.title}
                </div>
                <h3 className="font-serif font-normal text-[30px] tracking-[-0.015em] leading-[1.05] mb-3.5 text-ink">
                  {mod.title}
                </h3>
                <p className="text-[14px] leading-[1.55] text-ink-2 mb-auto pb-6 font-sans">
                  {mod.desc}
                </p>
                <div className="flex justify-between items-baseline pt-[18px] border-t border-dashed border-rule-2 font-mono text-[10px] text-m-muted tracking-[0.06em] uppercase">
                  <span>
                    <strong className="font-serif text-[28px] font-normal text-ink normal-case tracking-[-0.02em]">{mod.count}</strong>{' '}
                    checkpoints
                  </span>
                  <span>{mod.range}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <Coda />
    </main>
  )
}
