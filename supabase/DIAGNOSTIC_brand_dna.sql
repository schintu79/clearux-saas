-- ============================================================
-- DIAGNOSTIC: Run this in Supabase SQL Editor to check which
-- columns/tables are missing that could break Brand DNA uploads.
-- This is NOT a migration — do not run via Supabase CLI.
-- ============================================================

-- 1. Check brand_identities columns (look for deleted_at, workspace_id)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'brand_identities'
ORDER BY ordinal_position;

-- 2. Check brand_identity_files columns (look for 'tag')
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'brand_identity_files'
ORDER BY ordinal_position;

-- 3. Check if workspaces table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'workspaces'
) AS workspaces_exists;

-- 4. Check if brand-assets storage bucket exists
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE name = 'brand-assets';

-- 5. Check storage policies for brand-assets
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
  AND policyname ILIKE '%brand%';

-- 6. Count brand_identity_files
SELECT COUNT(*) AS total_files FROM brand_identity_files;

-- 7. Check for brand identities
SELECT id, name, workspace_id, deleted_at
FROM brand_identities
ORDER BY created_at DESC
LIMIT 10;
