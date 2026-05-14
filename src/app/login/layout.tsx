import type { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clearux.ai'

export const metadata: Metadata = {
  title: 'Sign In to Your Audits',
  description: 'Access your UX audit reports, brand identity reviews, and design analysis. Sign in to your ClearUX dashboard.',
  openGraph: {
    title: 'Sign In to Your Audits | ClearUX',
    description: 'Access your UX audit reports, brand identity reviews, and design analysis. Sign in to your ClearUX dashboard.',
    url: `${siteUrl}/login`,
  },
  twitter: {
    title: 'Sign In to Your Audits | ClearUX',
    description: 'Access your UX audit reports, brand identity reviews, and design analysis. Sign in to your ClearUX dashboard.',
  },
  alternates: {
    canonical: `${siteUrl}/login`,
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
