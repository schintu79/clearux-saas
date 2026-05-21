'use client'

import { SectionMarker } from '@/components/marketing/SectionMarker'
import { Button } from '@/components/marketing/Button'
import { ArrowRightIcon } from '@/components/marketing/icons'
import { HomeCta } from '@/components/marketing/HomeCta'
import { FaqPreview } from '@/components/marketing/FaqPreview'

/* ── FAQ data ── */
const PRODUCT_FAQS = [
  { q: 'How does the AI audit work?', a: 'Fixpath crawls your website, captures every page, and analyses the content against 96 checkpoints across six modules. Each checkpoint is evaluated by AI that looks at real page content, not just metadata. Findings are ranked by severity with evidence and affected pages.' },
  { q: 'Can I fix issues directly through Fixpath?', a: 'Yes. Every finding includes a concrete fix. For code-level issues, Fixpath generates a surgical fix you can preview, edit, and deploy directly to your server via FTP or SFTP. For content and strategy issues, you get clear recommendations to share with your team.' },
  { q: 'What is the Website Health Score?', a: 'Your Website Health Score is a composite metric across all six audit modules. It gives your team a single number to track over time. Re-audit after making fixes and see exactly how your score improves.' },
  { q: 'Does Fixpath check AI visibility?', a: 'Yes. The Future Readiness module checks how LLMs interpret your pages, validates structured data for AI consumption, probes multiple AI models for accuracy, and audits your llms.txt and AI discovery files.' },
  { q: 'How is this different from Lighthouse or PageSpeed?', a: 'Lighthouse focuses on performance and basic accessibility. Fixpath covers 96 checkpoints across UX, accessibility, AI readiness, brand consistency, SEO, and more. It also helps you fix issues and tracks improvement, rather than just listing problems.' },
]

/* ── Mockup: Finding detail card ── */
function FindingMockup() {
  return (
    <div className="rounded-[4px] border border-rule overflow-hidden" style={{ background: 'var(--paper)' }}>
      <div className="px-5 py-3.5 border-b border-rule flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted">Finding detail</span>
        <span className="font-mono text-[9px] font-semibold tracking-[0.08em] uppercase px-2 py-0.5 rounded-[2px]" style={{ color: 'var(--severe)', background: 'color-mix(in srgb, var(--severe) 12%, transparent)' }}>Critical</span>
      </div>
      <div className="p-5">
        <h4 className="font-sans text-[15px] font-semibold text-ink mb-2">Login flow uses 3 dark-pattern signals that erode trust</h4>
        <p className="font-sans text-[13px] text-ink-2 leading-relaxed mb-4">
          The login page uses urgency messaging, pre-checked opt-ins, and a hidden close button
          on the modal overlay. These patterns reduce user trust and may violate consumer protection
          regulations in the EU.
        </p>
        <div className="flex items-center gap-4 text-[11px] font-mono text-m-muted tracking-[0.06em] uppercase">
          <span>Module: Human experience</span>
          <span>Pages: /login, /signup</span>
        </div>
      </div>
      <div className="px-5 py-3.5 border-t border-rule" style={{ background: 'var(--paper-2)' }}>
        <p className="font-mono text-[10px] tracking-[0.08em] uppercase text-signal">Fix available</p>
      </div>
    </div>
  )
}

/* ── Mockup: Fix console ── */
function FixMockup() {
  return (
    <div className="rounded-[4px] border border-rule overflow-hidden" style={{ background: 'var(--paper)' }}>
      <div className="px-5 py-3.5 border-b border-rule flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted">Fix console</span>
        <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-signal">Ready to deploy</span>
      </div>
      <div className="p-5 space-y-3">
        <div className="rounded border border-rule p-3" style={{ background: 'var(--paper-2)' }}>
          <p className="font-mono text-[11px] text-m-muted mb-1">Before</p>
          <p className="font-mono text-[12px] text-severe leading-relaxed line-through">&lt;input type=&quot;checkbox&quot; checked&gt; Subscribe to newsletter</p>
        </div>
        <div className="rounded border border-rule p-3" style={{ background: 'color-mix(in srgb, var(--signal) 6%, var(--paper))' }}>
          <p className="font-mono text-[11px] text-m-muted mb-1">After</p>
          <p className="font-mono text-[12px] text-signal leading-relaxed">&lt;input type=&quot;checkbox&quot;&gt; Subscribe to newsletter</p>
        </div>
      </div>
      <div className="px-5 py-3.5 border-t border-rule flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-sans font-medium bg-ink text-paper">
          Deploy fix
        </span>
        <span className="font-mono text-[10px] text-m-muted tracking-[0.06em] uppercase">via SFTP to /login.html</span>
      </div>
    </div>
  )
}

/* ── Mockup: Score tracking ── */
function TrackMockup() {
  return (
    <div className="rounded-[4px] border border-rule overflow-hidden" style={{ background: 'var(--paper)' }}>
      <div className="px-5 py-3.5 border-b border-rule">
        <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted">Score history</span>
      </div>
      <div className="p-5">
        <div className="flex items-end gap-4 mb-6">
          {[42, 55, 62, 71, 78].map((score, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className="w-full rounded-[2px]"
                style={{
                  height: `${score * 0.8}px`,
                  background: i === 4 ? 'var(--signal)' : 'var(--rule)',
                  transition: 'height 0.3s ease',
                }}
              />
              <span className="font-mono text-[10px] text-m-muted">{score}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-signal" />
            <span className="font-sans text-[12px] text-ink">+36 points over 5 audits</span>
          </div>
          <span className="font-mono text-[10px] text-m-muted tracking-[0.06em] uppercase">12 weeks</span>
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
              <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(36px, 4.5vw, 56px)' }}>
                Audit your entire site{' '}
                <em className="italic text-signal">in minutes.</em>
              </h2>
              <p className="text-[17px] leading-[1.6] text-ink-2 font-sans mb-8">
                Enter your URL and Fixpath crawls every page, tests 96 checkpoints across six modules,
                and delivers severity-ranked findings with evidence and context. Most audits complete in
                under ten minutes.
              </p>
              <h3 className="font-sans text-[16px] font-semibold text-ink mb-4">What the audit covers</h3>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mb-8">
                {[
                  'Site structure and navigation',
                  'Usability and dark patterns',
                  'WCAG 2.1 AA accessibility',
                  'AI discoverability and readiness',
                  'Brand and messaging consistency',
                  'SEO structure and metadata',
                  'Mobile responsiveness',
                  'Performance and load times',
                  'Cognitive accessibility',
                  'Structured data validation',
                  'Heading hierarchy',
                  'Cross-page coherence',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5">
                    <span className="w-1 h-1 rounded-full bg-signal shrink-0" />
                    <span className="font-sans text-[14px] text-ink-2">{item}</span>
                  </div>
                ))}
              </div>
              <p className="font-sans text-[14px] text-m-muted">
                Every finding includes the affected pages, evidence from your actual site content, and a
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
              <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(36px, 4.5vw, 56px)' }}>
                Fix issues directly.{' '}
                <em className="italic text-signal">Or send the fix path.</em>
              </h2>
              <p className="text-[17px] leading-[1.6] text-ink-2 font-sans mb-8">
                Most audit tools stop at a list of problems. Fixpath turns every finding into an action.
              </p>
              <div className="space-y-6">
                <div>
                  <h3 className="font-sans text-[15px] font-semibold text-ink mb-1.5">Deploy code fixes directly</h3>
                  <p className="font-sans text-[14px] text-ink-2 leading-relaxed">
                    For code-level issues, Fixpath generates a surgical fix. Preview the diff, edit if needed,
                    and deploy to your server via FTP or SFTP with one click.
                  </p>
                </div>
                <div>
                  <h3 className="font-sans text-[15px] font-semibold text-ink mb-1.5">Send clear recommendations</h3>
                  <p className="font-sans text-[14px] text-ink-2 leading-relaxed">
                    For content, strategy, or design issues, export findings as a PDF or Word report. Share a
                    live link with stakeholders. Everyone sees the same evidence and priority.
                  </p>
                </div>
                <div>
                  <h3 className="font-sans text-[15px] font-semibold text-ink mb-1.5">WordPress integration</h3>
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
              <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(36px, 4.5vw, 56px)' }}>
                Track improvement.{' '}
                <em className="italic text-signal">See what moved.</em>
              </h2>
              <p className="text-[17px] leading-[1.6] text-ink-2 font-sans mb-8">
                Re-audit after making changes and see exactly what improved. Your Website Health Score
                gives your team a single metric to optimise around.
              </p>
              <div className="space-y-6">
                <div>
                  <h3 className="font-sans text-[15px] font-semibold text-ink mb-1.5">Score history</h3>
                  <p className="font-sans text-[14px] text-ink-2 leading-relaxed">
                    Track your Website Health Score over time. See which fixes had the biggest impact
                    and identify trends across audit cycles.
                  </p>
                </div>
                <div>
                  <h3 className="font-sans text-[15px] font-semibold text-ink mb-1.5">Before/after comparison</h3>
                  <p className="font-sans text-[14px] text-ink-2 leading-relaxed">
                    Compare any two audits side by side. See resolved findings, new issues, and
                    score changes by module.
                  </p>
                </div>
                <div>
                  <h3 className="font-sans text-[15px] font-semibold text-ink mb-1.5">Competitor benchmarking</h3>
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
          <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(36px, 4.5vw, 56px)' }}>
            The only audit platform that checks{' '}
            <em className="italic text-signal">how AI sees your site.</em>
          </h2>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[600px] mb-12 font-sans">
            AI agents are already reading your site for their users. Fixpath checks whether they
            get it right, and shows you exactly how to improve.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: 'var(--rule)' }}>
            {[
              { title: 'LLM probe testing', desc: 'We ask multiple AI models about your business and compare their answers to ground truth.' },
              { title: 'Structured data audit', desc: 'Validates JSON-LD, Open Graph, and schema markup that AI agents rely on to understand your pages.' },
              { title: 'AI discovery files', desc: 'Checks for llms.txt, robots.txt AI directives, and other files that guide AI crawlers.' },
              { title: 'Citation monitoring', desc: 'Tracks when and how AI models cite your content, and whether the citations are accurate.' },
            ].map((item) => (
              <div key={item.title} className="p-6" style={{ background: 'var(--paper)' }}>
                <h3 className="font-sans text-[15px] font-semibold text-ink mb-2">{item.title}</h3>
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
          <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-5" style={{ fontSize: 'clamp(36px, 4.5vw, 56px)' }}>
            Share results{' '}
            <em className="italic text-signal">your way.</em>
          </h2>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mb-12 font-sans">
            Export your audit as a professional PDF or Word document. Share a live link with
            clients or stakeholders. Every format includes the same severity-ranked findings,
            evidence, and recommendations.
          </p>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { format: 'PDF report', desc: 'Print-ready A4 document with cover page, executive summary, and detailed findings by module.' },
              { format: 'Word document', desc: 'Editable .docx format. Add your own notes, customise recommendations, and share with your team.' },
              { format: 'Shareable link', desc: 'A live web page anyone can view. No login required. Includes score, findings, and module breakdown.' },
            ].map((item) => (
              <div key={item.format} className="p-6 rounded-[4px] border border-rule" style={{ background: 'var(--paper)' }}>
                <h3 className="font-sans text-[15px] font-semibold text-ink mb-2">{item.format}</h3>
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
