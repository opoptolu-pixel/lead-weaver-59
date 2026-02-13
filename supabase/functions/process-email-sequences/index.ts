import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "Cleanda <hello@cleanda.co.uk>";
const RESEND_API_URL = "https://api.resend.com/emails";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-EMAIL-SEQUENCES] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find active enrollments due to send
    const { data: dueEnrollments, error: fetchError } = await supabase
      .from("email_sequence_enrollments")
      .select("*")
      .eq("status", "active")
      .lte("next_send_at", new Date().toISOString())
      .limit(50);

    if (fetchError) throw fetchError;

    logStep(`Found ${dueEnrollments?.length || 0} due enrollments`);

    let sent = 0;
    let failed = 0;

    for (const enrollment of (dueEnrollments || [])) {
      try {
        const nextStepOrder = enrollment.current_step + 1;

        // Get the next step
        const { data: step, error: stepError } = await supabase
          .from("email_sequence_steps")
          .select("*")
          .eq("sequence_id", enrollment.sequence_id)
          .eq("step_order", nextStepOrder)
          .eq("is_active", true)
          .maybeSingle();

        if (stepError) throw stepError;

        if (!step) {
          // No more steps - mark as completed
          await supabase
            .from("email_sequence_enrollments")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              next_send_at: null,
            })
            .eq("id", enrollment.id);
          logStep("Enrollment completed", { enrollmentId: enrollment.id });
          continue;
        }

        // Check the parent sequence is still active
        const { data: sequence } = await supabase
          .from("email_sequences")
          .select("status")
          .eq("id", enrollment.sequence_id)
          .maybeSingle();

        if (!sequence || sequence.status !== "active") {
          logStep("Sequence not active, skipping", { sequenceId: enrollment.sequence_id });
          continue;
        }

        // Replace variables
        const currentYear = new Date().getFullYear().toString();
        let htmlBody = step.body
          .replace(/\{\{contact_name\}\}/g, enrollment.recipient_name || "there")
          .replace(/\{\{customer_name\}\}/g, enrollment.recipient_name || "there")
          .replace(/\{\{business_name\}\}/g, enrollment.recipient_name || "Business")
          .replace(/\{\{current_year\}\}/g, currentYear)
          .replace(/\{\{unsubscribe_url\}\}/g, `${supabaseUrl}/functions/v1/unsubscribe?email=${encodeURIComponent(enrollment.recipient_email)}`);

        let subject = step.subject
          .replace(/\{\{contact_name\}\}/g, enrollment.recipient_name || "there")
          .replace(/\{\{customer_name\}\}/g, enrollment.recipient_name || "there")
          .replace(/\{\{business_name\}\}/g, enrollment.recipient_name || "Business")
          .replace(/\{\{current_year\}\}/g, currentYear);

        // Send email via Resend
        const response = await fetch(RESEND_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [enrollment.recipient_email],
            subject,
            html: htmlBody,
          }),
        });

        const responseData = await response.json();
        if (!response.ok) throw new Error(responseData.message || "Failed to send");

        // Log the send
        await supabase.from("email_sequence_logs").insert({
          enrollment_id: enrollment.id,
          step_id: step.id,
          recipient_email: enrollment.recipient_email,
          subject,
          status: "sent",
          resend_id: responseData.id,
        });

        // Calculate next send time
        const { data: nextStep } = await supabase
          .from("email_sequence_steps")
          .select("delay_days, delay_hours")
          .eq("sequence_id", enrollment.sequence_id)
          .eq("step_order", nextStepOrder + 1)
          .eq("is_active", true)
          .maybeSingle();

        const nextSendAt = nextStep
          ? new Date(Date.now() + (nextStep.delay_days * 86400000) + (nextStep.delay_hours * 3600000)).toISOString()
          : null;

        await supabase
          .from("email_sequence_enrollments")
          .update({
            current_step: nextStepOrder,
            next_send_at: nextSendAt,
            ...(nextSendAt ? {} : { status: "completed", completed_at: new Date().toISOString() }),
          })
          .eq("id", enrollment.id);

        // Also log in email_logs for deliverability tracking
        await supabase.from("email_logs").insert({
          template_name: `sequence_step_${nextStepOrder}`,
          recipient_email: enrollment.recipient_email,
          subject,
          status: "sent",
          resend_id: responseData.id,
        });

        sent++;
        logStep("Email sent", { enrollmentId: enrollment.id, step: nextStepOrder });
      } catch (error: any) {
        failed++;
        logStep("Failed to process enrollment", { enrollmentId: enrollment.id, error: error.message });
      }
    }

    logStep("Complete", { sent, failed });

    return new Response(JSON.stringify({ success: true, sent, failed }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
