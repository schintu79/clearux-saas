'use client';

/**
 * Deploy page — redirects to /dashboard/fix.
 *
 * The deploy experience has been unified into the Fix page as an inline
 * Deploy Console. This redirect preserves any bookmarks or links.
 */

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function DeployRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Preserve workspace slug if present: /dashboard/[slug]/deploy → /dashboard/[slug]/fix
    const parts = (pathname || '').split('/').filter(Boolean);
    if (parts.length >= 3 && parts[0] === 'dashboard' && parts[2] === 'deploy') {
      router.replace(`/dashboard/${parts[1]}/fix`);
    } else {
      router.replace('/dashboard/fix');
    }
  }, [router, pathname]);

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <p className="text-[13px]" style={{ color: 'var(--m-muted)' }}>
        Redirecting to Fix...
      </p>
    </div>
  );
}
