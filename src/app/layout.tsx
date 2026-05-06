import type { Metadata } from 'next'
import { DM_Sans, Caveat } from 'next/font/google'
import localFont from 'next/font/local'
import { cookies } from 'next/headers'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/context/AuthContext'
import CookieConsent from '@/components/ui/CookieConsent'
import ScrollToTop from '@/components/ui/ScrollToTop'
import CrispChat from '@/components/ui/CrispChat'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600', '700'],
})

const genova = localFont({
  src: [
    { path: '../../public/fonts/Genova-Thin.otf', weight: '100', style: 'normal' },
    { path: '../../public/fonts/Genova-ThinItalic.otf', weight: '100', style: 'italic' },
    { path: '../../public/fonts/Genova.otf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Genova-Italic.otf', weight: '400', style: 'italic' },
    { path: '../../public/fonts/Genova-Medium.otf', weight: '500', style: 'normal' },
    { path: '../../public/fonts/Genova-MediumItalic.otf', weight: '500', style: 'italic' },
    { path: '../../public/fonts/Genova-Black.otf', weight: '900', style: 'normal' },
    { path: '../../public/fonts/Genova-BlackItalic.otf', weight: '900', style: 'italic' },
  ],
  variable: '--font-heading',
  display: 'swap',
})


const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-handwriting',
  weight: ['400', '500', '600', '700'],
})

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clearux.ai'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: '%s | ClearUX',
    default:  'ClearUX — Find the UX issues costing you conversions. In minutes.',
  },
  description: 'Get a consultant-grade UX audit for $99. 64 checkpoints covering accessibility, dark patterns, conversion psychology, and AI readiness — delivered in minutes.',
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
    title: 'ClearUX — Find the UX issues costing you conversions. In minutes.',
    description: 'Get a consultant-grade UX audit for $99. 64 checkpoints covering accessibility, dark patterns, conversion psychology, and AI readiness — delivered in minutes.',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'ClearUX — Find the UX issues costing you conversions. In minutes.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClearUX — Find the UX issues costing you conversions. In minutes.',
    description: 'Get a consultant-grade UX audit for $99. 64 checkpoints covering accessibility, dark patterns, conversion psychology, and AI readiness — delivered in minutes.',
    images: ['/api/og'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
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
      className={`${dmSans.variable} ${genova.variable} ${caveat.variable} ${initialTheme === 'dark' ? 'dark' : ''}`}
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
      <body suppressHydrationWarning className="font-body antialiased bg-surface text-text">
        <ThemeProvider initialTheme={initialTheme}>
          <AuthProvider>
            {children}
            <ScrollToTop />
            <CookieConsent />
            <CrispChat />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
