-- 051: Add tag column to brand_identity_files
-- The tag column is used by the analyze-files route to classify uploaded
-- files (e.g. 'Brand guide', 'Logo', 'Icon', 'Voice', 'Colours', 'Messaging')
-- and by the GET list route's embedded select. Without this column the
-- PostgREST embedded resource query fails, breaking file visibility.

ALTER TABLE brand_identity_files
  ADD COLUMN IF NOT EXISTS tag TEXT DEFAULT NULL;
