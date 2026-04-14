'use client';

import { Bell } from 'lucide-react';

export default function NotificationsPage() {
  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text">Notifications</h1>
        <p className="text-muted text-xs mt-0.5">Updates and announcements from ClearUX</p>
      </div>

      <div className="text-center py-16">
        <div className="w-12 h-12 rounded-full bg-off dark:bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
          <Bell size={20} className="text-muted" />
        </div>
        <p className="text-sm font-semibold text-text mb-1">No notifications yet</p>
        <p className="text-xs text-muted max-w-xs mx-auto">
          We will notify you about audit completions, product updates, and important announcements.
        </p>
      </div>
    </div>
  );
}
