import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import { WordPressContent } from './WordPressContent'

export const metadata: Metadata = {
  title: 'WordPress plugin — Fixpath',
  description:
    'The Fixpath WordPress plugin brings audit findings directly into your admin panel. See issues, apply fixes, and re-audit without leaving WordPress.',
}

export default function WordPressPage() {
  return (
    <MarketingBody>
      <Nav />
      <WordPressContent />
      <Footer />
    </MarketingBody>
  )
}
