'use client';

/**
 * Deploy — Compact file browser + one-click fix deployment.
 *
 * Clean, functional console. File tree left, editor right.
 * No bloat, no repetition.
 */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FolderOpen,
  File,
  FileCode,
  FileText,
  Image as ImageIcon,
  ChevronRight,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Server,
  Wrench,
  RotateCcw,
  Copy,
  FolderUp,
  Check,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';

interface RemoteFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string | null;
}

interface Connection {
  id: string;
  label: string;
  protocol: string;
  host: string;
  port: number;
  username: string;
  remote_path: string;
}

interface PendingFix {
  findingId: string;
  title: string;
  filePath: string;
  originalContent: string;
  fixedContent: string;
  description: string;
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['html', 'htm', 'php', 'js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'json', 'xml', 'svg'].includes(ext || ''))
    return FileCode;
  if (['md', 'txt', 'log', 'env', 'htaccess', 'conf', 'yaml', 'yml', 'toml'].includes(ext || ''))
    return FileText;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp'].includes(ext || ''))
    return ImageIcon;
  return File;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isTextFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase();
  const textExts = ['html', 'htm', 'php', 'js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'json', 'xml', 'svg', 'md', 'txt', 'log', 'env', 'htaccess', 'conf', 'yaml', 'yml', 'toml', 'csv', 'sql', 'py', 'rb', 'sh', 'bat'];
  return textExts.includes(ext || '');
}

export default function DeployPage() {
  const { user } = useAuth();
  const { selection } = useBrandSelection();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [browsing, setBrowsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openFile, setOpenFile] = useState<{ path: string; content: string } | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingFixes, setPendingFixes] = useState<PendingFix[]>([]);

  // Fetch connections
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch('/api/ftp');
        const data = await res.json();
        setConnections(data.connections || []);
        if (data.connections?.length > 0 && !selectedConnection) {
          setSelectedConnection(data.connections[0]);
        }
      } catch {}
      setLoading(false);
    })();
  }, [user]);

  // Load pending fixes from URL params
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fixesParam = params.get('fixes');
    if (fixesParam) {
      try { setPendingFixes(JSON.parse(decodeURIComponent(fixesParam))); } catch {}
    }
  }, []);

  const browse = useCallback(async (conn: Connection, dirPath: string) => {
    setBrowsing(true);
    setError(null);
    try {
      const res = await fetch('/api/ftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', connectionId: conn.id, dirPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to list files');
      setFiles(data.files || []);
      setCurrentPath(data.currentPath || dirPath);
    } catch (err: any) {
      setError(err?.message || 'Failed to browse');
      setFiles([]);
    } finally {
      setBrowsing(false);
    }
  }, []);

  const navigateTo = (dirPath: string) => {
    if (!selectedConnection) return;
    setOpenFile(null);
    setSaveResult(null);
    browse(selectedConnection, dirPath);
  };

  const goUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    navigateTo(parent);
  };

  const openRemoteFile = async (filePath: string) => {
    if (!selectedConnection) return;
    setFileLoading(true);
    setSaveResult(null);
    try {
      const res = await fetch('/api/ftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read', connectionId: selectedConnection.id, filePath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to read file');
      setOpenFile({ path: filePath, content: data.content });
      setEditedContent(data.content);
    } catch (err: any) {
      setError(err?.message || 'Failed to open file');
    } finally {
      setFileLoading(false);
    }
  };

  const saveFile = async () => {
    if (!selectedConnection || !openFile) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch('/api/ftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'write', connectionId: selectedConnection.id,
          filePath: openFile.path, content: editedContent, createBackup: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSaveResult({ success: true, message: 'Saved' });
      setOpenFile({ ...openFile, content: editedContent });
    } catch (err: any) {
      setSaveResult({ success: false, message: err?.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const applyFix = async (fix: PendingFix) => {
    if (!selectedConnection) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch('/api/ftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'write', connectionId: selectedConnection.id,
          filePath: fix.filePath, content: fix.fixedContent,
          findingId: fix.findingId, createBackup: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply fix');
      setSaveResult({ success: true, message: `Applied: ${fix.title}` });
      setPendingFixes((prev) => prev.filter((f) => f.findingId !== fix.findingId));
    } catch (err: any) {
      setSaveResult({ success: false, message: err?.message || 'Fix failed' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (selectedConnection) browse(selectedConnection, selectedConnection.remote_path);
  }, [selectedConnection, browse]);

  const pathParts = currentPath.split('/').filter(Boolean);
  const hasChanges = openFile && editedContent !== openFile.content;

  const handleCopy = () => {
    navigator.clipboard.writeText(editedContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div>
        <div className="h-7 w-32 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-4 w-64 rounded-md animate-pulse mb-6" style={{ background: 'var(--paper-2)' }} />
        <div className="h-[400px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
      </div>
    );
  }

  /* ── No connections ── */
  if (connections.length === 0) {
    return (
      <div className="py-12 text-center">
        <Server size={24} style={{ color: 'var(--m-muted)' }} className="mx-auto mb-3" />
        <h1 className="text-[16px] font-semibold" style={{ color: 'var(--ink)' }}>Connect your server</h1>
        <p className="text-[12px] mt-1 mb-5 max-w-xs mx-auto" style={{ color: 'var(--m-muted)' }}>
          Add FTP or SFTP credentials to browse files and deploy fixes.
        </p>
        <Link
          href="/dashboard/connect"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold"
          style={{ background: 'var(--ink)', color: 'var(--paper)' }}
        >
          <Server size={13} /> Add connection
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Deploy</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
            Browse files and apply fixes.
            {selectedConnection && (
              <span> Connected to <span className="font-medium" style={{ color: 'var(--ink)' }}>{selectedConnection.host}</span></span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connections.length > 1 && (
            <select
              value={selectedConnection?.id || ''}
              onChange={(e) => {
                const conn = connections.find((c) => c.id === e.target.value);
                if (conn) setSelectedConnection(conn);
              }}
              className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg outline-none"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          )}
          <Link
            href="/dashboard/connect"
            className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:bg-paper-2"
            style={{ color: 'var(--m-muted)', border: '1px solid var(--rule)' }}
          >
            Settings
          </Link>
        </div>
      </div>

      {/* ── Pending fixes bar ── */}
      {pendingFixes.length > 0 && (
        <div
          className="mb-4 rounded-lg px-4 py-2.5"
          style={{ background: 'color-mix(in srgb, var(--ok) 6%, var(--card))', border: '1px solid color-mix(in srgb, var(--ok) 20%, transparent)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Wrench size={12} style={{ color: 'var(--ok)' }} />
            <span className="text-[11px] font-semibold" style={{ color: 'var(--ok)' }}>{pendingFixes.length} fix{pendingFixes.length > 1 ? 'es' : ''} ready</span>
          </div>
          <div className="space-y-1">
            {pendingFixes.map((fix) => (
              <div key={fix.findingId} className="flex items-center justify-between gap-2 py-1">
                <div className="min-w-0">
                  <span className="text-[12px] font-medium truncate block" style={{ color: 'var(--ink)' }}>{fix.title}</span>
                  <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>{fix.filePath}</span>
                </div>
                <button
                  onClick={() => applyFix(fix)}
                  disabled={saving}
                  className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-md transition-colors disabled:opacity-40"
                  style={{ background: 'color-mix(in srgb, var(--ok) 12%, transparent)', color: 'var(--ok)' }}
                >
                  {saving ? <Loader2 size={9} className="animate-spin" /> : <CheckCircle2 size={9} />}
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Feedback toast ── */}
      {saveResult && (
        <div
          className="mb-3 flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[11px]"
          style={{
            background: saveResult.success ? 'color-mix(in srgb, var(--ok) 8%, var(--card))' : 'color-mix(in srgb, var(--severe) 8%, var(--card))',
            color: saveResult.success ? 'var(--ok)' : 'var(--severe)',
            border: `1px solid ${saveResult.success ? 'color-mix(in srgb, var(--ok) 20%, transparent)' : 'color-mix(in srgb, var(--severe) 20%, transparent)'}`,
          }}
        >
          <div className="flex items-center gap-1.5">
            {saveResult.success ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            <span>{saveResult.message}</span>
          </div>
          <button onClick={() => setSaveResult(null)} className="p-0.5 rounded hover:opacity-70">
            <X size={10} />
          </button>
        </div>
      )}

      {error && (
        <div
          className="mb-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px]"
          style={{ background: 'color-mix(in srgb, var(--severe) 8%, var(--card))', color: 'var(--severe)', border: '1px solid color-mix(in srgb, var(--severe) 20%, transparent)' }}
        >
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Console: file tree + editor ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--rule)', background: 'var(--card)' }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr]" style={{ minHeight: '420px' }}>
          {/* ── File tree ── */}
          <div style={{ borderRight: '1px solid var(--rule)' }}>
            {/* Breadcrumb */}
            <div
              className="flex items-center gap-0.5 px-3 py-1.5 overflow-x-auto text-[10px]"
              style={{ borderBottom: '1px solid var(--rule)', background: 'var(--paper-2)' }}
            >
              <button onClick={() => navigateTo('/')} className="hover:underline" style={{ color: 'var(--m-muted)' }}>/</button>
              {pathParts.map((part, i) => (
                <React.Fragment key={i}>
                  <ChevronRight size={8} style={{ color: 'var(--rule)' }} className="flex-shrink-0" />
                  <button
                    onClick={() => navigateTo('/' + pathParts.slice(0, i + 1).join('/'))}
                    className="hover:underline flex-shrink-0"
                    style={{ color: i === pathParts.length - 1 ? 'var(--ink)' : 'var(--m-muted)' }}
                  >
                    {part}
                  </button>
                </React.Fragment>
              ))}
              {browsing && <Loader2 size={9} className="animate-spin ml-auto flex-shrink-0" style={{ color: 'var(--signal)' }} />}
            </div>

            {/* File list */}
            <div className="overflow-y-auto" style={{ maxHeight: '388px' }}>
              {currentPath !== '/' && (
                <button
                  onClick={goUp}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-paper-2/40"
                  style={{ borderBottom: '1px solid color-mix(in srgb, var(--rule) 40%, transparent)' }}
                >
                  <FolderUp size={12} style={{ color: 'var(--m-muted)' }} />
                  <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>..</span>
                </button>
              )}
              {files
                .sort((a, b) => {
                  if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                  return a.name.localeCompare(b.name);
                })
                .map((file) => {
                  const Icon = file.type === 'directory' ? FolderOpen : fileIcon(file.name);
                  const isClickable = file.type === 'directory' || isTextFile(file.name);
                  const isActive = openFile?.path === file.path;
                  return (
                    <button
                      key={file.path}
                      onClick={() => {
                        if (file.type === 'directory') navigateTo(file.path);
                        else if (isTextFile(file.name)) openRemoteFile(file.path);
                      }}
                      disabled={!isClickable}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors"
                      style={{
                        borderBottom: '1px solid color-mix(in srgb, var(--rule) 40%, transparent)',
                        background: isActive ? 'color-mix(in srgb, var(--signal) 8%, transparent)' : 'transparent',
                        opacity: isClickable ? 1 : 0.4,
                        cursor: isClickable ? 'pointer' : 'default',
                      }}
                    >
                      <Icon size={12} style={{ color: file.type === 'directory' ? 'var(--signal)' : 'var(--m-muted)' }} />
                      <span className="text-[11px] truncate flex-1" style={{ color: isActive ? 'var(--signal)' : 'var(--ink)' }}>{file.name}</span>
                      {file.type === 'file' && (
                        <span className="text-[9px] flex-shrink-0" style={{ color: 'var(--m-muted)' }}>{formatSize(file.size)}</span>
                      )}
                    </button>
                  );
                })}
              {files.length === 0 && !browsing && (
                <div className="px-3 py-6 text-center">
                  <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>Empty</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Editor ── */}
          <div className="flex flex-col">
            {fileLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={18} className="animate-spin" style={{ color: 'var(--signal)' }} />
              </div>
            ) : openFile ? (
              <>
                {/* Toolbar */}
                <div
                  className="flex items-center justify-between px-3 py-1.5"
                  style={{ borderBottom: '1px solid var(--rule)', background: 'var(--paper-2)' }}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileCode size={11} style={{ color: 'var(--m-muted)' }} />
                    <span className="text-[11px] truncate" style={{ color: 'var(--ink)' }}>{openFile.path.split('/').pop()}</span>
                    {hasChanges && (
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--warn)' }} />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditedContent(openFile.content)}
                      className="p-1 rounded transition-colors hover:bg-paper-2"
                      style={{ color: 'var(--m-muted)' }}
                      title="Revert"
                    >
                      <RotateCcw size={11} />
                    </button>
                    <button
                      onClick={handleCopy}
                      className="p-1 rounded transition-colors hover:bg-paper-2"
                      style={{ color: copied ? 'var(--ok)' : 'var(--m-muted)' }}
                      title="Copy"
                    >
                      {copied ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                    <button
                      onClick={saveFile}
                      disabled={saving || !hasChanges}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all disabled:opacity-30"
                      style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                    >
                      {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                      Save
                    </button>
                  </div>
                </div>
                {/* Code area */}
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="flex-1 w-full px-3 py-2.5 text-[11px] leading-relaxed font-mono resize-none focus:outline-none"
                  style={{ background: 'var(--card)', color: 'var(--ink)', minHeight: '360px' }}
                  spellCheck={false}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <FileCode size={20} style={{ color: 'var(--m-muted)' }} className="mx-auto mb-2" />
                  <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>Select a file to edit</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
