import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Hero } from '@/components/marketing/Hero'
import { Problem } from '@/components/marketing/Problem'
import { Comparison } from '@/components/marketing/Comparison'
import { HumanExperience } from '@/components/marketing/HumanExperience'
import { InstrumentGrid } from '@/components/marketing/InstrumentGrid'
import { CheckpointTicker } from '@/components/marketing/CheckpointTicker'
import { BenchmarkTable } from '@/components/marketing/BenchmarkTable'
import { FindingAnatomy } from '@/components/marketing/FindingAnatomy'
import { Pricing } from '@/components/marketing/Pricing'
import { Coda } from '@/components/marketing/Coda'
import { Footer } from '@/components/marketing/Footer'
import { HomeJsonLd } from '@/components/seo/JsonLd'

export const metadata: Metadata = {
  title: 'ClearUX — The audit your team actually ships from.',
  description:
    'AI-powered UX audits: 96 checkpoints, 6 modules. Severity-ranked, evidence-backed, shippable fixes. First audit free.',
}

export default function HomePage() {
  return (
    <MarketingBody>
      <HomeJsonLd />
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Comparison />
        <HumanExperience />
        <InstrumentGrid />
        <CheckpointTicker />
        <BenchmarkTable />
        <FindingAnatomy />
        <Pricing />
        <Coda />
      </main>
      <Footer />
    </MarketingBody>
  )
}
