'use client';

/**
 * /dashboard — redirects to /dashboard/overview.
 *
 * The dashboard is now structured around Find / Fix / Track with the
 * Overview page acting as the entry point ("What should I do next?").
 * We keep this route as a thin client redirect so existing links and the
 * sidebar "Dashboard" item continue to land on the right page, and so
 * Stripe's `?credits=purchased` callback still works.
 */

import React, { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function DashboardRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    router.replace(`/dashboard/overview${query ? `?${query}` : ''}`);
  }, [router, searchParams]);

  return (
    <div>
      <div className="h-8 w-48 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
      <div className="h-5 w-72 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-[160px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div>
        <div className="h-8 w-48 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-72 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[160px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
          ))}
        </div>
      </div>
    }>
      <DashboardRedirect />
    </Suspense>
  );
}
