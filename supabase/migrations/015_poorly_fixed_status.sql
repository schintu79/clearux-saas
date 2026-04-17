-- Add 'poorly_fixed' to the verification_status check constraint
-- This status indicates the AI detected a fix attempt that made things worse

-- Drop the existing constraint first (if it exists)
ALTER TABLE audit_findings
  DROP CONSTRAINT IF EXISTS check_verification_status;

-- Re-add with the new value included
ALTER TABLE audit_findings
  ADD CONSTRAINT check_verification_status
  CHECK (verification_status IS NULL OR verification_status IN ('confirmed_open', 'likely_fixed', 'poorly_fixed'));

COMMENT ON COLUMN audit_findings.verification_status IS 'AI verification result: confirmed_open, likely_fixed, or poorly_fixed. NULL means not verified.';
