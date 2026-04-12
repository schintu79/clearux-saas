import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn about ClearUX — the AI-powered UX audit platform helping teams build better digital products.',
}

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[70vh] bg-surface">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <h1 className="font-manrope font-bold text-3xl sm:text-4xl text-text mb-6">
            About Clear<span className="text-accent">UX</span>
          </h1>

          <div className="space-y-5 text-text/80 text-base leading-relaxed">
            <p>
              ClearUX is an AI-powered UX audit platform that helps product teams, designers, and marketers
              understand what&rsquo;s working on their website — and what isn&rsquo;t. We analyse your site across
              56 checkpoints spanning usability, conversion, accessibility, mobile experience, content quality,
              and AI discoverability.
            </p>

            <p>
              Traditional UX audits take weeks and cost thousands. ClearUX delivers a comprehensive,
              actionable report in minutes — powered by advanced AI that reads your pages the way a
              senior UX consultant would, but at a fraction of the cost.
            </p>

            <h2 className="font-manrope font-semibold text-xl text-text pt-4">Our Mission</h2>
            <p>
              We believe every digital product deserves great UX. Our mission is to make professional-grade
              UX analysis accessible to teams of every size — from solo founders to enterprise organisations —
              so they can ship products that users love.
            </p>

            <h2 className="font-manrope font-semibold text-xl text-text pt-4">How It Works</h2>
            <p>
              Paste your URL, choose a plan, and our engine crawls your pages, analyses them against
              industry-standard UX heuristics, and generates a prioritised report with concrete
              recommendations you can act on immediately. You get severity ratings, impact estimates,
              and a downloadable PDF or Word report to share with your team.
            </p>

            <h2 className="font-manrope font-semibold text-xl text-text pt-4">Built for Real Teams</h2>
            <p>
              ClearUX is designed for product managers, UX designers, growth marketers, and founders
              who need fast, reliable UX insights without the overhead of hiring a consultancy.
              Credits never expire, so you can audit whenever you need to.
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted">
              Have questions?{' '}
              <Link href="/contact" className="text-accent hover:underline">Get in touch</Link>.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
