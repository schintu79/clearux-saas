'use client';

/**
 * AuditBundleContext — Single source of truth for the latest audit bundle.
 *
 * Every dashboard page (Overview, Find, Fix, Track, AI Readability, Intelligence)
 * previously loaded its own copy of the audit bundle via loadLatestAuditBundle().
 * This caused stale data bugs: a status change on the Fix page wouldn't appear
 * on the Find page until the user navigated away and back.
 *
 * This context centralizes the bundle so:
 *  1. One Supabase query per selection change, shared across all tabs.
 *  2. Optimistic finding updates propagate to every mounted consumer instantly.
 *  3. After any mutation (status, dismiss, deploy, rollback), calling invalidate()
 *     re-fetches the authoritative state from the database.
 *  4. Score updates from the API are applied to the local report.
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
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import {
  loadLatestAuditBundle,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import type { AuditFinding, FindingStatus } from '@/types/database';

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
   * Used to apply scoreUpdate from PATCH /api/findings/:id responses.
   */
  updateReportScore: (newScore: number) => void;
  /**
   * Force re-fetch the bundle from the database.
   * Call after any mutation to reconcile optimistic state with server truth.
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
  const { selection, ready } = useBrandSelection();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchIdRef = useRef(0);

  // Load bundle when auth or selection changes
  useEffect(() => {
    if (authLoading || !user || !ready) {
      if (!authLoading) setLoading(false);
      return;
    }
    const id = ++fetchIdRef.current;
    setLoading(true);
    loadLatestAuditBundle(user.id, selection)
      .then((b) => {
        if (id === fetchIdRef.current) setBundle(b);
      })
      .catch(() => {})
      .finally(() => {
        if (id === fetchIdRef.current) setLoading(false);
      });
  }, [authLoading, user, ready, selection]);

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
    if (!user || !ready) return;
    const id = ++fetchIdRef.current;
    loadLatestAuditBundle(user.id, selection)
      .then((b) => {
        if (id === fetchIdRef.current) setBundle(b);
      })
      .catch(() => {});
  }, [user, ready, selection]);

  return (
    <AuditBundleContext.Provider
      value={{ bundle, loading, updateFindingLocally, updateReportScore, invalidate }}
    >
      {children}
    </AuditBundleContext.Provider>
  );
}
