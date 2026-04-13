-- ============================================================
-- Migration 007 — Add admin role to profiles
-- ============================================================

-- Add role column (default 'user', can be 'admin' or 'super_admin')
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- Create index for fast admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Set initial admin (Stefano)
UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 's.schintu@gmail.com';
