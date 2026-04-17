import React from 'react';
import Link from 'next/link';
// Icons removed — none currently needed

const Footer: React.FC = () => {
  const currentYear = 2026;

  return (
    <footer role="contentinfo" aria-label="Site footer" className="border-t border-border bg-[#1C1C1C] py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        {/* Top: Brand + Links */}
        <div className="flex flex-col md:flex-row gap-12 md:gap-16 mb-12">

          {/* Brand column */}
          <div className="md:max-w-[260px] flex-shrink-0">
            <svg viewBox="250 245 310 65" className="h-7 w-auto mb-3" aria-label="ClearUX">
              <path className="fill-white" d="M292.41,286.77l2.42,3.42c-4.7,5.64-10.67,8.46-17.92,8.46-3.36,0-6.44-.62-9.26-1.86-2.82-1.24-5.27-2.97-7.35-5.19-2.08-2.22-3.71-4.8-4.88-7.75-1.18-2.95-1.76-6.11-1.76-9.47s.6-6.65,1.81-9.67c1.21-3.02,2.85-5.64,4.93-7.85,2.08-2.22,4.53-3.96,7.35-5.24,2.82-1.27,5.57-1.91,8.26-1.91,1.21,0,2.37.07,3.47.2,1.11.13,2.08.29,2.92.45.84.17,1.71.44,2.62.81.91.37,1.61.65,2.11.86.5.2,1.16.55,1.96,1.06.81.5,1.32.84,1.56,1.01.23.17.72.54,1.46,1.11.74.57,1.14.86,1.21.86v-1.91h1.21v13.8h-1.21v-.91c0-.81-.17-1.79-.5-2.97-.34-1.17-.92-2.5-1.76-3.98-.84-1.48-1.85-2.83-3.02-4.08-1.18-1.24-2.77-2.3-4.78-3.17-2.01-.87-4.2-1.31-6.55-1.31-4.1,0-7.65,2.08-10.67,6.24-3.02,4.16-4.53,9.7-4.53,16.61,0,5.98,1.53,11.23,4.58,15.76,3.05,4.53,6.66,6.8,10.82,6.8,6.18,0,11.34-3.39,15.51-10.17Z"/>
              <path className="fill-white" d="M312.75,295.83h5.64v1.51h-19.53v-1.51h5.64v-61.02l-5.24,1.71-.4-1.31,13.9-5.03v65.65Z"/>
              <path className="fill-white" d="M344.98,296.94c6.18,0,11.34-3.39,15.51-10.17l2.42,3.42c-4.7,5.64-10.67,8.46-17.92,8.46-3.36,0-6.44-.62-9.26-1.86-2.82-1.24-5.27-2.97-7.35-5.19-2.08-2.22-3.71-4.8-4.88-7.75-1.18-2.95-1.76-6.11-1.76-9.47s.6-6.65,1.81-9.67c1.21-3.02,2.85-5.64,4.93-7.85,2.08-2.22,4.53-3.96,7.35-5.24,2.82-1.27,5.57-1.91,8.26-1.91,5.24,0,9.78,1.65,13.64,4.93,3.86,3.29,6.19,7.49,7,12.59l-34.94,9.47c.87,5.71,2.68,10.51,5.44,14.4,2.75,3.89,6.01,5.84,9.77,5.84ZM329.57,274.39v.4c0,.2.03.34.1.4l26.68-7.15c-.13-1.74-.59-3.57-1.36-5.49-.77-1.91-1.8-3.74-3.07-5.49-1.28-1.74-2.94-3.12-4.98-4.13-2.05-1.01-4.21-1.37-6.49-1.11-2.82.34-5.12,1.68-6.9,4.03-1.78,2.35-2.97,5.13-3.57,8.36-.6,3.22-.74,6.61-.4,10.17Z"/>
              <path className="fill-white" d="M405.39,290.19c0,.14-.02.5-.05,1.11-.03.6-.03,1.01,0,1.21.03.2.08.55.15,1.06.06.5.17.86.3,1.06.13.2.33.45.6.75.27.3.6.52,1.01.65.4.14.87.2,1.41.2v1.11h-6.24c-2.01,0-3.62-.81-4.83-2.42l-1.01-1.21c-1.07.94-2.57,1.83-4.48,2.67-1.91.84-3.71,1.26-5.39,1.26-2.82,0-5.5-.47-8.06-1.41-2.55-.94-4.73-2.5-6.54-4.68-1.81-2.18-2.72-4.75-2.72-7.7,0-2.55.65-4.9,1.96-7.05,1.31-2.15,2.95-3.89,4.93-5.24,1.98-1.34,4.23-2.48,6.75-3.42,2.52-.94,4.92-1.61,7.2-2.01,2.28-.4,4.4-.6,6.34-.6v-2.52c0-4.3-.79-7.47-2.37-9.52-1.58-2.05-3.71-3.07-6.39-3.07s-4.77.74-6.65,2.22c-1.88,1.48-3.21,3.12-3.98,4.93-.77,1.81-1.16,3.49-1.16,5.04v.91h-1.21v-12.39h1.21v1.91c3.42-2.95,7.35-4.43,11.78-4.43,3.15,0,6.08.64,8.76,1.91,5.77,2.62,8.66,7.89,8.66,15.81v23.86ZM396.73,291.1v-23.26c-4.3,0-8.11,1.21-11.43,3.63s-5.52,5.64-6.6,9.67c-.94,3.49-.5,6.71,1.31,9.67,1.81,2.95,4.4,4.43,7.75,4.43,1.68,0,3.27-.33,4.78-1.01,1.51-.67,2.57-1.34,3.17-2.01l1.01-1.11Z"/>
              <path className="fill-white" d="M439.23,249.92c3.42,0,6.41.77,8.96,2.32l-1.71,5.04c-2.95-3.29-6.04-4.93-9.26-4.93-2.35,0-4.58,1.16-6.7,3.47-2.12,2.32-3.17,5.12-3.17,8.41v31.62h5.64v1.51h-19.54v-1.51h5.64v-42.49l-5.24,1.71-.4-1.41,13.9-5.04v7.55c3.29-4.16,7.25-6.24,11.88-6.24Z"/>
              <path className="fill-[#f15a29]" d="M496.22,296.24h.7v1.11h-6.85c-1.48,0-2.77-.55-3.88-1.66s-1.66-2.4-1.66-3.88v-2.01c-3.29,4.16-7.25,6.24-11.88,6.24-2.82,0-5.32-.49-7.5-1.46-2.18-.97-3.89-2.28-5.13-3.93-1.24-1.64-2.17-3.47-2.77-5.49-.6-2.01-.91-4.19-.91-6.55l.1-25.27-5.24,1.71-.4-1.41,13.9-5.04v33.43c0,3.83.86,6.71,2.57,8.66,1.71,1.95,3.88,2.92,6.49,2.92,2.48,0,4.77-.87,6.85-2.62,2.08-1.75,3.39-4.3,3.93-7.65v-30.01l-5.24,1.71-.4-1.41,13.9-5.04v42.39c0,1.41.28,2.63.85,3.68.57,1.04,1.43,1.56,2.57,1.56Z"/>
              <path className="fill-[#f15a29]" d="M539.92,295.83h5.24v1.51h-20.34v-1.51h4.93l-10.27-18.73-10.37,18.73h4.94v1.51h-12.49v-1.51h5.34l11.28-21.04-12.89-23.46h-5.13v-1.41h20.34v1.41h-4.53l7.45,13.8,7.45-13.8h-4.53v-1.41h12.39v1.41h-5.04l-8.96,16.21,15.21,28.29Z"/>
              <path className="fill-[#f15a29]" d="M277.32,268.73c-3.35,0-6.07,2.72-6.07,6.07s2.72,6.07,6.07,6.07,6.07-2.72,6.07-6.07-2.72-6.07-6.07-6.07Z"/>
            </svg>
            <p className="font-body text-sm text-white/55 leading-relaxed mb-5">
              Professional UX audits powered by AI. 64 checkpoints, 16 categories, results in minutes.
            </p>

            {/* Social links */}
            <div className="flex items-center gap-3">
              <a
                href="https://www.instagram.com/clearux.ai"
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
