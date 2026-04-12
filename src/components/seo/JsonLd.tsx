const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clearux.ai'

const FAQ_ITEMS = [
  { q: 'How long does an audit take?', a: 'Most audits complete in under 10 minutes. Our AI crawls your website, analyses every page against 95 checkpoints across 19 UX categories, and generates a full professional report with prioritised recommendations.' },
  { q: 'What does the audit cover?', a: 'We evaluate 19 categories across 4 pillars: Foundation (First Impression, Value Proposition, Navigation, Visual Hierarchy, Content Quality, CTAs), Human Experience (Trust, Ethical UX, Emotional Intelligence, Cognitive Accessibility, Digital Wellbeing, Age Inclusivity), Technical Excellence (Performance, Mobile, Accessibility, SEO), and Future Readiness (AI Discoverability, AI Agent Readiness, Cultural Sensitivity).' },
  { q: 'How do credits work?', a: 'One credit equals one full audit of any website. Credits never expire. There are no feature tiers or limits — every audit includes all 95 checkpoints, PDF & Word reports, and prioritised recommendations.' },
  { q: 'What format is the report?', a: 'You get both a professional PDF report and a downloadable Word document. Reports include an overall score, category breakdowns, detailed findings with severity levels, and actionable recommendations for each issue.' },
  { q: 'Can I audit any website?', a: 'Yes. ClearUX works with any publicly accessible URL. Our crawler handles JavaScript-rendered sites, single-page applications, and multi-page websites. We automatically detect your industry, tech stack, and target audience.' },
  { q: 'Is my data secure?', a: 'Absolutely. We only analyse publicly visible content on your website. Payments are processed securely via Stripe. We do not store or share your website data beyond generating your audit report.' },
  { q: 'What languages are supported?', a: 'Audit reports are available in 6 languages: English, Spanish, French, German, Italian, and Portuguese. The AI generates findings and recommendations natively in your chosen language.' },
  { q: 'Can I get a refund?', a: 'If you are unsatisfied with an audit result, contact us at support@clearux.ai and we will work with you to resolve the issue or provide a credit for a new audit.' },
  { q: 'How accurate are the AI-generated findings?', a: 'Our AI models are tuned for precision over recall — we would rather miss an edge case than flag a false positive. Each finding includes a confidence level and specific evidence such as screenshots, element selectors, or metrics. AI audits complement but do not replace human expert review for nuanced brand or strategy questions.' },
  { q: 'What are the limitations of an AI audit?', a: 'ClearUX analyses publicly visible pages only — we cannot audit gated content like login-required areas or admin panels. We do not test with real users, so behavioural insights like A/B test results or heatmaps are not included. For complex flows like multi-step checkouts, findings may be limited to the accessible steps.' },
  { q: 'How does ClearUX compare to hiring a UX consultant?', a: 'A traditional UX audit costs $5,000 to $15,000 and takes 2 to 4 weeks. ClearUX delivers 95 checkpoints across 19 categories in minutes for a fraction of the cost. It is ideal for quick, comprehensive baseline assessments. For deep qualitative research such as user interviews and usability testing, we recommend pairing ClearUX findings with a specialist.' },
]

export function HomeJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'ClearUX',
        url: siteUrl,
        description: 'AI-powered UX audits across 95 checkpoints in 19 categories. Professional reports in minutes.',
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
        description: 'Deep AI-powered UX audit tool that analyses websites across 95 checkpoints in 19 categories and delivers professional reports with actionable recommendations.',
        featureList: [
          '95-point UX analysis',
          '19 audit categories',
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
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Pricing', item: `${siteUrl}/#pricing` },
          { '@type': 'ListItem', position: 3, name: 'About', item: `${siteUrl}/about` },
          { '@type': 'ListItem', position: 4, name: 'Contact', item: `${siteUrl}/contact` },
          { '@type': 'ListItem', position: 5, name: 'FAQ', item: `${siteUrl}/#faq` },
        ],
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
