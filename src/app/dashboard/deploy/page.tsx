'use client';

/**
 * Deploy page — redirects to /dashboard/fix.
 *
 * The deploy experience has been unified into the Fix page as an inline
 * Deploy Console. This redirect preserves any bookmarks or links.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeployRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/fix');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <p className="text-[13px]" style={{ color: 'var(--m-muted)' }}>
        Redirecting to Fix...
      </p>
    </div>
  );
}
