'use client';

/**
 * AuditBundleContext — Single source of truth for the latest audit bundle.
 *
 * WORKSPACE-SCOPED: reads workspace_id from WorkspaceContext instead of
 * the old localStorage brand-selection. No more cross-brand race conditions.
 *
 * Every dashboard page (Overview, Find, Fix, Track, AI Readability, Intelligence)
 * shares one bundle so mutations propagate instantly.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  loadLatestAuditBundle,
  isInProgressAuditStatus,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import type { AuditFinding } from '@/types/database';

interface AuditBundleContextValue {
  /** The shared bundle — null while loading or if no audit exists. */
  bundle: LatestAuditBundle | null;
  /** True during initial load or re-fetch. */
  loading: boolean;
  /**
   * Optimistically update a finding in the local bundle.
   * All consumers see the change instantly. Call invalidate() after the
   * server confirms to reconcile with the authoritative state.
   */
  updateFindingLocally: (findingId: string, patch: Partial<AuditFinding>) => void;
  /**
   * Update the report's overall_score in the local bundle.
   */
  updateReportScore: (newScore: number) => void;
  /**
   * Force re-fetch the bundle from the database.
   */
  invalidate: () => void;
}

const AuditBundleContext = createContext<AuditBundleContextValue>({
  bundle: null,
  loading: true,
  updateFindingLocally: () => {},
  updateReportScore: () => {},
  invalidate: () => {},
});

export function useAuditBundle() {
  return useContext(AuditBundleContext);
}

export function AuditBundleProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchIdRef = useRef(0);
  const workspaceIdRef = useRef(workspaceId);
  workspaceIdRef.current = workspaceId;

  // Load bundle when auth or workspace changes.
  // Clear old bundle immediately so no page shows stale data.
  useEffect(() => {
    if (authLoading || wsLoading || !user) {
      if (!authLoading && !wsLoading) setLoading(false);
      return;
    }
    if (!workspaceId) {
      setBundle(null);
      setLoading(false);
      return;
    }
    const id = ++fetchIdRef.current;
    setBundle(null);
    setLoading(true);
    loadLatestAuditBundle(user.id, workspaceId)
      .then((b) => {
        if (id === fetchIdRef.current) setBundle(b);
      })
      .catch(() => {})
      .finally(() => {
        if (id === fetchIdRef.current) setLoading(false);
      });
  }, [authLoading, wsLoading, user, workspaceId]);

  // Poll every 3s while an audit is in progress.
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const inProgressStatus = bundle?.inProgressAudit
    ? (bundle.inProgressAudit as any).status
    : bundle?.audit
      ? (bundle.audit as any).status
      : null;
  const needsPolling = isInProgressAuditStatus(inProgressStatus);

  useEffect(() => {
    if (!needsPolling || !user || !workspaceId) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const immediateId = ++fetchIdRef.current;
    loadLatestAuditBundle(user.id, workspaceIdRef.current!)
      .then((b) => {
        if (immediateId === fetchIdRef.current) setBundle(b);
      })
      .catch(() => {});

    pollingRef.current = setInterval(() => {
      const id = ++fetchIdRef.current;
      loadLatestAuditBundle(user.id, workspaceIdRef.current!)
        .then((b) => {
          if (id === fetchIdRef.current) setBundle(b);
        })
        .catch(() => {});
    }, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [needsPolling, user, workspaceId]);

  const updateFindingLocally = useCallback(
    (findingId: string, patch: Partial<AuditFinding>) => {
      setBundle((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          findings: prev.findings.map((f) =>
            f.id === findingId ? { ...f, ...patch } : f,
          ),
        };
      });
    },
    [],
  );

  const updateReportScore = useCallback((newScore: number) => {
    setBundle((prev) => {
      if (!prev || !prev.report) return prev;
      return {
        ...prev,
        report: { ...prev.report, overall_score: newScore },
      };
    });
  }, []);

  const invalidate = useCallback(() => {
    if (!user || !workspaceIdRef.current) return;
    const id = ++fetchIdRef.current;
    setLoading(true);
    loadLatestAuditBundle(user.id, workspaceIdRef.current!)
      .then((b) => {
        if (id === fetchIdRef.current) setBundle(b);
      })
      .catch(() => {})
      .finally(() => {
        if (id === fetchIdRef.current) setLoading(false);
      });
  }, [user]);

  return (
    <AuditBundleContext.Provider
      value={{ bundle, loading, updateFindingLocally, updateReportScore, invalidate }}
    >
      {children}
    </AuditBundleContext.Provider>
  );
}
