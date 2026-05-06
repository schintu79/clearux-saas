'use client';

import { useState, useEffect } from 'react';
import { Bell, CheckCircle2, AlertTriangle, Info, Sparkles, Megaphone } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  icon: string;
  color: string;
  is_read: boolean;
  created_at: string;
}

const colorMap: Record<string, string> = {
  blue: 'border-blue-200/40 bg-blue-50/60 dark:bg-blue-900/10 dark:border-blue-800/20',
  green: 'border-green-200/40 bg-green-50/60 dark:bg-green-900/10 dark:border-green-800/20',
  yellow: 'border-yellow-200/40 bg-yellow-50/60 dark:bg-yellow-900/10 dark:border-yellow-800/20',
  red: 'border-red-200/40 bg-red-50/60 dark:bg-red-900/10 dark:border-red-800/20',
  violet: 'border-brand/20 bg-brand/5 dark:bg-brand/5 dark:border-brand/10',
};

const iconColorMap: Record<string, string> = {
  blue: 'text-blue-500', green: 'text-green-500', yellow: 'text-yellow-500', red: 'text-red-500', violet: 'text-brand',
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-lg font-medium text-text">Notifications</h1>
          <p className="text-muted text-xs mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-off dark:bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
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
                className={`rounded-xl border p-4 transition-all ${n.is_read ? 'opacity-60' : ''} ${colorMap[n.color] || colorMap.blue}`}
                onClick={() => !n.is_read && markAsRead(n.id)}
                role={n.is_read ? undefined : 'button'}
              >
                <div className="flex items-start gap-3">
                  <Icon size={16} className={`flex-shrink-0 mt-0.5 ${iconColorMap[n.color] || iconColorMap.blue}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-text">{n.title}</p>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-muted/50 mt-1.5">
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
