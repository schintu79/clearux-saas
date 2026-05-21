import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { HomeHero } from '@/components/marketing/HomeHero'
import { HomeWorkflow } from '@/components/marketing/HomeWorkflow'
import { HomeModules } from '@/components/marketing/HomeModules'
import { HomeAdvantage } from '@/components/marketing/HomeAdvantage'
import { HomeWordPress } from '@/components/marketing/HomeWordPress'
import { Pricing } from '@/components/marketing/Pricing'
import { HomeFaq } from '@/components/marketing/HomeFaq'
import { HomeCta } from '@/components/marketing/HomeCta'
import { Footer } from '@/components/marketing/Footer'
import { HomeJsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Fixpath — Find the issues hurting your site. Follow the path to fix them.',
  description:
    'Fixpath.ai audits your website across 96 checkpoints, turns every issue into a clear fix path, and tracks improvement over time. First audit free.',
}

export default function HomePage() {
  return (
    <MarketingBody>
      <HomeJsonLd />
      <Nav />
      <main>
        <HomeHero />
        <HomeWorkflow />
        <HomeModules />
        <HomeAdvantage />
        <HomeWordPress />
        <Pricing />
        <HomeFaq />
        <HomeCta />
      </main>
      <Footer />
    </MarketingBody>
  )
}
