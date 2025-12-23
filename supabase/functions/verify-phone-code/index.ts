import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 60 * 1000; // 1 hour lockout

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PHONE-CODE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");
    logStep("User verified", { userId: user.id });

    const { code } = await req.json();
    if (!code) throw new Error("Verification code is required");
    
    // Validate code format (must be 8-digit alphanumeric)
    if (typeof code !== 'string' || code.length !== 8 || !/^[A-Z0-9]+$/.test(code)) {
      throw new Error("Invalid verification code format");
    }
    logStep("Code received and validated format");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check if user is currently locked out
    const { data: lockedCode, error: lockCheckError } = await supabaseAdmin
      .from("phone_verification_codes")
      .select("locked_until")
      .eq("user_id", user.id)
      .eq("verified", false)
      .gt("locked_until", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lockCheckError) {
      logStep("Lock check error", { error: lockCheckError.message });
    }

    if (lockedCode?.locked_until) {
      const lockExpiry = new Date(lockedCode.locked_until);
      const remainingMinutes = Math.ceil((lockExpiry.getTime() - Date.now()) / (60 * 1000));
      logStep("User is locked out", { locked_until: lockedCode.locked_until, remainingMinutes });
      throw new Error(`Too many failed attempts. Please try again in ${remainingMinutes} minutes.`);
    }

    // Find the latest unverified code for this user
    const { data: latestCode, error: latestError } = await supabaseAdmin
      .from("phone_verification_codes")
      .select("*")
      .eq("user_id", user.id)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) throw new Error(`Database error: ${latestError.message}`);
    
    if (!latestCode) {
      throw new Error("No active verification code found. Please request a new code.");
    }

    // Check if this code matches
    if (latestCode.code !== code) {
      // Increment attempts
      const newAttempts = (latestCode.attempts || 0) + 1;
      const updateData: { attempts: number; locked_until?: string } = { attempts: newAttempts };
      
      // Lock if max attempts reached
      if (newAttempts >= MAX_ATTEMPTS) {
        updateData.locked_until = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
        logStep("Max attempts reached, locking user", { attempts: newAttempts });
      }

      await supabaseAdmin
        .from("phone_verification_codes")
        .update(updateData)
        .eq("id", latestCode.id);

      const remainingAttempts = MAX_ATTEMPTS - newAttempts;
      if (remainingAttempts > 0) {
        throw new Error(`Invalid verification code. ${remainingAttempts} attempts remaining.`);
      } else {
        throw new Error("Too many failed attempts. Your account has been locked for 1 hour.");
      }
    }

    logStep("Code verified successfully");

    // Mark code as verified
    await supabaseAdmin
      .from("phone_verification_codes")
      .update({ verified: true })
      .eq("id", latestCode.id);

    // Update profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ phone_verified: true })
      .eq("user_id", user.id);

    if (profileError) throw new Error(`Failed to update profile: ${profileError.message}`);
    logStep("Profile updated - phone verified");

    // Check if user is now fully verified
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone_verified, address_verified")
      .eq("user_id", user.id)
      .single();

    // Check for approved documents
    const { data: docs } = await supabaseAdmin
      .from("verification_documents")
      .select("document_type, status")
      .eq("user_id", user.id)
      .eq("status", "approved");

    const hasApprovedDoc = docs && docs.length > 0;

    // If phone and address are verified and has approved doc, mark as fully verified
    if (profile?.phone_verified && profile?.address_verified && hasApprovedDoc) {
      await supabaseAdmin
        .from("profiles")
        .update({ is_verified: true, verification_status: "approved" })
        .eq("user_id", user.id);
      logStep("User is now fully verified!");
    }

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
