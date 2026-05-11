import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import DemoReportContent from './DemoReportContent'

export const metadata: Metadata = {
  title: 'Sample reports',
  description: 'See what ClearUX delivers. Explore sample reports for website audits, brand identity audits, and design audits — scores, findings, and actionable recommendations.',
}

export default function DemoReportPage() {
  return (
    <MarketingBody>
      <Nav />
      <DemoReportContent />
      <Footer />
    </MarketingBody>
  )
}
