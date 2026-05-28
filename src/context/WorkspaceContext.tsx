'use client';

/**
 * WorkspaceContext — URL-driven workspace scoping for the dashboard.
 *
 * Replaces the old localStorage-based brand-selection system. Instead of
 * tracking which brand/site is "active" in a mutable store that races with
 * component updates, the workspace identity comes from the URL path:
 *
 *   /dashboard/[slug]/overview  →  workspaceSlug = slug
 *
 * This makes workspace identity structural and refresh-safe.
 *
 * The context fetches and caches workspace metadata (id, domain, type, etc.)
 * so child components can access workspace_id for API calls.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';
import type { Workspace } from '@/types/database';

interface WorkspaceContextValue {
  /** The full workspace record, null while loading or if not found. */
  workspace: Workspace | null;
  /** The workspace ID (shortcut for workspace?.id). */
  workspaceId: string | null;
  /** The workspace slug from the URL. */
  workspaceSlug: string;
  /** True during initial load. */
  loading: boolean;
  /** Error message if workspace couldn't be loaded. */
  error: string | null;
  /** Force re-fetch workspace data. */
  refresh: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspace: null,
  workspaceId: null,
  workspaceSlug: '',
  loading: true,
  error: null,
  refresh: () => {},
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

interface WorkspaceProviderProps {
  slug: string;
  children: React.ReactNode;
}

export function WorkspaceProvider({ slug, children }: WorkspaceProviderProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const fetchWorkspace = async () => {
    const id = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/workspaces');
      if (!res.ok) throw new Error('Failed to load workspaces');
      const { workspaces } = await res.json();

      if (id !== fetchIdRef.current) return;

      const match = (workspaces as Workspace[]).find(
        (w) => w.slug === slug,
      );

      if (match) {
        setWorkspace(match);
      } else {
        setWorkspace(null);
        setError('Workspace not found');
      }
    } catch (err) {
      if (id === fetchIdRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      if (id === fetchIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [slug]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        workspaceId: workspace?.id || null,
        workspaceSlug: slug,
        loading,
        error,
        refresh: fetchWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
