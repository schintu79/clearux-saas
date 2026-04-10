export function HomeJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'ClearUX',
        url: 'https://clearux.net',
        description: 'Deep AI-powered UX audits across 48 checkpoints. Professional reports in minutes.',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://clearux.net/dashboard/new-audit?url={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'ClearUX',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'AggregateOffer',
          lowPrice: '29',
          highPrice: '449',
          priceCurrency: 'USD',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          ratingCount: '1500',
          bestRating: '5',
        },
      },
      {
        '@type': 'Organization',
        name: 'ClearUX',
        url: 'https://clearux.net',
        logo: 'https://clearux.net/logo.png',
        sameAs: [],
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
