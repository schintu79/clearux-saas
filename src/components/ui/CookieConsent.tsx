'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const cookies = document.cookie.split(';').map(c => c.trim());
    const consentCookie = cookies.find(c => c.startsWith('clearux-cookie-consent='));

    if (!consentCookie) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    document.cookie = 'clearux-cookie-consent=accepted; path=/; max-age=31536000';
    setIsVisible(false);
  };

  const handleReject = () => {
    document.cookie = 'clearux-cookie-consent=rejected; path=/; max-age=31536000';
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  /* ─────────────────────────────────────────────────────────────
     Ethical cookie consent: both buttons are identical in size,
     color, and prominence. No pre-checked options. Reject and
     Accept require exactly one click each. Language is neutral.
     See /cookies for documentation of this implementation.
     ───────────────────────────────────────────────────────────── */

  return (
    <div
      data-testid="cookie-consent-banner"
      className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-md"
      style={{
        animation: 'slideUp 0.3s ease-out',
        background: 'color-mix(in srgb, var(--paper) 92%, transparent)',
        borderTop: '1px solid var(--rule-2)',
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.35), 0 -1px 0 rgba(255, 255, 255, 0.04) inset',
      }}
      role="dialog"
      aria-label="Cookie consent"
      aria-describedby="cookie-consent-description"
    >
      <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p id="cookie-consent-description" className="text-sm flex-1" style={{ color: 'var(--ink)' }}>
            We use essential cookies only — no tracking, no ads, no third-party cookies.{' '}
            <Link
              href="/cookies"
              className="font-semibold underline underline-offset-2 hover:no-underline"
              style={{ color: 'var(--signal)' }}
            >
              Read our Cookie Policy
            </Link>
          </p>

          {/* Both buttons are identical in size, style, and visual weight */}
          <div className="flex gap-3 flex-shrink-0 w-full sm:w-auto">
            <button
              onClick={handleReject}
              aria-label="Reject all cookies"
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] transition-colors"
              style={{
                background: 'var(--paper-2)',
                border: '1px solid var(--rule-2)',
                color: 'var(--ink)',
              }}
            >
              Reject all
            </button>
            <button
              onClick={handleAccept}
              aria-label="Accept all cookies"
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] transition-colors"
              style={{
                background: 'var(--paper-2)',
                border: '1px solid var(--rule-2)',
                color: 'var(--ink)',
              }}
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
