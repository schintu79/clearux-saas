'use client'

import { SectionMarker } from '@/components/marketing/SectionMarker'
import { Button } from '@/components/marketing/Button'
import { ArrowRightIcon } from '@/components/marketing/icons'
import { HomeCta } from '@/components/marketing/HomeCta'
import { FaqPreview } from '@/components/marketing/FaqPreview'
import { Scale, Heart, Accessibility, Brain, FileSearch, Eye, Bot, Database, FileCode, Quote, type LucideIcon } from 'lucide-react'

/* Dashboard-matching MODULE_TINTS */
const MODULE_TINTS: Record<string, string> = {
  'Foundation': '#3B82F6',
  'Human experience': '#EC4899',
  'Inclusive design': '#8B5CF6',
  'Future readiness': '#F59E0B',
  'Brand consistency': '#06B6D4',
  'SEO structure': '#10B981',
}

const AUDIT_MODULES: { name: string; Icon: LucideIcon; checks: string[] }[] = [
  { name: 'Foundation', Icon: Scale, checks: ['Site structure and navigation', 'Mobile responsiveness', 'Performance and load times'] },
  { name: 'Human experience', Icon: Heart, checks: ['Usability and dark patterns', 'Cognitive accessibility', 'Conversion friction'] },
  { name: 'Inclusive design', Icon: Accessibility, checks: ['WCAG 2.1 AA accessibility', 'Heading hierarchy', 'Colour contrast'] },
  { name: 'Future readiness', Icon: Brain, checks: ['AI discoverability and readiness', 'Structured data validation', 'LLM probe accuracy'] },
  { name: 'Brand consistency', Icon: Eye, checks: ['Brand and messaging consistency', 'Cross-page coherence', 'Tone of voice'] },
  { name: 'SEO structure', Icon: FileSearch, checks: ['SEO structure and metadata', 'Canonical URLs', 'Internal linking'] },
]

/* ── FAQ data ── */
const PRODUCT_FAQS = [
  { q: 'How does the AI audit work?', a: 'Fixpath crawls your website, captures every page, and analyses the content against 96 checkpoints across six modules. Each checkpoint is evaluated by AI that looks at real page content, not just metadata. Findings are ranked by severity with evidence and affected pages.' },
  { q: 'Can I fix issues directly through Fixpath?', a: 'Yes. Every finding includes a concrete fix. For code-level issues, Fixpath generates a surgical fix you can preview, edit, and deploy directly to your server via FTP or SFTP. For content and strategy issues, you get clear recommendations to share with your team.' },
  { q: 'What is the Website Health Score?', a: 'Your Website Health Score is a composite metric across all six audit modules. It gives your team a single number to track over time. Re-audit after making fixes and see exactly how your score improves.' },
  { q: 'Does Fixpath check AI visibility?', a: 'Yes. The Future Readiness module checks how LLMs interpret your pages, validates structured data for AI consumption, probes multiple AI models for accuracy, and audits your llms.txt and AI discovery files.' },
  { q: 'How is this different from Lighthouse or PageSpeed?', a: 'Lighthouse focuses on performance and basic accessibility. Fixpath covers 96 checkpoints across UX, accessibility, AI readiness, brand consistency, SEO, and more. It also helps you fix issues and tracks improvement, rather than just listing problems.' },
]

/* ── Mockup: Finding detail card — mirrors real findings panel ── */
function FindingMockup() {
  return (
    <div className="rounded-[4px] border border-rule overflow-hidden" style={{ background: 'var(--paper)' }}>
      {/* Header bar with severity + module */}
      <div className="px-5 py-3 border-b border-rule flex items-center justify-between" style={{ background: 'var(--paper-2)' }}>
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[9px] font-semibold tracking-[0.08em] uppercase px-2 py-0.5 rounded-[2px]" style={{ color: 'var(--severe)', background: 'color-mix(in srgb, var(--severe) 12%, transparent)' }}>Critical</span>
          <span className="font-mono text-[10px] tracking-[0.06em] uppercase text-m-muted">Human experience</span>
        </div>
        <span className="font-mono text-[9px] tracking-[0.06em] uppercase text-m-muted">HX-04</span>
      </div>
      {/* Finding content */}
      <div className="p-5">
        <h4 className="font-sans text-[15px] font-semibold text-ink mb-2">Login flow uses 3 dark-pattern signals that erode trust</h4>
        <p className="font-sans text-[13px] text-ink-2 leading-relaxed mb-4">
          The login page uses urgency messaging, pre-checked opt-ins, and a hidden close button
          on the modal overlay. These patterns reduce user trust and may violate consumer protection
          regulations in the EU.
        </p>
        {/* Evidence + affected pages — mirrors real layout */}
        <div className="rounded border border-rule p-3 mb-4" style={{ background: 'var(--paper-2)' }}>
          <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-m-muted mb-2">Evidence</p>
          <p className="font-mono text-[11px] text-ink-2 leading-relaxed">
            &quot;Only 2 spots left!&quot; urgency text + pre-checked newsletter opt-in + modal close button opacity: 0.15
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono text-m-muted tracking-[0.06em]">
          <span className="uppercase">Affected: /login, /signup</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-signal" />
            <span className="uppercase text-signal">Fix available</span>
          </span>
        </div>
      </div>
      {/* Action bar */}
      <div className="px-5 py-3 border-t border-rule flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-sans font-medium bg-ink text-paper">
          View fix
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-sans font-medium border border-rule text-ink">
          Export finding
        </span>
      </div>
    </div>
  )
}

/* ── Mockup: Fix console — mirrors real diff-preview + deploy flow ── */
function FixMockup() {
  return (
    <div className="rounded-[4px] border border-rule overflow-hidden" style={{ background: 'var(--paper)' }}>
      {/* Header with finding reference */}
      <div className="px-5 py-3 border-b border-rule flex items-center justify-between" style={{ background: 'var(--paper-2)' }}>
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted">Fix console</span>
          <span className="font-mono text-[9px] tracking-[0.06em] uppercase text-m-muted">HX-04</span>
        </div>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-signal" />
          <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-signal">Ready to deploy</span>
        </span>
      </div>
      {/* File path */}
      <div className="px-5 py-2 border-b border-rule">
        <span className="font-mono text-[11px] text-ink-2">/login.html</span>
      </div>
      {/* Diff preview */}
      <div className="p-5 space-y-2">
        <div className="rounded border border-rule p-3" style={{ background: 'color-mix(in srgb, var(--severe) 4%, var(--paper))' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-[10px] text-severe">-</span>
            <span className="font-mono text-[10px] text-m-muted">line 47</span>
          </div>
          <p className="font-mono text-[11px] text-severe leading-relaxed line-through">&lt;input type=&quot;checkbox&quot; checked&gt; Subscribe to newsletter</p>
        </div>
        <div className="rounded border border-rule p-3" style={{ background: 'color-mix(in srgb, var(--signal) 4%, var(--paper))' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-[10px] text-signal">+</span>
            <span className="font-mono text-[10px] text-m-muted">line 47</span>
          </div>
          <p className="font-mono text-[11px] text-signal leading-relaxed">&lt;input type=&quot;checkbox&quot;&gt; Subscribe to newsletter</p>
        </div>
        <div className="rounded border border-rule p-3" style={{ background: 'color-mix(in srgb, var(--severe) 4%, var(--paper))' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-[10px] text-severe">-</span>
            <span className="font-mono text-[10px] text-m-muted">line 52</span>
          </div>
          <p className="font-mono text-[11px] text-severe leading-relaxed line-through">&lt;p class=&quot;urgency&quot;&gt;Only 2 spots left!&lt;/p&gt;</p>
        </div>
      </div>
      {/* Deploy bar */}
      <div className="px-5 py-3 border-t border-rule flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-sans font-medium bg-ink text-paper">
            Deploy fix
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-sans font-medium border border-rule text-ink">
            Edit diff
          </span>
        </div>
        <span className="font-mono text-[9px] text-m-muted tracking-[0.06em] uppercase">SFTP</span>
      </div>
    </div>
  )
}

/* ── Mockup: Score tracking — mirrors real score history + comparison view ── */
function TrackMockup() {
  return (
    <div className="rounded-[4px] border border-rule overflow-hidden" style={{ background: 'var(--paper)' }}>
      <div className="px-5 py-3 border-b border-rule flex items-center justify-between" style={{ background: 'var(--paper-2)' }}>
        <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted">Score history</span>
        <span className="font-mono text-[9px] tracking-[0.06em] uppercase text-m-muted">5 audits / 12 weeks</span>
      </div>
      <div className="p-5">
        {/* Score trend bars */}
        <div className="flex items-end gap-3 mb-5">
          {[
            { score: 42, date: 'Feb 3' },
            { score: 55, date: 'Mar 1' },
            { score: 62, date: 'Mar 22' },
            { score: 71, date: 'Apr 10' },
            { score: 78, date: 'May 2' },
          ].map((audit, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="font-mono text-[10px] font-medium" style={{ color: i === 4 ? 'var(--signal)' : 'var(--ink-2)' }}>{audit.score}</span>
              <div
                className="w-full rounded-[2px]"
                style={{
                  height: `${audit.score * 0.7}px`,
                  background: i === 4 ? 'var(--signal)' : 'var(--rule-2)',
                }}
              />
              <span className="font-mono text-[8px] text-m-muted">{audit.date}</span>
            </div>
          ))}
        </div>

        {/* Module comparison — last two audits */}
        <div className="border-t border-rule pt-4 mb-4">
          <p className="font-mono text-[9px] tracking-[0.08em] uppercase text-m-muted mb-3">Module changes (last audit)</p>
          <div className="space-y-2">
            {[
              { name: 'Foundation', prev: 65, curr: 72, delta: '+7' },
              { name: 'Human exp.', prev: 58, curr: 68, delta: '+10' },
              { name: 'Inclusive', prev: 74, curr: 81, delta: '+7' },
              { name: 'Future', prev: 51, curr: 59, delta: '+8' },
            ].map((mod) => (
              <div key={mod.name} className="flex items-center gap-3">
                <span className="font-sans text-[11px] text-ink-2 w-[72px] shrink-0">{mod.name}</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--rule)' }}>
                  <div className="h-full rounded-full bg-signal" style={{ width: `${mod.curr}%` }} />
                </div>
                <span className="font-mono text-[10px] text-signal w-[28px] text-right shrink-0">{mod.delta}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary stat */}
        <div className="flex items-center justify-between pt-3 border-t border-rule">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-signal" />
            <span className="font-sans text-[12px] text-ink">+36 points over 5 audits</span>
          </div>
          <span className="font-mono text-[10px] text-m-muted tracking-[0.06em] uppercase">14 findings resolved</span>
        </div>
      </div>
    </div>
  )
}

export function ProductContent() {
  return (
    <main>
      {/* Hero */}
      <section className="py-20 sm:py-[100px] border-b border-rule">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <div className="max-w-[680px]">
            <p className="font-mono text-[11px] tracking-[0.12em] uppercase text-signal mb-6">The product</p>
            <h1 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6" style={{ fontSize: 'clamp(44px, 6vw, 80px)' }}>
              The complete path from{' '}
              <em className="italic text-signal">audit to improvement.</em>
            </h1>
            <p className="text-[18px] leading-[1.6] text-ink-2 font-sans mb-9">
              Fixpath is not just an audit tool. It finds every issue hurting your site, gives you
              the tools to fix them, and tracks your progress over time. Here is how it works.
            </p>
            <Button href="/register" size="large">
              Start free audit
              <ArrowRightIcon size={14} />
            </Button>
          </div>
        </div>
      </section>

      {/* Step 1: Find */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <SectionMarker number="01" label="Find" />
              <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
                Audit your entire site{' '}
                <em className="italic text-signal">in minutes.</em>
              </h2>
              <p className="text-[18px] leading-[1.6] text-ink-2 font-sans mb-8">
                Enter your URL. Fixpath crawls every page, runs 96 checkpoints across six modules,
                and delivers severity-ranked findings with real evidence from your site content. Each
                finding shows affected pages, what went wrong, and a concrete recommendation. Most
                audits complete in under ten minutes.
              </p>
              <h3 className="font-sans text-[16px] font-semibold text-ink mb-5">What the audit covers</h3>
              <div className="grid sm:grid-cols-2 gap-3 mb-8">
                {AUDIT_MODULES.map((mod) => {
                  const tint = MODULE_TINTS[mod.name] || 'var(--signal)'
                  return (
                    <div key={mod.name} className="rounded-[4px] border border-rule p-4" style={{ background: 'var(--paper-2)' }}>
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <span
                          className="w-7 h-7 rounded-[5px] flex items-center justify-center shrink-0"
                          style={{ background: `color-mix(in srgb, ${tint} 12%, transparent)`, color: tint }}
                        >
                          <mod.Icon size={15} strokeWidth={1.5} />
                        </span>
                        <span className="font-sans text-[13px] font-semibold text-ink">{mod.name}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {mod.checks.map((check) => (
                          <div key={check} className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full shrink-0" style={{ background: tint }} />
                            <span className="font-sans text-[12px] text-ink-2">{check}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="font-sans text-[14px] text-m-muted">
                96 checkpoints across six modules. Every finding includes affected pages, evidence, and a
                concrete recommendation.
              </p>
            </div>
            <FindingMockup />
          </div>
        </div>
      </section>

      {/* Step 2: Fix */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div className="order-2 lg:order-1">
              <FixMockup />
            </div>
            <div className="order-1 lg:order-2">
              <SectionMarker number="02" label="Fix" />
              <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
                Fix issues directly.{' '}
                <em className="italic text-signal">Or send the fix path.</em>
              </h2>
              <p className="text-[18px] leading-[1.6] text-ink-2 font-sans mb-8">
                Most audit tools stop at a list of problems. Fixpath turns every finding into an
                action you can take right from the dashboard — or hand off to your team with full context.
              </p>
              <div className="space-y-6">
                <div>
                  <h3 className="font-sans text-[16px] font-semibold text-ink mb-1.5">Deploy code fixes directly</h3>
                  <p className="font-sans text-[14px] text-ink-2 leading-relaxed">
                    For code-level issues, Fixpath generates a surgical fix. Preview the diff, edit if needed,
                    and deploy to your server via FTP or SFTP with one click.
                  </p>
                </div>
                <div>
                  <h3 className="font-sans text-[16px] font-semibold text-ink mb-1.5">Send clear recommendations</h3>
                  <p className="font-sans text-[14px] text-ink-2 leading-relaxed">
                    For content, strategy, or design issues, export findings as a PDF or Word report. Share a
                    live link with stakeholders. Everyone sees the same evidence and priority.
                  </p>
                </div>
                <div>
                  <h3 className="font-sans text-[16px] font-semibold text-ink mb-1.5">WordPress integration</h3>
                  <p className="font-sans text-[14px] text-ink-2 leading-relaxed">
                    The Fixpath WordPress plugin surfaces recommendations directly in your admin panel.
                    See which pages need attention and apply fixes without leaving your CMS.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Step 3: Track */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <SectionMarker number="03" label="Track" />
              <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
                Track improvement.{' '}
                <em className="italic text-signal">See what moved.</em>
              </h2>
              <p className="text-[18px] leading-[1.6] text-ink-2 font-sans mb-8">
                Re-audit after making changes and see exactly what improved. Your Website Health Score
                gives your team a single metric to optimise around.
              </p>
              <div className="space-y-6">
                <div>
                  <h3 className="font-sans text-[16px] font-semibold text-ink mb-1.5">Score history</h3>
                  <p className="font-sans text-[14px] text-ink-2 leading-relaxed">
                    Track your Website Health Score over time. See which fixes had the biggest impact
                    and identify trends across audit cycles.
                  </p>
                </div>
                <div>
                  <h3 className="font-sans text-[16px] font-semibold text-ink mb-1.5">Before/after comparison</h3>
                  <p className="font-sans text-[14px] text-ink-2 leading-relaxed">
                    Compare any two audits side by side. See resolved findings, new issues, and
                    score changes by module.
                  </p>
                </div>
                <div>
                  <h3 className="font-sans text-[16px] font-semibold text-ink mb-1.5">Competitor benchmarking</h3>
                  <p className="font-sans text-[14px] text-ink-2 leading-relaxed">
                    See how your site stacks up against competitors across all six modules.
                    Identify where you lead and where to focus next.
                  </p>
                </div>
              </div>
            </div>
            <TrackMockup />
          </div>
        </div>
      </section>

      {/* AI Visibility */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="04" label="AI readiness" />
          <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            From audit findings to{' '}
            <em className="italic text-signal">actionable next steps.</em>
          </h2>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[600px] mb-12 font-sans">
            AI agents are already reading your site for their users. Fixpath checks whether they
            get it right, connects findings to structured fixes, and tracks improvement over time — all inside one workflow.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'LLM probe testing', desc: 'We ask multiple AI models about your business and compare their answers to ground truth.', Icon: Bot, color: '#F59E0B' },
              { title: 'Structured data audit', desc: 'Validates JSON-LD, Open Graph, and schema markup that AI agents rely on to understand your pages.', Icon: Database, color: '#8B5CF6' },
              { title: 'AI discovery files', desc: 'Checks for llms.txt, robots.txt AI directives, and other files that guide AI crawlers.', Icon: FileCode, color: '#3B82F6' },
              { title: 'Citation monitoring', desc: 'Tracks when and how AI models cite your content, and whether the citations are accurate.', Icon: Quote, color: '#10B981' },
            ].map((item) => (
              <div key={item.title} className="rounded-[4px] border border-rule p-6" style={{ background: 'var(--paper-2)' }}>
                <span
                  className="w-9 h-9 rounded-[6px] flex items-center justify-center mb-4"
                  style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)`, color: item.color }}
                >
                  <item.Icon size={18} strokeWidth={1.5} />
                </span>
                <h3 className="font-sans text-[16px] font-semibold text-ink mb-2">{item.title}</h3>
                <p className="font-sans text-[13px] text-ink-2 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Exports and reports */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="05" label="Reports" />
          <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Share results{' '}
            <em className="italic text-signal">your way.</em>
          </h2>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mb-12 font-sans">
            Export your audit as a professional PDF or Word document. Share a live link with
            clients or stakeholders. Every format includes the same severity-ranked findings,
            evidence, and recommendations.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { format: 'PDF report', desc: 'Print-ready A4 document with cover page, executive summary, and detailed findings by module.', Icon: FileSearch, color: '#EC4899' },
              { format: 'Word document', desc: 'Editable .docx format. Add your own notes, customise recommendations, and share with your team.', Icon: FileCode, color: '#3B82F6' },
              { format: 'Shareable link', desc: 'A live web page anyone can view. No login required. Includes score, findings, and module breakdown.', Icon: Eye, color: '#10B981' },
            ].map((item) => (
              <div key={item.format} className="p-6 rounded-[4px] border border-rule" style={{ background: 'var(--paper-2)' }}>
                <span
                  className="w-9 h-9 rounded-[6px] flex items-center justify-center mb-4"
                  style={{ background: `color-mix(in srgb, ${item.color} 12%, transparent)`, color: item.color }}
                >
                  <item.Icon size={18} strokeWidth={1.5} />
                </span>
                <h3 className="font-sans text-[16px] font-semibold text-ink mb-2">{item.format}</h3>
                <p className="font-sans text-[13px] text-ink-2 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FaqPreview sectionNumber="06" items={PRODUCT_FAQS} />

      {/* CTA */}
      <HomeCta />
    </main>
  )
}
