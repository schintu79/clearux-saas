import { Check, CheckCircle, Zap } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'Pricing',
  description: 'AI-powered UX audits starting at $99. Simple credit-based pricing — no subscriptions.',
};

export default function PricingPage() {
  const plans = [
    {
      name: 'Starter',
      credits: 1,
      price: 99,
      per: '$99',
      save: null,
      cta: 'Start Auditing',
      popular: false,
    },
    {
      name: 'Growth',
      credits: 5,
      price: 399,
      per: '$79.80',
      save: 'Save 19%',
      cta: 'Get 5 Audits',
      popular: true,
    },
    {
      name: 'Agency',
      credits: 15,
      price: 999,
      per: '$66.60',
      save: 'Save 33%',
      cta: 'Get 15 Audits',
      popular: false,
    },
    {
      name: 'Scale',
      credits: 50,
      price: 2499,
      per: '$49.98',
      save: 'Save 50%',
      cta: 'Get 50 Audits',
      popular: false,
    },
  ];

  const features = [
    '56-point deep UX analysis',
    '13 audit categories',
    'AI discoverability review',
    'Conversion & mobile analysis',
    'PDF + Word reports',
    'Prioritised recommendations',
    'Credits never expire',
    'Secure payment via Stripe',
  ];

  const faqs = [
    {
      question: 'How do credits work?',
      answer:
        'One credit = one full audit. Credits never expire. Every audit includes all 56 checkpoints, PDF & Word reports, and prioritised recommendations.',
    },
    {
      question: 'How fast is the audit delivered?',
      answer:
        'Most audits complete in under 10 minutes. Our AI-powered engine crawls your site and generates a comprehensive report automatically.',
    },
    {
      question: 'What does every audit include?',
      answer:
        'Every audit — regardless of which pack you buy — includes the full 56-point analysis across 13 UX categories, AI discoverability review, severity-ranked findings, and downloadable PDF + Word reports.',
    },
    {
      question: 'Can I buy more credits later?',
      answer:
        'Yes. You can purchase additional credit packs at any time. Credits from different purchases stack together and never expire.',
    },
    {
      question: 'Is there a refund policy?',
      answer:
        'If you\'re not satisfied with your audit, contact support@clearux.ai and we\'ll resolve it or provide a credit for a new audit.',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="font-manrope font-bold text-4xl sm:text-5xl text-text mb-4">
              Simple credit-based pricing
            </h1>
            <p className="font-inter text-lg text-muted max-w-2xl mx-auto mb-3">
              1 credit = 1 full audit. No tiers. No feature limits. No subscriptions.
            </p>
            <div className="flex items-center justify-center gap-2 text-accent text-sm font-medium">
              <Zap size={16} />
              Results delivered in minutes — not weeks
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="py-12 px-4 sm:px-6 lg:px-8 bg-surface-alt">
          <div className="max-w-5xl mx-auto">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative bg-card rounded-2xl p-6 flex flex-col ${
                    plan.popular
                      ? 'border-2 border-accent shadow-lg shadow-accent/10'
                      : 'border border-border'
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-2.5 right-4 bg-accent text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-md shadow-accent/30">
                      Most Popular
                    </span>
                  )}

                  <h2 className="font-manrope font-bold text-lg text-text mb-1">{plan.name}</h2>
                  <div className="mb-1">
                    <span className="font-manrope font-bold text-3xl text-text">
                      ${plan.price.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted mb-4">
                    {plan.credits} credit{plan.credits !== 1 ? 's' : ''} · {plan.per}/audit
                  </p>

                  {plan.save ? (
                    <div className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full mb-4 bg-accent/15 text-accent w-fit">
                      {plan.save}
                    </div>
                  ) : (
                    <div className="mb-4" />
                  )}

                  <div className="space-y-2.5 mb-6 flex-1">
                    {['48-point deep analysis', '13 UX categories', 'AI discoverability audit', 'PDF + DOCX reports'].map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 text-accent" />
                        <span className="text-xs text-muted">{f}</span>
                      </div>
                    ))}
                  </div>

                  <Link
                    href="/register"
                    className={`block text-center text-sm font-bold rounded-lg py-2.5 transition-all ${
                      plan.popular
                        ? 'bg-accent text-white hover:bg-accent-dk shadow-lg shadow-accent/20'
                        : 'bg-accent/[0.15] text-accent hover:bg-accent/[0.22]'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>

            <p className="text-center text-muted text-xs mt-8">
              Credits never expire · Secure payment via Stripe
            </p>
          </div>
        </section>

        {/* What's included */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-manrope font-bold text-3xl text-text mb-8">
              Every audit includes
            </h2>
            <div className="grid sm:grid-cols-2 gap-4 text-left">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                  <Check size={16} className="text-accent flex-shrink-0" />
                  <span className="text-sm text-text">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-surface-alt">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-manrope font-bold text-3xl text-text text-center mb-10">
              Frequently asked questions
            </h2>

            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <details
                  key={i}
                  className="group bg-card border border-border rounded-xl overflow-hidden"
                >
                  <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-card-hover transition-colors">
                    <h3 className="font-medium text-text text-sm pr-4">{faq.question}</h3>
                    <span className="text-muted text-xs flex-shrink-0 group-open:rotate-90 transition-transform">&#9654;</span>
                  </summary>
                  <div className="px-5 pb-5">
                    <p className="text-muted text-sm leading-relaxed">{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
