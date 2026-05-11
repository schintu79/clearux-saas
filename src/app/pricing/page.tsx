import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import PricingContent from './PricingContent'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'AI-powered UX audits from $9.90 each. First audit free. Subscribe from $29/mo or buy credit packs. 96 checkpoints, PDF + DOCX reports.',
}

export default function PricingPage() {
  return (
    <MarketingBody>
      <Nav />
      <PricingContent />
      <Footer />
    </MarketingBody>
  )
}
