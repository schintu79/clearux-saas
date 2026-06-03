'use client';

/**
 * AI Interrogation — redirects to Brand Intelligence page where the
 * interrogation feature is now integrated inline.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';

export default function AIInterrogationRedirect() {
  const router = useRouter();
  const { workspaceSlug } = useWorkspace();

  useEffect(() => {
    if (workspaceSlug) {
      router.replace(`/dashboard/${workspaceSlug}/intelligence`);
    }
  }, [workspaceSlug, router]);

  return (
    <div className="flex items-center justify-center py-32">
      <p className="text-[14px]" style={{ color: 'var(--m-muted)' }}>Redirecting...</p>
    </div>
  );
}
