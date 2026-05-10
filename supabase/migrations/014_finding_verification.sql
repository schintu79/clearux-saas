-- Add verification columns to audit_findings
-- Used by baseline re-audits to flag findings that AI detected as likely fixed
-- These are informational only — they do NOT affect scoring until the user confirms

ALTER TABLE audit_findings
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verification_note TEXT DEFAULT NULL;

-- Add constraint for valid verification statuses
ALTER TABLE audit_findings
  ADD CONSTRAINT check_verification_status
  CHECK (verification_status IS NULL OR verification_status IN ('confirmed_open', 'likely_fixed'));

COMMENT ON COLUMN audit_findings.verification_status IS 'AI verification result: confirmed_open or likely_fixed. NULL means not verified.';
COMMENT ON COLUMN audit_findings.verification_note IS 'AI explanation of verification determination.';
