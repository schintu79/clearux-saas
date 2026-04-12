const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clearux.ai'

const FAQ_ITEMS = [
  { q: 'How long does an audit take?', a: 'Most audits complete in under 10 minutes. Our AI crawls your website, analyses every page against 56 checkpoints across 13 UX categories, and generates a full professional report with prioritised recommendations.' },
  { q: 'What does the audit cover?', a: 'We evaluate 13 critical UX categories: First Impression & Visual Design, AI Discoverability, Value Proposition, Navigation, Conversion & CTAs, Onboarding, Mobile Experience, Trust & Credibility, Content Quality, Performance, Visual Hierarchy, Accessibility, and Cognitive Accessibility & Neurodiversity.' },
  { q: 'How do credits work?', a: 'One credit equals one full audit of any website. Credits never expire. There are no feature tiers or limits — every audit includes all 56 checkpoints, PDF & Word reports, and prioritised recommendations.' },
  { q: 'What format is the report?', a: 'You get both a professional PDF report and a downloadable Word document. Reports include an overall score, category breakdowns, detailed findings with severity levels, and actionable recommendations for each issue.' },
  { q: 'Can I audit any website?', a: 'Yes. ClearUX works with any publicly accessible URL. Our crawler handles JavaScript-rendered sites, single-page applications, and multi-page websites. We automatically detect your industry, tech stack, and target audience.' },
  { q: 'Is my data secure?', a: 'Absolutely. We only analyse publicly visible content on your website. Payments are processed securely via Stripe. We do not store or share your website data beyond generating your audit report.' },
  { q: 'What languages are supported?', a: 'Audit reports are available in 6 languages: English, Spanish, French, German, Italian, and Portuguese. The AI generates findings and recommendations natively in your chosen language.' },
  { q: 'Can I get a refund?', a: 'If you are unsatisfied with an audit result, contact us at support@clearux.ai and we will work with you to resolve the issue or provide a credit for a new audit.' },
]

export function HomeJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'ClearUX',
        url: siteUrl,
        description: 'AI-powered UX audits across 56 checkpoints in 13 categories. Professional reports in minutes.',
        potentialAction: {
          '@type': 'SearchAction',
          target: `${siteUrl}/dashboard/new-audit?url={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        name: 'ClearUX',
        url: siteUrl,
        logo: `${siteUrl}/logo.png`,
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'support@clearux.ai',
          contactType: 'customer support',
          availableLanguage: ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese'],
        },
        sameAs: [],
      },
      {
        '@type': 'SoftwareApplication',
        name: 'ClearUX',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: 'Deep AI-powered UX audit tool that analyses websites across 56 checkpoints in 13 categories and delivers professional reports with actionable recommendations.',
        featureList: [
          '56-point UX analysis',
          '13 audit categories',
          'AI-powered crawling',
          'PDF and Word reports',
          'Multi-language support (6 languages)',
          'Prioritised recommendations',
          'Severity-based issue classification',
        ],
        offers: [
          {
            '@type': 'Offer',
            name: 'Starter',
            price: '99',
            priceCurrency: 'USD',
            description: '1 full UX audit credit',
          },
          {
            '@type': 'Offer',
            name: 'Growth',
            price: '399',
            priceCurrency: 'USD',
            description: '5 full UX audit credits',
          },
          {
            '@type': 'Offer',
            name: 'Agency',
            price: '999',
            priceCurrency: 'USD',
            description: '15 full UX audit credits',
          },
          {
            '@type': 'Offer',
            name: 'Scale',
            price: '2499',
            priceCurrency: 'USD',
            description: '50 full UX audit credits',
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ_ITEMS.map(item => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.a,
          },
        })),
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
