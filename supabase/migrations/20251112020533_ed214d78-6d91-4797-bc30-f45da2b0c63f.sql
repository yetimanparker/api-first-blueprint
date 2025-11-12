-- Create contractor-logos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('contractor-logos', 'contractor-logos', true);

-- Allow contractors to upload their own logos
CREATE POLICY "Contractors can upload their own logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'contractor-logos' AND
  (storage.foldername(name))[1] = (SELECT id::text FROM contractors WHERE user_id = auth.uid())
);

-- Allow contractors to update their own logos
CREATE POLICY "Contractors can update their own logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'contractor-logos' AND
  (storage.foldername(name))[1] = (SELECT id::text FROM contractors WHERE user_id = auth.uid())
);

-- Allow contractors to delete their own logos
CREATE POLICY "Contractors can delete their own logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'contractor-logos' AND
  (storage.foldername(name))[1] = (SELECT id::text FROM contractors WHERE user_id = auth.uid())
);

-- Public read access for logos
CREATE POLICY "Anyone can view contractor logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'contractor-logos');