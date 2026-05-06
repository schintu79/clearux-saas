import type { Metadata } from 'next'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import AboutContent from './AboutContent'

export const metadata: Metadata = {
  title: 'About ClearUX — Why We Exist',
  description: 'ClearUX was born from 20+ years of watching companies ship products that ignored their users. Learn why we exist and who built it.',
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
