import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[CUSTOMER-CONFIRM] ${step}`, details ? JSON.stringify(details) : "");
};

interface ConfirmationRequest {
  leadId: string;
  method?: "whatsapp" | "sms";
  autoPublishHours?: number; // Default 24 hours
}

async function sendWhatsAppMessage(to: string, body: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM");

  if (!accountSid || !authToken || !from) {
    throw new Error("Missing Twilio credentials");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  const formData = new URLSearchParams();
  formData.append("To", `whatsapp:${to}`);
  formData.append("From", from);
  formData.append("Body", body);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const result = await response.json();
  
  if (!response.ok) {
    logStep("Twilio error", result);
    throw new Error(`Twilio error: ${result.message || "Unknown error"}`);
  }

  logStep("Message sent successfully", { sid: result.sid });
  return result;
}

async function sendSMSMessage(to: string, body: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

  if (!accountSid || !authToken) {
    throw new Error("Missing Twilio credentials");
  }

  // Get the SMS from number or use a default Twilio number
  const from = Deno.env.get("TWILIO_SMS_FROM") || Deno.env.get("TWILIO_WHATSAPP_FROM")?.replace("whatsapp:", "");

  if (!from) {
    throw new Error("Missing Twilio SMS number");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  const formData = new URLSearchParams();
  formData.append("To", to);
  formData.append("From", from);
  formData.append("Body", body);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const result = await response.json();
  
  if (!response.ok) {
    logStep("Twilio SMS error", result);
    throw new Error(`Twilio SMS error: ${result.message || "Unknown error"}`);
  }

  logStep("SMS sent successfully", { sid: result.sid });
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { leadId, method = "whatsapp", autoPublishHours = 24 }: ConfirmationRequest = await req.json();
    logStep("Received confirmation request", { leadId, method, autoPublishHours });

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error(`Lead not found: ${leadError?.message}`);
    }

    logStep("Lead found", { jobType: lead.job_type, postcode: lead.postcode, phone: lead.customer_phone });

    // Format phone number
    const phone = lead.customer_phone.replace(/\D/g, "");
    const formattedPhone = phone.startsWith("44") 
      ? `+${phone}` 
      : `+44${phone.startsWith("0") ? phone.slice(1) : phone}`;

    // Create confirmation message - no emojis for better deliverability
    const message = `Hi ${lead.customer_name},\n\n` +
      `We've received your cleaning request for ${lead.job_type} at ${lead.postcode}.\n\n` +
      `Reply YES to confirm and get matched with local cleaning professionals.\n\n` +
      `Reply NO to cancel this request.\n\n` +
      `- Cleanda`;

    // Calculate auto-publish time
    const autoPublishAt = new Date();
    autoPublishAt.setHours(autoPublishAt.getHours() + autoPublishHours);

    // Send message based on method
    if (method === "whatsapp") {
      await sendWhatsAppMessage(formattedPhone, message);
    } else {
      await sendSMSMessage(formattedPhone, message);
    }

    // Update lead status to pending confirmation
    const { error: updateError } = await supabase
      .from("leads")
      .update({
        lead_status: "pending_confirmation",
        confirmation_sent_at: new Date().toISOString(),
        confirmation_method: method,
        auto_publish_at: autoPublishAt.toISOString(),
      })
      .eq("id", leadId);

    if (updateError) {
      throw new Error(`Failed to update lead: ${updateError.message}`);
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      user_id: lead.unlocked_by || "00000000-0000-0000-0000-000000000000",
      entity_type: "lead",
      entity_id: leadId,
      action: "confirmation_sent",
      details: {
        previous_status: lead.lead_status,
        new_status: "pending_confirmation",
        method,
        auto_publish_at: autoPublishAt.toISOString(),
      },
    });

    logStep("Lead updated to pending_confirmation", { autoPublishAt });

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Confirmation ${method} sent`,
      autoPublishAt: autoPublishAt.toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    logStep("Error", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});