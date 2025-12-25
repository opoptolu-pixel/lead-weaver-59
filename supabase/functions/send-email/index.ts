import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "Deep Clean UK <hello@deepcleanco.uk>";
const RESEND_API_URL = "https://api.resend.com/emails";

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

    logStep("Sending email", { to, subject, isTest });

    const emailPayload: any = {
      from: FROM_EMAIL,
      to: [to],
      subject: subject,
      html: html,
    };

    if (replyTo) {
      emailPayload.reply_to = replyTo;
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