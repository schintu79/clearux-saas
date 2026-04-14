import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'FAQ — ClearUX',
  description: 'Frequently asked questions about ClearUX audits, pricing, reports, and how the AI analysis works.',
};

const FAQ_SECTIONS = [
  {
    title: 'General',
    items: [
      {
        q: 'How long does an audit take?',
        a: 'Most audits complete in under 10 minutes. Our AI crawls your website, analyses every page against 64 checkpoints across 16 categories, and generates a full professional report.',
      },
      {
        q: 'What does the audit cover?',
        a: 'We evaluate 16 categories across 4 pillars: Foundation (Visual Design, Value Proposition, Navigation, Content Quality), Human Experience (CTAs & Conversion, Trust & Credibility, Ethical UX, Emotional Design), Inclusive Design (Accessibility, Cognitive Accessibility, Digital Wellbeing, Mobile Experience), and Future Readiness (Performance & Technical Health, AI Discoverability, AI Agent Readiness, Cultural Sensitivity).',
      },
      {
        q: 'Can I audit any website?',
        a: 'Yes. ClearUX works with any publicly accessible URL \u2014 dynamic apps, single-page applications, and traditional multi-page sites. Content behind logins (admin panels, member areas) isn\u2019t accessible to our crawler. For complex multi-step flows like checkouts, findings cover the accessible steps.',
      },
      {
        q: 'What languages are supported?',
        a: 'Reports are available in English, Spanish, French, German, Italian, and Portuguese. All findings, recommendations, and the full report are translated.',
      },
      {
        q: 'How does ClearUX compare to hiring a UX consultant?',
        a: 'A traditional UX audit costs $5,000\u2013$15,000 and takes 2\u20134 weeks. ClearUX delivers 64 checkpoints across 16 categories in minutes for a fraction of the cost. It\u2019s ideal for quick, comprehensive baseline assessments. For deep qualitative research (user interviews, usability testing), we recommend pairing ClearUX findings with a specialist.',
      },
      {
        q: 'Can I track which findings have been fixed?',
        a: 'Yes. Every finding has a status you can update: Open, In Progress, Fixed, or Backlog. Your dashboard tracks how many issues you\u2019ve resolved over time, giving you a clear picture of progress.',
      },
      {
        q: 'Can I share audit results with my team?',
        a: 'Yes. Every completed audit has a "Share audit" button that generates a read-only link. Anyone with the link can view the scores, executive summary, and category breakdown \u2014 no account needed. You can revoke the link at any time.',
      },
      {
        q: 'Can I re-audit the same website to measure improvement?',
        a: 'Absolutely. Re-auditing the same URL is the best way to prove progress. Your dashboard shows re-audit badges and your stats track average scores over time. Audit the same site before and after implementing fixes to see your score improve.',
      },
    ],
  },
  {
    title: 'Audit & AI',
    items: [
      {
        q: 'How does the AI analysis work?',
        a: 'Our engine crawls your site (5\u201325 pages depending on plan), then runs each page through specialised AI models trained on UX best practices, WCAG guidelines, dark pattern databases, and conversion research. Each finding includes severity scoring, evidence, and a specific recommendation.',
      },
      {
        q: 'What format is the report?',
        a: 'You get a professional PDF and a Word document (DOCX). Both include an overall score, executive summary, top 3 priority recommendations, pillar score breakdown, and detailed findings ranked by severity with specific recommendations and impact estimates.',
      },
      {
        q: 'What should I know before running an audit?',
        a: 'ClearUX analyses all publicly visible pages on your site. For the most comprehensive results, ensure your site is live and publicly accessible. The audit is designed to catch the issues that matter most to real users \u2014 the same issues a specialist consultant would prioritise.',
      },
      {
        q: 'What about white-label reports?',
        a: 'Agency and Scale package customers can add their own company logo and name to reports. The ClearUX branding is replaced with yours in both PDF and Word exports \u2014 perfect for client-facing deliverables.',
      },
      {
        q: 'What is the free preview audit?',
        a: 'Anyone can run a free preview audit from the homepage without signing up. The preview shows your overall score, pillar scores, and severity breakdown. Individual findings, recommendations, and downloadable reports are available when you unlock the full audit.',
      },
    ],
  },
  {
    title: 'Account & Billing',
    items: [
      {
        q: 'How do credits work?',
        a: 'One credit = one full audit. Credits never expire. Every audit includes all 64 checkpoints, PDF & Word reports, finding status tracking, shareable team links, and prioritised recommendations. Buy in packs to lower the per-audit cost.',
      },
      {
        q: 'Is my data secure?',
        a: 'We only analyse publicly visible content. Your website data is never stored or shared \u2014 only your report. Payments are processed securely via Stripe. We are GDPR compliant and use SSL encryption throughout.',
      },
      {
        q: 'Can I get a refund?',
        a: 'If you\u2019re unsatisfied with an audit, contact support@clearux.ai and we\u2019ll resolve it or provide a credit for a new audit. We stand behind the quality of our reports.',
      },
      {
        q: 'Can I buy more credits later?',
        a: 'Yes. You can purchase additional credit packs at any time. Credits from different purchases stack together and never expire.',
      },
      {
        q: 'What payment methods are accepted?',
        a: 'We accept Visa, Mastercard, American Express, Apple Pay, and Google Pay. All payments are processed securely via Stripe.',
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <Navbar />

      <main id="main-content" className="flex-1">
        {/* Header */}
        <section className="pt-20 pb-10 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="font-manrope font-bold text-4xl sm:text-5xl text-text mb-4" style={{ lineHeight: '1.1' }}>
              Frequently asked questions
            </h1>
            <p className="text-muted text-base md:text-lg max-w-lg mx-auto">
              Everything you need to know about ClearUX audits, pricing, and reports.
            </p>
          </div>
        </section>

        {/* FAQ Sections */}
        {FAQ_SECTIONS.map((section) => (
          <section key={section.title} className="px-4 sm:px-6 lg:px-8 pb-12">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-manrope font-bold text-xl text-text mb-5 pb-3 border-b border-border/30 dark:border-white/[0.04]">
                {section.title}
              </h2>
              <div className="space-y-3">
                {section.items.map((faq, i) => (
                  <details
                    key={i}
                    className="group bg-card border border-border/40 dark:border-white/[0.06] rounded-2xl overflow-hidden"
                  >
                    <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-card-hover transition-colors">
                      <h3 className="font-medium text-text text-sm pr-4">{faq.q}</h3>
                      <ArrowRight size={14} className="text-muted flex-shrink-0 transform group-open:rotate-90 transition-transform" />
                    </summary>
                    <div className="mx-5 pb-5 pt-1 border-t border-border/20 dark:border-white/[0.04]">
                      <p className="text-muted text-sm leading-relaxed pt-4">{faq.a}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </section>
        ))}

        {/* CTA */}
        <section className="px-4 sm:px-6 lg:px-8 pb-20">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border border-border/40 dark:border-white/[0.06] bg-surface-alt p-8 text-center">
              <h2 className="font-manrope font-bold text-xl text-text mb-2">Still have questions?</h2>
              <p className="text-muted text-sm mb-6">
                Reach out and we will get back to you within a business day.
              </p>
              <div className="flex items-center justify-center gap-4">
                <a
                  href="mailto:support@clearux.ai"
                  className="inline-flex items-center justify-center gap-2 text-white font-semibold text-sm rounded-full px-6 py-3 hover:brightness-110 transition-all"
                  style={{ background: 'var(--gradient-brand)' }}
                >
                  Email Support
                </a>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold rounded-full px-6 py-3 border border-border/40 dark:border-white/[0.1] text-text hover:bg-card transition-all"
                >
                  Contact Us
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
