import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { DM_Sans, Caveat, JetBrains_Mono, Instrument_Serif, Geist } from 'next/font/google'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/context/AuthContext'
import CookieConsent from '@/components/ui/CookieConsent'
import ScrollToTop from '@/components/ui/ScrollToTop'
import CrispChat from '@/components/ui/CrispChat'
import './globals.css'

const justSans = localFont({
  src: [
    { path: '../../public/fonts/JUST Sans/JUST Sans ExLight.woff2', weight: '200' },
    { path: '../../public/fonts/JUST Sans/JUST Sans Light.woff2', weight: '300' },
    { path: '../../public/fonts/JUST Sans/JUST Sans Regular.woff2', weight: '400' },
    { path: '../../public/fonts/JUST Sans/JUST Sans Medium.woff2', weight: '500' },
    { path: '../../public/fonts/JUST Sans/JUST Sans SemiBold.woff2', weight: '600' },
    { path: '../../public/fonts/JUST Sans/JUST Sans Bold.woff2', weight: '700' },
    { path: '../../public/fonts/JUST Sans/JUST Sans ExBold.woff2', weight: '800' },
  ],
  variable: '--font-heading',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600', '700'],
})

const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-handwriting',
  weight: ['400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '700'],
})

/* Marketing V2 fonts */
const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clearux.ai'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: '%s | ClearUX',
    default:  'ClearUX: AI UX Audits in Minutes',
  },
  description: 'AI-powered UX audits from $9.90. 96 checkpoints covering accessibility, dark patterns, conversion psychology, and AI readiness — delivered in minutes.',
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
    title: 'ClearUX: AI UX Audits in Minutes — 96 Checkpoints, from $9.90',
    description: 'AI-powered UX audits from $9.90. 96 checkpoints covering accessibility, dark patterns, conversion psychology, and AI readiness — delivered in minutes.',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'ClearUX — AI-powered UX audits in minutes' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClearUX: AI UX Audits in Minutes — 96 Checkpoints, from $9.90',
    description: 'AI-powered UX audits from $9.90. 96 checkpoints covering accessibility, dark patterns, conversion psychology, and AI readiness — delivered in minutes.',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${justSans.variable} ${dmSans.variable} ${caveat.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} ${geistSans.variable}`}
    >
      <head>
        {/* Prevent flash of wrong theme — runs before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )clearux-theme=(light|dark)/);var t=m?m[1]:'dark';if(t==='dark')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark')}catch(e){document.documentElement.classList.add('dark')}})()`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="font-body antialiased bg-surface text-text">
        <ThemeProvider>
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