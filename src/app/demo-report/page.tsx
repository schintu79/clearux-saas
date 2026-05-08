import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import DemoReportContent from './DemoReportContent'

export const metadata: Metadata = {
  title: 'Sample Audit Report — ClearUX',
  description: 'See what a ClearUX audit report looks like. Visual demo of findings, scores, and recommendations across 64 checkpoints.',
}

export default function DemoReportPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#111114]">
      <Navbar />
      <DemoReportContent />
      <Footer />
    </div>
  )
}
