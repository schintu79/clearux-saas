-- White-label branding fields on individual audits
-- Agency and Scale package users can optionally set a custom company name
-- and logo per audit, which replaces ClearUX branding in PDF/DOCX reports.

ALTER TABLE audits ADD COLUMN IF NOT EXISTS white_label_company_name TEXT;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS white_label_logo_url TEXT;

-- Create storage bucket for white-label logos (public so reports can embed them)
INSERT INTO storage.buckets (id, name, public)
VALUES ('white-label-logos', 'white-label-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'white-label-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access (reports need to fetch logos)
CREATE POLICY "Public read access for logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'white-label-logos');

-- Allow users to update/delete their own logos
CREATE POLICY "Users can manage their own logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'white-label-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
