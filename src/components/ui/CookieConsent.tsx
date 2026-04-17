'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const cookies = document.cookie.split(';').map(c => c.trim());
    const consentCookie = cookies.find(c => c.startsWith('clearux-cookie-consent='));

    if (!consentCookie) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    document.cookie = 'clearux-cookie-consent=accepted; path=/; max-age=31536000'; // 1 year
    setIsVisible(false);
  };

  const handleReject = () => {
    document.cookie = 'clearux-cookie-consent=rejected; path=/; max-age=31536000'; // 1 year
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/60 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
      style={{ animation: 'slideUp 0.3s ease-out' }}
      aria-label="Cookie consent"
    >
      <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Text Content */}
          <p className="text-sm text-muted flex-1">
            We use essential cookies to keep ClearUX working. No tracking, no ads.{' '}
            <Link
              href="/cookies"
              className="text-brand font-medium hover:underline"
            >
              See our Cookie Policy
            </Link>
          </p>

          {/* Buttons Container */}
          <div className="flex gap-3 flex-shrink-0 w-full sm:w-auto">
            <button
              onClick={handleReject}
              aria-label="Reject cookies"
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] bg-white dark:bg-card border border-border text-text hover:bg-muted/50 dark:hover:bg-muted/20 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={handleAccept}
              aria-label="Accept cookies"
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] bg-white dark:bg-card border border-border text-text hover:bg-muted/50 dark:hover:bg-muted/20 transition-colors"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
