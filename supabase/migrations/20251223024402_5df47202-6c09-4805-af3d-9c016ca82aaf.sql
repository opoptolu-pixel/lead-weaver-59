-- Create email templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  description TEXT,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can view email templates
CREATE POLICY "Admins can view email templates"
ON public.email_templates
FOR SELECT
USING (is_admin(auth.uid()));

-- Only admins can manage email templates
CREATE POLICY "Admins can manage email templates"
ON public.email_templates
FOR ALL
USING (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO public.email_templates (name, subject, body, description, variables) VALUES
('welcome', 'Welcome to Deep Clean UK!', '<h1>Welcome, {{name}}!</h1><p>Thank you for joining Deep Clean UK. We''re excited to have you as part of our network of professional cleaners.</p><p>Start browsing leads in your area today!</p>', 'Sent to new users upon registration', ARRAY['name', 'email']),
('lead_notification', 'New Lead Available in {{postcode}}', '<h1>New Cleaning Lead!</h1><p>Hi {{name}},</p><p>A new {{job_type}} lead is available in {{postcode}}.</p><p><strong>Estimated Value:</strong> {{value}}</p><p>Log in now to unlock this lead before someone else does!</p>', 'Sent when a new lead matches user preferences', ARRAY['name', 'postcode', 'job_type', 'value']),
('lead_unlocked', 'Lead Details - {{job_type}} in {{postcode}}', '<h1>Your Lead Details</h1><p>Hi {{name}},</p><p>Here are the details for your unlocked lead:</p><p><strong>Customer:</strong> {{customer_name}}<br><strong>Phone:</strong> {{customer_phone}}<br><strong>Address:</strong> {{customer_address}}<br><strong>Job Type:</strong> {{job_type}}</p>', 'Sent when a user unlocks a lead', ARRAY['name', 'customer_name', 'customer_phone', 'customer_address', 'job_type', 'postcode']),
('verification_approved', 'Your Business is Now Verified!', '<h1>Congratulations, {{name}}!</h1><p>Your business verification has been approved. You now have full access to all leads and features.</p><p>The verified badge will appear on your profile.</p>', 'Sent when business verification is approved', ARRAY['name', 'business_name']),
('verification_rejected', 'Verification Update Required', '<h1>Hi {{name}},</h1><p>Unfortunately, we couldn''t verify your business with the documents provided.</p><p><strong>Reason:</strong> {{reason}}</p><p>Please upload new documents to try again.</p>', 'Sent when business verification is rejected', ARRAY['name', 'reason']),
('password_reset', 'Reset Your Password', '<h1>Password Reset Request</h1><p>Hi {{name}},</p><p>Click the link below to reset your password:</p><p><a href="{{reset_link}}">Reset Password</a></p><p>If you didn''t request this, you can ignore this email.</p>', 'Sent when user requests password reset', ARRAY['name', 'reset_link']);