'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Fingerprint,
  Upload,
  FileText,
  Trash2,
  Check,
  AlertCircle,
  File,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

interface BrandFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
}

interface BrandIdentityDetail {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  brand_identity_files: BrandFile[];
}

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

const BrandIdentityDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: userLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [identity, setIdentity] = useState<BrandIdentityDetail | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const loadIdentity = useCallback(async () => {
    try {
      const res = await fetch(`/api/brand-identities/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setIdentity(data.identity);
      setName(data.identity.name);
      setDescription(data.identity.description || '');
    } catch {
      setErrorMsg('Brand identity not found');
    } finally {
      setDataLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!user) return;
    loadIdentity();
  }, [user, loadIdentity]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/brand-identities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      if (!res.ok) throw new Error();
      setHasChanges(false);
      setSuccessMsg('Changes saved');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setErrorMsg('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploading(true);
    setUploadSuccess(false);
    setErrorMsg(null);

    let uploadedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setUploadProgress(
        fileArray.length === 1
          ? `Uploading ${file.name}...`
          : `Uploading ${i + 1} of ${fileArray.length}...`
      );

      if (file.size > MAX_FILE_SIZE) {
        setErrorMsg(`${file.name} exceeds 10MB limit`);
        failedCount++;
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`/api/brand-identities/${id}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Upload failed');
        }
        uploadedCount++;
      } catch (err) {
        console.error('File upload error:', err);
        failedCount++;
        setErrorMsg(`Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await loadIdentity();

    // Show success feedback
    if (uploadedCount > 0 && failedCount === 0) {
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files);
  };

  const handleDeleteFile = async (fileId: string) => {
    setDeletingFileId(fileId);
    try {
      const res = await fetch(`/api/brand-identities/${id}/files?fileId=${fileId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      setIdentity((prev) =>
        prev
          ? { ...prev, brand_identity_files: prev.brand_identity_files.filter((f) => f.id !== fileId) }
          : prev
      );
    } catch {
      setErrorMsg('Failed to delete file');
    } finally {
      setDeletingFileId(null);
    }
  };

  const inputClass =
    'w-full px-4 py-2.5 border border-border rounded-xl font-body text-sm transition-all focus:outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(17,17,17,.06)] bg-input-bg text-text placeholder:text-placeholder';

  if (userLoading || dataLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-off rounded animate-pulse" />
        <div className="h-64 bg-off rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-muted mb-4">Brand identity not found</p>
        <Link href="/dashboard/brand-identity" className="text-sm text-brand hover:underline">
          Back to Brand Identities
        </Link>
      </div>
    );
  }

  const fileCount = identity.brand_identity_files.length;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back button */}
      <Link
        href="/dashboard/brand-identity"
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
          <h1 className="text-xl font-normal font-sans" style={{ color: 'var(--ink)' }}>{identity.name}</h1>
          <p className="text-xs text-muted">
            Created {new Date(identity.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <Check size={14} className="text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-green-700 dark:text-green-300 text-sm font-medium">{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
          <p className="text-red-700 dark:text-red-300 text-sm">{errorMsg}</p>
        </div>
      )}

      {/* Single unified card */}
      <Card>
        <form onSubmit={handleSave} className="space-y-5">
          {/* Details section */}
          <div>
            <label htmlFor="bi-name" className="block text-sm font-medium text-text mb-1.5">
              Brand Name
            </label>
            <input
              id="bi-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setHasChanges(true); }}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="bi-desc" className="block text-sm font-medium text-text mb-1.5">
              Description
            </label>
            <textarea
              id="bi-desc"
              value={description}
              onChange={(e) => { setDescription(e.target.value); setHasChanges(true); }}
              placeholder="Brief description of this brand"
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Files section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-text">Brand Files</label>
              <span className="text-xs text-muted">
                {fileCount} file{fileCount !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center gap-2 px-6 py-8 rounded-xl border-2 border-dashed transition-all
                ${uploading
                  ? 'border-border bg-off cursor-wait'
                  : dragOver
                    ? 'border-brand bg-brand/5 cursor-pointer'
                    : uploadSuccess
                      ? 'border-green-400/40 dark:border-green-600/40 bg-green-50 dark:bg-green-900/20 cursor-pointer'
                      : 'border-border hover:border-brand/30 hover:bg-surface cursor-pointer'
                }
              `}
            >
              {uploading ? (
                <>
                  <Loader2 size={20} className="text-brand animate-spin" />
                  <p className="text-sm font-medium text-text">{uploadProgress}</p>
                  <p className="text-[11px] text-muted">Please wait while files are being saved</p>
                </>
              ) : uploadSuccess ? (
                <>
                  <CheckCircle2 size={20} className="text-green-600 dark:text-green-400" />
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">Files uploaded successfully</p>
                  <p className="text-[11px] text-muted">Drop more files or click to browse</p>
                </>
              ) : (
                <>
                  <Upload size={20} className={dragOver ? 'text-brand' : 'text-muted'} />
                  <p className="text-sm text-muted">Drop files here or click to browse</p>
                  <p className="text-[11px] text-muted/60">
                    PDF, DOCX, TXT, PNG, JPG, SVG, WebP — max 10MB each
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.svg,.webp"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* File list */}
            {fileCount > 0 && (
              <div className="mt-3 space-y-2">
                {identity.brand_identity_files.map((f) => (
                  <div
                    key={f.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border group transition-all ${
                      deletingFileId === f.id ? 'opacity-50' : 'bg-surface'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-off flex items-center justify-center flex-shrink-0">
                      {f.file_type && ['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(f.file_type) ? (
                        <File size={14} className="text-muted" />
                      ) : (
                        <FileText size={14} className="text-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text truncate">{f.file_name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted">
                        <span>{getFileTypeLabel(f.file_name)}</span>
                        {f.file_size_bytes && (
                          <>
                            <span className="text-border">|</span>
                            <span>{formatBytes(f.file_size_bytes)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); handleDeleteFile(f.id); }}
                      disabled={deletingFileId === f.id}
                      className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 text-muted hover:text-red-500 transition-all disabled:opacity-50"
                      title="Remove file"
                      type="button"
                    >
                      {deletingFileId === f.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Save button */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="md"
              type="submit"
              loading={saving}
              disabled={saving || !hasChanges || !name.trim()}
            >
              Save Changes
            </Button>
            {hasChanges && (
              <span className="text-xs text-muted">Unsaved changes</span>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
};

export default BrandIdentityDetailPage;
