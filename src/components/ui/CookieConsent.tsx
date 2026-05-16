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

     Layout: compact bottom-right card on >=sm, narrow enough that
     it does not span across the main content area. On mobile it
     spans the bottom with margins so it does not extend behind a
     thumb-reach gesture area. Either way it sits well below the
     primary dashboard / demo content at 1440x1100 and on phones.
     ───────────────────────────────────────────────────────────── */

  return (
    <div
      data-testid="cookie-consent-banner"
      className="fixed z-50 bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 sm:w-[300px] rounded-2xl backdrop-blur-md"
      style={{
        animation: 'slideUp 0.3s ease-out',
        background: 'color-mix(in srgb, var(--paper) 94%, transparent)',
        border: '1px solid var(--rule-2)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.03) inset',
      }}
      role="dialog"
      aria-label="Cookie consent"
      aria-describedby="cookie-consent-description"
    >
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <p
          id="cookie-consent-description"
          className="text-[13px] leading-relaxed"
          style={{ color: 'var(--ink)' }}
        >
          We use essential cookies only — no tracking, no ads, no third-party cookies.{' '}
          <Link
            href="/cookies"
            className="font-semibold underline underline-offset-2 hover:no-underline"
            style={{ color: 'var(--signal)' }}
          >
            Cookie Policy
          </Link>
        </p>

        {/* Both buttons are identical in size, style, and visual weight */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleReject}
            aria-label="Reject all cookies"
            data-testid="cookie-reject"
            className="flex-1 px-3 py-2 rounded-lg text-[13px] font-semibold min-h-[40px] transition-colors"
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
            data-testid="cookie-accept"
            className="flex-1 px-3 py-2 rounded-lg text-[13px] font-semibold min-h-[40px] transition-colors"
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
  );
}
