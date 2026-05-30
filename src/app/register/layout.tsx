import type { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fixpath.ai'

export const metadata: Metadata = {
  title: 'Create Your Free Account',
  description: '112 checkpoints across 7 modules. No credit card required. Your first UX audit is free — sign up in seconds.',
  openGraph: {
    title: 'Create Your Free Account | Fixpath',
    description: '112 checkpoints across 7 modules. No credit card required. Your first UX audit is free — sign up in seconds.',
    url: `${siteUrl}/register`,
  },
  twitter: {
    title: 'Create Your Free Account | Fixpath',
    description: '112 checkpoints across 7 modules. No credit card required. Your first UX audit is free — sign up in seconds.',
  },
  alternates: {
    canonical: `${siteUrl}/register`,
  },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
