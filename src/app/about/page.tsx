import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import AboutContent from './AboutContent'

export const metadata: Metadata = {
  title: 'About ClearUX — Full Clarity, at Your Fingertips',
  description: 'ClearUX gives product teams 360° clarity on every layer of user experience. Learn why we exist and who built it.',
}

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#111114]">
      <Navbar />
      <AboutContent />
      <Footer />
    </div>
  )
}
