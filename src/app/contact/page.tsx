import type { Metadata } from 'next'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Nav } from '@/components/marketing/Nav'
import { Footer } from '@/components/marketing/Footer'
import ContactContent from './ContactContent'

export const metadata: Metadata = {
  title: 'Contact — ClearUX',
  description: 'Have a question, feedback, or need help? Get in touch with the ClearUX team.',
}

export default function ContactPage() {
  return (
    <MarketingBody>
      <Nav />
      <ContactContent />
      <Footer />
    </MarketingBody>
  )
}
