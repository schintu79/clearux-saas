import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import DemoReportContent from './DemoReportContent'

export const metadata: Metadata = {
  title: 'Sample reports',
  description: 'See what ClearUX delivers. Explore sample reports for website audits, brand identity audits, and design audits — scores, findings, and actionable recommendations.',
}

export default function DemoReportPage() {
  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <Navbar />
      <DemoReportContent />
      <Footer />
    </div>
  )
}
