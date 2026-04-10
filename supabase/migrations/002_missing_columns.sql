-- ============================================================
-- ClearUX — Missing columns migration
-- Adds columns required by the app but missing from initial schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Credits column on profiles (used for credit-based audit purchases)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0;

-- 2. Plan column on audits (starter / deep_dive / full_audit etc.)
ALTER TABLE audits ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'full_audit';

-- 3. Language column on audits (ISO 639-1: en, es, fr, de, it, pt)
ALTER TABLE audits ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- 4. Make payments.audit_id nullable (credit pack purchases have no audit)
ALTER TABLE payments ALTER COLUMN audit_id DROP NOT NULL;

-- 5. Drop the UNIQUE constraint on payments.audit_id (multiple payments per audit possible)
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_audit_id_key;

-- Backfill existing rows
UPDATE audits SET plan = 'full_audit' WHERE plan IS NULL;
UPDATE audits SET language = 'en' WHERE language IS NULL;
UPDATE profiles SET credits = 0 WHERE credits IS NULL;
