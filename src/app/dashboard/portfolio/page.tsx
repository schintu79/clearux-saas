'use client';

/**
 * Portfolio — answers "Which brand/client needs attention first?"
 *
 * Only useful for users with more than one site or brand. We do not force
 * a single-brand owner to see it — the page surfaces an explicit empty
 * state with a single CTA. Ordering defaults to risk-first (lowest score
 * with open criticals on top).
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  Fingerprint,
  FolderOpen,
  Globe,
  AlertTriangle,
} from 'lucide-react';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';

interface PortfolioBrand {
  kind: 'site' | 'brand';
  id: string;
  name: string;
  url: string | null;
  latestScore: number | null;
  priorScore: number | null;
  criticalOpen: number;
  totalOpen: number;
  lastAuditAt: string | null;
  latestAuditId: string | null;
}

function scoreColor(s: number | null): string {
  if (s == null) return 'var(--m-muted)';
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

function deltaTone(d: number | null): string {
  if (d == null || d === 0) return 'var(--m-muted)';
  return d > 0 ? 'var(--ok)' : 'var(--severe)';
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

type SortKey = 'risk' | 'score' | 'recent';

export default function PortfolioPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<PortfolioBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('risk');

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }
    (async () => {
      try {
        const supabase = createBrowserSupabase();
        const [{ data: audits }, brandsRes] = await Promise.all([
          supabase
            .from('audits')
            .select('id, product_url, status, completed_at, brand_identity_id, audit_type')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .is('deleted_at', null)
            .order('completed_at', { ascending: false }),
          fetch('/api/brand-identities').then((r) => r.ok ? r.json() : { identities: [] }),
        ]);
        const auditRows = (audits || []) as any[];
        const websiteAudits = auditRows.filter((a) => !a.audit_type || a.audit_type === 'website');

        // group by domain
        const byDomain = new Map<string, any[]>();
        for (const a of websiteAudits) {
          const host = hostOf(a.product_url);
          if (!host) continue;
          if (!byDomain.has(host)) byDomain.set(host, []);
          byDomain.get(host)!.push(a);
        }

        const ids = websiteAudits.map((a) => a.id);
        let reportMap = new Map<string, any>();
        let findingMap = new Map<string, { critical: number; total: number }>();
        if (ids.length) {
          const [{ data: reports }, { data: findings }] = await Promise.all([
            supabase.from('reports').select('audit_id, overall_score').in('audit_id', ids),
            supabase
              .from('audit_findings')
              .select('audit_id, severity, status, dismissed')
              .in('audit_id', ids),
          ]);
          for (const r of (reports || []) as any[]) reportMap.set(r.audit_id, r);
          for (const f of (findings || []) as any[]) {
            if (f.dismissed) continue;
            if (f.status !== 'open' && f.status !== 'in_progress') continue;
            const cur = findingMap.get(f.audit_id) || { critical: 0, total: 0 };
            cur.total++;
            if (f.severity === 'critical') cur.critical++;
            findingMap.set(f.audit_id, cur);
          }
        }

        const siteItems: PortfolioBrand[] = [];
        for (const [host, list] of byDomain.entries()) {
          const latest = list[0];
          const prior = list[1];
          const latestScore = reportMap.get(latest.id)?.overall_score ?? null;
          const priorScore = prior ? (reportMap.get(prior.id)?.overall_score ?? null) : null;
          const fc = findingMap.get(latest.id) || { critical: 0, total: 0 };
          siteItems.push({
            kind: 'site',
            id: `site:${host}`,
            name: host,
            url: latest.product_url,
            latestScore,
            priorScore,
            criticalOpen: fc.critical,
            totalOpen: fc.total,
            lastAuditAt: latest.completed_at,
            latestAuditId: latest.id,
          });
        }

        const brandItems: PortfolioBrand[] = ((brandsRes?.identities || []) as any[]).map((b) => ({
          kind: 'brand' as const,
          id: `brand:${b.id}`,
          name: b.name || 'Untitled brand',
          url: null,
          latestScore: null,
          priorScore: null,
          criticalOpen: 0,
          totalOpen: 0,
          lastAuditAt: null,
          latestAuditId: null,
        }));

        setItems([...siteItems, ...brandItems]);
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user]);

  const sorted = useMemo(() => {
    const list = [...items];
    list.sort((a, b) => {
      if (sort === 'score') return (a.latestScore ?? 999) - (b.latestScore ?? 999);
      if (sort === 'recent') return new Date(b.lastAuditAt || 0).getTime() - new Date(a.lastAuditAt || 0).getTime();
      // risk
      const riskA = (a.criticalOpen * 100) + a.totalOpen - (a.latestScore ?? 100);
      const riskB = (b.criticalOpen * 100) + b.totalOpen - (b.latestScore ?? 100);
      return riskB - riskA;
    });
    return list;
  }, [items, sort]);

  if (authLoading || loading) {
    return (
      <div>
        <div className="h-8 w-40 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-80 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-[80px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      </div>
    );
  }

  const isSingle = items.length <= 1;

  return (
    <div>
      <PageHeader
        icon={<FolderOpen size={18} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />}
        title="Portfolio"
        subtitle="Which brand or client needs attention first? Ranked by open criticals and lowest score."
      >
        <Link
          href="/dashboard/new-audit"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90 flex-shrink-0"
          style={{ background: 'var(--ink)', color: 'var(--paper)' }}
        >
          <Plus size={13} /> Add site or brand
        </Link>
      </PageHeader>

      {items.length === 0 ? (
        <div
          className="rounded-xl p-8"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          data-testid="portfolio-empty"
        >
          <p className="text-[16px] font-sans font-semibold" style={{ color: 'var(--ink)' }}>
            Your portfolio is empty
          </p>
          <p className="text-[13px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
            Add your first brand or site, run an audit, and we will surface where you should look first.
          </p>
          <Link
            href="/dashboard/new-audit"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-[13px] font-semibold"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            Run your first audit
            <ArrowRight size={13} />
          </Link>
        </div>
      ) : (
        <>
          {isSingle && (
            <div
              className="rounded-xl p-3 mb-4 flex items-start gap-2.5"
              style={{ background: 'color-mix(in srgb, var(--signal) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 12%, transparent)' }}
            >
              <Globe size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--signal)' }} />
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                You are tracking one brand right now. Portfolio view becomes more useful once you add a second brand or client site.
              </p>
            </div>
          )}

          <div className="mb-3 flex items-center gap-2">
            <p className="text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
              Sort by
            </p>
            {(['risk', 'score', 'recent'] as SortKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
                style={{
                  background: sort === k ? 'var(--paper-2)' : 'transparent',
                  color: sort === k ? 'var(--ink)' : 'var(--m-muted)',
                  border: '1px solid var(--rule)',
                }}
              >
                {k === 'risk' ? 'Risk' : k === 'score' ? 'Lowest score' : 'Most recent'}
              </button>
            ))}
          </div>

          <ul className="space-y-2">
            {sorted.map((i) => {
              const d = i.latestScore != null && i.priorScore != null ? i.latestScore - i.priorScore : null;
              const Icon = i.kind === 'brand' ? Fingerprint : Globe;
              const href = i.kind === 'site' && i.latestAuditId
                ? `/dashboard/audits/${i.latestAuditId}`
                : i.kind === 'brand'
                  ? `/dashboard/brand-identity/${i.id.replace('brand:', '')}`
                  : '/dashboard/new-audit';
              return (
                <li key={i.id}>
                  <Link
                    href={href}
                    className="rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-sm"
                    style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
                    data-testid="portfolio-row"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
                    >
                      <Icon size={16} strokeWidth={1.6} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{i.name}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
                        {i.kind === 'brand'
                          ? 'Brand identity'
                          : i.lastAuditAt
                            ? `Last audit ${new Date(i.lastAuditAt).toLocaleDateString()}`
                            : 'No audit yet'}
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-1 min-w-[80px] justify-end">
                      <span className="text-[18px] font-semibold tabular-nums" style={{ color: scoreColor(i.latestScore) }}>
                        {i.latestScore ?? '—'}
                      </span>
                      {d != null && (
                        <span className="inline-flex items-center text-[11px] font-semibold" style={{ color: deltaTone(d) }}>
                          {d > 0 ? <TrendingUp size={11} /> : d < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                          {d > 0 ? '+' : ''}{d}
                        </span>
                      )}
                    </div>
                    <div className="hidden md:flex items-center gap-1 text-[11px] min-w-[120px] justify-end">
                      {i.criticalOpen > 0 && (
                        <span className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--severe)' }}>
                          <AlertTriangle size={11} />
                          {i.criticalOpen} critical
                        </span>
                      )}
                      {i.criticalOpen === 0 && i.totalOpen > 0 && (
                        <span style={{ color: 'var(--m-muted)' }}>{i.totalOpen} open</span>
                      )}
                    </div>
                    <span
                      className="inline-flex items-center gap-1 text-[12px] font-medium flex-shrink-0"
                      style={{ color: 'var(--signal)' }}
                    >
                      {i.kind === 'site' && i.latestAuditId ? 'Open' : i.kind === 'brand' ? 'View' : 'Audit'}
                      <ArrowRight size={11} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
