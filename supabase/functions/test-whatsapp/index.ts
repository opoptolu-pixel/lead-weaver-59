import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[TEST-WHATSAPP] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();
    
    if (!phone) {
      throw new Error("Phone number is required");
    }

    logStep("Starting test", { phone });

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
    formData.append("Body", `🧪 Test message from Cleanda! WhatsApp integration is working correctly. Sent at: ${new Date().toISOString()}`);

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
      from: fromNumber
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
