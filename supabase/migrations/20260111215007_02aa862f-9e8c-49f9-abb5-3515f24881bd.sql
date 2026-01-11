-- Insert dispute_resolved email template
INSERT INTO email_templates (name, subject, body, description, variables, is_active)
VALUES (
  'dispute_resolved',
  'Your Dispute Has Been Resolved - Case #{{dispute_id}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #10b981;">Dispute Resolved ✓</h2>
  
  <p>Hi {{contact_name}},</p>
  
  <p>Great news! Your dispute (Case #{{dispute_id}}) for lead #{{lead_id}} has been reviewed and resolved in your favour.</p>
  
  <p><strong>Resolution:</strong> {{resolution}}</p>
  
  <p>{{resolution_notes}}</p>
  
  <p>If you have any questions about this resolution, please don''t hesitate to contact our support team at {{support_email}}.</p>
  
  <p style="margin-top: 24px;">
    <a href="{{dashboard_url}}" style="display: inline-block; background-color: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Your Dashboard</a>
  </p>
  
  <p style="margin-top: 24px;">Best regards,<br>The Cleanda Team</p>
  
  <hr style="margin-top: 32px; border: none; border-top: 1px solid #e5e7eb;">
  <p style="font-size: 12px; color: #6b7280;">© {{current_year}} Cleanda Ltd. All rights reserved.</p>
</body>
</html>',
  'Sent when a dispute is resolved in the user''s favour (refund issued)',
  ARRAY['business_name', 'contact_name', 'dispute_id', 'lead_id', 'resolution', 'resolution_notes', 'dashboard_url', 'support_email', 'current_year'],
  true
)
ON CONFLICT (name) DO UPDATE SET 
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = now();