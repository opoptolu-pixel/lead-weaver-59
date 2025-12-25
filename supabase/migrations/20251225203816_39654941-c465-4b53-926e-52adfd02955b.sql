-- Add new columns to leads table for property details
ALTER TABLE public.leads
ADD COLUMN property_type text NULL,
ADD COLUMN bedrooms text NULL,
ADD COLUMN frequency text NULL;