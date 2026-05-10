-- ============================================================
-- ClearUX — Fix profile creation for OAuth (Google) sign-ups
-- The original trigger only saved id + email, missing the name
-- and avatar from OAuth providers (stored in raw_user_meta_data).
-- Run this in your Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.email, new.raw_user_meta_data->>'email'),
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      NULL
    ),
    COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture',
      NULL
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name  = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix any existing Google users who have NULL full_name
-- by pulling the name from auth.users metadata
UPDATE public.profiles p
SET
  full_name  = COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  avatar_url = COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
  updated_at = NOW()
FROM auth.users u
WHERE p.id = u.id
  AND p.full_name IS NULL
  AND (u.raw_user_meta_data->>'full_name' IS NOT NULL OR u.raw_user_meta_data->>'name' IS NOT NULL);
