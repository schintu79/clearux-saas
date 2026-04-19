import React from 'react';
import Link from 'next/link';
const Footer: React.FC = () => {
  const currentYear = 2026;

  return (
    <footer role="contentinfo" aria-label="Site footer" className="bg-[#111111] py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Top: Brand + Links */}
        <div className="flex flex-col md:flex-row gap-12 md:gap-16 mb-12">

          {/* Brand column */}
          <div className="md:max-w-[260px] flex-shrink-0">
            <div className="mb-3"><span className="font-heading text-2xl font-bold tracking-tight text-[#B9FF66]">ClearUX</span></div>
            <p className="font-body text-sm text-white/55 leading-relaxed mb-5">
              Professional UX audits powered by AI. 64 checkpoints, 16 categories, results in minutes.
            </p>

            {/* Social links */}
            <div className="flex items-center gap-3">
              <a
                href="https://www.instagram.com/clear_ux"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow ClearUX on Instagram"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white/40 hover:text-white bg-white/[0.06] hover:bg-white/[0.10] transition-all"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
              <a
                href="https://www.linkedin.com/company/clearux"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow ClearUX on LinkedIn"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white/40 hover:text-white bg-white/[0.06] hover:bg-white/[0.10] transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
            </div>
          </div>

          {/* Link columns */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div>
              <h4 className="font-body font-semibold text-xs uppercase tracking-wider text-white/35 mb-4">Product</h4>
              <ul className="space-y-2.5">
                {[
                  { label: 'How It Works', href: '/about' },
                  { label: 'Pricing', href: '/pricing' },
                  { label: 'FAQ', href: '/faq' },
                ].map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="font-body text-sm text-white/55 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-body font-semibold text-xs uppercase tracking-wider text-white/35 mb-4">Company</h4>
              <ul className="space-y-2.5">
                {[
                  { label: 'About Us', href: '/about' },
                  { label: 'Contact Us', href: '/contact' },
                  { label: 'Login', href: '/login' },
                  { label: 'Dashboard', href: '/dashboard' },
                ].map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="font-body text-sm text-white/55 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-body font-semibold text-xs uppercase tracking-wider text-white/35 mb-4">Legal</h4>
              <ul className="space-y-2.5">
                {[
                  { label: 'Privacy Policy', href: '/privacy' },
                  { label: 'Terms of Service', href: '/terms' },
                  { label: 'Cookie Policy', href: '/cookies' },
                ].map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="font-body text-sm text-white/55 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <a href="mailto:support@clearux.ai" className="font-body text-sm text-white/55 hover:text-white transition-colors">
                    support@clearux.ai
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-body text-xs text-white/45">
            &copy; {currentYear} ClearUX. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-white/35">
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              SSL Encrypted
            </span>
            <span>GDPR Compliant</span>
            <span>Powered by Stripe</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
