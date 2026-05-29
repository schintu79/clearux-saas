import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import { WhyFixpathContent } from './WhyFixpathContent'

export const metadata: Metadata = {
  title: 'Why Fixpath — Built around truth, not noise',
  description:
    'Most audit tools create noise. Fixpath is built around truth, trust, and usefulness — real issues, impact-ranked priorities, fix guidance, and progress tracking.',
}

export default function WhyFixpathPage() {
  return (
    <MarketingBody>
      <Nav />
      <WhyFixpathContent />
      <Footer />
    </MarketingBody>
  )
}
