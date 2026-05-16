import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import AboutContent from './AboutContent'

export const metadata: Metadata = {
  title: 'About Fixpath — Full Clarity, at Your Fingertips',
  description: 'Fixpath gives product teams 360° clarity on every layer of user experience. Learn why we exist and who built it.',
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
