import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import AboutContent from './HowItWorksContent'

export const metadata: Metadata = {
  title: 'How ClearUX Works — Human-Centered AI Audit Platform',
  description: 'Three steps to a comprehensive UX audit. Paste your URL, AI runs 64 checkpoints across four pillars, and get ranked findings with actionable fixes.',
}

export default function HowItWorksPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-[70vh] bg-surface">
        <AboutContent />
      </main>
      <Footer />
    </>
  )
}
