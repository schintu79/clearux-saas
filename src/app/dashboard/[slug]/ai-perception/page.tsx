'use client';

/**
 * DEPRECATED: Redirects to Brand Intelligence > AI Perception tab.
 * The standalone ai-perception route is no longer used.
 */

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function AIPerceptionRedirect() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug ?? '';

  useEffect(() => {
    router.replace(`/dashboard/${slug}/intelligence?tab=perception`);
  }, [router, slug]);

  return null;
}
