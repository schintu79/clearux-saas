'use client';

/**
 * DEPRECATED: Redirects to Brand Intelligence > AI Perception tab.
 * The standalone ai-perception route is no longer used — all AI perception
 * content lives inside the Intelligence page's "perception" tab.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';

export default function AIPerceptionRedirect() {
  const router = useRouter();
  const { workspaceSlug, loading } = useWorkspace();

  useEffect(() => {
    if (loading) return;
    const prefix = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard';
    router.replace(`${prefix}/intelligence?tab=perception`);
  }, [router, workspaceSlug, loading]);

  return null;
}
