import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { HomeHero } from '@/components/marketing/HomeHero'
import { HomeTrustStrip } from '@/components/marketing/HomeTrustStrip'
import { HomeWorkflow } from '@/components/marketing/HomeWorkflow'
import { HomeSignals } from '@/components/marketing/HomeSignals'
import { HomeDifferentiator } from '@/components/marketing/HomeDifferentiator'
import { HomeModules } from '@/components/marketing/HomeModules'
import { HomeModelLayer } from '@/components/marketing/HomeModelLayer'
import { HomeAudience } from '@/components/marketing/HomeAudience'
import { HomeProof } from '@/components/marketing/HomeProof'
import { HomeFaq } from '@/components/marketing/HomeFaq'
import { HomeCta } from '@/components/marketing/HomeCta'
import { Footer } from '@/components/marketing/Footer'
import { HomeJsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Fixpath — See what is hurting trust. Fix what matters.',
  description:
    'Fixpath is a decision engine for real website and brand issues. Audits combine verified checks, page evidence, and structured review — with confidence and coverage visible on every finding. First audit free.',
}

/**
 * Homepage — structured for 5-second clarity:
 *  1. Hero (product definition + animated dashboard)
 *  2. Trust band (4 proof points)
 *  3. Find. Fix. Track. (visual product walkthrough)
 *  4. We measure signals (product principle — structure over taste)
 *  5. Built around truth, not noise (6 proof blocks)
 *  6. What we cover (7 module chips)
 *  7. One system, multiple AI perspectives (model layer)
 *  8. Who it's for (6 audience cards)
 *  9. Inside every audit (4 proof items)
 * 10. FAQ (accordion)
 * 11. Final CTA
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
        <HomeSignals />
        <HomeDifferentiator />
        <HomeModules />
        <HomeModelLayer />
        <HomeAudience />
        <HomeProof />
        <HomeFaq />
        <HomeCta />
      </main>
      <Footer />
    </MarketingBody>
  )
}
