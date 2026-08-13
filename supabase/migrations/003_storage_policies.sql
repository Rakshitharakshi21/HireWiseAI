-- Storage bucket policies
-- Run after creating buckets in Supabase Storage

-- Resumes bucket policies
CREATE POLICY "Candidates upload own resumes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'resumes' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Candidates view own resumes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'resumes' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Candidates delete own resumes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'resumes' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Optimized resumes bucket policies
CREATE POLICY "Candidates upload optimized resumes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'optimized-resumes' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Candidates view optimized resumes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'optimized-resumes' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Candidates delete optimized resumes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'optimized-resumes' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
