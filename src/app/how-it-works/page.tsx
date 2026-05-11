import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import HowItWorksContent from './HowItWorksContent'

export const metadata: Metadata = {
  title: 'How It Works',
  description: 'Three steps to 360° clarity. Choose your audit type (website, brand identity, or design), we run 96 checkpoints across six modules, and you decide what to fix.',
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
