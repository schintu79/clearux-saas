-- ============================================================
-- ClearUX — White-label support
-- Adds white_label flag to profiles for Agency/Scale packages
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- White-label flag: enabled when user purchases Agency or Scale pack
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS white_label BOOLEAN NOT NULL DEFAULT false;

-- Also store the highest package tier purchased (for future tier-based features)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS package_tier TEXT NOT NULL DEFAULT 'starter';

-- Backfill
UPDATE profiles SET white_label = false WHERE white_label IS NULL;
UPDATE profiles SET package_tier = 'starter' WHERE package_tier IS NULL;
