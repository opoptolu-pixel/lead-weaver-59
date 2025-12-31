-- Change the default value for whatsapp_optin to true for new accounts
ALTER TABLE public.profiles 
ALTER COLUMN whatsapp_optin SET DEFAULT true;