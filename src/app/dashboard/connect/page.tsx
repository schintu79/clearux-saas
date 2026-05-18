'use client';

/**
 * Connect — FTP/SFTP settings page.
 *
 * Scoped to the current brand selection. Each brand has its own
 * set of server connections.
 *
 * Fixes:
 * - Password show/hide toggle works correctly
 * - Test connection always available (uses stored password when editing)
 * - Connections scoped to current brand, not global
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Server,
  Plus,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  Loader2,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  Shield,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';

interface SavedConnection {
  id: string;
  label: string;
  protocol: string;
  host: string;
  port: number;
  username: string;
  remote_path: string;
  brand_identity_id: string | null;
  last_connected_at: string | null;
  created_at: string;
}

interface FormState {
  label: string;
  protocol: 'sftp' | 'ftp' | 'ftps';
  host: string;
  port: string;
  username: string;
  password: string;
  remotePath: string;
}

const DEFAULT_FORM: FormState = {
  label: 'My server',
  protocol: 'sftp',
  host: '',
  port: '22',
  username: '',
  password: '',
  remotePath: '/',
};

export default function ConnectPage() {
  const { user } = useAuth();
  const { selection, ready } = useBrandSelection();

  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Get brand ID for scoping
  const brandId = selection?.kind === 'brand' ? selection.brandId : null;

  const fetchConnections = useCallback(async () => {
    try {
      const url = brandId ? `/api/ftp?brandId=${brandId}` : '/api/ftp';
      const res = await fetch(url);
      const data = await res.json();
      setConnections(data.connections || []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    if (user && ready) fetchConnections();
  }, [user, ready, fetchConnections]);

  const handleProtocolChange = (protocol: 'sftp' | 'ftp' | 'ftps') => {
    setForm((prev) => ({
      ...prev,
      protocol,
      port: protocol === 'sftp' ? '22' : '21',
    }));
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          protocol: form.protocol,
          host: form.host,
          port: parseInt(form.port) || (form.protocol === 'sftp' ? 22 : 21),
          username: form.username,
          password: form.password || undefined,
          remotePath: form.remotePath,
          // Pass connectionId so API can use stored password when editing
          connectionId: editingId || undefined,
        }),
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.success
          ? `Connected. Found ${data.fileCount} items in ${form.remotePath}`
          : data.error || 'Connection failed',
      });
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Network error' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        action: editingId ? 'update' : 'save',
        label: form.label,
        protocol: form.protocol,
        host: form.host,
        port: parseInt(form.port) || (form.protocol === 'sftp' ? 22 : 21),
        username: form.username,
        password: form.password,
        remotePath: form.remotePath,
        brandIdentityId: brandId,
      };
      if (editingId) payload.connectionId = editingId;

      const res = await fetch('/api/ftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setForm(DEFAULT_FORM);
        setTestResult(null);
        setShowPassword(false);
        fetchConnections();
      } else {
        setTestResult({ success: false, message: data.error || 'Save failed' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this connection?')) return;
    try {
      await fetch('/api/ftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', connectionId: id }),
      });
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert('Failed to delete connection');
    }
  };

  const handleEdit = (conn: SavedConnection) => {
    setForm({
      label: conn.label,
      protocol: conn.protocol as 'sftp' | 'ftp' | 'ftps',
      host: conn.host,
      port: String(conn.port),
      username: conn.username,
      password: '',
      remotePath: conn.remote_path,
    });
    setEditingId(conn.id);
    setShowForm(true);
    setTestResult(null);
    setShowPassword(false);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setTestResult(null);
    setShowPassword(false);
  };

  // Can test: need host + username, and either a password or an existing connection (stored password)
  const canTest = !!form.host && !!form.username && (!!form.password || !!editingId);
  // Can save: need host + username, and for new connections need password
  const canSave = !!form.host && !!form.username && (!!form.password || !!editingId);

  if (loading || !ready) {
    return (
      <div>
        <div className="h-7 w-48 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-4 w-64 rounded-md animate-pulse mb-6" style={{ background: 'var(--paper-2)' }} />
        <div className="h-40 rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
            Server connections
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
            Connect via FTP/SFTP to deploy fixes directly.
            {brandId && <span> Connections are scoped to this brand.</span>}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(DEFAULT_FORM); setTestResult(null); setShowPassword(false); }}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-lg transition-all hover:brightness-110"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            <Plus size={13} /> Add connection
          </button>
        )}
      </div>

      {/* ── Form ── */}
      {showForm && (
        <div
          className="rounded-xl p-5 mb-5"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
              {editingId ? 'Edit connection' : 'New connection'}
            </h2>
            <button onClick={cancelForm} className="p-1 rounded-md hover:bg-paper-2 transition-colors">
              <X size={14} style={{ color: 'var(--m-muted)' }} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Label */}
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--m-muted)' }}>Connection name</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full px-3 py-2 text-[13px] rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                placeholder="e.g. Production server"
              />
            </div>

            {/* Protocol */}
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--m-muted)' }}>Protocol</label>
              <div className="flex gap-1.5">
                {(['sftp', 'ftps', 'ftp'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleProtocolChange(p)}
                    className="px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all"
                    style={{
                      background: form.protocol === p ? 'var(--ink)' : 'var(--paper-2)',
                      color: form.protocol === p ? 'var(--paper)' : 'var(--m-muted)',
                      border: form.protocol === p ? '1px solid var(--ink)' : '1px solid var(--rule)',
                    }}
                  >
                    {p === 'sftp' && <Shield size={9} className="inline mr-1 -mt-px" />}
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
              {form.protocol === 'sftp' && (
                <p className="text-[10px] mt-1" style={{ color: 'var(--m-muted)' }}>Recommended. Uses SSH encryption.</p>
              )}
            </div>

            {/* Host + Port */}
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--m-muted)' }}>Host</label>
                <input
                  type="text"
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  className="w-full px-3 py-2 text-[13px] rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
                  style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                  placeholder="ftp.yoursite.com"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--m-muted)' }}>Port</label>
                <input
                  type="text"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: e.target.value })}
                  className="w-full px-3 py-2 text-[13px] rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
                  style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--m-muted)' }}>Username</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-3 py-2 text-[13px] rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                placeholder="your-ftp-username"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--m-muted)' }}>
                Password{editingId ? ' (leave blank to keep existing)' : ''}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 pr-10 text-[13px] rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
                  style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                  placeholder={editingId ? 'Enter new password or leave blank' : 'Your password'}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPassword((prev) => !prev);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors hover:bg-paper-2"
                  style={{ color: 'var(--m-muted)', zIndex: 10 }}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Remote path */}
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--m-muted)' }}>Remote path (document root)</label>
              <input
                type="text"
                value={form.remotePath}
                onChange={(e) => setForm({ ...form, remotePath: e.target.value })}
                className="w-full px-3 py-2 text-[13px] rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                placeholder="/public_html or /var/www/html"
              />
              <p className="text-[10px] mt-1" style={{ color: 'var(--m-muted)' }}>The folder where your website files live on the server.</p>
            </div>

            {/* Test result */}
            {testResult && (
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px]"
                style={{
                  background: testResult.success ? 'color-mix(in srgb, var(--ok) 8%, var(--card))' : 'color-mix(in srgb, var(--severe) 8%, var(--card))',
                  color: testResult.success ? 'var(--ok)' : 'var(--severe)',
                  border: `1px solid ${testResult.success ? 'color-mix(in srgb, var(--ok) 20%, transparent)' : 'color-mix(in srgb, var(--severe) 20%, transparent)'}`,
                }}
              >
                {testResult.success ? <CheckCircle2 size={13} className="flex-shrink-0" /> : <AlertCircle size={13} className="flex-shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !canTest}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-lg transition-all disabled:opacity-30"
                style={{ color: 'var(--ink)', border: '1px solid var(--rule)' }}
              >
                {testing ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
                Test connection
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !canSave}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold rounded-lg transition-all hover:brightness-110 disabled:opacity-30"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                {editingId ? 'Update' : 'Save'}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="px-3 py-2 text-[12px] transition-colors hover:bg-paper-2 rounded-lg"
                style={{ color: 'var(--m-muted)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Saved connections ── */}
      {connections.length === 0 && !showForm ? (
        <div
          className="text-center py-14 rounded-xl"
          style={{ border: '1px dashed var(--rule)' }}
        >
          <WifiOff size={22} style={{ color: 'var(--m-muted)' }} className="mx-auto mb-3" />
          <h2 className="text-[14px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>No connections yet</h2>
          <p className="text-[12px] mb-4 max-w-xs mx-auto" style={{ color: 'var(--m-muted)' }}>
            Add your FTP or SFTP credentials to deploy audit fixes directly to your website.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-4 py-2 rounded-lg transition-all hover:brightness-110"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            <Plus size={13} /> Add connection
          </button>
        </div>
      ) : connections.length > 0 && (
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--m-muted)' }}>
            Saved connections{brandId ? ' for this brand' : ''}
          </h2>
          <div className="space-y-2">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--paper-2)' }}
                >
                  <Server size={13} style={{ color: 'var(--m-muted)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{conn.label}</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--m-muted)' }}>
                    {conn.protocol.toUpperCase()} · {conn.username}@{conn.host}:{conn.port} · {conn.remote_path}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleEdit(conn)}
                    className="p-1.5 rounded-md transition-colors hover:bg-paper-2"
                    style={{ color: 'var(--m-muted)' }}
                    title="Edit"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(conn.id)}
                    className="p-1.5 rounded-md transition-colors hover:bg-paper-2"
                    style={{ color: 'var(--m-muted)' }}
                    title="Remove"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Security note ── */}
      <div
        className="mt-6 px-4 py-3 rounded-xl"
        style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
      >
        <div className="flex items-start gap-2">
          <Shield size={13} style={{ color: 'var(--m-muted)' }} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>Your credentials are encrypted</p>
            <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: 'var(--m-muted)' }}>
              Passwords are encrypted with AES-256-GCM before storage and never logged in plaintext.
              We recommend using SFTP (SSH) for the most secure connection.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
