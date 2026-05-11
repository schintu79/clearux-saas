import Link from 'next/link'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'

export default function NotFound() {
  return (
    <MarketingBody>
      <Nav />
      <main className="flex-1 flex items-center justify-center px-8 max-sm:px-5 py-24 sm:py-32">
        <div className="text-center max-w-md mx-auto">
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-signal mb-4 block">Error 404</span>
          <h1 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.02em] mb-4" style={{ fontSize: 'clamp(48px, 8vw, 96px)' }}>
            Page not found
          </h1>
          <p className="text-[16px] text-ink-2 leading-[1.6] mb-10 font-sans">
            This page may have moved or the link might be outdated. Let&apos;s get you back on track.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 text-[14px] font-sans font-medium bg-ink text-paper border border-ink rounded-full transition-all hover:bg-signal hover:border-signal"
            >
              Go to homepage
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 text-[14px] font-sans font-medium text-ink bg-transparent border border-rule-2 rounded-full transition-all hover:border-ink"
            >
              Contact support
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </MarketingBody>
  )
}
