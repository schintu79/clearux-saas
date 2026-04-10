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
    <footer className="bg-sidebar text-sidebar-text py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1">
            <h3 className="font-manrope font-bold text-2xl mb-2">Clear<span className="text-accent">UX</span></h3>
            <p className="font-inter text-sm text-sidebar-text/70">
              Audit your UX, understand your users, improve your product.
            </p>
          </div>

          <div>
            <h4 className="font-inter font-semibold text-sm mb-4">Product</h4>
            <ul className="space-y-2">
              {footerLinks.Product.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-inter text-sm text-sidebar-text/70 hover:text-sidebar-text transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-inter font-semibold text-sm mb-4">Support</h4>
            <ul className="space-y-2">
              {footerLinks.Support.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-inter text-sm text-sidebar-text/70 hover:text-sidebar-text transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-inter font-semibold text-sm mb-4">Legal</h4>
            <ul className="space-y-2">
              {footerLinks.Legal.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-inter text-sm text-sidebar-text/70 hover:text-sidebar-text transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-sidebar-text/10 pt-8">
          <p className="font-inter text-sm text-sidebar-text/50 text-center">
            &copy; {currentYear} ClearUX. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
