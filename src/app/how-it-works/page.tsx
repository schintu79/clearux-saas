import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HowItWorksContent from './HowItWorksContent'

export const metadata: Metadata = {
  title: 'How It Works',
  description: 'Three steps to 360° clarity. Choose your audit type (website, brand identity, or design), we run 96 checkpoints across six modules, and you decide what to fix.',
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
