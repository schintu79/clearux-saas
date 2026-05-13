const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clearux.ai'

const FAQ_ITEMS = [
  { q: 'How long does an audit take?', a: 'Most audits complete in under 10 minutes. Our AI crawls your website, analyses every page against 96 checkpoints across six modules, and generates a full professional report with prioritised recommendations.' },
  { q: 'What does the audit cover?', a: 'We evaluate 24 categories across six modules: Foundation (the structural and technical baseline), Human Experience (how the product feels to use — clarity, flow, cognitive load, wellbeing), Inclusive Design (accessibility and equity for every user), Future Readiness (AI discoverability and agent readiness), Brand Consistency (whether what users see matches what the brand promises), and SEO Structure (findability, legibility, and ranking). Available for websites, brand identity materials, and design files.' },
  { q: 'How do credits work?', a: 'One credit equals one full audit of any website. Credits never expire. There are no feature tiers or limits — every audit includes all six modules, 96 checkpoints, PDF & Word reports, and prioritised recommendations.' },
  { q: 'What format is the report?', a: 'You get both a professional PDF report and a downloadable Word document. Reports include an overall score, module breakdowns, detailed findings with severity levels, and actionable recommendations for each issue.' },
  { q: 'Can I audit any website?', a: 'Yes. ClearUX works with any publicly accessible URL. Our crawler handles JavaScript-rendered sites, single-page applications, and multi-page websites. We automatically detect your industry, tech stack, and target audience.' },
  { q: 'Is my data secure?', a: 'Absolutely. We only analyse publicly visible content on your website. Payments are processed securely via Stripe. We do not store or share your website data beyond generating your audit report.' },
  { q: 'What languages are supported?', a: 'Audit reports are available in 6 languages: English, Spanish, French, German, Italian, and Portuguese. The AI generates findings and recommendations natively in your chosen language.' },
  { q: 'Can I get a refund?', a: 'If you are unsatisfied with an audit result, use our contact form at clearux.ai/contact or email support@clearux.ai and we will work with you to resolve the issue or provide a credit for a new audit.' },
  { q: 'How accurate are the AI-generated findings?', a: 'Our AI delivers high-precision findings on critical issues like mobile responsiveness, accessibility failures, and conversion blockers. Every finding includes specific evidence — screenshots, element selectors, or metrics — so you can verify instantly. We prioritise precision over volume, flagging only findings we are confident about.' },
  { q: 'What are the limitations of an AI audit?', a: 'ClearUX analyses publicly visible pages only — we cannot audit gated content like login-required areas or admin panels. We do not test with real users, so behavioural insights like A/B test results or heatmaps are not included.' },
  { q: 'How does ClearUX compare to hiring a UX consultant?', a: 'A traditional UX audit costs $5,000 to $15,000 and takes 2 to 4 weeks. ClearUX delivers 96 checkpoints across six modules in minutes for a fraction of the cost. It is ideal for comprehensive baseline assessments.' },
]

export function FaqJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function HomeJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'ClearUX',
        url: siteUrl,
        description: 'AI-powered UX audits: 96 checkpoints, 6 modules. Severity-ranked, evidence-backed, shippable fixes. First audit free.',
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
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/logo.png`,
          width: 512,
          height: 512,
        },
        description: 'AI-powered UX audit platform. 96 checkpoints across 6 modules with severity-ranked, evidence-backed findings and shippable fixes.',
        contactPoint: {
          '@type': 'ContactPoint',
          email: 'support@clearux.ai',
          contactType: 'customer support',
          areaServed: 'Worldwide',
          availableLanguage: ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese'],
        },
        sameAs: [
          'https://www.linkedin.com/company/clearux',
        ],
      },
      {
        '@type': 'SoftwareApplication',
        name: 'ClearUX',
        url: siteUrl,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: 'AI-powered UX audit platform. 96 checkpoints across 6 modules — Foundation, Human Experience, Inclusive Design, Future Readiness, Brand Consistency, SEO Structure. Severity-ranked findings with evidence-backed, shippable fixes.',
        featureList: [
          'Foundation: The structural and technical baseline a great experience is built on',
          'Human Experience: How the product feels to use — clarity, flow, cognitive load, wellbeing',
          'Inclusive Design: Accessibility and equity for every user, every ability, every context',
          'Future Readiness: AI discoverability and how the product holds up as discovery shifts',
          'Brand Consistency: Whether what users see matches what the brand promises',
          'SEO Structure: Whether the product is findable, legible, and ranked the way it deserves',
          'Audit types: Website audits, Brand Identity audits, Design audits',
        ],
        offers: [
          {
            '@type': 'Offer',
            name: 'Free audit',
            price: '0',
            priceCurrency: 'USD',
            description: 'First full 96-checkpoint audit free, no credit card required',
            availability: 'https://schema.org/InStock',
          },
          {
            '@type': 'Offer',
            name: 'Starter subscription',
            price: '29',
            priceCurrency: 'USD',
            description: '3 audits per month, unlimited re-audits, PDF + DOCX reports',
            availability: 'https://schema.org/InStock',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              billingDuration: 'P1M',
            },
          },
          {
            '@type': 'Offer',
            name: 'Pro subscription',
            price: '59',
            priceCurrency: 'USD',
            description: '10 audits per month, white-label reports, priority processing',
            availability: 'https://schema.org/InStock',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              billingDuration: 'P1M',
            },
          },
          {
            '@type': 'Offer',
            name: 'Growth credit pack',
            price: '99',
            priceCurrency: 'USD',
            description: '10 audit credits at $9.90 each, never expire',
            availability: 'https://schema.org/InStock',
          },
        ],
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.8',
          ratingCount: '47',
          bestRating: '5',
          worstRating: '1',
        },
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
          { '@type': 'ListItem', position: 2, name: 'Pricing', item: `${siteUrl}/pricing` },
          { '@type': 'ListItem', position: 3, name: 'About', item: `${siteUrl}/about` },
          { '@type': 'ListItem', position: 4, name: 'Contact', item: `${siteUrl}/contact` },
          { '@type': 'ListItem', position: 5, name: 'FAQ', item: `${siteUrl}/faq` },
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
