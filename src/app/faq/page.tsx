import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import FaqContent from './FaqContent';

export const metadata: Metadata = {
  title: 'FAQ — ClearUX',
  description: 'Everything you need to know about ClearUX audits, pricing, and reports.',
};

export default function FaqPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#111114]">
      <Navbar />
      <FaqContent />
      <Footer />
    </div>
  );
}
