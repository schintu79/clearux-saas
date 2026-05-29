import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import AboutContent from './AboutContent'

export const metadata: Metadata = {
  title: 'About — Why Fixpath exists | Fixpath',
  description: 'Fixpath exists because too many teams get noise instead of useful truth. Built around truth, trust, and usefulness — a decision engine for real website and brand issues.',
}

export default function AboutPage() {
  return (
    <MarketingBody>
      <Nav />
      <AboutContent />
      <Footer />
    </MarketingBody>
  )
}
