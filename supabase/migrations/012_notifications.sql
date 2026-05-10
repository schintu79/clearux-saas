-- ============================================================
-- ClearUX — Notifications System
-- Admin-created notifications displayed in user dashboards.
-- Run this in your Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  icon            TEXT NOT NULL DEFAULT 'info',          -- info | success | warning | error | announcement
  color           TEXT NOT NULL DEFAULT 'blue',          -- blue | green | yellow | red | violet
  show_in_overview BOOLEAN NOT NULL DEFAULT false,       -- pin to dashboard overview (only 1 at a time)
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track which users have read which notifications
CREATE TABLE IF NOT EXISTS notification_reads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads(user_id);

-- RLS: all authenticated users can read active notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active notifications" ON notifications;
CREATE POLICY "Anyone can view active notifications"
  ON notifications FOR SELECT USING (is_active = true);

ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own reads" ON notification_reads;
CREATE POLICY "Users can view own reads"
  ON notification_reads FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own reads" ON notification_reads;
CREATE POLICY "Users can insert own reads"
  ON notification_reads FOR INSERT WITH CHECK (auth.uid() = user_id);
