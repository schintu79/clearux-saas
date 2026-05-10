import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'Cookie Policy — ClearUX',
  description: 'ClearUX cookie policy — what cookies we use, why, and how our consent banner is designed ethically.',
}

export default function CookiesPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-[70vh] bg-surface">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <h1 className="font-heading font-medium text-3xl sm:text-4xl text-text mb-2">Cookie Policy</h1>
          <p className="text-sm text-muted mb-10">Last updated: May 2026</p>

          <div className="space-y-8 text-text/80 text-[15px] leading-relaxed">
            <section>
              <h2 className="font-heading font-medium text-xl text-text mb-3">What cookies are</h2>
              <p>
                Cookies are small text files stored on your device when you visit a website. They help the
                site remember your preferences and keep you logged in.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-medium text-xl text-text mb-3">Cookies we use</h2>
              <p className="mb-3">ClearUX uses only essential cookies. We don't use advertising, analytics, or third-party tracking cookies.</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-off">
                      <th className="text-left px-4 py-2.5 font-medium text-text border-b border-border">Cookie</th>
                      <th className="text-left px-4 py-2.5 font-medium text-text border-b border-border">Purpose</th>
                      <th className="text-left px-4 py-2.5 font-medium text-text border-b border-border">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="px-4 py-2.5 font-mono text-xs">sb-*-auth-token</td>
                      <td className="px-4 py-2.5">Keeps you logged in (managed by Supabase)</td>
                      <td className="px-4 py-2.5">Session</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="px-4 py-2.5 font-mono text-xs">clearux-theme</td>
                      <td className="px-4 py-2.5">Remembers your light/dark theme choice</td>
                      <td className="px-4 py-2.5">1 year</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-mono text-xs">clearux-cookie-consent</td>
                      <td className="px-4 py-2.5">Records your cookie consent choice</td>
                      <td className="px-4 py-2.5">1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="font-heading font-medium text-xl text-text mb-3">No pre-checked options</h2>
              <p>
                No cookies are pre-selected or enabled by default. Our consent banner appears once
                and requires a single, explicit click to either accept or reject.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-medium text-xl text-text mb-3">Third-party cookies</h2>
              <p>
                We don't use advertising or third-party tracking cookies. Stripe, our payment processor,
                may set its own cookies during checkout — these are governed by{' '}
                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-text font-medium underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">Stripe&rsquo;s privacy policy</a>.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-medium text-xl text-text mb-3">Managing cookies</h2>
              <p>
                You can clear or block cookies through your browser settings at any time. Disabling
                essential cookies may prevent you from logging in or using certain features.
              </p>
            </section>

            <section>
              <h2 className="font-heading font-medium text-xl text-text mb-3">Our consent banner: ethical by design</h2>
              <p className="mb-3">
                ClearUX audits products for dark patterns — so we hold our own cookie consent to the same standard. Here is how our banner works:
              </p>
              <div className="space-y-2 ml-1">
                <p><span className="font-medium text-text">Equal prominence:</span> the &ldquo;Reject all&rdquo; and &ldquo;Accept all&rdquo; buttons are identical in size, colour, contrast, and visual weight. Neither is emphasised over the other.</p>
                <p><span className="font-medium text-text">Equal effort:</span> rejecting cookies takes exactly one click — the same as accepting. There is no &ldquo;Manage preferences&rdquo; detour that makes rejection harder.</p>
                <p><span className="font-medium text-text">No pre-checked boxes:</span> nothing is enabled until you explicitly choose.</p>
                <p><span className="font-medium text-text">Neutral language:</span> we use &ldquo;Reject all&rdquo; and &ldquo;Accept all&rdquo; — not &ldquo;Accept&rdquo; vs. &ldquo;Manage preferences&rdquo; or any phrasing that nudges you towards acceptance.</p>
                <p><span className="font-medium text-text">No emotional manipulation:</span> no guilt-tripping, no urgency, no consequences framing. Your choice is respected either way.</p>
              </div>
            </section>

            <section>
              <h2 className="font-heading font-medium text-xl text-text mb-3">Questions?</h2>
              <p>
                Use our{' '}
                <a href="/contact" className="text-text font-medium underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">contact form</a>{' '}
                or email us at{' '}
                <a href="mailto:support@clearux.ai" className="text-text font-medium underline decoration-brand decoration-2 underline-offset-2 hover:opacity-70 transition-opacity">support@clearux.ai</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
