'use client';

/**
 * /dashboard — Workspace hub.
 *
 * 3-column card grid showing all workspaces with key stats.
 * Each card links to /dashboard/[slug]/overview.
 *
 * Stripe's `?credits=purchased` callback lands here and forwards to
 * the first workspace's overview.
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Layers,
  PlusCircle,
  Globe,
  FolderOpen,
  Trash2,
  X,
  ArrowRight,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { Workspace } from '@/types/database';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import SiteFavicon from '@/components/ui/SiteFavicon';

function WorkspaceSwitcherInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);

  // Stripe callback → forward to first workspace
  useEffect(() => {
    if (searchParams.get('credits') === 'purchased' && workspaces.length > 0) {
      router.replace(`/dashboard/${workspaces[0].slug}/overview?${searchParams.toString()}`);
    }
  }, [searchParams, router, workspaces]);

  // Auto-redirect: if user has exactly one workspace and lands on /dashboard,
  // go directly to that workspace's overview.
  useEffect(() => {
    if (!loading && workspaces.length === 1 && !showCreate && !searchParams.get('credits')) {
      router.replace(`/dashboard/${workspaces[0].slug}/overview`);
    }
  }, [loading, workspaces, showCreate, router, searchParams]);

  const loadWorkspaces = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces || []);
      }
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) loadWorkspaces();
    if (!authLoading && !user) setLoading(false);
  }, [authLoading, user, loadWorkspaces]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          primary_domain: newDomain.trim() || null,
          workspace_type: newDomain.trim() ? 'website' : 'brand',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowCreate(false);
        setNewName('');
        setNewDomain('');
        router.push(`/dashboard/${data.workspace.slug}/overview`);
      }
    } catch {}
    setCreating(false);
  };

  const handleArchive = async (id: string) => {
    setArchiving(id);
    try {
      await fetch(`/api/workspaces/${id}`, { method: 'DELETE' });
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      setConfirmArchive(null);
    } catch {}
    setArchiving(null);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[14px]" style={{ color: 'var(--m-muted)' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        icon={<Layers size={18} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />}
        title="Workspaces"
        subtitle="Select a workspace to view its audits, findings, and settings."
      >
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3.5 py-[7px] rounded-md text-[13px] font-medium transition-all hover:opacity-90"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            <PlusCircle size={14} strokeWidth={1.75} />
            New workspace
          </button>
        )}
      </PageHeader>

      {/* Create workspace form */}
      {showCreate && (
        <div
          className="mb-6 rounded-lg p-5"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <h3 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
              Create workspace
            </h3>
            <button
              onClick={() => setShowCreate(false)}
              className="p-1 rounded hover:bg-black/5 transition-colors"
            >
              <X size={16} style={{ color: 'var(--m-muted)' }} />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
            <div className="flex-1">
              <label className="block text-[11px] font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--m-muted)' }}>
                Workspace name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My website"
                className="w-full px-3 py-2 rounded-md text-[14px]"
                style={{ border: '1px solid var(--rule)', background: 'var(--paper)', color: 'var(--ink)' }}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--m-muted)' }}>
                Domain (optional)
              </label>
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="example.com"
                className="w-full px-3 py-2 rounded-md text-[14px]"
                style={{ border: '1px solid var(--rule)', background: 'var(--paper)', color: 'var(--ink)' }}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-4 py-2 rounded-md text-[13px] font-medium transition-all hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workspace cards — 3-column grid */}
      {workspaces.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <div key={ws.id} className="relative group">
              <Link
                href={`/dashboard/${ws.slug}/overview`}
                className="block rounded-lg p-5 transition-all hover:shadow-sm"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--rule)',
                }}
              >
                {/* Card header: icon + name */}
                <div className="flex items-start gap-3 mb-4">
                  <span
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
                  >
                    {ws.primary_domain
                      ? <SiteFavicon hostname={ws.primary_domain} size={20} />
                      : <FolderOpen size={20} strokeWidth={1.25} style={{ color: 'var(--m-muted)' }} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold truncate leading-tight" style={{ color: 'var(--ink)' }}>
                      {ws.name}
                    </p>
                    <p className="text-[12px] truncate mt-1 leading-tight" style={{ color: 'var(--m-muted)' }}>
                      {ws.primary_domain || ws.brand_name || ws.workspace_type}
                    </p>
                  </div>
                </div>

                {/* Card stats row */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Globe size={12} strokeWidth={1.75} style={{ color: 'var(--m-muted)' }} />
                    <span className="text-[11px] font-medium" style={{ color: 'var(--ink-2)' }}>
                      {ws.workspace_type === 'brand' ? 'Brand' : ws.workspace_type === 'website_and_brand' ? 'Website + brand' : 'Website'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Activity size={12} strokeWidth={1.75} style={{ color: 'var(--m-muted)' }} />
                    <span className="text-[11px] font-medium" style={{ color: 'var(--ink-2)' }}>
                      {ws.status === 'active' ? 'Active' : 'Archived'}
                    </span>
                  </div>
                </div>

                {/* Open arrow */}
                <div
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ArrowRight size={16} strokeWidth={1.75} style={{ color: 'var(--m-muted)' }} />
                </div>
              </Link>

              {/* Archive button — bottom-right of card */}
              {confirmArchive === ws.id ? (
                <div
                  className="absolute bottom-3 right-3 flex items-center gap-2 rounded-md shadow-sm px-3 py-1.5 z-10"
                  style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
                >
                  <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>Archive?</span>
                  <button
                    onClick={(e) => { e.preventDefault(); handleArchive(ws.id); }}
                    disabled={archiving === ws.id}
                    className="text-[12px] font-medium px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
                    style={{ color: 'var(--severe)' }}
                  >
                    {archiving === ws.id ? '...' : 'Yes'}
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); setConfirmArchive(null); }}
                    className="text-[12px] px-2 py-0.5 rounded hover:bg-black/5 transition-colors"
                    style={{ color: 'var(--m-muted)' }}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.preventDefault(); setConfirmArchive(ws.id); }}
                  className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-50 transition-all z-10"
                  title="Archive workspace"
                >
                  <Trash2 size={13} style={{ color: 'var(--m-muted)' }} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        !showCreate && (
          <div
            className="rounded-lg p-12 text-center"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
            >
              <FolderOpen size={28} strokeWidth={1.25} style={{ color: 'var(--m-muted)' }} />
            </div>
            <p className="text-[16px] font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>
              No workspaces yet
            </p>
            <p className="text-[13px] mb-5 max-w-sm mx-auto" style={{ color: 'var(--m-muted)' }}>
              Create your first workspace to start auditing a website or brand.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md text-[13px] font-medium transition-all hover:opacity-90"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            >
              <PlusCircle size={14} />
              Create workspace
            </button>
          </div>
        )
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><p className="text-[14px]" style={{ color: 'var(--m-muted)' }}>Loading...</p></div>}>
      <WorkspaceSwitcherInner />
    </React.Suspense>
  );
}
