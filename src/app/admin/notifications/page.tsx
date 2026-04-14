'use client';

import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Eye, EyeOff, Pin, PinOff, Send } from 'lucide-react';

const ICON_OPTIONS = [
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'announcement', label: 'Announcement' },
];

const COLOR_OPTIONS = [
  { value: 'blue', label: 'Blue (Info)', bg: 'bg-blue-500' },
  { value: 'green', label: 'Green (Success)', bg: 'bg-green-500' },
  { value: 'yellow', label: 'Yellow (Warning)', bg: 'bg-yellow-500' },
  { value: 'red', label: 'Red (Error)', bg: 'bg-red-500' },
  { value: 'violet', label: 'Violet (Brand)', bg: 'bg-violet-500' },
];

interface Notification {
  id: string;
  title: string;
  message: string;
  icon: string;
  color: string;
  show_in_overview: boolean;
  is_active: boolean;
  created_at: string;
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    title: '',
    message: '',
    icon: 'info',
    color: 'blue',
    show_in_overview: false,
  });

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/notifications');
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchNotifications(); }, []);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.message.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ title: '', message: '', icon: 'info', color: 'blue', show_in_overview: false });
        setShowForm(false);
        fetchNotifications();
      }
    } catch {}
    setSending(false);
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !isActive }),
    });
    fetchNotifications();
  };

  const handleToggleOverview = async (id: string, showInOverview: boolean) => {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, show_in_overview: !showInOverview }),
    });
    fetchNotifications();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this notification permanently?')) return;
    await fetch('/api/admin/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchNotifications();
  };

  const colorMap: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800/20',
    green: 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800/20',
    yellow: 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-800/20',
    red: 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800/20',
    violet: 'border-violet-200 bg-violet-50 dark:bg-violet-900/10 dark:border-violet-800/20',
  };

  const iconColorMap: Record<string, string> = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    yellow: 'text-yellow-500',
    red: 'text-red-500',
    violet: 'text-violet-500',
  };

  return (
    <div className="max-w-3xl mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-text">Notifications</h1>
          <p className="text-xs text-muted mt-0.5">Send notifications to all users</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 text-white text-xs font-medium px-3.5 py-2 rounded-lg transition-all hover:brightness-110"
          style={{ background: 'var(--gradient-brand)' }}
        >
          <Plus size={14} />
          New Notification
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-border/40 dark:border-white/[0.06] bg-card p-5">
          <h2 className="text-sm font-bold text-text mb-4">Create Notification</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. New feature: Score Trends"
                className="input"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1.5">Message</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Describe the notification..."
                rows={3}
                className="input resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">Icon Type</label>
                <select
                  value={form.icon}
                  onChange={(e) => setForm(f => ({ ...f, icon: e.target.value }))}
                  className="input"
                >
                  {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">Color</label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setForm(f => ({ ...f, color: c.value }))}
                      className={`w-8 h-8 rounded-lg ${c.bg} transition-all ${form.color === c.value ? 'ring-2 ring-offset-2 ring-current scale-110' : 'opacity-50 hover:opacity-75'}`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.show_in_overview}
                onChange={(e) => setForm(f => ({ ...f, show_in_overview: e.target.checked }))}
                className="w-4 h-4 rounded border-border text-violet-500 focus:ring-violet-500"
              />
              <div>
                <span className="text-xs font-semibold text-text">Show in Dashboard Overview</span>
                <p className="text-[10px] text-muted">Pins this notification to the main overview tab. Only 1 at a time.</p>
              </div>
            </label>

            {/* Preview */}
            <div>
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-2">Preview</p>
              <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${colorMap[form.color] || colorMap.blue}`}>
                <Bell size={15} className={`flex-shrink-0 mt-0.5 ${iconColorMap[form.color] || iconColorMap.blue}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text">{form.title || 'Notification title'}</p>
                  <p className="text-[11px] text-muted mt-0.5">{form.message || 'Notification message...'}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={sending || !form.title.trim() || !form.message.trim()}
                className="inline-flex items-center gap-1.5 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: 'var(--gradient-brand)' }}
              >
                <Send size={13} />
                {sending ? 'Sending...' : 'Send to all users'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="text-xs font-medium text-muted px-4 py-2.5 rounded-lg hover:bg-off transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-off rounded-xl animate-pulse" />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12">
          <Bell size={24} className="text-muted mx-auto mb-3" />
          <p className="text-sm font-semibold text-text">No notifications yet</p>
          <p className="text-xs text-muted mt-1">Create your first notification above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className={`rounded-xl border p-4 ${n.is_active ? colorMap[n.color] || colorMap.blue : 'border-border/30 bg-off/30 opacity-50'}`}>
              <div className="flex items-start gap-3">
                <Bell size={15} className={`flex-shrink-0 mt-0.5 ${n.is_active ? iconColorMap[n.color] || iconColorMap.blue : 'text-muted'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-bold text-text">{n.title}</p>
                    {n.show_in_overview && (
                      <span className="text-[9px] font-bold text-violet-600 bg-violet-100 dark:bg-violet-500/15 px-1.5 py-0.5 rounded">PINNED</span>
                    )}
                    {!n.is_active && (
                      <span className="text-[9px] font-bold text-muted bg-off px-1.5 py-0.5 rounded">INACTIVE</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted">{n.message}</p>
                  <p className="text-[10px] text-muted/50 mt-1">
                    {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggleOverview(n.id, n.show_in_overview)}
                    className="p-1.5 rounded-md text-muted hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/10 transition-colors"
                    title={n.show_in_overview ? 'Unpin from overview' : 'Pin to overview'}
                  >
                    {n.show_in_overview ? <PinOff size={13} /> : <Pin size={13} />}
                  </button>
                  <button
                    onClick={() => handleToggleActive(n.id, n.is_active)}
                    className="p-1.5 rounded-md text-muted hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors"
                    title={n.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {n.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="p-1.5 rounded-md text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
