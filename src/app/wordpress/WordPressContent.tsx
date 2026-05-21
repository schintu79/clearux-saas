'use client'

import { SectionMarker } from '@/components/marketing/SectionMarker'
import { Button } from '@/components/marketing/Button'
import { ArrowRightIcon } from '@/components/marketing/icons'
import { HomeCta } from '@/components/marketing/HomeCta'
import { FaqPreview } from '@/components/marketing/FaqPreview'

const WP_FAQS = [
  { q: 'Is the plugin free?', a: 'The WordPress plugin is free to install. It connects to your Fixpath account where audits are run. Your first audit is free, no credit card required.' },
  { q: 'Does it work with any WordPress theme?', a: 'Yes. The plugin works at the page level, not the theme level. It audits your live site content regardless of which theme or page builder you use.' },
  { q: 'Can I apply fixes automatically?', a: 'For content-level issues like meta descriptions, heading hierarchy, and alt text, the plugin can apply fixes directly. For structural or code-level changes, it provides clear instructions.' },
  { q: 'How do I connect my Fixpath account?', a: 'Install the plugin, enter your Fixpath API key from your dashboard settings, and select which site to sync. Audit results appear in your WordPress admin within seconds.' },
]

export function WordPressContent() {
  return (
    <main>
      {/* Hero */}
      <section className="py-20 sm:py-[100px] border-b border-rule">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="font-mono text-[11px] tracking-[0.12em] uppercase text-signal mb-6">WordPress plugin</p>
              <h1 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6" style={{ fontSize: 'clamp(44px, 5.5vw, 72px)' }}>
                Audit and fix your site{' '}
                <em className="italic text-signal">inside WordPress.</em>
              </h1>
              <p className="text-[18px] leading-[1.6] text-ink-2 font-sans mb-9">
                The Fixpath WordPress plugin brings your audit results directly into the admin panel.
                See which pages need attention, understand each issue, and apply fixes without leaving
                your CMS.
              </p>
              <div className="flex gap-3.5 max-sm:flex-col">
                <Button href="/register" size="large">
                  Get started free
                  <ArrowRightIcon size={14} />
                </Button>
                <Button href="/product" variant="ghost" size="large">
                  See the full product
                </Button>
              </div>
            </div>

            {/* WP admin mockup */}
            <div className="rounded-[4px] overflow-hidden border border-rule" style={{ background: 'var(--paper-2)' }}>
              <div className="px-5 py-3 border-b border-rule flex items-center gap-2.5">
                <span className="w-5 h-5 rounded bg-ink flex items-center justify-center">
                  <span className="text-[10px] font-bold text-paper">W</span>
                </span>
                <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-m-muted">
                  yoursite.com/wp-admin
                </span>
              </div>
              <div className="flex">
                {/* Sidebar */}
                <div className="w-[180px] border-r border-rule p-3 space-y-1 max-sm:hidden" style={{ background: 'var(--paper-3)' }}>
                  {['Dashboard', 'Posts', 'Pages', 'Fixpath', 'Settings'].map((item) => (
                    <div
                      key={item}
                      className={`px-3 py-2 rounded text-[12px] font-sans ${
                        item === 'Fixpath' ? 'font-medium' : 'text-m-muted'
                      }`}
                      style={item === 'Fixpath' ? { background: 'var(--signal-soft)', color: 'var(--signal)' } : {}}
                    >
                      {item}
                    </div>
                  ))}
                </div>
                {/* Content */}
                <div className="flex-1 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-sans text-[14px] font-medium text-ink">Audit results</span>
                    <span className="font-mono text-[10px] text-m-muted tracking-[0.06em] uppercase">Score: 62</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { sev: 'Critical', label: 'Missing alt text on 12 images', page: '/about' },
                      { sev: 'Medium', label: 'H1 tag missing on pricing page', page: '/pricing' },
                      { sev: 'Minor', label: 'Meta description too long', page: '/blog/guide' },
                    ].map((f) => (
                      <div key={f.label} className="p-3 rounded border border-rule" style={{ background: 'var(--paper)' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="font-mono text-[9px] font-semibold tracking-[0.06em] uppercase px-1.5 py-0.5 rounded-[2px]"
                            style={{
                              color: f.sev === 'Critical' ? 'var(--severe)' : f.sev === 'Medium' ? 'var(--warn)' : 'var(--m-muted)',
                              background: f.sev === 'Critical' ? 'color-mix(in srgb, var(--severe) 12%, transparent)' : f.sev === 'Medium' ? 'color-mix(in srgb, var(--warn) 12%, transparent)' : 'color-mix(in srgb, var(--m-muted) 12%, transparent)',
                            }}
                          >
                            {f.sev}
                          </span>
                          <span className="font-mono text-[10px] text-m-muted">{f.page}</span>
                        </div>
                        <p className="font-sans text-[13px] text-ink">{f.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="01" label="How it works" />
          <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-12" style={{ fontSize: 'clamp(36px, 4.5vw, 56px)' }}>
            Three steps to a{' '}
            <em className="italic text-signal">healthier WordPress site.</em>
          </h2>

          <div className="grid sm:grid-cols-3 gap-10">
            {[
              {
                step: '1',
                title: 'Install and connect',
                desc: 'Install the Fixpath plugin from the WordPress plugin directory. Enter your API key to sync with your Fixpath dashboard.',
              },
              {
                step: '2',
                title: 'View findings in context',
                desc: 'Audit results appear in your WordPress admin. See which pages are affected, understand each issue, and view the recommended fix.',
              },
              {
                step: '3',
                title: 'Fix and re-audit',
                desc: 'Apply content fixes directly from the admin panel. Trigger a re-audit to verify improvements and track your score over time.',
              },
            ].map((s) => (
              <div key={s.step}>
                <span
                  className="w-10 h-10 rounded-full inline-flex items-center justify-center font-mono text-[13px] font-semibold mb-4"
                  style={{ background: 'var(--signal-soft)', color: 'var(--signal)' }}
                >
                  {s.step}
                </span>
                <h3 className="font-sans text-[17px] font-semibold text-ink mb-2">{s.title}</h3>
                <p className="font-sans text-[15px] text-ink-2 leading-[1.65]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="02" label="Features" />
          <h2 className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-12" style={{ fontSize: 'clamp(36px, 4.5vw, 56px)' }}>
            Everything you need{' '}
            <em className="italic text-signal">inside your CMS.</em>
          </h2>

          <div className="grid sm:grid-cols-2 gap-x-12 gap-y-10">
            {[
              { title: 'Page-level findings', desc: 'See which specific pages have issues and what severity they are. Filter by module, severity, or page to focus on what matters most.' },
              { title: 'Direct content fixes', desc: 'For issues like missing alt text, heading hierarchy problems, or meta description length, apply the fix directly from your WordPress admin.' },
              { title: 'Score dashboard', desc: 'Your Website Health Score appears in the plugin dashboard. Track how it changes over time as you fix issues and re-audit.' },
              { title: 'One-click re-audit', desc: 'Trigger a new audit directly from WordPress. Results sync automatically, so you can verify fixes without switching between tools.' },
              { title: 'Team notifications', desc: 'Optionally send audit summaries to team members via email. Keep developers, content editors, and stakeholders aligned on priorities.' },
              { title: 'Multi-site support', desc: 'Managing multiple WordPress sites? The plugin connects each site to its own Fixpath project, so findings and scores are tracked separately.' },
            ].map((f) => (
              <div key={f.title}>
                <h3 className="font-sans text-[16px] font-semibold text-ink mb-2">{f.title}</h3>
                <p className="font-sans text-[14px] text-ink-2 leading-[1.65]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FaqPreview sectionNumber="03" items={WP_FAQS} />

      {/* CTA */}
      <HomeCta />
    </main>
  )
}
