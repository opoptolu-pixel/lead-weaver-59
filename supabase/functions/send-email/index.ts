import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "Cleanda <hello@cleanda.co.uk>";
const RESEND_API_URL = "https://api.resend.com/emails";
const UNSUBSCRIBE_EMAIL = "unsubscribe@cleanda.co.uk";
const SUPABASE_PROJECT_URL = "https://jqyhiekqqcffiwpctzsi.supabase.co";

// Generate unsubscribe URL with token for one-click unsubscribe
const generateUnsubscribeUrl = (email: string): string => {
  const token = btoa(email); // Simple token - email encoded
  return `${SUPABASE_PROJECT_URL}/functions/v1/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  templateId?: string;
  templateName?: string;
  isTest?: boolean;
}

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

    const { to, subject, html, replyTo, templateId, templateName, isTest }: EmailRequest = await req.json();

    if (!to || !subject || !html) {
      throw new Error("Missing required fields: to, subject, html");
    }

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
    
    const emailPayload: any = {
      from: FROM_EMAIL,
      to: [to],
      subject: subject,
      html: html,
      reply_to: replyTo || "hello@cleanda.co.uk",
      headers: {
        // RFC 8058 one-click unsubscribe (required by Gmail for bulk senders)
        "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:${UNSUBSCRIBE_EMAIL}?subject=Unsubscribe%20${encodeURIComponent(to)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        // Identifies as subscription-based email
        "Precedence": "bulk",
        // Feedback ID for Google Postmaster Tools tracking (campaign:sender:list:mailtype)
        "Feedback-ID": `${templateName || 'transactional'}:cleanda:subscribers:marketing`,
        // Organization header
        "Organization": "Cleanda Ltd",
      },
    };

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