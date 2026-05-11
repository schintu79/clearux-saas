import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'

export const metadata: Metadata = {
  title: 'Cookie Policy — ClearUX',
  description: 'ClearUX cookie policy — what cookies we use, why, and how our consent banner is designed ethically.',
}

export default function CookiesPage() {
  return (
    <MarketingBody>
      <Nav />
      <main>
        <section className="py-[80px] border-b border-rule max-sm:py-14">
          <div className="max-w-[760px] mx-auto px-8 max-sm:px-5">
            <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-signal mb-4 block">Legal</span>
            <h1 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.02em] mb-3" style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}>
              Cookie policy
            </h1>
            <p className="font-mono text-[11px] text-m-muted tracking-[0.06em] uppercase">Last updated: May 2026</p>
          </div>
        </section>

        <section className="py-[60px]">
          <div className="max-w-[760px] mx-auto px-8 max-sm:px-5 space-y-10 font-sans text-[15px] text-ink-2 leading-[1.7]">
            <div>
              <h2 className="font-sans font-medium text-[17px] text-ink mb-3">What cookies are</h2>
              <p>Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences and keep you logged in.</p>
            </div>

            <div>
              <h2 className="font-sans font-medium text-[17px] text-ink mb-3">Cookies we use</h2>
              <p className="mb-4">ClearUX uses only essential cookies. We don&apos;t use advertising, analytics, or third-party tracking cookies.</p>
              <div className="overflow-x-auto border border-ink">
                <table className="w-full text-[14px] border-collapse">
                  <thead>
                    <tr className="bg-ink text-paper">
                      <th className="text-left px-5 py-3 font-mono text-[10px] font-medium tracking-[0.1em] uppercase">Cookie</th>
                      <th className="text-left px-5 py-3 font-mono text-[10px] font-medium tracking-[0.1em] uppercase">Purpose</th>
                      <th className="text-left px-5 py-3 font-mono text-[10px] font-medium tracking-[0.1em] uppercase">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-rule">
                      <td className="px-5 py-3 font-mono text-[12px]">sb-*-auth-token</td>
                      <td className="px-5 py-3">Keeps you logged in (managed by Supabase)</td>
                      <td className="px-5 py-3">Session</td>
                    </tr>
                    <tr className="border-b border-rule">
                      <td className="px-5 py-3 font-mono text-[12px]">clearux-theme</td>
                      <td className="px-5 py-3">Remembers your light/dark theme choice</td>
                      <td className="px-5 py-3">1 year</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-mono text-[12px]">clearux-cookie-consent</td>
                      <td className="px-5 py-3">Records your cookie consent choice</td>
                      <td className="px-5 py-3">1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="font-sans font-medium text-[17px] text-ink mb-3">No pre-checked options</h2>
              <p>No cookies are pre-selected or enabled by default. Our consent banner appears once and requires a single, explicit click to either accept or reject.</p>
            </div>

            <div>
              <h2 className="font-sans font-medium text-[17px] text-ink mb-3">Third-party cookies</h2>
              <p>We don&apos;t use advertising or third-party tracking cookies. Stripe, our payment processor, may set its own cookies during checkout — these are governed by <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-ink font-medium underline decoration-signal decoration-2 underline-offset-2 hover:text-signal transition-colors">Stripe&apos;s privacy policy</a>.</p>
            </div>

            <div>
              <h2 className="font-sans font-medium text-[17px] text-ink mb-3">Managing cookies</h2>
              <p>You can clear or block cookies through your browser settings at any time. Disabling essential cookies may prevent you from logging in or using certain features.</p>
            </div>

            <div>
              <h2 className="font-sans font-medium text-[17px] text-ink mb-3">Our consent banner: ethical by design</h2>
              <p className="mb-3">ClearUX audits products for dark patterns — so we hold our own cookie consent to the same standard. Here is how our banner works:</p>
              <div className="space-y-2 ml-1">
                <p><span className="font-medium text-ink">Equal prominence:</span> the &ldquo;Reject all&rdquo; and &ldquo;Accept all&rdquo; buttons are identical in size, colour, contrast, and visual weight. Neither is emphasised over the other.</p>
                <p><span className="font-medium text-ink">Equal effort:</span> rejecting cookies takes exactly one click — the same as accepting. There is no &ldquo;Manage preferences&rdquo; detour that makes rejection harder.</p>
                <p><span className="font-medium text-ink">No pre-checked boxes:</span> nothing is enabled until you explicitly choose.</p>
                <p><span className="font-medium text-ink">Neutral language:</span> we use &ldquo;Reject all&rdquo; and &ldquo;Accept all&rdquo; — not &ldquo;Accept&rdquo; vs. &ldquo;Manage preferences&rdquo; or any phrasing that nudges you towards acceptance.</p>
                <p><span className="font-medium text-ink">No emotional manipulation:</span> no guilt-tripping, no urgency, no consequences framing. Your choice is respected either way.</p>
              </div>
            </div>

            <div>
              <h2 className="font-sans font-medium text-[17px] text-ink mb-3">Questions?</h2>
              <p>Use our <a href="/contact" className="text-ink font-medium underline decoration-signal decoration-2 underline-offset-2 hover:text-signal transition-colors">contact form</a> or email us at <a href="mailto:support@clearux.ai" className="text-ink font-medium underline decoration-signal decoration-2 underline-offset-2 hover:text-signal transition-colors">support@clearux.ai</a>.</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </MarketingBody>
  )
}
