import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In to Your Audits',
  description: 'Access your UX audit reports, brand identity reviews, and design analysis. Sign in to your ClearUX dashboard.',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
