import { Check, Zap, FileSearch, Building2, Rocket } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'Pricing',
  description: 'AI-powered UX audits starting at $29. One-time audits or monthly agency plans.',
};

export default function PricingPage() {
  const plans = [
    {
      icon: Zap,
      name: 'Quick Scan',
      price: '$29',
      period: 'one-time',
      tagline: 'Quick website UX snapshot',
      delivery: 'Ready in minutes',
      cta: 'Get Quick Scan',
      features: [
        'Full website analysis',
        'Core UX score',
        'Top 5 critical issues',
        'Quick-win recommendations',
        'PDF summary',
      ],
    },
    {
      icon: FileSearch,
      name: 'Full Audit',
      price: '$79',
      period: 'one-time',
      tagline: 'Complete website UX deep-dive',
      delivery: 'Ready in under 1 hour',
      cta: 'Get Full Audit',
      popular: true,
      features: [
        'Full website crawl & analysis',
        '48-point checklist (12 categories)',
        'All severity levels',
        'AI discoverability review',
        'Conversion & mobile analysis',
        'Full PDF report',
      ],
    },
    {
      icon: Building2,
      name: 'Agency Pro',
      price: '$199',
      period: '/month',
      tagline: 'For freelancers & small agencies',
      delivery: 'All audits under 1 hour',
      cta: 'Start Agency Pro',
      features: [
        '10 full website audits per month',
        'Everything in Full Audit',
        'Priority processing',
        'White-label PDF reports',
        'Cancel anytime',
      ],
    },
    {
      icon: Rocket,
      name: 'Agency Scale',
      price: '$449',
      period: '/month',
      tagline: 'For agencies at scale',
      delivery: 'All audits under 1 hour',
      cta: 'Start Agency Scale',
      features: [
        '25 full website audits per month',
        'Everything in Agency Pro',
        'Bulk upload URLs',
        'Dedicated support',
        'Custom branding',
        'Cancel anytime',
      ],
    },
  ];

  const faqs = [
    {
      question: 'How fast is the audit delivered?',
      answer:
        'Quick Scans are ready in minutes. Full Audits typically complete in under 1 hour. Our AI-powered engine works instantly — no manual review or waiting required.',
    },
    {
      question: 'What\'s the difference between Quick Scan and Full Audit?',
      answer:
        'Quick Scan analyses your website and highlights the top 5 critical issues — perfect for a fast check. Full Audit does a complete website crawl with a 48-point checklist across 12 UX categories, including AI discoverability, conversion analysis, and mobile UX.',
    },
    {
      question: 'How do the Agency plans work?',
      answer:
        'Agency Pro ($199/mo) gives you 10 full audits per month, and Agency Scale ($449/mo) gives you 25. Unused audits don\'t roll over, but you can cancel anytime with no penalty.',
    },
    {
      question: 'Can I upgrade or downgrade my plan?',
      answer:
        'Yes, you can change your plan at any time. Upgrades take effect immediately, and downgrades apply at the start of your next billing cycle.',
    },
    {
      question: 'Is there a refund policy?',
      answer:
        'One-time audits come with a 7-day satisfaction guarantee. If you\'re not happy with the results, contact support@clearux.net for a full refund. Agency subscriptions can be cancelled anytime — no questions asked.',
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
              UX audits that pay for themselves
            </h1>
            <p className="font-inter text-lg text-muted max-w-2xl mx-auto mb-3">
              AI-powered analysis, delivered in minutes — not weeks. From a single page check to full agency workflows.
            </p>
            <div className="flex items-center justify-center gap-2 text-blue text-sm font-medium">
              <Zap size={16} />
              Instant delivery — no manual review, no waiting
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="py-12 px-4 sm:px-6 lg:px-8 bg-off">
          <div className="max-w-6xl mx-auto">
            {/* One-time label */}
            <p className="text-center text-xs font-bold uppercase tracking-widest text-muted mb-6">
              One-time audits
            </p>
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-12">
              {plans.slice(0, 2).map((plan) => {
                const Icon = plan.icon;
                return (
                  <div
                    key={plan.name}
                    className={`bg-card rounded-2xl p-8 ${
                      'popular' in plan && plan.popular
                        ? 'border-2 border-accent shadow-lg relative'
                        : 'border border-border'
                    }`}
                  >
                    {'popular' in plan && plan.popular && (
                      <span className="absolute -top-3 right-6 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    )}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-lt flex items-center justify-center">
                        <Icon size={20} className="text-blue" />
                      </div>
                      <div>
                        <h2 className="font-manrope font-bold text-xl text-text">{plan.name}</h2>
                        <p className="text-muted text-xs">{plan.tagline}</p>
                      </div>
                    </div>

                    <div className="mb-1">
                      <span className="font-manrope font-bold text-4xl text-text">{plan.price}</span>
                      <span className="text-muted text-sm ml-1">{plan.period}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-6">
                      <Zap size={14} className="text-blue" />
                      <span className="text-sm font-medium text-blue">{plan.delivery}</span>
                    </div>

                    <Link
                      href="/register"
                      className="block w-full bg-blue text-white font-manrope font-bold py-3 px-6 rounded-lg text-center hover:bg-blue-dk transition-colors mb-6"
                    >
                      {plan.cta}
                    </Link>

                    <div className="space-y-3">
                      {plan.features.map((f, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <Check size={18} className="text-blue flex-shrink-0 mt-0.5" />
                          <span className="font-inter text-text text-sm">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Subscription label */}
            <p className="text-center text-xs font-bold uppercase tracking-widest text-muted mb-6">
              Monthly subscriptions for agencies
            </p>
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {plans.slice(2).map((plan) => {
                const Icon = plan.icon;
                return (
                  <div
                    key={plan.name}
                    className="bg-card rounded-2xl p-8 border border-border"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-lt flex items-center justify-center">
                        <Icon size={20} className="text-blue" />
                      </div>
                      <div>
                        <h2 className="font-manrope font-bold text-xl text-text">{plan.name}</h2>
                        <p className="text-muted text-xs">{plan.tagline}</p>
                      </div>
                    </div>

                    <div className="mb-1">
                      <span className="font-manrope font-bold text-4xl text-text">{plan.price}</span>
                      <span className="text-muted text-sm ml-1">{plan.period}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-6">
                      <Zap size={14} className="text-blue" />
                      <span className="text-sm font-medium text-blue">{plan.delivery}</span>
                    </div>

                    <Link
                      href="/register"
                      className="block w-full bg-blue text-white font-manrope font-bold py-3 px-6 rounded-lg text-center hover:bg-blue-dk transition-colors mb-6"
                    >
                      {plan.cta}
                    </Link>

                    <div className="space-y-3">
                      {plan.features.map((f, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <Check size={18} className="text-blue flex-shrink-0 mt-0.5" />
                          <span className="font-inter text-text text-sm">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-manrope font-bold text-3xl text-text text-center mb-4">
              Frequently asked questions
            </h2>
            <p className="font-inter text-muted text-center mb-10">
              Everything you need to know about pricing and delivery.
            </p>

            <div className="space-y-5">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="bg-card border border-border rounded-lg p-6 hover:shadow-sm transition-shadow"
                >
                  <h3 className="font-manrope font-bold text-text mb-2">{faq.question}</h3>
                  <p className="font-inter text-muted text-sm leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
