import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'Privacy Policy — ClearUX',
  description: 'How ClearUX handles your data. We only analyse publicly visible content and never store or share your website data.',
}

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-[70vh] bg-surface">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <h1 className="font-heading font-semibold text-3xl sm:text-4xl text-text mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted mb-10">Last updated: April 2026</p>

          <div className="space-y-6 text-text/80 text-sm leading-relaxed">
            <section>
              <h2 className="font-semibold text-lg text-text mb-2">1. Information We Collect</h2>
              <p>
                When you create a ClearUX account we collect your name, email address, and hashed password.
                When you purchase credits we process payments through Stripe — we never store your card details directly.
                When you run an audit we crawl the publicly accessible pages of the URL you provide and store the
                crawled content, analysis findings, and generated reports associated with your account.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-lg text-text mb-2">2. How We Use Your Data</h2>
              <p>
                We use your data to provide the ClearUX service: running audits, generating reports, managing
                your account, and communicating with you about your audits (e.g. completion emails). We do not
                sell or share your personal data with third-party advertisers. Aggregated, non-identifying usage
                statistics may be used to improve the platform.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-lg text-text mb-2">3. Data Storage &amp; Security</h2>
              <p>
                Your data is stored on secure, encrypted servers managed by Supabase (hosted on AWS).
                We use HTTPS for all data in transit and follow industry-standard security practices.
                Passwords are hashed and never stored in plain text.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-lg text-text mb-2">4. Third-Party Services</h2>
              <p>
                We use the following third-party services: Supabase (database &amp; authentication),
                Stripe (payment processing), Anthropic Claude API (AI analysis), and Resend (transactional email).
                Each service has its own privacy policy and processes only the minimum data necessary.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-lg text-text mb-2">5. Your Rights</h2>
              <p>
                You can access, update, or delete your account data at any time from your dashboard settings.
                If you wish to delete your entire account and all associated data, contact us at{' '}
                <a href="mailto:support@clearux.ai" className="text-text font-semibold underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">support@clearux.ai</a>.
                We will process deletion requests within 30 days.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-lg text-text mb-2">6. Cookies</h2>
              <p>
                We use essential cookies to manage your session and remember your theme preference.
                We do not use advertising or third-party tracking cookies. See our{' '}
                <a href="/cookies" className="text-text font-semibold underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">Cookie Policy</a> for details.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-lg text-text mb-2">7. Changes to This Policy</h2>
              <p>
                We may update this policy from time to time. If we make material changes, we will notify
                you via email or a notice on the platform. Your continued use of ClearUX after changes
                constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-lg text-text mb-2">8. Contact</h2>
              <p>
                For privacy-related questions, contact us at{' '}
                <a href="mailto:support@clearux.ai" className="text-text font-semibold underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">support@clearux.ai</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
