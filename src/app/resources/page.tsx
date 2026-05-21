import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import { ResourcesContent } from './ResourcesContent'

export const metadata: Metadata = {
  title: 'Resources — Fixpath',
  description: 'Guides, tutorials, and best practices for improving your website health, accessibility, and AI visibility.',
}

export default function ResourcesPage() {
  return (
    <MarketingBody>
      <Nav />
      <ResourcesContent />
      <Footer />
    </MarketingBody>
  )
}
