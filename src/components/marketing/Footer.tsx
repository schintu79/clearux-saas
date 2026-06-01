import { Logo } from './Logo'
import Link from 'next/link'

/**
 * Footer — curated and brand-consistent.
 * Five columns: Brand, Platform, Company, Resources, Legal.
 * Only high-confidence links. No filler.
 */

const platformLinks = [
  { label: 'Product', href: '/product' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'WordPress plugin', href: '/wordpress' },
]

const companyLinks = [
  { label: 'About', href: '/about' },
  { label: 'Why Fixpath', href: '/why-fixpath' },
  { label: 'Contact', href: '/contact' },
]

const resourceLinks = [
  { label: 'FAQ', href: '/faq' },
  { label: 'What Fixpath audits', href: '/product' },
  { label: 'Changelog', href: '/changelog' },
]

const legalLinks = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Cookies', href: '/cookies' },
]

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h4
        className="font-sans text-[11px] font-semibold tracking-[0.06em] uppercase mb-5"
        style={{ color: 'var(--ink)' }}
      >
        {title}
      </h4>
      <ul className="list-none">
        {links.map((l) => (
          <li key={l.label} className="mb-2.5">
            <Link
              href={l.href}
              className="no-underline text-[13px] hover:text-signal transition-colors font-sans"
              style={{ color: 'var(--m-muted)' }}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Footer() {
  return (
    <footer style={{ background: 'var(--paper)' }} className="pt-14 pb-8">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div
          className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-10 max-sm:gap-6 pb-10 max-md:grid-cols-2"
          style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}
        >
          {/* Brand column — full width on mobile so link cols sit below */}
          <div className="max-md:col-span-2 max-md:mb-2">
            <Logo height={56} className="mb-5" />
            <p
              className="text-[13px] max-w-[280px] leading-[1.65] font-sans"
              style={{ color: 'var(--m-muted)' }}
            >
              Find what matters. Fix what matters. Track what improves.
            </p>
          </div>

          <FooterColumn title="Platform" links={platformLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Resources" links={resourceLinks} />
          <FooterColumn title="Legal" links={legalLinks} />
        </div>

        <div
          className="mt-6 flex justify-between items-center max-sm:flex-col max-sm:gap-2 max-sm:items-center font-sans text-[11px] tracking-[0.02em]"
          style={{ color: 'var(--m-muted)' }}
        >
          <span>&copy; 2026 Fixpath</span>
          <span>SSL · GDPR · Stripe</span>
        </div>
      </div>
    </footer>
  )
}
