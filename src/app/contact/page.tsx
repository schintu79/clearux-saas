import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ContactContent from './ContactContent';

export const metadata: Metadata = {
  title: 'Contact — ClearUX',
  description: 'Have a question, feedback, or need help? Get in touch with the ClearUX team.',
};

export default function ContactPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#111114]">
      <Navbar />
      <ContactContent />
      <Footer />
    </div>
  );
}
