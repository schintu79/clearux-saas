'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Fingerprint,
  Plus,
  FileText,
  Trash2,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';

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

function getFileTypeLabel(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    pdf: 'PDF', docx: 'DOCX', doc: 'DOC', txt: 'TXT',
    png: 'PNG', jpg: 'JPG', jpeg: 'JPG', svg: 'SVG', webp: 'WebP',
  };
  return map[ext] || ext.toUpperCase();
}

const BrandIdentityPage: React.FC = () => {
  const { user, loading: userLoading } = useAuth();
  const [identities, setIdentities] = useState<BrandIdentity[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
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

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
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

  if (userLoading || dataLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-off rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-off rounded-xl animate-pulse" />
          ))}
        </div>
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
            <Fingerprint size={22} style={{ color: 'var(--ink)' }} />
            <h1 className="text-2xl font-normal font-sans" style={{ color: 'var(--ink)' }}>Brand Identity</h1>
          </div>
          <p className="text-muted text-sm mt-1 pl-[34px]">
            Manage brand identities to audit websites against your brand guidelines.
          </p>
        </div>
        <Link href="/dashboard/brand-identity/new">
          <Button variant="primary" size="md">
            <Plus size={14} className="mr-1.5" />
            New Brand
          </Button>
        </Link>
      </div>

      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-300 text-sm">{errorMsg}</p>
        </div>
      )}

      {/* Brand identities list */}
      {identities.length > 0 ? (
        <div className="space-y-2">
          {identities.map((bi) => (
            <Link
              key={bi.id}
              href={`/dashboard/brand-identity/${bi.id}`}
              className="block rounded-xl hover:bg-surface transition-all group"
              style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-lg bg-off flex items-center justify-center flex-shrink-0">
                  <Fingerprint size={16} style={{ color: 'var(--ink)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-text truncate">{bi.name}</h3>
                    <span className="text-[11px] text-muted bg-off px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {bi.brand_identity_files.length} file{bi.brand_identity_files.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {bi.brand_identity_files.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {bi.brand_identity_files.slice(0, 5).map((f) => (
                        <span
                          key={f.id}
                          className="inline-flex items-center gap-1 text-[10px] text-muted bg-off px-1.5 py-0.5 rounded"
                        >
                          <FileText size={9} />
                          {f.file_name.length > 16 ? f.file_name.slice(0, 14) + '...' : f.file_name}
                        </span>
                      ))}
                      {bi.brand_identity_files.length > 5 && (
                        <span className="text-[10px] text-muted py-0.5">
                          +{bi.brand_identity_files.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => handleDelete(e, bi.id)}
                    disabled={deletingId === bi.id}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted hover:text-red-500 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                  <ChevronRight size={14} className="text-muted group-hover:text-text transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl" style={{ border: '1px solid var(--rule)', background: 'var(--paper)' }}>
          <div className="text-center py-12 px-6">
            <div className="w-12 h-12 rounded-2xl bg-off flex items-center justify-center mx-auto mb-3">
              <Fingerprint size={22} style={{ color: 'var(--ink)' }} />
            </div>
            <h3 className="text-base font-medium text-text mb-1">No brand identities yet</h3>
            <p className="text-sm text-muted mb-5 max-w-md mx-auto">
              Create a brand identity and upload your brand documents. When running an audit, select it to check brand consistency.
            </p>
            <Link href="/dashboard/brand-identity/new">
              <Button variant="primary" size="md">
                <Plus size={14} className="mr-1.5" />
                Create Your First Brand
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandIdentityPage;
