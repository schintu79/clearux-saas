import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import { ProductContent } from './ProductContent'

export const metadata: Metadata = {
  title: 'Product — Fixpath',
  description:
    'See how Fixpath audits your website across 96 checkpoints, helps you fix issues directly, and tracks improvement over time.',
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
