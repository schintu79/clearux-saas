import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import { ChangelogContent } from './ChangelogContent'

export const metadata: Metadata = {
  title: 'Changelog — Fixpath',
  description: 'See what is new in Fixpath. Product updates, new features, and improvements.',
}

export default function ChangelogPage() {
  return (
    <MarketingBody>
      <Nav />
      <ChangelogContent />
      <Footer />
    </MarketingBody>
  )
}
