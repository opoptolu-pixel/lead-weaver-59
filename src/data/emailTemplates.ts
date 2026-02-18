// Simplified email templates for better deliverability
// - Minimal HTML styling (high text-to-code ratio)
// - No complex tables or heavy CSS
// - Clean, text-focused content
// - Proper unsubscribe links

export interface EmailTemplateData {
  name: string;
  subject: string;
  description: string;
  variables: string[];
  body: string;
}

// Standardised footer blocks
const CUSTOMER_FOOTER = `
    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888888; line-height: 1.6;">
      Cleanda is a trading name of Orbit Shade Limited (Company No. 15337705)<br>
      First Floor, Swan Buildings, 20 Swan Street, Manchester, M4 5JW<br><br>
      &copy; {{current_year}} Orbit Shade Limited. All rights reserved.<br>
      <a href="{{unsubscribe_url}}" style="color: #888888;">Unsubscribe</a> | <a href="https://cleanda.co.uk/privacy-policy" style="color: #888888;">Privacy Policy</a>
    </p>`;

const PARTNER_FOOTER = `
    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888888; line-height: 1.6;">
      You are receiving this because you are a registered Cleanda partner.<br><br>
      Cleanda is a trading name of Orbit Shade Limited (Company No. 15337705)<br>
      First Floor, Swan Buildings, 20 Swan Street, Manchester, M4 5JW<br><br>
      &copy; {{current_year}} Orbit Shade Limited. All rights reserved.<br>
      <a href="{{unsubscribe_url}}" style="color: #888888;">Unsubscribe</a> | <a href="https://cleanda.co.uk/privacy-policy" style="color: #888888;">Privacy Policy</a>
    </p>`;

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplateData[] = [
  {
    name: "cleaning_request_confirmation",
    subject: "Your Cleaning Request - Ref #{{reference_id}}",
    description: "Sent to customers when they submit a cleaning request",
    variables: ["customer_name", "job_type", "preferred_date", "postcode", "reference_id", "current_year", "unsubscribe_url"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h2 style="color: #0B3D2E; margin-bottom: 20px;">Cleanda - Request Received</h2>
    
    <p>Hi {{customer_name}},</p>
    
    <p>Thank you for choosing Cleanda. Your cleaning request has been received and we are now matching you with a trusted cleaner in your area.</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #0B3D2E;">
      <strong>Your Booking Details:</strong><br>
      Reference: #{{reference_id}}<br>
      Service: {{job_type}}<br>
      Preferred Date: {{preferred_date}}<br>
      Location: {{postcode}}
    </div>
    
    <p><strong>What happens next?</strong></p>
    <p>1. We are finding the best cleaner for your job<br>
    2. A cleaner will contact you within 24 hours<br>
    3. Enjoy a sparkling clean space</p>
    
    <p>Questions? Just reply to this email.</p>
    ${CUSTOMER_FOOTER}
  </div>
</body>
</html>`,
  },
  {
    name: "lead_available_notification",
    subject: "New {{job_type}} Lead in {{postcode_area}}",
    description: "Sent to businesses when a new lead matches their area",
    variables: ["business_name", "contact_name", "job_type", "postcode_area", "display_value", "lead_date", "dashboard_url", "current_year", "unsubscribe_url"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h2 style="color: #0B3D2E; margin-bottom: 20px;">Cleanda - New Lead Available</h2>
    
    <p>Hi {{contact_name}},</p>
    
    <p>A new cleaning lead has come in that matches your service area. Act quickly to secure this job.</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #e8f5e9; border-left: 4px solid #4CAF50;">
      <strong>Lead Details:</strong><br>
      Service: {{job_type}}<br>
      Area: {{postcode_area}}<br>
      Estimated Value: {{display_value}}<br>
      Date Needed: {{lead_date}}
    </div>
    
    <p><a href="{{dashboard_url}}" style="display: inline-block; background-color: #0B3D2E; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Lead & Unlock</a></p>
    
    <p style="font-size: 14px; color: #666666;">Leads are available on a first-come, first-served basis. Use 1 credit to unlock full customer details.</p>
    ${PARTNER_FOOTER}
  </div>
</body>
</html>`,
  },
  {
    name: "welcome_business",
    subject: "Welcome to Cleanda, {{business_name}}",
    description: "Sent to new businesses when they sign up",
    variables: ["business_name", "contact_name", "dashboard_url", "current_year", "unsubscribe_url"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h2 style="color: #0B3D2E; margin-bottom: 20px;">Welcome to Cleanda</h2>
    
    <p>Hi {{contact_name}},</p>
    
    <p>Welcome aboard! We are thrilled to have {{business_name}} join our growing network of professional cleaners across the UK.</p>
    
    <p><strong>Get Started in 4 Simple Steps:</strong></p>
    <p>1. Complete Your Verification - Upload your business documents<br>
    2. Add Credits to Your Account - Purchase credit packs to unlock leads<br>
    3. Browse Available Leads - Find cleaning jobs in your area<br>
    4. Win Jobs & Grow Your Business - Contact customers and deliver great service</p>
    
    <p><a href="{{dashboard_url}}" style="display: inline-block; background-color: #0B3D2E; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Go to Your Dashboard</a></p>
    
    <p>Need help? Reply to this email anytime.</p>
    ${PARTNER_FOOTER}
  </div>
</body>
</html>`,
  },
  {
    name: "lead_unlocked",
    subject: "Lead Unlocked - {{job_type}} in {{postcode}}",
    description: "Sent to businesses when they unlock a lead",
    variables: ["business_name", "contact_name", "job_type", "customer_name", "customer_phone", "customer_email", "customer_address", "postcode", "preferred_date", "display_value", "dashboard_url", "current_year", "unsubscribe_url"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h2 style="color: #0B3D2E; margin-bottom: 20px;">Cleanda - Lead Unlocked</h2>
    
    <p>Hi {{contact_name}},</p>
    
    <p>You have successfully unlocked a new lead. Contact this customer as soon as possible to secure the job.</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #e8f5e9; border-left: 4px solid #4CAF50;">
      <strong>Customer Details:</strong><br>
      Name: {{customer_name}}<br>
      Phone: {{customer_phone}}<br>
      Email: {{customer_email}}<br>
      Address: {{customer_address}}<br><br>
      <strong>Job Details:</strong><br>
      Service: {{job_type}}<br>
      Preferred Date: {{preferred_date}}<br>
      Estimated Value: {{display_value}}
    </div>
    
    <p style="background-color: #fff3e0; padding: 12px; border-radius: 4px;"><strong>Tip:</strong> Call within the first hour to increase your chance of winning this job.</p>
    
    <p><a href="{{dashboard_url}}" style="display: inline-block; background-color: #0B3D2E; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View in Dashboard</a></p>
    ${PARTNER_FOOTER}
  </div>
</body>
</html>`,
  },
  {
    name: "password_reset",
    subject: "Reset Your Cleanda Password",
    description: "Sent when a user requests a password reset",
    variables: ["user_name", "reset_link", "expiry_hours", "current_year", "unsubscribe_url"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h2 style="color: #0B3D2E; margin-bottom: 20px;">Password Reset Request</h2>
    
    <p>Hi {{user_name}},</p>
    
    <p>We received a request to reset your password for your Cleanda account. Click the button below to create a new password.</p>
    
    <p><a href="{{reset_link}}" style="display: inline-block; background-color: #0B3D2E; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Reset My Password</a></p>
    
    <p style="background-color: #fff3e0; padding: 12px; border-radius: 4px;">This link will expire in {{expiry_hours}} hours for security reasons.</p>
    
    <p>If you did not request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>

    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888888; line-height: 1.6;">
      This is an automated security email from Cleanda.<br><br>
      Cleanda is a trading name of Orbit Shade Limited (Company No. 15337705)<br>
      First Floor, Swan Buildings, 20 Swan Street, Manchester, M4 5JW<br><br>
      &copy; {{current_year}} Orbit Shade Limited. All rights reserved.<br>
      <a href="{{unsubscribe_url}}" style="color: #888888;">Unsubscribe</a> | <a href="https://cleanda.co.uk/privacy-policy" style="color: #888888;">Privacy Policy</a>
    </p>
  </div>
</body>
</html>`,
  },
  {
    name: "verification_approved",
    subject: "Your Cleanda Account is Verified",
    description: "Sent when a business verification is approved",
    variables: ["business_name", "contact_name", "dashboard_url", "current_year", "unsubscribe_url"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h2 style="color: #0B3D2E; margin-bottom: 20px;">Verification Approved</h2>
    
    <p>Hi {{contact_name}},</p>
    
    <p>Great news! {{business_name}} has been verified. You now have full access to all Cleanda features and can unlock unlimited leads.</p>
    
    <p><strong>What you can do now:</strong></p>
    <p>- Browse and unlock all available leads<br>
    - Access customer contact details<br>
    - Build your reputation on our platform</p>
    
    <p><a href="{{dashboard_url}}" style="display: inline-block; background-color: #0B3D2E; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Start Finding Leads</a></p>
    ${PARTNER_FOOTER}
  </div>
</body>
</html>`,
  },
  {
    name: "credits_purchased",
    subject: "Credits Added to Your Cleanda Account",
    description: "Sent when a business purchases credits",
    variables: ["business_name", "contact_name", "credits_amount", "new_balance", "dashboard_url", "current_year", "unsubscribe_url"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h2 style="color: #0B3D2E; margin-bottom: 20px;">Credits Added</h2>
    
    <p>Hi {{contact_name}},</p>
    
    <p>Your credit purchase was successful.</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #0B3D2E;">
      Credits Added: {{credits_amount}}<br>
      New Balance: {{new_balance}} credits
    </div>
    
    <p>Your credits are ready to use. Start unlocking leads now!</p>
    
    <p><a href="{{dashboard_url}}" style="display: inline-block; background-color: #0B3D2E; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Browse Leads</a></p>
    ${PARTNER_FOOTER}
  </div>
</body>
</html>`,
  },
  {
    name: "dispute_received",
    subject: "Dispute Received - We Are Looking Into It",
    description: "Sent when a business submits a dispute",
    variables: ["business_name", "contact_name", "dispute_id", "lead_reference", "dashboard_url", "current_year", "unsubscribe_url"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h2 style="color: #0B3D2E; margin-bottom: 20px;">Dispute Received</h2>
    
    <p>Hi {{contact_name}},</p>
    
    <p>We have received your dispute and our team is reviewing it.</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #0B3D2E;">
      Dispute ID: #{{dispute_id}}<br>
      Lead Reference: {{lead_reference}}
    </div>
    
    <p>We aim to resolve all disputes within 3-5 business days. We will email you with the outcome.</p>
    
    <p><a href="{{dashboard_url}}" style="display: inline-block; background-color: #0B3D2E; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Dispute Status</a></p>
    ${PARTNER_FOOTER}
  </div>
</body>
</html>`,
  },
  {
    name: "dispute_resolved",
    subject: "Dispute Resolved - {{resolution_outcome}}",
    description: "Sent when a dispute is resolved",
    variables: ["business_name", "contact_name", "dispute_id", "resolution_outcome", "resolution_details", "credits_refunded", "dashboard_url", "current_year", "unsubscribe_url"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h2 style="color: #0B3D2E; margin-bottom: 20px;">Dispute Resolved</h2>
    
    <p>Hi {{contact_name}},</p>
    
    <p>Your dispute has been reviewed and resolved.</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #0B3D2E;">
      Dispute ID: #{{dispute_id}}<br>
      Outcome: {{resolution_outcome}}<br>
      Credits Refunded: {{credits_refunded}}
    </div>
    
    <p>{{resolution_details}}</p>
    
    <p><a href="{{dashboard_url}}" style="display: inline-block; background-color: #0B3D2E; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Your Account</a></p>
    ${PARTNER_FOOTER}
  </div>
</body>
</html>`,
  },
  {
    name: "insurance_expiry_reminder",
    subject: "{{urgency_prefix}}Your Insurance {{urgency_text}}",
    description: "Sent to businesses when their insurance certificate is about to expire",
    variables: ["contact_name", "business_name", "urgency_text", "urgency_prefix", "expiry_date", "days_remaining", "is_urgent", "current_year", "unsubscribe_url"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h2 style="color: #0B3D2E; margin-bottom: 20px;">Insurance Expiry Reminder</h2>
    
    <p>Hi {{contact_name}},</p>
    
    <p>This is a friendly reminder that your insurance certificate for <strong>{{business_name}}</strong> {{urgency_text}}.</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #fffbeb; border-left: 4px solid #f59e0b;">
      <strong>Expiry Date:</strong> {{expiry_date}}<br>
      <strong>Days Remaining:</strong> {{days_remaining}}
    </div>
    
    <p><strong>What you need to do:</strong></p>
    <p>1. Renew your insurance policy before it expires<br>
    2. Upload your new insurance certificate to Cleanda<br>
    3. Keep your verification status active</p>
    
    <p><a href="https://cleanda.co.uk/settings/verification" style="display: inline-block; background-color: #0B3D2E; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Upload New Insurance</a></p>
    ${PARTNER_FOOTER}
  </div>
</body>
</html>`,
  },
];
