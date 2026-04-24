-- Add marketing email consent to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marketing_emails BOOLEAN DEFAULT false;
COMMENT ON COLUMN profiles.marketing_emails IS 'Whether the user opted in to receive marketing emails and promotions.';
