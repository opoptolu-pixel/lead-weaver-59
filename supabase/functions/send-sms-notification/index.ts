import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[SMS-NOTIFICATION] ${step}`, details ? JSON.stringify(details) : "");
};

interface SMSNotificationRequest {
  type: "new_lead" | "lead_unlocked";
  leadId: string;
  userId?: string;
}

async function sendSMS(to: string, body: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_SMS_FROM");

  if (!accountSid || !authToken) {
    throw new Error("Missing Twilio credentials");
  }

  if (!from) {
    throw new Error("Missing TWILIO_SMS_FROM");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  
  const formData = new URLSearchParams();
  formData.append("To", to);
  formData.append("From", from);
  formData.append("Body", body);

  logStep("Sending SMS", { to, bodyLength: body.length });

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
    throw new Error(`Twilio error: ${result.message || result.code || "Unknown error"}`);
  }

  logStep("SMS sent successfully", { sid: result.sid, status: result.status });
  return result;
}

// Format phone number to E.164 format
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("44")) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith("0")) {
    return `+44${cleaned.slice(1)}`;
  }
  return `+44${cleaned}`;
}

// Extract outward code from postcode
function getOutwardCode(postcode: string): string {
  if (!postcode) return "Unknown";
  const trimmed = postcode.trim().toUpperCase();
  if (trimmed.includes(" ")) {
    return trimmed.split(" ")[0];
  }
  if (trimmed.length > 4) {
    return trimmed.slice(0, -3);
  }
  return trimmed;
}

// Extract value without "from" prefix
function extractValue(displayValue: string): string {
  if (!displayValue) return "Contact for quote";
  return displayValue.replace(/^from\s+/i, "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, leadId, userId }: SMSNotificationRequest = await req.json();
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
      // Send to all opted-in users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .eq("whatsapp_optin", true) // Using same opt-in field for SMS
        .not("phone", "is", null);

      if (profilesError) {
        throw new Error(`Error fetching profiles: ${profilesError.message}`);
      }

      logStep("Found opted-in users", { count: profiles?.length || 0 });

      const outwardPostcode = getOutwardCode(lead.postcode);
      const cleanValue = extractValue(lead.display_value);
      
      // New lead SMS message
      const message = `New lead in ${outwardPostcode}!\n\n` +
        `${lead.job_type}\n` +
        `Value: ${cleanValue}\n\n` +
        `Login to Cleanda to view and unlock this lead.\n\n` +
        `- Cleanda`;

      const results = [];
      for (const profile of profiles || []) {
        if (!profile.phone) continue;

        try {
          const formattedPhone = formatPhoneNumber(profile.phone);
          await sendSMS(formattedPhone, message);
          results.push({ userId: profile.user_id, status: "sent" });
        } catch (err: any) {
          logStep("Failed to send to user", { userId: profile.user_id, error: err.message });
          results.push({ userId: profile.user_id, status: "failed", error: err.message });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
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

      // Lead unlocked SMS message with customer details
      const message = `Lead unlocked!\n\n` +
        `Customer: ${lead.customer_name || "Not provided"}\n` +
        `Phone: ${lead.customer_phone || "Not provided"}\n` +
        `Email: ${lead.customer_email || "Not provided"}\n` +
        `Address: ${lead.customer_address || "Contact for address"}\n\n` +
        `Good luck with this job!\n` +
        `- Cleanda`;

      const formattedPhone = formatPhoneNumber(profile.phone);
      await sendSMS(formattedPhone, message);

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
