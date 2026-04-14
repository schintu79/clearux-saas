import type { Metadata } from 'next'
import { Inter, Manrope } from 'next/font/google'
import { cookies } from 'next/headers'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/context/AuthContext'
import CookieConsent from '@/components/ui/CookieConsent'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  weight: ['400', '500', '600', '700', '800'],
})

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clearux.ai'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: '%s | ClearUX',
    default:  'ClearUX — AI-Powered UX Audits | 64 Checkpoints in Minutes',
  },
  description: 'Get consultant-grade UX audits powered by AI. 64 checkpoints across 16 categories. Actionable findings with prioritised fixes — from $99 per audit.',
  keywords: [
    'UX audit', 'AI UX analysis', 'website audit', 'user experience review',
    'conversion optimization', 'accessibility audit', 'AI discoverability',
    'UX report', 'website analysis tool', 'ClearUX',
  ],
  authors: [{ name: 'ClearUX' }],
  creator: 'ClearUX',
  publisher: 'ClearUX',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'ClearUX',
    title: 'ClearUX — Deep AI-Powered UX Audits',
    description: 'Paste your URL. Our AI audits your entire website across 64 checkpoints. Get a professional report in minutes.',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'ClearUX — Deep AI-Powered UX Audits' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClearUX — Deep AI-Powered UX Audits',
    description: 'Paste your URL. Get a comprehensive UX audit with 64 checkpoints across 16 categories. Professional report in minutes.',
    images: ['/api/og'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  alternates: {
    canonical: siteUrl,
    languages: {
      'en': siteUrl,
      'x-default': siteUrl,
    },
  },
  other: {
    'content-language': 'en',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read the theme cookie server-side so we can apply the correct
  // class on the very first render — no flash of wrong theme.
  const cookieStore = await cookies()
  const themeCookie = cookieStore.get('clearux-theme')?.value as 'light' | 'dark' | undefined
  const initialTheme = themeCookie === 'light' ? 'light' : 'dark'

  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${inter.variable} ${manrope.variable} ${initialTheme === 'dark' ? 'dark' : ''}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'ClearUX',
              url: siteUrl,
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              description: 'AI-powered UX audit tool that analyses websites across 64 checkpoints in 16 categories. Professional consultant-grade reports in minutes.',
              offers: {
                '@type': 'Offer',
                price: '99',
                priceCurrency: 'USD',
                priceValidUntil: '2027-12-31',
                availability: 'https://schema.org/InStock',
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.8',
                ratingCount: '47',
                bestRating: '5',
              },
              featureList: '64 UX checkpoints, 16 audit categories, 4 pillar framework, PDF & Word reports, AI discoverability review, dark pattern detection, accessibility audit, mobile UX analysis',
            }),
          }}
        />
      </head>
      <body suppressHydrationWarning className="font-inter antialiased bg-surface text-text">
        <ThemeProvider initialTheme={initialTheme}>
          <AuthProvider>
            {children}
            <CookieConsent />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
