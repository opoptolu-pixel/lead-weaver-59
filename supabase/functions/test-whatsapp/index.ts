import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[TEST-WHATSAPP] ${step}`, details ? JSON.stringify(details) : "");
};

// Approved WhatsApp template SIDs
const TEMPLATE_SIDS = {
  new_lead: "HXc3db59223fff5a94bde64cd87bbd2e4c",
  lead_unlocked: "HXa096583e8373561638f29908da545ea4",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, template } = await req.json();
    
    if (!phone) {
      throw new Error("Phone number is required");
    }

    logStep("Starting test", { phone, template });

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_WHATSAPP_FROM");

    logStep("Credentials check", { 
      hasAccountSid: !!accountSid, 
      hasAuthToken: !!authToken, 
      from 
    });

    if (!accountSid || !authToken) {
      throw new Error("Missing Twilio credentials");
    }

    if (!from) {
      throw new Error("Missing TWILIO_WHATSAPP_FROM");
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    const toNumber = phone.startsWith("+") ? phone : `+${phone}`;
    formData.append("To", `whatsapp:${toNumber}`);
    
    // Ensure from number has whatsapp: prefix
    const fromNumber = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
    formData.append("From", fromNumber);

    // Use template if specified, otherwise send plain test message
    if (template === "new_lead") {
      // Test cleanda_new_lead template with sample data
      formData.append("ContentSid", TEMPLATE_SIDS.new_lead);
      formData.append("ContentVariables", JSON.stringify({
        "1": "SW1A",           // Outward postcode only
        "2": "Regular Cleaning", // Job type
        "3": "£120",           // Value without "from" prefix
      }));
      logStep("Using new_lead template", { contentSid: TEMPLATE_SIDS.new_lead });
    } else if (template === "lead_unlocked") {
      // Test cleanda_lead_unlocked template with sample data
      formData.append("ContentSid", TEMPLATE_SIDS.lead_unlocked);
      formData.append("ContentVariables", JSON.stringify({
        "1": "John Smith",
        "2": "07700 900123",
        "3": "john@example.com",
        "4": "123 Main Street, London",
      }));
      logStep("Using lead_unlocked template", { contentSid: TEMPLATE_SIDS.lead_unlocked });
    } else {
      // Plain test message (may fail outside 24h window)
      formData.append("Body", `🧪 Test message from Cleanda! WhatsApp integration is working correctly. Sent at: ${new Date().toISOString()}`);
      logStep("Using plain text message");
    }

    logStep("Sending message", { to: `whatsapp:${toNumber}`, from: fromNumber });

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
      logStep("Twilio error", { status: response.status, result });
      throw new Error(`Twilio error: ${result.message || result.code || "Unknown error"}`);
    }

    logStep("Message sent successfully", { sid: result.sid, status: result.status });

    return new Response(JSON.stringify({ 
      success: true, 
      sid: result.sid,
      status: result.status,
      to: `whatsapp:${toNumber}`,
      from: fromNumber,
      template: template || "plain"
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
