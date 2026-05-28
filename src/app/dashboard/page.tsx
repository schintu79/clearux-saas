'use client';

/**
 * /dashboard — Workspace switcher page.
 *
 * Lists all workspaces the user owns with their latest audit status.
 * Each workspace card links to /dashboard/[slug]/overview.
 * Users can create new workspaces from here.
 *
 * Stripe's `?credits=purchased` callback lands here and forwards to
 * the first workspace's overview.
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Layers } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PlusCircle,
  Globe,
  Fingerprint,
  ChevronRight,
  FolderOpen,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { Workspace } from '@/types/database';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import DashCard from '@/components/dashboard/v2/DashCard';
import SiteFavicon from '@/components/ui/SiteFavicon';
import { scoreColor } from '@/components/dashboard/v2/score-utils';

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
        subtitle="Each workspace contains one brand or website with its own audits, findings, and settings."
      />

      {/* Create workspace form */}
      {showCreate && (
        <DashCard className="mb-6">
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
          <div className="space-y-3 max-w-md">
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: 'var(--ink-2)' }}>
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
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: 'var(--ink-2)' }}>
                Domain (optional)
              </label>
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="example.com"
                className="w-full px-3 py-2 rounded-md text-[14px]"
                style={{ border: '1px solid var(--rule)', background: 'var(--paper)', color: 'var(--ink)' }}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-4 py-2 rounded-md text-[13px] font-medium transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            >
              {creating ? 'Creating...' : 'Create workspace'}
            </button>
          </div>
        </DashCard>
      )}

      {/* Workspace list */}
      <div className="space-y-2">
        {workspaces.map((ws) => (
          <div key={ws.id} className="relative group">
            <Link
              href={`/dashboard/${ws.slug}/overview`}
              className="flex items-center gap-4 px-4 py-4 rounded-lg transition-colors hover:bg-black/[0.02]"
              style={{ border: '1px solid var(--rule)', background: 'var(--card)' }}
            >
              <span
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
              >
                {ws.primary_domain
                  ? <SiteFavicon hostname={ws.primary_domain} size={18} />
                  : <FolderOpen size={18} strokeWidth={1.5} style={{ color: 'var(--m-muted)' }} />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                  {ws.name}
                </p>
                <p className="text-[12px] truncate mt-0.5" style={{ color: 'var(--m-muted)' }}>
                  {ws.primary_domain || ws.workspace_type}
                </p>
              </div>
              <ChevronRight size={16} style={{ color: 'var(--m-muted)' }} />
            </Link>

            {/* Archive button */}
            {confirmArchive === ws.id ? (
              <div className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-white rounded-md shadow-sm px-3 py-1.5" style={{ border: '1px solid var(--rule)' }}>
                <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>Archive?</span>
                <button
                  onClick={() => handleArchive(ws.id)}
                  disabled={archiving === ws.id}
                  className="text-[12px] font-medium px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
                  style={{ color: 'var(--severe)' }}
                >
                  {archiving === ws.id ? '...' : 'Yes'}
                </button>
                <button
                  onClick={() => setConfirmArchive(null)}
                  className="text-[12px] px-2 py-0.5 rounded hover:bg-black/5 transition-colors"
                  style={{ color: 'var(--m-muted)' }}
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.preventDefault(); setConfirmArchive(ws.id); }}
                className="absolute right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-50 transition-all"
                title="Archive workspace"
              >
                <Trash2 size={14} style={{ color: 'var(--m-muted)' }} />
              </button>
            )}
          </div>
        ))}

        {workspaces.length === 0 && !showCreate && (
          <DashCard>
            <div className="text-center py-8">
              <FolderOpen size={32} strokeWidth={1.25} className="mx-auto mb-3" style={{ color: 'var(--m-muted)' }} />
              <p className="text-[15px] font-medium mb-1" style={{ color: 'var(--ink)' }}>
                No workspaces yet
              </p>
              <p className="text-[13px] mb-4" style={{ color: 'var(--m-muted)' }}>
                Create your first workspace to start auditing a website or brand.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium transition-all hover:opacity-90"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                <PlusCircle size={14} />
                Create workspace
              </button>
            </div>
          </DashCard>
        )}
      </div>

      {/* Add workspace button */}
      {!showCreate && workspaces.length > 0 && (
        <button
          onClick={() => setShowCreate(true)}
          className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium transition-colors hover:bg-black/[0.04]"
          style={{ color: 'var(--ink-2)', border: '1px solid var(--rule)' }}
        >
          <PlusCircle size={14} />
          Add workspace
        </button>
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
