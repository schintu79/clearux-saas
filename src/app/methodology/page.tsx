import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import MethodologyContent from './MethodologyContent'

export const metadata: Metadata = {
  title: 'Methodology — How Fixpath scores, what it verifies, and when we refund | Fixpath',
  description: 'Show your work: how Fixpath derives every score, the evidence tiers behind each finding, the worst-driven cap model, severity definitions, and our refund policy. No invented urgency, no fabricated numbers.',
}

export default function MethodologyPage() {
  return (
    <MarketingBody>
      <Nav />
      <MethodologyContent />
      <Footer />
    </MarketingBody>
  )
}
