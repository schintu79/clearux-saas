import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'

export const metadata: Metadata = {
  title: 'Privacy Policy — ClearUX',
  description: 'How ClearUX handles your data, written in plain language. We only analyse publicly visible content and never sell your data.',
}

export default function PrivacyPage() {
  return (
    <MarketingBody>
      <Nav />
      <main>
        <section className="py-[80px] border-b border-rule max-sm:py-14">
          <div className="max-w-[760px] mx-auto px-8 max-sm:px-5">
            <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-signal mb-4 block">Legal</span>
            <h1 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.02em] mb-3" style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}>
              Privacy policy
            </h1>
            <p className="font-mono text-[11px] text-m-muted tracking-[0.06em] uppercase mb-8">Last updated: May 2026</p>
            <p className="font-sans text-[14px] text-ink-2 p-5 border border-signal/30 bg-signal/5 leading-[1.6]">
              This policy is written in plain language so you can actually understand it. No legalese, no hidden clauses. If anything is unclear, email us and we will explain it.
            </p>
          </div>
        </section>

        <section className="py-[60px]">
          <div className="max-w-[760px] mx-auto px-8 max-sm:px-5 space-y-10 font-sans text-[15px] text-ink-2 leading-[1.7]">
            <div>
              <h2 className="font-sans font-medium text-[17px] text-ink mb-3">What we collect</h2>
              <p className="mb-3">We collect the minimum data needed to run your audits and manage your account:</p>
              <div className="space-y-2 ml-1">
                <p><span className="font-medium text-ink">Account info:</span> your name, email address, and a hashed version of your password. We never store your password in readable form.</p>
                <p><span className="font-medium text-ink">Payment info:</span> processed entirely by Stripe. We never see or store your card number.</p>
                <p><span className="font-medium text-ink">Audit data:</span> the publicly visible pages of the URL you submit, plus the analysis findings and reports we generate for you.</p>
              </div>
            </div>

            <div>
              <h2 className="font-sans font-medium text-[17px] text-ink mb-3">What we do with it</h2>
              <p className="mb-3">We use your data for three things:</p>
              <div className="space-y-2 ml-1">
                <p><span className="font-medium text-ink">Running your audits</span> — crawling pages, generating findings, building reports.</p>
                <p><span className="font-medium text-ink">Managing your account</span> — login, credits, settings, email notifications about completed audits.</p>
                <p><span className="font-medium text-ink">Improving ClearUX</span> — aggregated, anonymous usage statistics only. Never your personal data or audit results.</p>
              </div>
            </div>

            <div>
              <h2 className="font-sans font-medium text-[17px] text-ink mb-3">What we never do</h2>
              <div className="space-y-2 ml-1">
                <p>We <span className="font-medium text-ink">never sell your data</span> to anyone.</p>
                <p>We <span className="font-medium text-ink">never share your audit results</span> with third parties, competitors, or the public.</p>
                <p>We <span className="font-medium text-ink">never use advertising or tracking cookies</span>.</p>
                <p>We <span className="font-medium text-ink">never send your data to ad networks</span>.</p>
              </div>
            </div>

            <div>
              <h2 className="font-sans font-medium text-[17px] text-ink mb-3">Where your data lives</h2>
              <p>Your data is stored on encrypted servers managed by Supabase (hosted on AWS infrastructure). All data travels over HTTPS. Passwords are hashed using industry-standard algorithms and are never stored in plain text.</p>
            </div>

            <div>
              <h2 className="font-sans font-medium text-[17px] text-ink mb-3">Third-party services we use</h2>
              <p className="mb-3">We rely on a small number of trusted services. Each processes only the minimum data it needs:</p>
              <div className="space-y-2 ml-1">
                <p><span className="font-medium text-ink">Supabase</span> — database and authentication.</p>
                <p><span className="font-medium text-ink">Stripe</span> — payment processing. Stripe handles all card data directly.</p>
                <p><span className="font-medium text-ink">Anthropic (Claude API)</span> — AI-powered analysis of your audit pages.</p>
                <p><span className="font-medium text-ink">Resend</span> — sends transactional emails (audit complete, password reset).</p>
              </div>
            </div>

            <div>
              <h2 className="font-sans font-medium text-[17px] text-ink mb-3">Your rights</h2>
              <p className="mb-3">You are in control of your data:</p>
              <div className="space-y-2 ml-1">
                <p><span className="font-medium text-ink">Access and update</span> your data anytime from your dashboard settings.</p>
                <p><span className="font-medium text-ink">Export</span> your audit reports as PDF or Word documents.</p>
                <p><span className="font-medium text-ink">Delete your account</span> and all associated data via our <a href="/contact" className="text-ink font-medium underline decoration-signal decoration-2 underline-offset-2 hover:text-signal transition-colors">contact form</a> or by emailing <a href="mailto:support@clearux.ai" className="text-ink font-medium underline decoration-signal decoration-2 underline-offset-2 hover:text-signal transition-colors">support@clearux.ai</a>. We process deletion requests within 30 days.</p>
              </div>
            </div>

            <div>
              <h2 className="font-sans font-medium text-[17px] text-ink mb-3">Cookies</h2>
              <p>We use only essential cookies to keep you logged in and remember your theme preference. No tracking cookies, no advertising cookies. Full details in our <a href="/cookies" className="text-ink font-medium underline decoration-signal decoration-2 underline-offset-2 hover:text-signal transition-colors">Cookie Policy</a>.</p>
            </div>

            <div>
              <h2 className="font-sans font-medium text-[17px] text-ink mb-3">Changes to this policy</h2>
              <p>If we make meaningful changes, we will email you before they take effect. We will never quietly reduce your privacy protections.</p>
            </div>

            <div>
              <h2 className="font-sans font-medium text-[17px] text-ink mb-3">Questions?</h2>
              <p>Use our <a href="/contact" className="text-ink font-medium underline decoration-signal decoration-2 underline-offset-2 hover:text-signal transition-colors">contact form</a> or email us at <a href="mailto:support@clearux.ai" className="text-ink font-medium underline decoration-signal decoration-2 underline-offset-2 hover:text-signal transition-colors">support@clearux.ai</a>. We reply to every message.</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </MarketingBody>
  )
}
