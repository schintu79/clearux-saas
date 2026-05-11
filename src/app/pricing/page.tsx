import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import PricingContent from './PricingContent';

export const metadata = {
  title: 'Pricing',
  description: 'AI-powered UX audits from $9.90 each. First audit free. Subscribe from $29/mo or buy credit packs. 96 checkpoints, PDF + DOCX reports.',
};

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <Navbar />
      <PricingContent />
      <Footer />
    </div>
  );
}
