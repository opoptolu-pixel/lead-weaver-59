-- Add storage policy for admin access to verification documents
CREATE POLICY "Admins can view all verification documents storage"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-documents' 
  AND is_admin(auth.uid())
);