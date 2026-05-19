'use client';

/**
 * Deploy — compact deploy console.
 *
 * Two modes:
 *  - Default: tight 240px file/page tree on the left, snippet editor on the
 *    right (compact deploy queue browsing).
 *  - Guided (?findingId=…): focused single-finding deployment flow with a
 *    context banner (title + severity + recommendation), an editable code
 *    snippet, and a Push action that writes via the FTP API and marks the
 *    finding as fixed on success.
 *
 * Safety contract: nothing is pushed to a live site without an explicit
 * user click on Push/Save. Mark fixed only fires after a successful FTP
 * write, which then triggers the report score recalculation server-side.
 */

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  ArrowLeft,
  Upload,
  Loader2,
  ClipboardPaste,
  Wand2,
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
import DiffPreview from '@/components/dashboard/v2/DiffPreview';
import type { SurgicalFixResult } from '@/lib/surgical-fix';

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

interface FtpConnectionSummary {
  id: string;
  label: string;
  protocol: string;
  host: string;
  port: number;
  username: string;
  remote_path: string;
  brand_identity_id: string | null;
}

interface GuidedFinding {
  id: string;
  audit_id: string;
  title: string;
  description: string;
  severity: string;
  status: FindingStatus;
  recommendation: string;
  estimated_impact: string | null;
  page_url: string | null;
}

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

/**
 * Derive a suggested remote file path from a finding's page_url and the
 * FTP connection's document root. Since we crawled the site, we already
 * know which URL has the issue — map it to the likely server file path.
 *
 * Examples:
 *   pageUrl="https://acme.com/"           root="/public_html" → "/public_html/index.html"
 *   pageUrl="https://acme.com/about"      root="/public_html" → "/public_html/about/index.html"
 *   pageUrl="https://acme.com/about.html" root="/public_html" → "/public_html/about.html"
 *   pageUrl="https://acme.com/blog/post"  root="/"            → "/blog/post/index.html"
 */
function suggestRemotePath(pageUrl: string | null | undefined, remoteRoot: string): string {
  if (!pageUrl) return '';
  let pathname: string;
  try {
    pathname = new URL(pageUrl).pathname;
  } catch {
    return '';
  }
  // Normalise root — strip trailing slash
  const root = remoteRoot.replace(/\/+$/, '') || '';

  // If pathname already has a file extension, use it directly
  if (/\.\w{2,5}$/.test(pathname)) {
    return `${root}${pathname}`;
  }

  // Normalise pathname — strip trailing slash
  const clean = pathname.replace(/\/+$/, '') || '';

  // Root path → index.html
  if (!clean || clean === '/') {
    return `${root}/index.html`;
  }

  // Path without extension → path/index.html (most common for clean URLs)
  return `${root}${clean}/index.html`;
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

/**
 * Best-effort extraction of a fenced ``` code block from a recommendation.
 * Returns null if no clearly-marked block is present. Plain prose stays in
 * the editor; only an explicit ``` block becomes the "apply snippet" payload.
 */
function extractCodeBlock(text: string): string | null {
  if (!text) return null;
  const fenced = text.match(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/);
  if (fenced && fenced[1]) return fenced[1].trim();
  return null;
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
  const searchParams = useSearchParams();
  const findingId = searchParams.get('findingId');

  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [patches, setPatches] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Guided-mode state
  const [guided, setGuided] = useState<GuidedFinding | null>(null);
  const [guidedLoading, setGuidedLoading] = useState(false);
  const [guidedError, setGuidedError] = useState<string | null>(null);

  // FTP target state
  const [connections, setConnections] = useState<FtpConnectionSummary[]>([]);
  const [connectionId, setConnectionId] = useState<string>('');
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);
  const [provisioned, setProvisioned] = useState<boolean>(true);

  // Deploy form state (guided mode)
  const [remotePath, setRemotePath] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [lastDeployLogId, setLastDeployLogId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Surgical fix state
  const [surgicalLoading, setSurgicalLoading] = useState(false);
  const [surgicalResult, setSurgicalResult] = useState<SurgicalFixResult | null>(null);
  const [surgicalError, setSurgicalError] = useState<string | null>(null);

  const handleRollback = async () => {
    if (!lastDeployLogId || restoring) return;
    setRestoring(true);
    try {
      const res = await fetch('/api/ftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', deployLogId: lastDeployLogId, connectionId }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        pushToast('warn', data?.error || 'Rollback failed.');
      } else {
        pushToast('ok', 'Original file restored successfully.');
        setLastDeployLogId(null);
      }
    } catch (err: any) {
      pushToast('warn', err?.message || 'Network error during rollback.');
    } finally {
      setRestoring(false);
    }
  };

  const pushToast = useCallback((tone: Toast['tone'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const dismissToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  /* ── Site-scoped FTP connections ──────────────────────────── */
  useEffect(() => {
    if (authLoading || !user || !ready) return;
    const siteHost = selection?.kind === 'site' ? selection.host : null;
    const url = siteHost ? `/api/ftp?siteHost=${encodeURIComponent(siteHost)}` : '/api/ftp';
    fetch(url)
      .then(async (res) => {
        const data = await res.json().catch(() => ({} as any));
        if (res.status === 503) {
          setProvisioned(false);
          setConnections([]);
          return;
        }
        setProvisioned(true);
        const list: FtpConnectionSummary[] = data?.connections || [];
        setConnections(list);
        // Auto-select if exactly one
        if (list.length === 1) setConnectionId(list[0].id);
      })
      .catch(() => setConnections([]))
      .finally(() => setConnectionsLoaded(true));
  }, [authLoading, user, ready, selection]);

  /* ── Auto-suggest remote path when finding + connection are known ── */
  useEffect(() => {
    // Only auto-fill if the user hasn't manually typed anything yet
    if (remotePath) return;
    const pageUrl = guided?.page_url;
    if (!pageUrl) return;
    // Find the selected (or sole) connection's remote_path
    const conn = connections.find((c) => c.id === connectionId);
    const root = conn?.remote_path || '';
    const suggested = suggestRemotePath(pageUrl, root);
    if (suggested) setRemotePath(suggested);
  }, [guided, connectionId, connections]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Default mode: audit bundle ────────────────────────────── */
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

  /* ── Guided mode: fetch the targeted finding ───────────────── */
  useEffect(() => {
    if (!findingId) {
      setGuided(null);
      setGuidedError(null);
      return;
    }
    setGuidedLoading(true);
    setGuidedError(null);
    fetch(`/api/findings/${findingId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok) {
          setGuidedError(data?.error || `Could not load finding (${res.status}).`);
          setGuided(null);
          return;
        }
        const f = data.finding as GuidedFinding | undefined;
        if (!f) {
          setGuidedError('Finding not found.');
          return;
        }
        setGuided(f);
        // Seed the patch with the recommendation so the editor isn't empty
        setPatches((p) => (p[f.id] === undefined
          ? { ...p, [f.id]: (f.recommendation || '').trim() }
          : p));
      })
      .catch(() => setGuidedError('Network error loading finding.'))
      .finally(() => setGuidedLoading(false));
  }, [findingId]);

  // Build the "file tree": each unique page URL is a folder, each
  // finding is a leaf. Findings without a URL bucket into "(no URL)".
  const tree = useMemo<PageNode[]>(() => {
    if (!bundle) return [];
    const pendingItems = bundle.findings.filter((f) => f.status === 'open' || f.status === 'in_progress');
    const byKey = new Map<string, PageNode>();
    for (const f of pendingItems) {
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
    if (findingId || activeId) return;
    const first = tree[0]?.findings[0];
    if (first) setActiveId(first.id);
  }, [tree, activeId, findingId]);

  const active = useMemo<AuditFinding | GuidedFinding | null>(() => {
    if (guided) return guided;
    if (!activeId || !bundle) return null;
    return bundle.findings.find((f) => f.id === activeId) || null;
  }, [activeId, bundle, guided]);

  const initialPatch = ((active as any)?.recommendation || '').trim();
  const patch = active ? (patches[active.id] ?? initialPatch) : '';
  const dirty = active ? patch !== initialPatch : false;
  const isJson = active ? looksLikeJson(patch) : false;
  const codeBlock = useMemo(
    () => (active ? extractCodeBlock(initialPatch) : null),
    [active, initialPatch],
  );

  const setActivePatch = (v: string) => {
    if (!active) return;
    setPatches((p) => ({ ...p, [active.id]: v }));
  };

  const updateLocal = (id: string, patchObj: Partial<AuditFinding>) => {
    setBundle((b) => b ? { ...b, findings: b.findings.map((f) => f.id === id ? { ...f, ...patchObj } : f) } : b);
    setGuided((g) => (g && g.id === id ? { ...g, ...(patchObj as Partial<GuidedFinding>) } : g));
  };

  const handleStatus = async (id: string, status: FindingStatus) => {
    const prev = bundle?.findings.find((f) => f.id === id)?.status || guided?.status;
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

  const handleApplySnippet = () => {
    if (!codeBlock) return;
    setActivePatch(codeBlock);
    pushToast('ok', 'Snippet applied to editor.');
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

  /** Guided-mode push: write via FTP API, then auto-mark the finding fixed. */
  const handleDeploy = async () => {
    if (!guided) return;
    if (!connectionId) {
      pushToast('warn', 'Pick an FTP target first.');
      return;
    }
    if (!remotePath.trim()) {
      pushToast('warn', 'Enter a remote path.');
      return;
    }
    if (!patch.trim()) {
      pushToast('warn', 'Nothing to deploy — editor is empty.');
      return;
    }

    setDeploying(true);
    try {
      const res = await fetch('/api/ftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'write',
          connectionId,
          filePath: remotePath.trim(),
          content: patch,
          auditId: guided.audit_id,
          findingId: guided.id,
          createBackup: true,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        pushToast('warn', data?.error || `Deploy failed (${res.status}).`);
        return;
      }
      pushToast('ok', data?.hadBackup ? 'Deployed (backup captured).' : 'Deployed successfully.');
      if (data?.deployLogId) setLastDeployLogId(data.deployLogId);

      // Auto-mark fixed — triggers score recalculation server-side
      await handleStatus(guided.id, 'fixed');
    } catch (err: any) {
      pushToast('warn', err?.message || 'Network error during deploy.');
    } finally {
      setDeploying(false);
    }
  };

  const handleSurgicalFix = async () => {
    if (!guided || !connectionId || !remotePath.trim() || !patch.trim()) return;
    setSurgicalLoading(true);
    setSurgicalError(null);
    setSurgicalResult(null);
    try {
      const res = await fetch('/api/surgical-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          filePath: remotePath.trim(),
          recommendation: patch,
          findingId: guided.id,
          findingTitle: guided.title,
          findingDescription: guided.description || '',
          findingCategory: '',
          pageUrl: guided.page_url || null,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setSurgicalError(data?.error || `Surgical fix failed (${res.status}).`);
        return;
      }
      setSurgicalResult(data as SurgicalFixResult);
    } catch (err: any) {
      setSurgicalError(err?.message || 'Network error generating surgical fix.');
    } finally {
      setSurgicalLoading(false);
    }
  };

  const handleSurgicalDeploy = async (finalContent: string) => {
    if (!guided || !connectionId || !remotePath.trim()) return;
    setDeploying(true);
    try {
      const res = await fetch('/api/ftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'write',
          connectionId,
          filePath: remotePath.trim(),
          content: finalContent,
          auditId: guided.audit_id,
          findingId: guided.id,
          createBackup: true,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        pushToast('warn', data?.error || `Deploy failed (${res.status}).`);
        return;
      }
      pushToast('ok', data?.hadBackup ? 'Deployed (backup captured).' : 'Deployed successfully.');
      if (data?.deployLogId) setLastDeployLogId(data.deployLogId);
      setSurgicalResult(null);
      await handleStatus(guided.id, 'fixed');
    } catch (err: any) {
      pushToast('warn', err?.message || 'Network error during deploy.');
    } finally {
      setDeploying(false);
    }
  };

  const pendingCount = useMemo(() => tree.reduce((s, n) => s + n.findings.length, 0), [tree]);

  if (authLoading || (!findingId && loading) || !ready) {
    return (
      <div>
        <div className="h-7 w-32 rounded-md animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-80 rounded animate-pulse mb-6" style={{ background: 'var(--paper-2)' }} />
        <div className="h-[420px] rounded-lg animate-pulse" style={{ background: 'var(--paper-2)' }} />
      </div>
    );
  }

  /* ── Guided mode UI ──────────────────────────────────────── */
  if (findingId) {
    return (
      <div>
        <OverviewBreadcrumb current="Deploy" />
        <div className="mb-3 flex items-center gap-2">
          <Link
            href="/dashboard/fix"
            className="inline-flex items-center gap-1 text-[11.5px] font-medium hover:underline"
            style={{ color: 'var(--m-muted)' }}
          >
            <ArrowLeft size={12} />
            Back to Fix
          </Link>
        </div>
        <div className="mb-4">
          <h1 className="text-[20px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
            Deploy fix
          </h1>
          <p className="text-[12.5px] mt-1" style={{ color: 'var(--m-muted)' }}>
            Push this fix to a connected FTP target. Nothing is sent until you click Deploy.
          </p>
        </div>

        {guidedLoading && (
          <div className="rounded-md p-6 text-[12.5px]" style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}>
            Loading finding…
          </div>
        )}

        {!guidedLoading && guidedError && (
          <div
            className="rounded-md p-4 text-[12.5px] flex items-start gap-2"
            style={{
              background: 'color-mix(in srgb, var(--warn) 6%, transparent)',
              border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)',
              color: 'var(--ink-2)',
            }}
          >
            <AlertTriangle size={14} style={{ color: 'var(--warn)' }} />
            <span>{guidedError}</span>
          </div>
        )}

        {!guidedLoading && guided && (
          <>
            {/* Context banner */}
            <div
              className="rounded-md p-3 mb-3"
              style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-[0.04em]"
                  style={{
                    background: `color-mix(in srgb, ${severityColor(guided.severity)} 12%, transparent)`,
                    color: severityColor(guided.severity),
                  }}
                >
                  {severityLabel(guided.severity)}
                </span>
                <span className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                  {guided.title}
                </span>
                {guided.page_url && (
                  <span className="ml-auto text-[11.5px]" style={{ color: 'var(--m-muted)' }}>
                    {hostnameOf(guided.page_url) || pathOf(guided.page_url)}
                  </span>
                )}
              </div>
              {guided.description && (
                <p className="mt-2 text-[12px] leading-[1.6]" style={{ color: 'var(--ink-2)' }}>
                  {guided.description}
                </p>
              )}
              {guided.recommendation && (
                <div className="mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--signal)' }}>
                    Recommended fix
                  </p>
                  <p className="text-[12px] leading-[1.6] whitespace-pre-wrap" style={{ color: 'var(--ink-2)' }}>
                    {guided.recommendation}
                  </p>
                  {codeBlock && (
                    <button
                      type="button"
                      onClick={handleApplySnippet}
                      className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-md text-[11.5px] font-medium"
                      style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                    >
                      <ClipboardPaste size={11} />
                      Apply code snippet to editor
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Deploy form */}
            <div
              className="rounded-md overflow-hidden"
              style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
            >
              <div className="px-3 py-2 flex items-center gap-2" style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--rule)' }}>
                <Upload size={12} style={{ color: 'var(--signal)' }} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--m-muted)' }}>
                  Deploy target
                </span>
              </div>

              <div className="p-3 space-y-3">
                {!provisioned ? (
                  <div className="text-[12px]" style={{ color: 'var(--m-muted)' }}>
                    FTP is not provisioned for this workspace yet.{' '}
                    <Link href="/dashboard/connect" className="underline" style={{ color: 'var(--ink)' }}>
                      Go to Connect site
                    </Link>{' '}
                    to set it up.
                  </div>
                ) : connectionsLoaded && connections.length === 0 ? (
                  <div className="text-[12px]" style={{ color: 'var(--m-muted)' }}>
                    No FTP connections for this brand yet.{' '}
                    <Link href="/dashboard/connect" className="underline" style={{ color: 'var(--ink)' }}>
                      Connect a target
                    </Link>{' '}
                    to enable deploy.
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--m-muted)' }}>
                        FTP connection
                      </label>
                      <select
                        value={connectionId}
                        onChange={(e) => setConnectionId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-signal/30 rounded-md"
                        style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                      >
                        <option value="">Select a target…</option>
                        {connections.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label} ({c.protocol.toUpperCase()} · {c.host})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--m-muted)' }}>
                        Remote file path
                      </label>
                      <input
                        type="text"
                        value={remotePath}
                        onChange={(e) => setRemotePath(e.target.value)}
                        placeholder="/path/to/file.html"
                        className="w-full px-2.5 py-1.5 text-[12px] font-mono outline-none focus-visible:ring-2 focus-visible:ring-signal/30 rounded-md"
                        style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                      />
                      {guided?.page_url && remotePath && (
                        <p className="mt-1 text-[10.5px]" style={{ color: 'var(--signal)' }}>
                          Suggested from crawled page: {guided.page_url}
                        </p>
                      )}
                      <p className="mt-1 text-[10.5px]" style={{ color: 'var(--m-muted)' }}>
                        We back up the existing file before overwriting it.
                      </p>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--m-muted)' }}>
                    Content to deploy
                  </label>
                  <textarea
                    value={patch}
                    onChange={(e) => setActivePatch(e.target.value)}
                    spellCheck={false}
                    className="w-full min-h-[200px] px-3 py-2 text-[12px] leading-[1.6] outline-none focus-visible:ring-2 focus-visible:ring-signal/30 font-mono rounded-md"
                    style={{
                      background: 'var(--paper-2)',
                      border: '1px solid var(--rule)',
                      color: 'var(--ink)',
                      resize: 'vertical',
                    }}
                    aria-label="File content"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!patch.trim()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium disabled:opacity-50"
                    style={{
                      background: copied ? 'color-mix(in srgb, var(--ok) 12%, transparent)' : 'var(--paper-2)',
                      border: '1px solid var(--rule)',
                      color: copied ? 'var(--ok)' : 'var(--ink)',
                    }}
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={!patch.trim()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium disabled:opacity-50"
                    style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
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
                    >
                      <RotateCcw size={11} />
                      Reset
                    </button>
                  )}
                  <span className="flex-1" />
                  {!surgicalResult && (
                    <>
                      <button
                        type="button"
                        onClick={handleSurgicalFix}
                        disabled={surgicalLoading || deploying || restoring || !connectionId || !remotePath.trim() || !patch.trim() || !provisioned}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-semibold disabled:opacity-50"
                        style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                      >
                        {surgicalLoading ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                        {surgicalLoading ? 'Generating fix…' : 'Generate surgical fix'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDeploy}
                        disabled={deploying || restoring || !connectionId || !remotePath.trim() || !patch.trim() || !provisioned}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium disabled:opacity-50"
                        style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
                      >
                        {deploying ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                        {deploying ? 'Deploying…' : 'Deploy snippet as-is'}
                      </button>
                    </>
                  )}
                  {lastDeployLogId && (
                    <button
                      type="button"
                      onClick={handleRollback}
                      disabled={restoring}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-semibold disabled:opacity-50"
                      style={{ background: 'transparent', border: '1px solid var(--warn)', color: 'var(--warn)' }}
                    >
                      {restoring ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                      {restoring ? 'Restoring…' : 'Undo deploy'}
                    </button>
                  )}
                </div>

                {/* Surgical fix error */}
                {surgicalError && (
                  <div
                    className="flex items-start gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md"
                    style={{
                      background: 'color-mix(in srgb, var(--warn) 8%, transparent)',
                      color: 'var(--warn)',
                    }}
                  >
                    <AlertTriangle size={11} className="mt-px flex-shrink-0" />
                    <span>{surgicalError}</span>
                  </div>
                )}

                {/* Surgical diff preview */}
                {surgicalResult && (
                  <DiffPreview
                    filePath={remotePath.trim()}
                    operation={surgicalResult.operation}
                    originalContent={surgicalResult.originalContent}
                    patchedContent={surgicalResult.patchedContent}
                    changes={surgicalResult.changes}
                    confidence={surgicalResult.confidence}
                    aiExplanation={surgicalResult.aiExplanation}
                    warning={surgicalResult.warning}
                    onApprove={handleSurgicalDeploy}
                    onCancel={() => setSurgicalResult(null)}
                    deploying={deploying}
                  />
                )}

                <p className="text-[10.5px] flex items-center gap-1.5" style={{ color: 'var(--m-muted)' }}>
                  <Lock size={10} />
                  Surgical fix reads the live file and merges your fix safely.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Toasts */}
        <ToastStack toasts={toasts} dismissToast={dismissToast} />
      </div>
    );
  }

  /* ── Default mode UI ─────────────────────────────────────── */
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
                      background: `color-mix(in srgb, ${severityColor((active as any).severity)} 12%, transparent)`,
                      color: severityColor((active as any).severity),
                    }}
                  >
                    {severityLabel((active as any).severity)}
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
                    {hostnameOf((active as any).page_url) || pathOf((active as any).page_url)}
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
                  <Link
                    href={`/dashboard/deploy?findingId=${encodeURIComponent(active.id)}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium"
                    style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                    aria-label="Open guided deploy"
                  >
                    <Upload size={11} />
                    Open guided deploy
                  </Link>
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
              </>
            ) : (
              <div className="flex-1 grid place-items-center p-6 text-[12px]" style={{ color: 'var(--m-muted)' }}>
                Select a fix from the left to start.
              </div>
            )}
          </main>
        </div>
      )}

      {/* Toasts */}
      <ToastStack toasts={toasts} dismissToast={dismissToast} />
    </div>
  );
}

function ToastStack({ toasts, dismissToast }: { toasts: Toast[]; dismissToast: (id: number) => void }) {
  return (
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
