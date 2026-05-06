import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HowItWorksContent from './HowItWorksContent'

export const metadata: Metadata = {
  title: 'How ClearUX Works — Human-Centered AI Audit Platform',
  description: 'Three steps to a comprehensive UX audit. Paste your URL, AI runs 64 checkpoints across four pillars, and get ranked findings with actionable fixes.',
}

export default function HowItWorksPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#111114]">
      <Navbar />
      <HowItWorksContent />
      <Footer />
    </div>
  )
}
