import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[WHATSAPP] ${step}`, details ? JSON.stringify(details) : "");
};

// Approved WhatsApp template SIDs
const TEMPLATE_SIDS = {
  new_lead: "HXc3db59223fff5a94bde64cd87bbd2e4c",
  lead_unlocked: "HXa096583e8373561638f29908da545ea4",
};

interface WhatsAppRequest {
  type: "new_lead" | "lead_unlocked";
  leadId: string;
  userId?: string;
}

async function sendWhatsAppTemplate(
  to: string, 
  contentSid: string, 
  contentVariables: Record<string, string>
) {
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
  formData.append("ContentSid", contentSid);
  formData.append("ContentVariables", JSON.stringify(contentVariables));

  logStep("Sending template message", { to, contentSid, contentVariables });

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
    throw new Error(`Twilio error: ${result.message || result.code || "Unknown error"}`);
  }

  logStep("Template message sent successfully", { sid: result.sid, status: result.status });
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

    const { type, leadId, userId }: WhatsAppRequest = await req.json();
    logStep("Received request", { type, leadId, userId });

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error(`Lead not found: ${leadError?.message}`);
    }

    logStep("Lead found", { jobType: lead.job_type, postcode: lead.postcode });

    if (type === "new_lead") {
      // Send to all opted-in users in the area
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .eq("whatsapp_optin", true)
        .not("phone", "is", null);

      if (profilesError) {
        throw new Error(`Error fetching profiles: ${profilesError.message}`);
      }

      logStep("Found opted-in users", { count: profiles?.length || 0 });

      // Template variables for cleanda_new_lead:
      // {{1}} = postcode/area
      // {{2}} = job type
      // {{3}} = estimated value
      // {{4}} = dashboard URL
      const dashboardUrl = "https://cleanda.co.uk/dashboard";
      
      const messages = [];
      for (const profile of profiles || []) {
        if (!profile.phone) continue;

        const contentVariables = {
          "1": lead.postcode || "Unknown",
          "2": lead.job_type || "Cleaning",
          "3": lead.display_value || "Contact for quote",
          "4": dashboardUrl,
        };

        try {
          await sendWhatsAppTemplate(profile.phone, TEMPLATE_SIDS.new_lead, contentVariables);
          messages.push({ userId: profile.user_id, status: "sent" });
        } catch (err: any) {
          logStep("Failed to send to user", { userId: profile.user_id, error: err.message });
          messages.push({ userId: profile.user_id, status: "failed", error: err.message });
        }
      }

      return new Response(JSON.stringify({ success: true, messages }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === "lead_unlocked") {
      // Send full details to the user who unlocked
      if (!userId) {
        throw new Error("userId required for lead_unlocked type");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (profileError || !profile) {
        throw new Error(`Profile not found: ${profileError?.message}`);
      }

      if (!profile.phone || !profile.whatsapp_optin) {
        logStep("User not opted in or no phone", { userId });
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Template variables for cleanda_lead_unlocked:
      // {{1}} = postcode/area
      // {{2}} = customer name
      // {{3}} = customer email
      // {{4}} = customer address
      const contentVariables = {
        "1": lead.postcode || "Unknown",
        "2": lead.customer_name || "Customer",
        "3": lead.customer_email || "Not provided",
        "4": lead.customer_address || "Contact for address",
      };

      await sendWhatsAppTemplate(profile.phone, TEMPLATE_SIDS.lead_unlocked, contentVariables);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid notification type");

  } catch (error: any) {
    logStep("Error", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
