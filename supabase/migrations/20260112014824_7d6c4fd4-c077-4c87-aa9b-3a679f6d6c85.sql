
-- Add credit_type column to track whether lead was unlocked with purchased or granted credits
ALTER TABLE public.leads 
ADD COLUMN credit_type text DEFAULT 'purchased';

-- Add comment for documentation
COMMENT ON COLUMN public.leads.credit_type IS 'Whether the lead was unlocked using purchased credits or granted (free) credits. Values: purchased, granted';

-- Update historical leads that were unlocked with granted credits (users with no payment history)
UPDATE public.leads
SET credit_type = 'granted'
WHERE unlocked_by IN (
  '4caee838-eb02-41dd-bbd2-d41f341e1df0',  -- Sparkle Clean
  'b2074d85-ae77-4473-b201-e3209b1fd767',  -- Orbit Shade Ltd
  '25a7cc46-5c72-4983-83fd-4c744ac276dc',  -- Kydos Digital
  '65bff2e1-ab87-469b-baf0-5615e5354c68'   -- Taprave Ltd
)
AND is_unlocked = true;
