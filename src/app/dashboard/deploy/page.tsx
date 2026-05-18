'use client';

/**
 * Deploy — compact deploy console.
 *
 * Layout: tight 240px file/page tree on the left, snippet editor on the
 * right. Smaller typography than the Find/Fix tabs because this is a
 * working surface, not a reading surface. A thin pending-fixes bar at
 * the top surfaces the queue without competing for screen space.
 *
 * Safety contract: nothing is pushed to a live site without explicit
 * user approval. The Push action stays gated behind a connected
 * deployment target. Approve / Mark fixed updates only the local
 * finding status — same flow as the Fix tab.
 */

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  Copy,
  Check,
  Download,
  Send,
  Lock,
  RotateCcw,
  AlertTriangle,
  X,
  FileText,
  Globe,
  Rocket,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import {
  loadLatestAuditBundle,
  severityColor,
  severityLabel,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import OverviewBreadcrumb from '@/components/dashboard/OverviewBreadcrumb';
import type { AuditFinding, FindingStatus } from '@/types/database';

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

function pathOf(url: string | null | undefined): string {
  if (!url) return '(no URL)';
  try { return new URL(url).pathname || '/'; } catch { return url; }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'fix';
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (!(t.startsWith('{') || t.startsWith('['))) return false;
  try { JSON.parse(t); return true; } catch { return false; }
}

type Toast = { id: number; tone: 'info' | 'ok' | 'warn'; message: string };

interface PageNode {
  key: string;          // URL or "__no_url"
  host: string | null;
  path: string;
  findings: AuditFinding[];
}

function DeployPageInner() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [patches, setPatches] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [showPushNotice, setShowPushNotice] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (tone: Toast['tone'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  };

  const dismissToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  useEffect(() => {
    if (authLoading || !user || !ready) {
      if (!authLoading) setLoading(false);
      return;
    }
    setLoading(true);
    loadLatestAuditBundle(user.id, selection)
      .then(setBundle)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, user, ready, selection]);

  // Build the "file tree": each unique page URL is a folder, each
  // finding is a leaf. Findings without a URL bucket into "(no URL)".
  const tree = useMemo<PageNode[]>(() => {
    if (!bundle) return [];
    const pending = bundle.findings.filter((f) => f.status === 'open' || f.status === 'in_progress');
    const byKey = new Map<string, PageNode>();
    for (const f of pending) {
      const key = f.page_url || '__no_url';
      let node = byKey.get(key);
      if (!node) {
        node = {
          key,
          host: hostnameOf(f.page_url),
          path: f.page_url ? pathOf(f.page_url) : '(no URL)',
          findings: [],
        };
        byKey.set(key, node);
      }
      node.findings.push(f);
    }
    const out = Array.from(byKey.values());
    out.sort((a, b) => a.path.localeCompare(b.path));
    for (const n of out) {
      n.findings.sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0));
    }
    return out;
  }, [bundle]);

  // Default-select the first finding so the editor isn't empty on first load.
  useEffect(() => {
    if (activeId) return;
    const first = tree[0]?.findings[0];
    if (first) setActiveId(first.id);
  }, [tree, activeId]);

  const active = useMemo<AuditFinding | null>(() => {
    if (!activeId || !bundle) return null;
    return bundle.findings.find((f) => f.id === activeId) || null;
  }, [activeId, bundle]);

  const initialPatch = (active?.recommendation || '').trim();
  const patch = active ? (patches[active.id] ?? initialPatch) : '';
  const dirty = active ? patch !== initialPatch : false;
  const isJson = active ? looksLikeJson(patch) : false;

  const setActivePatch = (v: string) => {
    if (!active) return;
    setPatches((p) => ({ ...p, [active.id]: v }));
  };

  const updateLocal = (id: string, patch: Partial<AuditFinding>) => {
    setBundle((b) => b ? { ...b, findings: b.findings.map((f) => f.id === id ? { ...f, ...patch } : f) } : b);
  };

  const handleStatus = async (id: string, status: FindingStatus) => {
    const prev = bundle?.findings.find((f) => f.id === id)?.status;
    setPending((p) => ({ ...p, [id]: true }));
    updateLocal(id, { status });
    try {
      const res = await fetch(`/api/findings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        if (prev) updateLocal(id, { status: prev });
        pushToast('warn', 'Could not update status. Try again.');
      } else if (status === 'fixed') {
        pushToast('ok', 'Marked as fixed.');
      }
    } catch {
      if (prev) updateLocal(id, { status: prev });
      pushToast('warn', 'Network error. Status not saved.');
    } finally {
      setPending((p) => ({ ...p, [id]: false }));
    }
  };

  const handleCopy = async () => {
    if (!patch.trim()) return;
    try {
      await navigator.clipboard.writeText(patch);
      setCopied(true);
      pushToast('ok', 'Copied to clipboard.');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      pushToast('warn', 'Copy failed.');
    }
  };

  const handleDownload = () => {
    if (!active || !patch.trim()) return;
    const base = slugify(active.title);
    if (isJson) {
      downloadFile(`${base}.json`, patch, 'application/json');
      pushToast('ok', `Downloaded ${base}.json`);
      return;
    }
    const md = [
      `# ${active.title}`,
      '',
      `## Finding`,
      active.description || '(no description)',
      '',
      `## Recommended fix`,
      patch,
      '',
    ].join('\n');
    downloadFile(`${base}.md`, md, 'text/markdown');
    pushToast('ok', `Downloaded ${base}.md`);
  };

  const handleReset = () => {
    if (!active) return;
    setPatches((p) => {
      const next = { ...p };
      delete next[active.id];
      return next;
    });
  };

  const pendingCount = useMemo(() => tree.reduce((s, n) => s + n.findings.length, 0), [tree]);

  if (authLoading || loading || !ready) {
    return (
      <div>
        <div className="h-7 w-32 rounded-md animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-80 rounded animate-pulse mb-6" style={{ background: 'var(--paper-2)' }} />
        <div className="h-[420px] rounded-lg animate-pulse" style={{ background: 'var(--paper-2)' }} />
      </div>
    );
  }

  if (!bundle?.audit) {
    return (
      <div>
        <OverviewBreadcrumb current="Deploy" />
        <div className="mb-5">
          <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Deploy</h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
            {selection ? 'No audit for this brand yet.' : 'Run an audit to populate the deploy queue.'}
          </p>
        </div>
        <EmptyAudit
          title="No fixes to deploy"
          body="Run your first audit to surface fixes you can ship from this console."
        />
      </div>
    );
  }

  return (
    <div>
      <OverviewBreadcrumb current="Deploy" />
      <div className="mb-4">
        <h1 className="text-[20px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Deploy</h1>
        <p className="text-[12.5px] mt-1" style={{ color: 'var(--m-muted)' }}>
          Compact console for shipping fixes. Pick a page, review the snippet, copy or download — push stays gated until you connect a target.
        </p>
      </div>

      {/* Minimal pending-fixes bar */}
      <div
        className="rounded-md px-3 py-1.5 mb-2 flex items-center gap-3 text-[11.5px]"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink-2)' }}
      >
        <Rocket size={12} style={{ color: 'var(--signal)' }} aria-hidden />
        <span className="font-semibold" style={{ color: 'var(--ink)' }}>
          {pendingCount} {pendingCount === 1 ? 'fix' : 'fixes'} pending
        </span>
        <span style={{ color: 'var(--m-muted)' }}>across {tree.length} {tree.length === 1 ? 'page' : 'pages'}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[10.5px]" style={{ color: 'var(--m-muted)' }}>
          <Lock size={10} aria-hidden />
          Safe mode · No silent changes
        </span>
      </div>

      {pendingCount === 0 ? (
        <div
          className="rounded-md p-6 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Nothing to deploy</p>
          <p className="text-[11.5px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
            Every fix from the latest audit is marked as fixed or backlog.
          </p>
          <Link
            href="/dashboard/find"
            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-md text-[12px] font-semibold"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            Back to Find
          </Link>
        </div>
      ) : (
        <div
          className="grid rounded-md overflow-hidden"
          style={{ gridTemplateColumns: '240px 1fr', background: 'var(--card)', border: '1px solid var(--rule)', minHeight: 520 }}
        >
          {/* File / page tree */}
          <aside
            className="overflow-y-auto"
            style={{ borderRight: '1px solid var(--rule)', maxHeight: 720 }}
          >
            <div
              className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] sticky top-0"
              style={{ background: 'var(--paper-2)', color: 'var(--m-muted)', borderBottom: '1px solid var(--rule)' }}
            >
              Pages
            </div>
            <ul className="text-[12px]">
              {tree.map((node) => {
                const isCollapsed = !!collapsed[node.key];
                return (
                  <li key={node.key}>
                    <button
                      type="button"
                      onClick={() => setCollapsed((c) => ({ ...c, [node.key]: !c[node.key] }))}
                      className="w-full px-2.5 py-1.5 flex items-center gap-1.5 text-left hover:bg-[color:var(--paper-2)]/60 transition-colors"
                      style={{ color: 'var(--ink-2)' }}
                      aria-expanded={!isCollapsed}
                    >
                      {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                      <Globe size={11} style={{ color: 'var(--m-muted)' }} aria-hidden />
                      <span className="truncate flex-1" title={node.path}>
                        {node.path === '/' ? (node.host || '/') : node.path}
                      </span>
                      <span className="tabular-nums text-[10px]" style={{ color: 'var(--m-muted)' }}>
                        {node.findings.length}
                      </span>
                    </button>
                    {!isCollapsed && (
                      <ul>
                        {node.findings.map((f) => {
                          const isActive = activeId === f.id;
                          return (
                            <li key={f.id}>
                              <button
                                type="button"
                                onClick={() => setActiveId(f.id)}
                                className="w-full pl-7 pr-2.5 py-1.5 flex items-center gap-1.5 text-left transition-colors"
                                style={{
                                  background: isActive ? 'color-mix(in srgb, var(--signal) 8%, transparent)' : 'transparent',
                                  color: isActive ? 'var(--ink)' : 'var(--ink-2)',
                                  borderLeft: isActive ? '2px solid var(--signal)' : '2px solid transparent',
                                }}
                                aria-current={isActive ? 'true' : undefined}
                              >
                                <FileText size={10} style={{ color: severityColor(f.severity) }} aria-hidden />
                                <span className="truncate flex-1 text-[11.5px]" title={f.title}>
                                  {f.title}
                                </span>
                                <span
                                  className="text-[9px] font-semibold uppercase tracking-[0.04em] flex-shrink-0"
                                  style={{ color: severityColor(f.severity) }}
                                >
                                  {f.severity[0]}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Editor */}
          <main className="flex flex-col">
            {active ? (
              <>
                {/* Editor header */}
                <header
                  className="px-3 py-2 flex items-center gap-2 flex-wrap"
                  style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--rule)' }}
                >
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-[0.04em]"
                    style={{
                      background: `color-mix(in srgb, ${severityColor(active.severity)} 12%, transparent)`,
                      color: severityColor(active.severity),
                    }}
                  >
                    {severityLabel(active.severity)}
                  </span>
                  <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                    {active.title}
                  </span>
                  {dirty && (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--warn)' }}>
                      Edited
                    </span>
                  )}
                  <span className="ml-auto text-[11px] truncate" style={{ color: 'var(--m-muted)' }}>
                    {hostnameOf(active.page_url) || pathOf(active.page_url)}
                  </span>
                </header>

                {/* Editor body */}
                <div className="p-3 flex-1 min-h-0">
                  <textarea
                    value={patch}
                    onChange={(e) => setActivePatch(e.target.value)}
                    spellCheck
                    className="w-full h-full min-h-[280px] px-3 py-2 text-[12px] leading-[1.6] outline-none focus-visible:ring-2 focus-visible:ring-signal/30 font-mono"
                    style={{
                      background: 'var(--paper-2)',
                      border: '1px solid var(--rule)',
                      borderRadius: '6px',
                      color: 'var(--ink)',
                      resize: 'vertical',
                    }}
                    placeholder={
                      initialPatch ? undefined : 'No recommendation captured — draft the snippet here.'
                    }
                    aria-label="Editable fix snippet"
                  />
                </div>

                {/* Action bar */}
                <footer
                  className="px-3 py-2 flex items-center gap-1.5 flex-wrap"
                  style={{ background: 'var(--paper-2)', borderTop: '1px solid var(--rule)' }}
                >
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!patch.trim()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium disabled:opacity-50"
                    style={{
                      background: copied ? 'color-mix(in srgb, var(--ok) 12%, transparent)' : 'var(--card)',
                      border: '1px solid var(--rule)',
                      color: copied ? 'var(--ok)' : 'var(--ink)',
                    }}
                    aria-label="Copy snippet to clipboard"
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={!patch.trim()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium disabled:opacity-50"
                    style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                    aria-label={isJson ? 'Download as JSON' : 'Download as Markdown'}
                  >
                    <Download size={11} />
                    {isJson ? '.json' : '.md'}
                  </button>
                  {dirty && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium"
                      style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
                      aria-label="Reset snippet to original recommendation"
                    >
                      <RotateCcw size={11} />
                      Reset
                    </button>
                  )}
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setShowPushNotice((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium"
                    style={{ background: 'transparent', border: '1px dashed var(--rule)', color: 'var(--m-muted)' }}
                    aria-expanded={showPushNotice}
                    aria-label="Push to site (deployment target required)"
                  >
                    <Lock size={11} />
                    Push
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatus(active.id, 'fixed')}
                    disabled={!!pending[active.id]}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11.5px] font-semibold disabled:opacity-50"
                    style={{ background: 'var(--ok)', color: 'var(--paper)' }}
                    aria-label="Approve and mark fixed"
                  >
                    <Send size={11} />
                    Approve
                  </button>
                </footer>

                {showPushNotice && (
                  <div
                    className="mx-3 mb-3 px-3 py-2 rounded-md text-[11.5px] flex items-start gap-2"
                    style={{
                      background: 'color-mix(in srgb, var(--warn) 6%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)',
                      color: 'var(--ink-2)',
                    }}
                    role="status"
                  >
                    <Lock size={12} className="mt-px flex-shrink-0" style={{ color: 'var(--warn)' }} />
                    <div className="flex-1">
                      <p className="font-semibold mb-0.5" style={{ color: 'var(--ink)' }}>Deployment target not connected</p>
                      <p style={{ color: 'var(--m-muted)' }}>
                        Connect WordPress, a CMS, or an FTP target from{' '}
                        <Link href="/dashboard/connect" className="underline" style={{ color: 'var(--ink)' }}>
                          Connect site
                        </Link>{' '}
                        to enable one-click push. Until then, copy or download the snippet — nothing is pushed without your explicit approval.
                      </p>
                    </div>
                    <button onClick={() => setShowPushNotice(false)} aria-label="Dismiss notice" className="text-[var(--m-muted)] hover:text-[var(--ink)]">
                      <X size={12} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 grid place-items-center p-6 text-[12px]" style={{ color: 'var(--m-muted)' }}>
                Select a fix from the left to start.
              </div>
            )}
          </main>
        </div>
      )}

      {/* Toasts — bottom-right, dismissable */}
      <div className="fixed bottom-4 right-4 z-50 space-y-1.5 max-w-[320px]">
        {toasts.map((t) => {
          const tone =
            t.tone === 'ok' ? { bg: 'color-mix(in srgb, var(--ok) 10%, transparent)', border: 'var(--ok)', icon: <Check size={12} /> } :
            t.tone === 'warn' ? { bg: 'color-mix(in srgb, var(--warn) 10%, transparent)', border: 'var(--warn)', icon: <AlertTriangle size={12} /> } :
            { bg: 'var(--card)', border: 'var(--rule)', icon: <Rocket size={12} /> };
          return (
            <div
              key={t.id}
              role="status"
              className="px-3 py-2 rounded-md text-[12px] flex items-start gap-2 shadow-sm"
              style={{ background: tone.bg, border: `1px solid ${tone.border}`, color: 'var(--ink)' }}
            >
              <span className="flex-shrink-0 mt-px" style={{ color: tone.border }}>{tone.icon}</span>
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss"
                className="text-[var(--m-muted)] hover:text-[var(--ink)] flex-shrink-0"
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DeployPage() {
  return (
    <Suspense
      fallback={
        <div>
          <div className="h-7 w-32 rounded-md animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
          <div className="h-5 w-80 rounded animate-pulse mb-6" style={{ background: 'var(--paper-2)' }} />
        </div>
      }
    >
      <DeployPageInner />
    </Suspense>
  );
}
