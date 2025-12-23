-- Create admin role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'super_admin');

-- Create user_roles table for admin access
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is any admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'super_admin')
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Super admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Allow admins to update profiles (for verification)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Allow admins to view all leads
CREATE POLICY "Admins can view all leads"
ON public.leads
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Allow admins to update all leads
CREATE POLICY "Admins can update all leads"
ON public.leads
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Allow admins to insert leads
CREATE POLICY "Admins can insert leads"
ON public.leads
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- Allow admins to view all verification documents
CREATE POLICY "Admins can view all verification documents"
ON public.verification_documents
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Allow admins to update verification documents
CREATE POLICY "Admins can update verification documents"
ON public.verification_documents
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Add admin-specific fields to leads table
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS lead_status TEXT DEFAULT 'new',
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expired_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refund_reason TEXT;

-- Add risk_score to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Create disputes table
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason_code TEXT NOT NULL,
  description TEXT,
  evidence_urls TEXT[],
  status TEXT NOT NULL DEFAULT 'open',
  resolution TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own disputes"
ON public.disputes
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create disputes"
ON public.disputes
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all disputes"
ON public.disputes
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update disputes"
ON public.disputes
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Create fraud_flags table
CREATE TABLE public.fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fraud flags"
ON public.fraud_flags
FOR ALL
USING (public.is_admin(auth.uid()));

-- Create trigger for disputes updated_at
CREATE TRIGGER update_disputes_updated_at
BEFORE UPDATE ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();