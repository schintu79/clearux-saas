import type { Metadata } from 'next'
import { Inter, Manrope } from 'next/font/google'
import { cookies } from 'next/headers'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/context/AuthContext'
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
    default:  'ClearUX — AI-Powered UX Audits in Minutes',
  },
  description: 'Get a comprehensive, AI-powered UX audit of your website across 56 checkpoints in 13 categories. Actionable professional report with prioritised fixes delivered in minutes.',
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
    description: 'Paste your URL. Our AI audits your entire website across 56 checkpoints. Get a professional report in minutes.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'ClearUX — Deep AI-Powered UX Audits' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClearUX — Deep AI-Powered UX Audits',
    description: 'Paste your URL. Get a comprehensive UX audit with 56 checkpoints across 13 categories. Professional report in minutes.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  alternates: {
    canonical: siteUrl,
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
      suppressHydrationWarning
      className={`${inter.variable} ${manrope.variable} ${initialTheme === 'dark' ? 'dark' : ''}`}
    >
      <body suppressHydrationWarning className="font-inter antialiased bg-surface text-text">
        <ThemeProvider initialTheme={initialTheme}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
