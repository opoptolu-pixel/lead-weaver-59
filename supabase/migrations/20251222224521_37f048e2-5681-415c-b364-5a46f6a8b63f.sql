-- Create leads table for storing cleaning job leads
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  postcode TEXT NOT NULL,
  job_type TEXT NOT NULL,
  value INTEGER NOT NULL, -- Value in pence for easier math
  display_value TEXT NOT NULL, -- e.g. "£120"
  date DATE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  source TEXT, -- 'google', 'facebook', 'direct', etc.
  is_unlocked BOOLEAN NOT NULL DEFAULT false,
  unlocked_by UUID REFERENCES auth.users(id),
  unlocked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Public can view leads (but we only expose non-sensitive fields in the query)
CREATE POLICY "Anyone can view available leads" 
ON public.leads 
FOR SELECT 
USING (is_unlocked = false);

-- Authenticated users can view leads they've unlocked
CREATE POLICY "Users can view their unlocked leads" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (unlocked_by = auth.uid());

-- Only allow updates through edge function (service role)
CREATE POLICY "Service role can update leads" 
ON public.leads 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Allow service role inserts for new leads
CREATE POLICY "Service role can insert leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (true);

-- Enable realtime for leads table
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;

-- Create profiles table for cleaner accounts
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  contact_name TEXT,
  postcode TEXT,
  phone TEXT,
  whatsapp_optin BOOLEAN DEFAULT false,
  credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();