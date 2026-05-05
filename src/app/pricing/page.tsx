import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import PricingContent from './PricingContent';

export const metadata = {
  title: 'Pricing',
  description: 'AI-powered UX audits starting at $99. First audit free. Simple credit-based pricing — no subscriptions.',
};

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#111114]">
      <Navbar />
      <PricingContent />
      <Footer />
    </div>
  );
}
