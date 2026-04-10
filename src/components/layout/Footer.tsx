import React from 'react';
import Link from 'next/link';

const Footer: React.FC = () => {
  const currentYear = 2026;

  const footerLinks = {
    Product: [
      { label: 'How It Works', href: '/#how-it-works' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'FAQ', href: '/#faq' },
    ],
    Support: [
      { label: 'Contact Us', href: 'mailto:support@clearux.ai' },
      { label: 'support@clearux.ai', href: 'mailto:support@clearux.ai' },
    ],
    Legal: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
    ],
  };

  return (
    <footer className="border-t border-border bg-sidebar py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-1">
            <h3 className="font-manrope font-bold text-xl mb-2 text-sidebar-text">Clear<span className="text-accent">UX</span></h3>
            <p className="font-inter text-sm text-muted">
              AI-powered UX audits.<br />Professional reports in minutes.
            </p>
          </div>

          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <h4 className="font-inter font-semibold text-xs uppercase tracking-wider text-muted mb-4">{section}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="font-inter text-sm text-muted hover:text-sidebar-text transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-8">
          <p className="font-inter text-xs text-muted/60 text-center">
            &copy; {currentYear} ClearUX. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
