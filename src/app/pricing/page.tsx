import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import { PricingJsonLd } from '@/components/seo/JsonLd'
import PricingContent from './PricingContent'

export const metadata: Metadata = {
  title: 'Pricing — Full audits from $9.90 | Fixpath',
  description: 'Full 112-checkpoint audits from $9.90. First audit free. Subscribe for ongoing monitoring or buy credit packs for project work. Fix guidance, progress tracking, and reports included.',
}

export default function PricingPage() {
  return (
    <MarketingBody>
      <PricingJsonLd />
      <Nav />
      <PricingContent />
      <Footer />
    </MarketingBody>
  )
}
