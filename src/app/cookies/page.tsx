import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'ClearUX cookie policy — what cookies we use and why.',
}

export default function CookiesPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[70vh] bg-surface">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <h1 className="font-manrope font-bold text-3xl sm:text-4xl text-text mb-2">Cookie Policy</h1>
          <p className="text-sm text-muted mb-10">Last updated: April 2026</p>

          <div className="space-y-6 text-text/80 text-sm leading-relaxed">
            <section>
              <h2 className="font-semibold text-lg text-text mb-2">What Are Cookies</h2>
              <p>
                Cookies are small text files stored on your device when you visit a website. They help the
                site remember your preferences and improve your experience.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-lg text-text mb-2">Cookies We Use</h2>
              <p>ClearUX uses only essential cookies required for the platform to function properly:</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-off">
                      <th className="text-left px-4 py-2 font-semibold text-text border-b border-border">Cookie</th>
                      <th className="text-left px-4 py-2 font-semibold text-text border-b border-border">Purpose</th>
                      <th className="text-left px-4 py-2 font-semibold text-text border-b border-border">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="px-4 py-2 font-mono text-xs">sb-*-auth-token</td>
                      <td className="px-4 py-2">Authentication session managed by Supabase</td>
                      <td className="px-4 py-2">Session</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="px-4 py-2 font-mono text-xs">clearux-theme</td>
                      <td className="px-4 py-2">Remembers your light/dark theme preference</td>
                      <td className="px-4 py-2">1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="font-semibold text-lg text-text mb-2">Third-Party Cookies</h2>
              <p>
                We do not use advertising cookies or third-party tracking cookies. Stripe, our payment
                processor, may set its own cookies during the checkout process — these are governed by
                Stripe&rsquo;s privacy policy.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-lg text-text mb-2">Managing Cookies</h2>
              <p>
                You can clear or block cookies through your browser settings. Note that disabling essential
                cookies may prevent you from logging in or using certain features of ClearUX.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-lg text-text mb-2">Contact</h2>
              <p>
                For questions about our cookie usage, contact us at{' '}
                <a href="mailto:support@clearux.ai" className="text-accent hover:underline">support@clearux.ai</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
