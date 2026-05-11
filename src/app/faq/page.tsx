import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import { FaqJsonLd } from '@/components/seo/JsonLd'
import FaqContent from './FaqContent'

export const metadata: Metadata = {
  title: 'FAQ — ClearUX',
  description: 'Everything you need to know about ClearUX audits, pricing, and reports.',
}

export default function FaqPage() {
  return (
    <MarketingBody>
      <FaqJsonLd />
      <Nav />
      <FaqContent />
      <Footer />
    </MarketingBody>
  )
}
