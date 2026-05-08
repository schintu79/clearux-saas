'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Fingerprint,
  Plus,
  FileText,
  Trash2,
  Pencil,
  BookOpen,
  Upload,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

interface BrandFile {
  id: string;
  file_name: string;
  file_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
}

interface BrandIdentity {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  brand_identity_files: BrandFile[];
}

const GUIDE_ITEMS = [
  {
    title: 'Brand Bible / Style Guide',
    desc: 'Your visual identity document with logo usage, colour palette, typography, and spacing rules.',
    formats: 'PDF, DOCX',
  },
  {
    title: 'Brand Voice Document',
    desc: 'Tone of voice guidelines, messaging framework, vocabulary, and writing principles.',
    formats: 'PDF, DOCX, TXT',
  },
  {
    title: 'Brand Guidelines',
    desc: 'Overall brand strategy, mission, values, target audience profiles, and positioning.',
    formats: 'PDF, DOCX',
  },
  {
    title: 'Visual Assets',
    desc: 'Logo files, icon sets, or imagery examples that define your visual language.',
    formats: 'PNG, SVG, JPG',
  },
];

const BrandIdentityPage: React.FC = () => {
  const { user, loading: userLoading } = useAuth();
  const [identities, setIdentities] = useState<BrandIdentity[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadIdentities = async () => {
    try {
      const res = await fetch('/api/brand-identities');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setIdentities(data.identities || []);
    } catch {
      setErrorMsg('Failed to load brand identities');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadIdentities();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/brand-identities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create');
      }
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
      await loadIdentities();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create brand identity');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this brand identity and all its files? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/brand-identities/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setIdentities((prev) => prev.filter((bi) => bi.id !== id));
    } catch {
      setErrorMsg('Failed to delete brand identity');
    } finally {
      setDeletingId(null);
    }
  };

  const inputClass =
    'w-full px-4 py-2.5 border border-border rounded-xl font-body text-sm transition-all focus:outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(124,58,237,.08)] bg-input-bg text-text placeholder:text-placeholder';

  if (userLoading || dataLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-off rounded animate-pulse" />
        <div className="h-64 bg-off rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back button */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Fingerprint size={22} className="text-brand" />
            <h1 className="text-2xl font-medium font-heading text-text">Brand Identity</h1>
          </div>
          <p className="text-muted text-sm mt-1">
            Manage brand identities to audit websites against your brand guidelines.
          </p>
        </div>
        {!showCreate && (
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={14} className="mr-1.5" />
            New Brand
          </Button>
        )}
      </div>

      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-300 text-sm">{errorMsg}</p>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <Card className="mb-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <h2 className="text-base font-medium text-text">Create Brand Identity</h2>
            <div>
              <label htmlFor="bi-name" className="block text-sm font-medium text-text mb-1.5">
                Brand Name
              </label>
              <input
                id="bi-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Acme Corp, My Personal Brand"
                className={inputClass}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="bi-desc" className="block text-sm font-medium text-text mb-1.5">
                Description
              </label>
              <textarea
                id="bi-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Brief description of this brand (optional)"
                rows={2}
                className={`${inputClass} resize-none`}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="primary" size="md" type="submit" loading={creating} disabled={creating || !newName.trim()}>
                Create
              </Button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); }}
                className="text-sm text-muted hover:text-text transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Brand identities list */}
      {identities.length > 0 ? (
        <div className="space-y-3 mb-8">
          {identities.map((bi) => (
            <Card key={bi.id} hover className="group">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Fingerprint size={18} className="text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-[15px] font-medium text-text truncate">{bi.name}</h3>
                    <span className="text-[10px] text-muted bg-off px-2 py-0.5 rounded-full flex-shrink-0">
                      {bi.brand_identity_files.length} file{bi.brand_identity_files.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {bi.description && (
                    <p className="text-xs text-muted line-clamp-2 mb-2">{bi.description}</p>
                  )}
                  {bi.brand_identity_files.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {bi.brand_identity_files.slice(0, 4).map((f) => (
                        <span
                          key={f.id}
                          className="inline-flex items-center gap-1 text-[10px] text-muted bg-off px-2 py-0.5 rounded-md"
                        >
                          <FileText size={10} />
                          {f.file_name.length > 20 ? f.file_name.slice(0, 18) + '...' : f.file_name}
                        </span>
                      ))}
                      {bi.brand_identity_files.length > 4 && (
                        <span className="text-[10px] text-muted">
                          +{bi.brand_identity_files.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Link
                    href={`/dashboard/brand-identity/${bi.id}`}
                    className="p-2 rounded-lg hover:bg-surface text-muted hover:text-text transition-colors"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </Link>
                  <button
                    onClick={() => handleDelete(bi.id)}
                    disabled={deletingId === bi.id}
                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted hover:text-red-500 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                  <Link
                    href={`/dashboard/brand-identity/${bi.id}`}
                    className="p-2 rounded-lg hover:bg-surface text-muted hover:text-text transition-colors"
                  >
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        !showCreate && (
          <Card className="mb-8">
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto mb-3">
                <Fingerprint size={22} className="text-brand" />
              </div>
              <h3 className="text-base font-medium text-text mb-1">No brand identities yet</h3>
              <p className="text-sm text-muted mb-4 max-w-md mx-auto">
                Create a brand identity and upload your brand documents. When running an audit, select it to check brand consistency.
              </p>
              <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
                <Plus size={14} className="mr-1.5" />
                Create Your First Brand
              </Button>
            </div>
          </Card>
        )
      )}

      {/* Guide section */}
      <div className="mt-2">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={16} className="text-brand" />
          <h2 className="text-base font-medium text-text">What to Upload</h2>
        </div>
        <p className="text-sm text-muted mb-4">
          Upload any combination of these documents. ClearUX will use them to check if your website is consistent with your brand identity.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GUIDE_ITEMS.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-border bg-card p-4 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <Upload size={13} className="text-brand" />
                <h3 className="text-sm font-medium text-text">{item.title}</h3>
              </div>
              <p className="text-xs text-muted leading-relaxed">{item.desc}</p>
              <p className="text-[10px] text-muted/70">Formats: {item.formats}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BrandIdentityPage;
