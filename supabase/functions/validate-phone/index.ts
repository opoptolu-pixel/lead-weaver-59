import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidationRequest {
  phone: string;
  countryCode?: string; // Default to GB
}

interface ValidationResponse {
  valid: boolean;
  phoneNumber?: string;
  nationalFormat?: string;
  countryCode?: string;
  carrier?: string;
  type?: string; // mobile, landline, voip, etc.
  error?: string;
}

// Clean and normalize UK phone number
const normalizeUKPhone = (phone: string): string => {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle UK formats
  if (cleaned.startsWith('44')) {
    // Already has country code
    cleaned = '+' + cleaned;
  } else if (cleaned.startsWith('0')) {
    // UK domestic format - convert to international
    cleaned = '+44' + cleaned.substring(1);
  } else if (cleaned.length === 10) {
    // Missing leading 0, assume UK mobile
    cleaned = '+44' + cleaned;
  } else {
    // Default: add +44
    cleaned = '+44' + cleaned;
  }
  
  return cleaned;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!twilioAccountSid || !twilioAuthToken) {
      console.error("[VALIDATE-PHONE] Twilio credentials not configured");
      return new Response(
        JSON.stringify({ 
          valid: true, // Fail open if Twilio not configured
          error: "Validation service not configured" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ValidationRequest = await req.json();

    if (!body.phone) {
      return new Response(
        JSON.stringify({ valid: false, error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize the phone number
    const normalizedPhone = normalizeUKPhone(body.phone);
    const countryCode = body.countryCode || "GB";

    console.log("[VALIDATE-PHONE] Validating:", { 
      original: body.phone, 
      normalized: normalizedPhone,
      countryCode 
    });

    // Call Twilio Lookup API v2
    const encodedPhone = encodeURIComponent(normalizedPhone);
    const lookupUrl = `https://lookups.twilio.com/v2/PhoneNumbers/${encodedPhone}?Fields=line_type_intelligence`;

    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const response = await fetch(lookupUrl, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[VALIDATE-PHONE] Twilio API error:", data);
      
      // Check for specific error codes
      if (data.code === 20404) {
        // Phone number not found - invalid
        return new Response(
          JSON.stringify({ 
            valid: false, 
            error: "This phone number does not exist or is not in service" 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // For other errors, fail open (allow submission but flag)
      return new Response(
        JSON.stringify({ 
          valid: true, 
          error: "Could not verify phone number",
          phoneNumber: normalizedPhone
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract line type info if available
    const lineType = data.line_type_intelligence;
    const phoneType = lineType?.type || "unknown";
    const carrier = lineType?.carrier_name || "unknown";

    // Determine if valid
    // We accept mobile, landline, and fixed_voip
    // We reject non_fixed_voip (often used for spam) and toll_free
    const invalidTypes = ["toll_free", "premium_rate", "shared_cost"];
    const isValid = data.valid && !invalidTypes.includes(phoneType);

    // Log for analytics
    console.log("[VALIDATE-PHONE] Result:", {
      phoneNumber: data.phone_number,
      valid: isValid,
      type: phoneType,
      carrier: carrier,
      countryCode: data.country_code,
    });

    const result: ValidationResponse = {
      valid: isValid,
      phoneNumber: data.phone_number,
      nationalFormat: data.national_format,
      countryCode: data.country_code,
      carrier: carrier,
      type: phoneType,
    };

    if (!isValid) {
      result.error = invalidTypes.includes(phoneType) 
        ? "Please provide a valid mobile or landline number" 
        : "This phone number could not be verified";
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[VALIDATE-PHONE] Error:", error);
    
    // Fail open - don't block submissions due to validation errors
    return new Response(
      JSON.stringify({ 
        valid: true, 
        error: "Validation service temporarily unavailable" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
