import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { HomeHero } from '@/components/marketing/HomeHero'
import { HomeTrustStrip } from '@/components/marketing/HomeTrustStrip'
import { HomeIdentity } from '@/components/marketing/HomeIdentity'
import { HomeWorkflow } from '@/components/marketing/HomeWorkflow'
import { HomeDifferentiator } from '@/components/marketing/HomeDifferentiator'
import { HomeModules } from '@/components/marketing/HomeModules'
import { HomeAudience } from '@/components/marketing/HomeAudience'
import { HomeCta } from '@/components/marketing/HomeCta'
import { Footer } from '@/components/marketing/Footer'
import { HomeJsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'Fixpath — See what is hurting trust. Fix what matters.',
  description:
    'Fixpath is a decision engine for real website and brand issues. It finds problems across clarity, trust, accessibility, and technical quality — prioritizes by impact, gives fix guidance, and tracks improvement. First audit free.',
}

/**
 * Homepage — structured as the brief's recommended sequence:
 * 1. Header (Nav)
 * 2. Hero
 * 3. Trust strip
 * 4. What Fixpath is
 * 5. How it works
 * 6. Why we are different
 * 7. Categories we cover (product proof)
 * 8. Who it is for / not for
 * 9. Final CTA
 * 10. Footer
 */
export default function HomePage() {
  return (
    <MarketingBody>
      <HomeJsonLd />
      <Nav />
      <main>
        <HomeHero />
        <HomeTrustStrip />
        <HomeIdentity />
        <HomeWorkflow />
        <HomeDifferentiator />
        <HomeModules />
        <HomeAudience />
        <HomeCta />
      </main>
      <Footer />
    </MarketingBody>
  )
}
