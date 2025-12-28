import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Use hello@ for all emails - more trustworthy to spam filters than noreply@
const FROM_EMAIL = "Cleanda <hello@cleanda.co.uk>";
const RESEND_API_URL = "https://api.resend.com/emails";
const UNSUBSCRIBE_EMAIL = "unsubscribe@cleanda.co.uk";
const SUPABASE_PROJECT_URL = "https://jqyhiekqqcffiwpctzsi.supabase.co";
// Support email for users who want to contact us
const SUPPORT_EMAIL = "hello@cleanda.co.uk";

// Generate unsubscribe URL with token for one-click unsubscribe
const generateUnsubscribeUrl = (email: string): string => {
  const token = btoa(email); // Simple token - email encoded
  return `${SUPABASE_PROJECT_URL}/functions/v1/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string; // Plain text version for better deliverability
  replyTo?: string;
  templateId?: string;
  templateName?: string;
  isTest?: boolean;
}

// Strip HTML to plain text for better deliverability
const htmlToPlainText = (html: string): string => {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove style tags
    .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags
    .replace(/<br\s*\/?>/gi, '\n') // Convert br to newline
    .replace(/<\/p>/gi, '\n\n') // Convert closing p to double newline
    .replace(/<\/div>/gi, '\n') // Convert closing div to newline
    .replace(/<\/tr>/gi, '\n') // Convert closing tr to newline
    .replace(/<\/h[1-6]>/gi, '\n\n') // Convert closing headers
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)') // Convert links
    .replace(/<[^>]+>/g, '') // Remove remaining tags
    .replace(/&nbsp;/g, ' ') // Convert nbsp
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .trim();
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-EMAIL] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { to, subject, html, text, replyTo, templateId, templateName, isTest }: EmailRequest = await req.json();

    if (!to || !subject || !html) {
      throw new Error("Missing required fields: to, subject, html");
    }

    // Generate plain text version if not provided
    const plainText = text || htmlToPlainText(html);

    // Check if recipient has unsubscribed (skip for test emails)
    if (!isTest) {
      const { data: subscriber } = await supabase
        .from("email_subscribers")
        .select("is_active, unsubscribed_at")
        .eq("email", to)
        .maybeSingle();

      if (subscriber && (!subscriber.is_active || subscriber.unsubscribed_at)) {
        logStep("Skipping unsubscribed recipient", { to });
        return new Response(JSON.stringify({ 
          success: false, 
          skipped: true, 
          reason: "Recipient has unsubscribed" 
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    logStep("Sending email", { to, subject, isTest });

    const unsubscribeUrl = generateUnsubscribeUrl(to);
    
    // Determine if this is a transactional email (confirmations, receipts) vs marketing
    const isTransactional = templateName?.includes('confirmation') || 
                            templateName?.includes('receipt') || 
                            templateName?.includes('verification') ||
                            templateName?.includes('password');

    const emailPayload: any = {
      from: FROM_EMAIL,
      to: [to],
      subject: subject,
      html: html,
      text: plainText, // Plain text version improves deliverability
      headers: {
        // RFC 8058 one-click unsubscribe (required by Gmail for bulk senders)
        "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:${UNSUBSCRIBE_EMAIL}?subject=Unsubscribe%20${encodeURIComponent(to)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "Organization": "Cleanda Ltd",
        "X-Mailer": "Cleanda Mailer",
        "X-Entity-Ref-ID": `cleanda-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      },
    };

    // Only add marketing-specific headers for non-transactional emails
    if (!isTransactional) {
      // Feedback ID for Google Postmaster Tools - format: identifier:identifier:identifier:identifier
      emailPayload.headers["Feedback-ID"] = `${templateName || 'notification'}:cleanda:leads:service`;
    }

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      logStep("Resend API error", { status: response.status, error: responseData });
      throw new Error(responseData.message || "Failed to send email");
    }

    logStep("Email sent successfully", { id: responseData.id });

    // Log the email to database for tracking
    const { error: logError } = await supabase
      .from("email_logs")
      .insert({
        template_id: templateId || null,
        template_name: templateName || null,
        recipient_email: to,
        subject: subject,
        status: "sent",
        resend_id: responseData.id,
        is_test: isTest || false,
      });

    if (logError) {
      logStep("Warning: Failed to log email", { error: logError.message });
    } else {
      logStep("Email logged successfully");
    }

    return new Response(JSON.stringify({ success: true, id: responseData.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});