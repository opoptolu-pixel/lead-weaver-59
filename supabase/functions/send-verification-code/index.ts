import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-VERIFICATION-CODE] ${step}${detailsStr}`);
};

// Generate secure 8-character alphanumeric code (increases entropy significantly)
// 36^8 = ~2.8 trillion possible combinations vs 10^6 = 1 million for 6-digit
function generateSecureCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar characters (I, O, 0, 1)
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    // Initialize Supabase client with user's auth
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");
    logStep("User verified", { userId: user.id });

    const { phone } = await req.json();
    if (!phone) throw new Error("Phone number is required");
    
    // Validate phone format (basic validation)
    if (typeof phone !== 'string' || phone.length < 10 || phone.length > 20) {
      throw new Error("Invalid phone number format");
    }
    logStep("Phone received", { phone });

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check if user is currently locked out from too many failed attempts
    const { data: lockedCode } = await supabaseAdmin
      .from("phone_verification_codes")
      .select("locked_until")
      .eq("user_id", user.id)
      .gt("locked_until", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lockedCode?.locked_until) {
      const lockExpiry = new Date(lockedCode.locked_until);
      const remainingMinutes = Math.ceil((lockExpiry.getTime() - Date.now()) / (60 * 1000));
      logStep("User is locked out", { locked_until: lockedCode.locked_until });
      throw new Error(`Too many failed attempts. Please try again in ${remainingMinutes} minutes.`);
    }

    // Generate secure 8-character alphanumeric code
    const code = generateSecureCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate any existing unverified codes for this user
    await supabaseAdmin
      .from("phone_verification_codes")
      .update({ expires_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString());

    // Store code in database
    const { error: insertError } = await supabaseAdmin
      .from("phone_verification_codes")
      .insert({
        user_id: user.id,
        phone: phone,
        code: code,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
      });

    if (insertError) throw new Error(`Failed to store code: ${insertError.message}`);
    logStep("Code stored in database");

    // Send via WhatsApp (using existing Twilio WhatsApp configuration)
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_WHATSAPP_FROM");

    if (!twilioAccountSid || !twilioAuthToken || !twilioFrom) {
      throw new Error("Twilio credentials not configured");
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const formData = new URLSearchParams();
    formData.append("To", `whatsapp:${phone}`);
    // Ensure From has whatsapp: prefix (handle both cases: with or without prefix in env)
    const fromNumber = twilioFrom.startsWith("whatsapp:") ? twilioFrom : `whatsapp:${twilioFrom}`;
    formData.append("From", fromNumber);
    formData.append("Body", `Your Deep Clean UK verification code is: ${code}. Valid for 10 minutes. Do not share this code with anyone.`);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
      },
      body: formData.toString(),
    });

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      logStep("Twilio error", { status: twilioResponse.status, error: errorText });
      throw new Error("Failed to send WhatsApp message");
    }

    logStep("WhatsApp verification message sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
