const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fixpath.ai'

const FAQ_ITEMS = [
  { q: 'How long does an audit take?', a: 'Most audits complete in under 10 minutes. Our AI crawls your website, analyses every page against 112 checkpoints across seven modules, and generates a full professional report with prioritised recommendations.' },
  { q: 'What does the audit cover?', a: 'We evaluate 28 categories across seven modules: Foundation (the structural and technical baseline), Human Experience (how the product feels to use — clarity, flow, cognitive load, wellbeing), Inclusive Design (accessibility and equity for every user), Future Readiness (AI discoverability and agent readiness), Accessibility Readiness (WCAG compliance and assistive technology support), Design Consistency (whether the visual system is internally consistent — fonts, colours, spacing, components), and SEO Structure (findability, legibility, and ranking). Available for websites, brand identity materials, and design files.' },
  { q: 'How do credits work?', a: 'One credit equals one full audit of any website. Credits never expire. There are no feature tiers or limits — every audit includes all seven modules, 112 checkpoints, PDF & Word reports, and prioritised recommendations.' },
  { q: 'What format is the report?', a: 'You get both a professional PDF report and a downloadable Word document. Reports include an overall score, module breakdowns, detailed findings with severity levels, and actionable recommendations for each issue.' },
  { q: 'Can I audit any website?', a: 'Yes. Fixpath works with any publicly accessible URL. Our crawler handles JavaScript-rendered sites, single-page applications, and multi-page websites. We automatically detect your industry, tech stack, and target audience.' },
  { q: 'Is my data secure?', a: 'Absolutely. We only analyse publicly visible content on your website. Payments are processed securely via Stripe. We do not store or share your website data beyond generating your audit report.' },
  { q: 'What languages are supported?', a: 'Audit reports are available in 6 languages: English, Spanish, French, German, Italian, and Portuguese. The AI generates findings and recommendations natively in your chosen language.' },
  { q: 'Can I get a refund?', a: 'If you are unsatisfied with an audit result, use our contact form at fixpath.ai/contact or email support@fixpath.ai and we will work with you to resolve the issue or provide a credit for a new audit.' },
  { q: 'How accurate are the AI-generated findings?', a: 'Our AI delivers high-precision findings on critical issues like mobile responsiveness, accessibility failures, and conversion blockers. Every finding includes specific evidence — screenshots, element selectors, or metrics — so you can verify instantly. We prioritise precision over volume, flagging only findings we are confident about.' },
  { q: 'What are the limitations of an AI audit?', a: 'Fixpath analyses publicly visible pages only — we cannot audit gated content like login-required areas or admin panels. We do not test with real users, so behavioural insights like A/B test results or heatmaps are not included.' },
  { q: 'How does Fixpath compare to hiring a UX consultant?', a: 'A traditional UX audit costs $5,000 to $15,000 and takes 2 to 4 weeks. Fixpath delivers 112 checkpoints across seven modules in minutes for a fraction of the cost. It is ideal for comprehensive baseline assessments.' },
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

/**
 * Standalone Organization schema — used in root layout so every page
 * carries the company identity signal for search engines and AI systems.
 */
export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Fixpath',
    url: siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/logo.png`,
      width: 512,
      height: 512,
    },
    description: 'AI-powered UX audit tool that finds and prioritises website issues across clarity, trust, accessibility, and technical quality.',
    foundingDate: '2024',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@fixpath.ai',
      contactType: 'Customer Support',
      areaServed: 'Worldwide',
      availableLanguage: ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese'],
    },
    sameAs: [
      'https://www.linkedin.com/company/fixpath',
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

/**
 * Homepage JSON-LD — individual typed blocks instead of @graph
 * so every block has an explicit @type (avoids validator warnings).
 */
export function HomeJsonLd() {
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Fixpath',
    url: siteUrl,
    description: 'Fixpath is a decision engine for real website and brand issues. Find what matters, get fix guidance, and track improvement over time. First audit free.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/dashboard/new-audit?url={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }

  const software = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Fixpath',
    url: siteUrl,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'A decision engine for real website and brand issues. 112 checkpoints across 7 modules — Foundation, Human Experience, Inclusive Design, Future Readiness, Accessibility Readiness, Design Consistency, SEO Structure. Severity-ranked findings, concrete fix guidance, and progress tracking.',
    featureList: [
      'Foundation: The structural and technical baseline a great experience is built on',
      'Human Experience: How the product feels to use — clarity, flow, cognitive load, wellbeing',
      'Inclusive Design: Accessibility and equity for every user, every ability, every context',
      'Future Readiness: AI discoverability and how the product holds up as discovery shifts',
      'Accessibility Readiness: WCAG compliance and assistive technology support across all pages',
      'Design Consistency: Whether your visual system is internally consistent across every page',
      'SEO Structure: Whether the product is findable, legible, and ranked the way it deserves',
      'Audit types: Website audits, Brand Identity audits, Design audits',
    ],
    offers: [
      {
        '@type': 'Offer',
        name: 'Free audit',
        price: '0',
        priceCurrency: 'USD',
        description: 'First full 112-checkpoint audit free, no credit card required',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Starter subscription',
        price: '29',
        priceCurrency: 'USD',
        description: '1 workspace, 4 re-audits per month, PDF + DOCX reports',
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
        description: '3 workspaces, 12 re-audits per month, priority processing',
        availability: 'https://schema.org/InStock',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          billingDuration: 'P1M',
        },
      },
      {
        '@type': 'Offer',
        name: 'Team subscription',
        price: '149',
        priceCurrency: 'USD',
        description: '10 workspaces, 40 re-audits per month, priority processing',
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
    image: {
      '@type': 'ImageObject',
      url: `${siteUrl}/og-image.png`,
      width: 1200,
      height: 630,
    },
  }

  const faq = {
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

  // BreadcrumbList removed from the homepage (2026-06-18): the page has no
  // visible breadcrumb trail and the static 6-item list didn't reflect the real
  // site structure — Google's guidance is that breadcrumb structured data must
  // mirror a real on-page trail, so it belongs on content pages, not here.

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(software) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
    </>
  )
}

/**
 * Pricing page JSON-LD — server-rendered so crawlers that don't execute
 * JS can still discover plan names, prices, and feature descriptions.
 */
export function PricingJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Fixpath',
    url: `${siteUrl}/pricing`,
    description: 'AI-powered UX audit tool. Full 112-checkpoint audits from $9.90. Subscribe for ongoing monitoring or buy credit packs for project work.',
    brand: { '@type': 'Organization', name: 'Fixpath' },
    offers: [
      {
        '@type': 'Offer',
        name: 'Free audit',
        price: '0',
        priceCurrency: 'USD',
        description: 'First full 112-checkpoint audit free. No credit card required. All 7 modules, PDF and Word reports included.',
        availability: 'https://schema.org/InStock',
        url: `${siteUrl}/register`,
      },
      {
        '@type': 'Offer',
        name: 'Starter plan',
        price: '29',
        priceCurrency: 'USD',
        description: '1 workspace, 4 re-audits per month. Monthly billing. Includes PDF and DOCX reports, progress tracking, and all 7 audit modules.',
        availability: 'https://schema.org/InStock',
        url: `${siteUrl}/pricing`,
        priceSpecification: { '@type': 'UnitPriceSpecification', billingDuration: 'P1M', unitCode: 'MON' },
      },
      {
        '@type': 'Offer',
        name: 'Pro plan',
        price: '59',
        priceCurrency: 'USD',
        description: '3 workspaces, 12 re-audits per month. Monthly billing. Priority processing, full reports, and fix guidance.',
        availability: 'https://schema.org/InStock',
        url: `${siteUrl}/pricing`,
        priceSpecification: { '@type': 'UnitPriceSpecification', billingDuration: 'P1M', unitCode: 'MON' },
      },
      {
        '@type': 'Offer',
        name: 'Team plan',
        price: '149',
        priceCurrency: 'USD',
        description: '10 workspaces, 40 re-audits per month. Monthly billing. Built for agencies and larger teams.',
        availability: 'https://schema.org/InStock',
        url: `${siteUrl}/pricing`,
        priceSpecification: { '@type': 'UnitPriceSpecification', billingDuration: 'P1M', unitCode: 'MON' },
      },
      {
        '@type': 'Offer',
        name: 'Starter credit pack',
        price: '49',
        priceCurrency: 'USD',
        description: '5 audit credits at $9.80 each. Credits never expire. One credit equals one full 112-checkpoint audit.',
        availability: 'https://schema.org/InStock',
        url: `${siteUrl}/pricing`,
      },
      {
        '@type': 'Offer',
        name: 'Growth credit pack',
        price: '99',
        priceCurrency: 'USD',
        description: '10 audit credits at $9.90 each. Credits never expire. One credit equals one full 112-checkpoint audit.',
        availability: 'https://schema.org/InStock',
        url: `${siteUrl}/pricing`,
      },
      {
        '@type': 'Offer',
        name: 'Scale credit pack',
        price: '199',
        priceCurrency: 'USD',
        description: '25 audit credits at $7.96 each. Credits never expire. One credit equals one full 112-checkpoint audit.',
        availability: 'https://schema.org/InStock',
        url: `${siteUrl}/pricing`,
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
