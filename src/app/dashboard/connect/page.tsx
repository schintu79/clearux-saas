'use client';

/**
 * Connect — FTP/SFTP settings page.
 *
 * Lets users add, test, and manage FTP/SFTP connections for their
 * brand's website. Used for one-click deployment of audit fixes
 * on static sites without a dev team.
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
} from 'lucide-react';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import DashCard from '@/components/dashboard/v2/DashCard';
import SectionHeader from '@/components/dashboard/v2/SectionHeader';
import { formatDate } from '@/components/dashboard/v2/score-utils';
import { useAuth } from '@/context/AuthContext';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import OverviewBreadcrumb from '@/components/dashboard/OverviewBreadcrumb';

interface SavedConnection {
  id: string;
  label: string;
  protocol: string;
  host: string;
  port: number;
  username: string;
  remote_path: string;
  site_host: string | null;
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
  const { selection } = useBrandSelection();

  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [provisioning, setProvisioning] = useState<{ provisioned: boolean; configured: boolean; error?: string } | null>(null);

  const fetchConnections = useCallback(async () => {
    try {
      const siteHost = selection?.kind === 'site' ? selection.host : null;
      const url = siteHost ? `/api/ftp?siteHost=${encodeURIComponent(siteHost)}` : '/api/ftp';
      const res = await fetch(url);
      const data = await res.json();
      if (res.status === 503) {
        setProvisioning({
          provisioned: data.provisioned !== false,
          configured: data.configured !== false,
          error: data.error,
        });
        setConnections([]);
        return;
      }
      setProvisioning({
        provisioned: data.provisioned !== false,
        configured: data.configured !== false,
      });
      setConnections(data.connections || []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [selection]);

  useEffect(() => {
    if (user) fetchConnections();
  }, [user, fetchConnections]);

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
      const payload: Record<string, any> = {
        action: 'test',
        protocol: form.protocol,
        host: form.host,
        port: parseInt(form.port) || (form.protocol === 'sftp' ? 22 : 21),
        username: form.username,
        remotePath: form.remotePath,
      };
      // Only include password if user typed one. When editing, an empty
      // password means "use the stored one" and the API will look it up.
      if (form.password) payload.password = form.password;
      if (editingId) payload.connectionId = editingId;

      const res = await fetch('/api/ftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      const siteHost = selection?.kind === 'site' ? selection.host : null;
      const payload: any = {
        action: editingId ? 'update' : 'save',
        label: form.label,
        protocol: form.protocol,
        host: form.host,
        port: parseInt(form.port) || (form.protocol === 'sftp' ? 22 : 21),
        username: form.username,
        password: form.password,
        remotePath: form.remotePath,
        siteHost,
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
      password: '', // Never pre-fill password
      remotePath: conn.remote_path,
    });
    setEditingId(conn.id);
    setShowForm(true);
    setTestResult(null);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">
        <div className="h-7 w-48 bg-off rounded animate-pulse" />
        <div className="h-40 bg-off rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-4 px-4">
      <OverviewBreadcrumb current="Connect site" />
      {/* Header */}
      <PageHeader
        icon={<Server size={18} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />}
        title="Server connections"
        subtitle="Connect your website via FTP/SFTP to deploy fixes directly from your audit results."
      >
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(DEFAULT_FORM); setTestResult(null); }}
            className="inline-flex items-center gap-1.5 bg-brand text-surface text-xs font-medium px-3.5 py-2 rounded-lg transition-all hover:brightness-110"
          >
            <Plus size={13} /> Add connection
          </button>
        )}
      </PageHeader>

      {/* Provisioning notice — surfaces missing migration / env clearly */}
      {provisioning && (!provisioning.provisioned || !provisioning.configured) && (
        <div className="mb-5 rounded-xl border border-border bg-off/60 p-4 flex items-start gap-2.5">
          <AlertCircle size={15} className="text-muted flex-shrink-0 mt-0.5" />
          <div className="text-xs text-text">
            {!provisioning.provisioned ? (
              <>
                <p className="font-medium mb-0.5">FTP feature not yet provisioned</p>
                <p className="text-muted">
                  The <code className="px-1 rounded bg-card border border-border">ftp_connections</code> table is missing.
                  Apply migration <code className="px-1 rounded bg-card border border-border">032_ftp_connections.sql</code> in Supabase to enable.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium mb-0.5">Encryption key not configured</p>
                <p className="text-muted">
                  Set <code className="px-1 rounded bg-card border border-border">FTP_ENCRYPTION_KEY</code> in your deployment env.
                  You can still test a connection below — credentials cannot be saved until the key is set.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Brand required notice */}
      {selection?.kind !== 'site' && (
        <div className="mb-5 rounded-xl border border-border bg-off/60 p-4 flex items-start gap-2.5">
          <AlertCircle size={15} className="text-muted flex-shrink-0 mt-0.5" />
          <div className="text-xs text-text">
            <p className="font-medium mb-0.5">Select a website first</p>
            <p className="text-muted">
              Server connections are saved per website. Use the dropdown in the sidebar to select which site this connection belongs to.
            </p>
          </div>
        </div>
      )}

      {/* Connection Form */}
      {showForm && (
        <DashCard padding="lg" className="mb-6">
          <h2 className="text-sm font-medium text-text mb-4">
            {editingId ? 'Edit connection' : 'New connection'}
          </h2>

          <div className="space-y-4">
            {/* Label */}
            <div>
              <label className="block text-xs text-muted mb-1">Connection name</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder="e.g. Production server"
              />
            </div>

            {/* Protocol selector */}
            <div>
              <label className="block text-xs text-muted mb-1">Protocol</label>
              <div className="flex gap-2">
                {(['sftp', 'ftps', 'ftp'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => handleProtocolChange(p)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      form.protocol === p
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border text-muted hover:text-text hover:border-text/20'
                    }`}
                  >
                    {p === 'sftp' && <Shield size={10} className="inline mr-1" />}
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
              {form.protocol === 'sftp' && (
                <p className="text-[11px] text-muted mt-1.5">Recommended. Uses SSH encryption for secure transfers.</p>
              )}
            </div>

            {/* Host + Port */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-muted mb-1">Host</label>
                <input
                  type="text"
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand"
                  placeholder="ftp.yoursite.com"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Port</label>
                <input
                  type="text"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand"
                  placeholder="22"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs text-muted mb-1">Username</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder="your-ftp-username"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs text-muted mb-1">
                Password {editingId && <span className="text-muted/60">(leave blank to keep existing)</span>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 pr-9 text-sm rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand"
                  placeholder={editingId ? '•••••••• (unchanged)' : '••••••••'}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onMouseDown={(e) => {
                    // Prevent the input from losing focus / from any wrapping
                    // form attempting a submit on click.
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPassword((v) => !v);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1 rounded text-muted hover:text-text focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Remote path */}
            <div>
              <label className="block text-xs text-muted mb-1">Remote path (document root)</label>
              <input
                type="text"
                value={form.remotePath}
                onChange={(e) => setForm({ ...form, remotePath: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder="/public_html or /var/www/html"
              />
              <p className="text-[11px] text-muted mt-1">The folder where your website files live on the server.</p>
            </div>

            {/* Test result */}
            {testResult && (
              <div
                className={`flex items-start gap-2 p-3 rounded-lg text-xs ${
                  testResult.success
                    ? 'bg-ok/10 text-ok border border-ok/20'
                    : 'bg-severe/10 text-severe border border-severe/20'
                }`}
              >
                {testResult.success ? <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleTest}
                disabled={
                  testing ||
                  !form.host ||
                  !form.username ||
                  // When editing an existing connection, password may be blank
                  // (the API will fall back to the stored encrypted password).
                  (!editingId && !form.password)
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border text-text hover:bg-off transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {testing ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
                Test connection
              </button>
              <button
                onClick={handleSave}
                disabled={
                  saving ||
                  !form.host ||
                  !form.username ||
                  (!form.password && !editingId) ||
                  (provisioning ? !provisioning.provisioned || !provisioning.configured : false) ||
                  selection?.kind !== 'site'
                }
                title={
                  selection?.kind !== 'site'
                    ? 'Select a website from the sidebar before saving'
                    : provisioning && (!provisioning.provisioned || !provisioning.configured)
                      ? 'Provisioning required — see banner above'
                      : undefined
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-brand text-surface hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                {editingId ? 'Update' : 'Save connection'}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); setTestResult(null); }}
                className="px-3 py-2 text-xs text-muted hover:text-text transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </DashCard>
      )}

      {/* Saved Connections */}
      {connections.length === 0 && !showForm ? (
        <DashCard dashed className="text-center py-16">
          <WifiOff size={24} className="text-muted mx-auto mb-3" />
          <h2 className="text-sm font-medium text-text mb-1">No connections yet</h2>
          <p className="text-muted text-xs mb-4 max-w-xs mx-auto">
            Add your FTP or SFTP credentials to deploy audit fixes directly to your website.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 bg-brand text-surface text-xs font-medium px-4 py-2 rounded-lg transition-all hover:brightness-110"
          >
            <Plus size={13} /> Add connection
          </button>
        </DashCard>
      ) : (
        connections.length > 0 && (
          <div className="space-y-3">
            <SectionHeader title="Saved connections" />
            {connections.map((conn) => (
              <DashCard
                key={conn.id}
                hover
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-off flex items-center justify-center flex-shrink-0">
                  <Server size={14} className="text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{conn.label}</p>
                  <p className="text-[11px] text-muted truncate">
                    {conn.protocol.toUpperCase()} · {conn.username}@{conn.host}:{conn.port} · {conn.remote_path}
                  </p>
                  {conn.last_connected_at && (
                    <p className="text-[10px] text-muted/60 mt-0.5">
                      Last connected: {formatDate(conn.last_connected_at)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(conn)}
                    className="p-2 text-muted hover:text-text transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(conn.id)}
                    className="p-2 text-muted hover:text-red-500 transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </DashCard>
            ))}
          </div>
        )
      )}

      {/* Security note */}
      <DashCard className="mt-8">
        <div className="flex items-start gap-2">
          <Shield size={14} className="text-muted flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-text mb-1">Your credentials are encrypted</p>
            <p className="text-[11px] text-muted leading-relaxed">
              Passwords are encrypted with AES-256-GCM before storage and never logged in plaintext.
              We recommend using SFTP (SSH) for the most secure connection. You can revoke access at any time.
            </p>
          </div>
        </div>
      </DashCard>
    </div>
  );
}
