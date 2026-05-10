-- Add billing/company columns to profiles table
-- These store optional company & invoicing details shown on receipts

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_company_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_vat_number   TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_address_line1 TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_address_line2 TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_city          TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_postal_code   TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_country       TEXT;
