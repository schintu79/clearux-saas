-- Add marketing email consent and welcome email tracking to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marketing_emails BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS welcome_email_sent BOOLEAN DEFAULT false;
COMMENT ON COLUMN profiles.marketing_emails IS 'Whether the user opted in to receive marketing emails and promotions.';
COMMENT ON COLUMN profiles.welcome_email_sent IS 'Whether the welcome email has been sent to this user.';
