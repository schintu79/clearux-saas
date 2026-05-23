import { Logo } from './Logo'
import Link from 'next/link'

const productLinks = [
  { label: 'Product', href: '/product' },
  { label: 'WordPress plugin', href: '/wordpress' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Changelog', href: '/changelog' },
]

const companyLinks = [
  { label: 'About', href: '/about' },
  { label: 'Resources', href: '/resources' },
  { label: 'Contact', href: '/contact' },
  { label: 'FAQ', href: '/faq' },
]

const legalLinks = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Cookies', href: '/cookies' },
]

export function Footer() {
  return (
    <footer className="bg-paper pt-12 pb-8">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-10 pb-9 border-b border-rule max-md:grid-cols-2 max-sm:grid-cols-1">
          <div>
            <Logo height={64} className="mb-[18px]" />
            <p className="text-[14px] text-m-muted max-w-[320px] leading-[1.6] font-sans">
              Find what is hurting your website. Fix the right issues first. Track whether things are improving.
            </p>
          </div>

          <div>
            <h4 className="font-mono text-[10px] font-semibold tracking-[0.12em] uppercase text-ink mb-[18px]">Product</h4>
            <ul className="list-none">
              {productLinks.map((l) => (
                <li key={l.label} className="mb-2.5">
                  <Link href={l.href} className="text-ink-2 no-underline text-[14px] hover:text-signal transition-colors font-sans">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-[10px] font-semibold tracking-[0.12em] uppercase text-ink mb-[18px]">Company</h4>
            <ul className="list-none">
              {companyLinks.map((l) => (
                <li key={l.label} className="mb-2.5">
                  <Link href={l.href} className="text-ink-2 no-underline text-[14px] hover:text-signal transition-colors font-sans">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-[10px] font-semibold tracking-[0.12em] uppercase text-ink mb-[18px]">Legal</h4>
            <ul className="list-none">
              {legalLinks.map((l) => (
                <li key={l.label} className="mb-2.5">
                  <Link href={l.href} className="text-ink-2 no-underline text-[14px] hover:text-signal transition-colors font-sans">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center font-mono text-[11px] text-m-muted tracking-[0.06em] uppercase">
          <span>&copy; 2026 Fixpath</span>
          <span>SSL · GDPR · Stripe</span>
        </div>
      </div>
    </footer>
  )
}
