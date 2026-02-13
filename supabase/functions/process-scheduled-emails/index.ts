import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "Cleanda <hello@cleanda.co.uk>";
const RESEND_API_URL = "https://api.resend.com/emails";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-SCHEDULED-EMAILS] ${step}${detailsStr}`);
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

    // Get all pending scheduled emails that are due
    const { data: scheduledEmails, error: fetchError } = await supabase
      .from("scheduled_emails")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .limit(10);

    if (fetchError) {
      throw new Error(`Failed to fetch scheduled emails: ${fetchError.message}`);
    }

    logStep("Found scheduled emails to process", { count: scheduledEmails?.length || 0 });

    if (!scheduledEmails || scheduledEmails.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let processed = 0;
    let failed = 0;

    for (const scheduled of scheduledEmails) {
      try {
        logStep("Sending scheduled email", { id: scheduled.id, to: scheduled.recipient_email });

        // Check if recipient has unsubscribed before sending
        const { data: subscriber } = await supabase
          .from("email_subscribers")
          .select("is_active, unsubscribed_at")
          .eq("email", scheduled.recipient_email)
          .maybeSingle();

        if (subscriber && (!subscriber.is_active || subscriber.unsubscribed_at)) {
          logStep("Skipping unsubscribed recipient", { email: scheduled.recipient_email });
          
          // Mark as cancelled instead of sending
          await supabase
            .from("scheduled_emails")
            .update({
              status: "cancelled",
              error_message: "Recipient has unsubscribed",
            })
            .eq("id", scheduled.id);
          continue;
        }

        // Send the email
        const response = await fetch(RESEND_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [scheduled.recipient_email],
            subject: scheduled.subject,
            html: scheduled.html_body,
          }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData.message || "Failed to send email");
        }

        // Update scheduled email status to sent
        await supabase
          .from("scheduled_emails")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", scheduled.id);

        // Log the email
        await supabase
          .from("email_logs")
          .insert({
            template_id: scheduled.template_id,
            template_name: scheduled.template_name,
            recipient_email: scheduled.recipient_email,
            subject: scheduled.subject,
            status: "sent",
            resend_id: responseData.id,
            is_test: scheduled.is_test,
          });

        logStep("Email sent successfully", { id: scheduled.id, resendId: responseData.id });
        processed++;
      } catch (error: any) {
        logStep("Failed to send email", { id: scheduled.id, error: error.message });

        // Update scheduled email status to failed
        await supabase
          .from("scheduled_emails")
          .update({
            status: "failed",
            error_message: error.message,
          })
          .eq("id", scheduled.id);

        failed++;
      }
    }

    logStep("Processing complete", { processed, failed });

    return new Response(JSON.stringify({ processed, failed }), {
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
