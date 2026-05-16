import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import HowItWorksContent from './HowItWorksContent'

export const metadata: Metadata = {
  title: 'Product — Fixpath',
  description: 'Audit your website UX, brand identity, and AI visibility. 96 checkpoints across 6 modules — severity-ranked findings, evidence-backed recommendations, exportable reports.',
}

export default function HowItWorksPage() {
  return (
    <MarketingBody>
      <Nav />
      <HowItWorksContent />
      <Footer />
    </MarketingBody>
  )
}
