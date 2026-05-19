'use client';

import { useState, useEffect } from 'react';
import { Bell, CheckCircle2, AlertTriangle, Info, Sparkles, Megaphone } from 'lucide-react';
import PageHeader from '@/components/dashboard/v2/PageHeader';

interface Notification {
  id: string;
  title: string;
  message: string;
  icon: string;
  color: string;
  is_read: boolean;
  created_at: string;
}

const colorStyleMap: Record<string, { background: string; borderColor: string }> = {
  blue: { background: 'color-mix(in srgb, var(--color-info) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--color-info) 20%, transparent)' },
  green: { background: 'color-mix(in srgb, var(--ok) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--ok) 20%, transparent)' },
  yellow: { background: 'color-mix(in srgb, var(--warn) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--warn) 20%, transparent)' },
  red: { background: 'color-mix(in srgb, var(--severe) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--severe) 20%, transparent)' },
  violet: { background: 'color-mix(in srgb, var(--ink) 5%, transparent)', borderColor: 'color-mix(in srgb, var(--ink) 12%, transparent)' },
};

const iconColorStyleMap: Record<string, string> = {
  blue: 'var(--color-info)', green: 'var(--ok)', yellow: 'var(--warn)', red: 'var(--severe)', violet: 'var(--ink)',
};

const iconMap: Record<string, React.ElementType> = {
  info: Info, success: CheckCircle2, warning: AlertTriangle, error: AlertTriangle, announcement: Megaphone,
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(d => {
        setNotifications(d.notifications || []);
        setUnreadCount(d.unreadCount || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markAsRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification_id: id }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    window.dispatchEvent(new Event('focus')); // triggers sidebar to re-fetch unread count
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-6 space-y-3">
        <div className="h-5 w-32 bg-off rounded animate-pulse" />
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-off rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6">
      <PageHeader
        icon={<Bell size={18} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />}
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
      />

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--paper-2)' }}>
            <Bell size={20} className="text-muted" />
          </div>
          <p className="text-sm font-medium text-text mb-1">No notifications yet</p>
          <p className="text-xs text-muted max-w-xs mx-auto">
            We will notify you about product updates and important announcements.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const Icon = iconMap[n.icon] || Info;
            return (
              <div
                key={n.id}
                className={`rounded-xl p-4 transition-all ${n.is_read ? 'opacity-60' : ''}`}
                style={{ border: '1px solid', ...(colorStyleMap[n.color] || colorStyleMap.blue) }}
                onClick={() => !n.is_read && markAsRead(n.id)}
                role={n.is_read ? undefined : 'button'}
              >
                <div className="flex items-start gap-3">
                  <Icon size={16} className="flex-shrink-0 mt-0.5" style={{ color: iconColorStyleMap[n.color] || iconColorStyleMap.blue }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-text">{n.title}</p>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--signal)' }} />
                      )}
                    </div>
                    <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{n.message}</p>
                    <p className="text-[11px] text-muted mt-1.5">
                      {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
