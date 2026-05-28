'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Fingerprint,
  Upload,
  FileText,
  File,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import Button from '@/components/ui/Button';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'image/webp',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const GUIDE_ITEMS = [
  {
    title: 'Brand Bible / Style Guide',
    desc: 'Logo usage, colour palette, typography, spacing rules.',
    formats: 'PDF, DOCX',
  },
  {
    title: 'Brand Voice Document',
    desc: 'Tone of voice, messaging framework, writing principles.',
    formats: 'PDF, DOCX, TXT',
  },
  {
    title: 'Brand Guidelines',
    desc: 'Mission, values, target audience, positioning.',
    formats: 'PDF, DOCX',
  },
  {
    title: 'Visual Assets',
    desc: 'Logo files, icon sets, or imagery examples.',
    formats: 'PNG, SVG, JPG',
  },
];

interface StagedFile {
  file: File;
  id: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeLabel(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    pdf: 'PDF', docx: 'DOCX', doc: 'DOC', txt: 'TXT',
    png: 'PNG', jpg: 'JPG', jpeg: 'JPG', svg: 'SVG', webp: 'WebP',
  };
  return map[ext] || ext.toUpperCase();
}

const NewBrandPage: React.FC = () => {
  const router = useRouter();
  const { user, loading: userLoading } = useAuth();
  const { workspaceSlug } = useWorkspace();
  const dashPrefix = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [creating, setCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const valid: StagedFile[] = [];

    for (const file of fileArray) {
      if (file.size > MAX_FILE_SIZE) {
        setErrorMsg(`${file.name} exceeds 10MB limit`);
        continue;
      }
      valid.push({ file, id: `${file.name}-${Date.now()}-${Math.random()}` });
    }

    setStagedFiles((prev) => [...prev, ...valid]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setErrorMsg(null);

    try {
      // 1. Create the brand identity
      const res = await fetch('/api/brand-identities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create');
      }

      const { identity } = await res.json();
      const brandId = identity.id;

      // 2. Upload staged files
      if (stagedFiles.length > 0) {
        for (let i = 0; i < stagedFiles.length; i++) {
          const sf = stagedFiles[i];
          setUploadProgress(
            stagedFiles.length === 1
              ? `Uploading ${sf.file.name}...`
              : `Uploading ${i + 1} of ${stagedFiles.length}...`
          );

          const formData = new FormData();
          formData.append('file', sf.file);

          const uploadRes = await fetch(`/api/brand-identities/${brandId}/upload`, {
            method: 'POST',
            body: formData,
          });

          if (!uploadRes.ok) {
            console.error(`Failed to upload ${sf.file.name}`);
          }
        }
      }

      // 3. Navigate to the brand detail page
      router.push(`${dashPrefix}/brand-identity/${brandId}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create brand identity');
      setCreating(false);
      setUploadProgress(null);
    }
  };

  const inputClass =
    'w-full px-4 py-2.5 border border-border rounded-xl font-body text-sm transition-all focus:outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(124,58,237,.08)] bg-input-bg text-text placeholder:text-placeholder';

  if (userLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-off rounded animate-pulse" />
        <div className="h-64 bg-off rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back button */}
      <Link
        href={`${dashPrefix}/brand-identity`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Brand Identities
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
          <Fingerprint size={20} className="text-brand" />
        </div>
        <div>
          <h1 className="text-xl font-normal font-sans" style={{ color: 'var(--ink)' }}>New Brand Identity</h1>
          <p className="text-xs text-muted">
            Set up your brand and upload documents for auditing.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 20%, transparent)' }}>
          <AlertCircle size={14} className="flex-shrink-0" style={{ color: 'var(--severe)' }} />
          <p className="text-sm" style={{ color: 'var(--severe)' }}>{errorMsg}</p>
        </div>
      )}

      {/* Unified card */}
      <form onSubmit={handleCreate}>
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="bi-name" className="block text-sm font-medium text-text mb-1.5">
              Brand Name
            </label>
            <input
              id="bi-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp, My Personal Brand"
              className={inputClass}
              autoFocus
              disabled={creating}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="bi-desc" className="block text-sm font-medium text-text mb-1.5">
              Description
            </label>
            <textarea
              id="bi-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this brand (optional)"
              rows={2}
              className={`${inputClass} resize-none`}
              disabled={creating}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Files section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-text">Brand Files</label>
              {stagedFiles.length > 0 && (
                <span className="text-xs text-muted">
                  {stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''} selected
                </span>
              )}
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !creating && fileInputRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center gap-2 px-6 py-6 rounded-xl border-2 border-dashed transition-all
                ${creating
                  ? 'border-border bg-off cursor-wait'
                  : dragOver
                    ? 'border-brand bg-brand/5 cursor-pointer'
                    : 'border-border hover:border-brand/30 hover:bg-surface cursor-pointer'
                }
              `}
            >
              <Upload size={18} className={dragOver ? 'text-brand' : 'text-muted'} />
              <p className="text-sm text-muted">Drop files here or click to browse</p>
              <p className="text-[11px] text-muted/60">
                PDF, DOCX, TXT, PNG, JPG, SVG, WebP — max 10MB each
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.svg,.webp"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Staged file list */}
            {stagedFiles.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {stagedFiles.map((sf) => (
                  <div
                    key={sf.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-surface group"
                  >
                    <div className="w-7 h-7 rounded-md bg-off flex items-center justify-center flex-shrink-0">
                      {['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(
                        sf.file.name.split('.').pop()?.toLowerCase() || ''
                      ) ? (
                        <File size={12} className="text-muted" />
                      ) : (
                        <FileText size={12} className="text-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text truncate">{sf.file.name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted">
                        <span>{getFileTypeLabel(sf.file.name)}</span>
                        <span className="text-border">|</span>
                        <span>{formatBytes(sf.file.size)}</span>
                      </div>
                    </div>
                    {!creating && (
                      <button
                        type="button"
                        onClick={() => removeFile(sf.id)}
                        className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-50 text-muted hover:text-red-500 transition-all"
                        title="Remove"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Guide — what to upload */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={13} className="text-brand" />
              <h3 className="text-xs font-medium text-text">What to Upload</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GUIDE_ITEMS.map((item) => (
                <div key={item.title} className="space-y-0.5">
                  <p className="text-xs font-medium text-text">{item.title}</p>
                  <p className="text-[11px] text-muted leading-relaxed">{item.desc}</p>
                  <p className="text-[10px] text-muted/60">{item.formats}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Submit */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="md"
              type="submit"
              loading={creating}
              disabled={creating || !name.trim()}
            >
              {creating
                ? uploadProgress || 'Creating...'
                : stagedFiles.length > 0
                  ? `Create Brand & Upload ${stagedFiles.length} File${stagedFiles.length !== 1 ? 's' : ''}`
                  : 'Create Brand'
              }
            </Button>
            {!creating && (
              <Link
                href={`${dashPrefix}/brand-identity`}
                className="text-sm text-muted hover:text-text transition-colors"
              >
                Cancel
              </Link>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default NewBrandPage;
