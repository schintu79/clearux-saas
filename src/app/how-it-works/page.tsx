import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import HowItWorksContent from './HowItWorksContent'

export const metadata: Metadata = {
  title: 'How it works — From URL to useful truth in minutes | Fixpath',
  description: 'Enter your URL. Fixpath detects real issues, prioritises by impact, generates fix guidance, and tracks improvement. See how the Find → Fix → Track workflow works.',
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
