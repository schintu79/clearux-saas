import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { HomeHero } from '@/components/marketing/HomeHero'
import { HomeTrustStrip } from '@/components/marketing/HomeTrustStrip'
import { HomeWorkflow } from '@/components/marketing/HomeWorkflow'
import { HomeDifferentiator } from '@/components/marketing/HomeDifferentiator'
import { HomeModules } from '@/components/marketing/HomeModules'
import { HomeAudience } from '@/components/marketing/HomeAudience'
import { HomeProof } from '@/components/marketing/HomeProof'
import { HomeFaq } from '@/components/marketing/HomeFaq'
import { HomeCta } from '@/components/marketing/HomeCta'
import { Footer } from '@/components/marketing/Footer'
import { HomeJsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Fixpath — See what is hurting trust. Fix what matters.',
  description:
    'Fixpath is a decision engine for real website and brand issues. It finds problems across clarity, trust, accessibility, and technical quality — prioritizes by impact, gives fix guidance, and tracks improvement. First audit free.',
}

/**
 * Homepage — structured for 5-second clarity:
 * 1. Hero (product definition + animated dashboard)
 * 2. Trust band (4 proof points)
 * 3. Find. Fix. Track. (visual product walkthrough)
 * 4. Built around truth, not noise (6 proof blocks)
 * 5. What we cover (7 category chips)
 * 6. Who it's for (4 audience cards)
 * 7. Inside every audit (4 proof items)
 * 8. FAQ (accordion)
 * 9. Final CTA
 */
export default function HomePage() {
  return (
    <MarketingBody>
      <HomeJsonLd />
      <Nav />
      <main>
        <HomeHero />
        <HomeTrustStrip />
        <HomeWorkflow />
        <HomeDifferentiator />
        <HomeModules />
        <HomeAudience />
        <HomeProof />
        <HomeFaq />
        <HomeCta />
      </main>
      <Footer />
    </MarketingBody>
  )
}
