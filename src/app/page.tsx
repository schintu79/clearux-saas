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
    'Fixpath is an AI-powered website audit tool that scans your site across 96 checkpoints in 6 modules, identifies UX, accessibility, and SEO issues with severity-ranked findings, and gives you a step-by-step fix path. First audit free, no credit card required.',
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
