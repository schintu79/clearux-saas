'use client';

/**
 * Deploy — File browser + one-click fix deployment.
 *
 * Connects to the user's server via FTP/SFTP and provides:
 * 1. A file browser to navigate the remote file system
 * 2. A file viewer/editor for making manual changes
 * 3. Integration with audit findings for one-click fix application
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
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Server,
  Wrench,
  RotateCcw,
  Copy,
  FolderUp,
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

  // File editor state
  const [openFile, setOpenFile] = useState<{ path: string; content: string } | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);

  // Pending fixes from audit
  const [pendingFixes, setPendingFixes] = useState<PendingFix[]>([]);

  // Fetch connections
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch('/api/ftp');
        const data = await res.json();
        setConnections(data.connections || []);
        // Auto-select first connection
        if (data.connections?.length > 0 && !selectedConnection) {
          setSelectedConnection(data.connections[0]);
        }
      } catch {}
      setLoading(false);
    })();
  }, [user]);

  // Load pending fixes from URL params (when coming from audit page)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fixesParam = params.get('fixes');
    if (fixesParam) {
      try {
        const fixes = JSON.parse(decodeURIComponent(fixesParam));
        setPendingFixes(fixes);
      } catch {}
    }
  }, []);

  // Browse directory
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
      setError(err?.message || 'Failed to browse directory');
      setFiles([]);
    } finally {
      setBrowsing(false);
    }
  }, []);

  // Navigate to directory
  const navigateTo = (dirPath: string) => {
    if (!selectedConnection) return;
    setOpenFile(null);
    browse(selectedConnection, dirPath);
  };

  // Go up one level
  const goUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    navigateTo(parent);
  };

  // Open file
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

  // Save file
  const saveFile = async () => {
    if (!selectedConnection || !openFile) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch('/api/ftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'write',
          connectionId: selectedConnection.id,
          filePath: openFile.path,
          content: editedContent,
          createBackup: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSaveResult({ success: true, message: 'File saved successfully' });
      setOpenFile({ ...openFile, content: editedContent });
    } catch (err: any) {
      setSaveResult({ success: false, message: err?.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  // Apply fix from audit
  const applyFix = async (fix: PendingFix) => {
    if (!selectedConnection) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch('/api/ftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'write',
          connectionId: selectedConnection.id,
          filePath: fix.filePath,
          content: fix.fixedContent,
          findingId: fix.findingId,
          createBackup: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply fix');
      setSaveResult({ success: true, message: `Fix applied: ${fix.title}` });
      // Remove from pending
      setPendingFixes((prev) => prev.filter((f) => f.findingId !== fix.findingId));
    } catch (err: any) {
      setSaveResult({ success: false, message: err?.message || 'Fix failed' });
    } finally {
      setSaving(false);
    }
  };

  // Connect to selected server
  useEffect(() => {
    if (selectedConnection) {
      browse(selectedConnection, selectedConnection.remote_path);
    }
  }, [selectedConnection, browse]);

  // Breadcrumb parts
  const pathParts = currentPath.split('/').filter(Boolean);

  // Loading skeleton
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4 space-y-4">
        <div className="h-7 w-48 bg-off rounded animate-pulse" />
        <div className="h-64 bg-off rounded-xl animate-pulse" />
      </div>
    );
  }

  // No connections
  if (connections.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <Server size={28} className="text-muted mx-auto mb-3" />
        <h1 className="text-lg font-medium text-text mb-2">Connect your server first</h1>
        <p className="text-muted text-xs mb-5 max-w-sm mx-auto">
          Add your FTP or SFTP credentials to browse files and deploy fixes.
        </p>
        <Link
          href="/dashboard/connect"
          className="inline-flex items-center gap-1.5 bg-brand text-surface text-xs font-medium px-4 py-2 rounded-lg transition-all hover:brightness-110"
        >
          <Server size={13} /> Add connection
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-4 px-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen size={18} className="text-muted" />
            <h1 className="text-lg font-medium text-text">Deploy</h1>
          </div>
          <p className="text-muted text-xs">Browse and edit your website files. Apply audit fixes with one click.</p>
        </div>

        {/* Connection selector */}
        {connections.length > 1 && (
          <select
            value={selectedConnection?.id || ''}
            onChange={(e) => {
              const conn = connections.find((c) => c.id === e.target.value);
              if (conn) setSelectedConnection(conn);
            }}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-surface text-text"
          >
            {connections.map((c) => (
              <option key={c.id} value={c.id}>{c.label} ({c.host})</option>
            ))}
          </select>
        )}
      </div>

      {/* Pending fixes from audit */}
      {pendingFixes.length > 0 && (
        <div className="mb-4 p-4 rounded-xl border border-ok/30 bg-ok/5">
          <div className="flex items-center gap-2 mb-2">
            <Wrench size={14} className="text-ok" />
            <h3 className="text-xs font-medium text-text">{pendingFixes.length} fix{pendingFixes.length > 1 ? 'es' : ''} ready to deploy</h3>
          </div>
          <div className="space-y-2">
            {pendingFixes.map((fix) => (
              <div key={fix.findingId} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-card border border-border">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text truncate">{fix.title}</p>
                  <p className="text-[11px] text-muted truncate">{fix.filePath}</p>
                </div>
                <button
                  onClick={() => applyFix(fix)}
                  disabled={saving}
                  className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-ok/10 text-ok border border-ok/20 hover:bg-ok/20 transition-colors disabled:opacity-40"
                >
                  {saving ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save/error feedback */}
      {saveResult && (
        <div className={`mb-4 flex items-center gap-2 p-3 rounded-lg text-xs ${
          saveResult.success ? 'bg-ok/10 text-ok border border-ok/20' : 'bg-severe/10 text-severe border border-severe/20'
        }`}>
          {saveResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>{saveResult.message}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg text-xs bg-severe/10 text-severe border border-severe/20">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* File browser panel */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-off/50 overflow-x-auto">
            <button onClick={() => navigateTo('/')} className="text-[11px] text-muted hover:text-text flex-shrink-0">
              /
            </button>
            {pathParts.map((part, i) => (
              <React.Fragment key={i}>
                <ChevronRight size={10} className="text-muted/40 flex-shrink-0" />
                <button
                  onClick={() => navigateTo('/' + pathParts.slice(0, i + 1).join('/'))}
                  className="text-[11px] text-muted hover:text-text flex-shrink-0"
                >
                  {part}
                </button>
              </React.Fragment>
            ))}
            {browsing && <Loader2 size={10} className="text-brand animate-spin ml-auto" />}
          </div>

          {/* File list */}
          <div className="max-h-[500px] overflow-y-auto divide-y divide-border/50">
            {currentPath !== '/' && (
              <button
                onClick={goUp}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-off/50 transition-colors"
              >
                <FolderUp size={14} className="text-muted" />
                <span className="text-xs text-muted">..</span>
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
                return (
                  <button
                    key={file.path}
                    onClick={() => {
                      if (file.type === 'directory') navigateTo(file.path);
                      else if (isTextFile(file.name)) openRemoteFile(file.path);
                    }}
                    disabled={!isClickable}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                      isClickable ? 'hover:bg-off/50 cursor-pointer' : 'opacity-50 cursor-default'
                    } ${openFile?.path === file.path ? 'bg-brand/5 border-l-2 border-brand' : ''}`}
                  >
                    <Icon size={14} className={file.type === 'directory' ? 'text-brand' : 'text-muted'} />
                    <span className="text-xs text-text truncate flex-1">{file.name}</span>
                    {file.type === 'file' && (
                      <span className="text-[10px] text-muted flex-shrink-0">{formatSize(file.size)}</span>
                    )}
                  </button>
                );
              })}
            {files.length === 0 && !browsing && (
              <div className="px-3 py-6 text-center">
                <p className="text-xs text-muted">Empty directory</p>
              </div>
            )}
          </div>
        </div>

        {/* Editor panel */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card overflow-hidden">
          {fileLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={20} className="text-brand animate-spin" />
            </div>
          ) : openFile ? (
            <>
              {/* Editor toolbar */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-off/50">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCode size={12} className="text-muted flex-shrink-0" />
                  <span className="text-[11px] text-text truncate">{openFile.path}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setEditedContent(openFile.content); }}
                    className="p-1.5 text-muted hover:text-text transition-colors"
                    title="Revert changes"
                  >
                    <RotateCcw size={12} />
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(editedContent)}
                    className="p-1.5 text-muted hover:text-text transition-colors"
                    title="Copy"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    onClick={saveFile}
                    disabled={saving || editedContent === openFile.content}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-brand text-surface disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
                  >
                    {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                    Save
                  </button>
                </div>
              </div>
              {/* Code editor */}
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-[440px] px-4 py-3 text-[12px] leading-relaxed font-mono bg-surface text-text resize-none focus:outline-none"
                spellCheck={false}
              />
              {editedContent !== openFile.content && (
                <div className="px-3 py-1.5 border-t border-border bg-warn/5">
                  <p className="text-[10px] text-warn">Unsaved changes</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <FileCode size={24} className="text-muted mx-auto mb-2" />
                <p className="text-xs text-muted">Select a file to view and edit</p>
                <p className="text-[11px] text-muted/60 mt-1">Supports HTML, CSS, JS, PHP, and other text files</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connection info footer */}
      {selectedConnection && (
        <div className="mt-4 flex items-center justify-between text-[11px] text-muted">
          <span>
            Connected to {selectedConnection.host} via {selectedConnection.protocol.toUpperCase()}
          </span>
          <Link href="/dashboard/connect" className="hover:text-text transition-colors">
            Manage connections
          </Link>
        </div>
      )}
    </div>
  );
}
