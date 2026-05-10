import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'Privacy Policy — ClearUX',
  description: 'How ClearUX handles your data, written in plain language. We only analyse publicly visible content and never sell your data.',
}

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-[70vh] bg-surface">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <h1 className="font-heading font-medium text-3xl sm:text-4xl text-text mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted mb-4">Last updated: May 2026</p>
          <p className="text-sm text-muted mb-10 p-4 rounded-xl bg-off border border-border/20">
            This policy is written in plain language so you can actually understand it. No legalese, no hidden clauses. If anything is unclear, email us and we will explain it.
          </p>

          <div className="space-y-8 text-text/80 text-[15px] leading-relaxed">
            <section>
              <h2 className="font-heading font-medium text-xl text-text mb-3">What we collect</h2>
              <p className="mb-3">We collect the minimum data needed to run your audits and manage your account:</p>
              <div className="space-y-2 ml-1">
                <p><span className="font-medium text-text">Account info:</span> your name, email address, and a hashed version of your password. We never store your password in readable form.</p>
                <p><span className="font-medium text-text">Payment info:</span> processed entirely by Stripe. We never see or store your card number.</p>
                <p><span className="font-medium text-text">Audit data:</span> the publicly visible pages of the URL you submit, plus the analysis findings and reports we generate for you.</p>
              </div>
            </section>

            <section>
              <h2 className="font-heading font-medium text-xl text-text mb-3">What we do with it</h2>
              <p className="mb-3">We use your data for three things:</p>
              <div className="space-y-2 ml-1">
                <p><span className="font-medium text-text">Running your audits</span> — crawling pages, generating findings, building reports.</p>
                <p><span className="font-medium text-text">Managing your account</span> — login, credits, settings, email notifications about completed audits.</p>
                <p><span className="font-medium text-text">Improving ClearUX</span> — aggregated, anonymous usage statistics only. Never your personal data or audit results.</p>
              </div>
            </section>

            <section>
              <h2 className="font-heading font-medium text-xl text-text mb-3">What we never do</h2>
              <div className="space-y-2 ml-1">
                <p>We <span className="font-medium text-text">never sell your data</span> to anyone.</p>
                <p>We <span className="font-medium text-text">never share your audit results</span> with third parties, competitors, or the public.</p>
                <p>We <span className="font-medium text-text">never use advertising or tracking cookies</span>.</p>
                <p>We <span className="font-medium text-text">never send your data to ad networks</span>.</p>
              </div>
            </section>

            <section>
              <h2 className="font-heading font-medium text-xl text-text mb-3">Where your data lives</h2>
              <p>
                Your data is stored on encrypted servers managed by Supabase (hosted on AWS infrastructure). All data travels over HTTPS. Passwords are hashed using industry-standard algorithms and are never stored in plain text.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-medium text-xl text-text mb-3">Third-party services we use</h2>
              <p className="mb-3">We rely on a small number of trusted services. Each processes only the minimum data it needs:</p>
              <div className="space-y-2 ml-1">
                <p><span className="font-medium text-text">Supabase</span> — database and authentication.</p>
                <p><span className="font-medium text-text">Stripe</span> — payment processing. Stripe handles all card data directly.</p>
                <p><span className="font-medium text-text">Anthropic (Claude API)</span> — AI-powered analysis of your audit pages.</p>
                <p><span className="font-medium text-text">Resend</span> — sends transactional emails (audit complete, password reset).</p>
              </div>
            </section>

            <section>
              <h2 className="font-heading font-medium text-xl text-text mb-3">Your rights</h2>
              <p className="mb-3">You are in control of your data:</p>
              <div className="space-y-2 ml-1">
                <p><span className="font-medium text-text">Access and update</span> your data anytime from your dashboard settings.</p>
                <p><span className="font-medium text-text">Export</span> your audit reports as PDF or Word documents.</p>
                <p><span className="font-medium text-text">Delete your account</span> and all associated data via our{' '}
                  <a href="/contact" className="text-text font-medium underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">contact form</a>{' '}
                  or by emailing{' '}
                  <a href="mailto:support@clearux.ai" className="text-text font-medium underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">support@clearux.ai</a>.
                  We process deletion requests within 30 days.
                </p>
              </div>
            </section>

            <section>
              <h2 className="font-heading font-medium text-xl text-text mb-3">Cookies</h2>
              <p>
                We use only essential cookies to keep you logged in and remember your theme preference. No tracking cookies, no advertising cookies. Full details in our{' '}
                <a href="/cookies" className="text-text font-medium underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">Cookie Policy</a>.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-medium text-xl text-text mb-3">Changes to this policy</h2>
              <p>
                If we make meaningful changes, we will email you before they take effect. We will never quietly reduce your privacy protections.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-medium text-xl text-text mb-3">Questions?</h2>
              <p>
                Use our{' '}
                <a href="/contact" className="text-text font-medium underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">contact form</a>{' '}
                or email us at{' '}
                <a href="mailto:support@clearux.ai" className="text-text font-medium underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">support@clearux.ai</a>.
                We reply to every message.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
