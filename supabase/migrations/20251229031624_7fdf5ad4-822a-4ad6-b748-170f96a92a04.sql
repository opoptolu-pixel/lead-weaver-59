-- Allow users to update their own disputes (add evidence, respond to admin)
CREATE POLICY "Users can update own disputes" 
ON public.disputes 
FOR UPDATE 
USING (auth.uid() IS NOT NULL AND user_id = auth.uid() AND status = 'open')
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());