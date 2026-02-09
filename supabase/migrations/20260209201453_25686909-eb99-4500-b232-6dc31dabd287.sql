-- Allow users to update their own verification documents (for re-uploads)
CREATE POLICY "Users can update own verification documents"
  ON public.verification_documents
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());