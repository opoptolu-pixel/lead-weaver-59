CREATE POLICY "No client access to lead SMS delivery ledger"
ON public.lead_sms_notification_deliveries
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);