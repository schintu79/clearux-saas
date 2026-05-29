import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import { ProductContent } from './ProductContent'

export const metadata: Metadata = {
  title: 'Product — A decision engine for real website issues | Fixpath',
  description:
    'Fixpath finds real issues hurting trust and clarity, prioritises by impact, provides concrete fix guidance, and tracks improvement over time. 96 checkpoints across 6 modules.',
}

export default function ProductPage() {
  return (
    <MarketingBody>
      <Nav />
      <ProductContent />
      <Footer />
    </MarketingBody>
  )
}
