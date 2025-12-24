-- Normalize all lead values to pence (multiply pounds by 100)
-- Values < 1000 are in pounds and need conversion
UPDATE leads
SET value = value * 100
WHERE value < 1000;

-- Add a check constraint to ensure values are stored consistently in pence (minimum £1 = 100 pence)
-- We use a reasonable minimum of 100 pence (£1) to catch obvious errors
ALTER TABLE leads ADD CONSTRAINT leads_value_in_pence_check CHECK (value >= 100);

-- Add a comment to document the value format
COMMENT ON COLUMN leads.value IS 'Job value stored in pence (e.g., £125 = 12500 pence)';