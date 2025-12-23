import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit configuration
const RATE_LIMIT_MAX_REQUESTS = 5; // Max 5 credit uses per window
const RATE_LIMIT_WINDOW_SECONDS = 60; // Per 60 seconds

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[USE-CREDIT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Check rate limit before processing
    const { data: rateLimitResult, error: rateLimitError } = await supabaseClient
      .rpc("check_rate_limit", {
        p_user_id: user.id,
        p_action: "use_credit",
        p_max_requests: RATE_LIMIT_MAX_REQUESTS,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      });

    if (rateLimitError) {
      logStep("Rate limit check error", { error: rateLimitError.message });
      // Don't block on rate limit errors, just log and continue
    } else if (rateLimitResult?.[0] && !rateLimitResult[0].allowed) {
      const resetAt = new Date(rateLimitResult[0].reset_at);
      const waitSeconds = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
      logStep("Rate limit exceeded", { 
        currentCount: rateLimitResult[0].current_count,
        resetAt: rateLimitResult[0].reset_at 
      });
      
      return new Response(JSON.stringify({ 
        error: `Too many requests. Please wait ${waitSeconds} seconds before trying again.`,
        retryAfter: waitSeconds,
      }), {
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Retry-After": String(waitSeconds),
        },
        status: 429,
      });
    } else {
      logStep("Rate limit check passed", { 
        currentCount: rateLimitResult?.[0]?.current_count || 1 
      });
    }

    const { leadId } = await req.json();
    if (!leadId) throw new Error("Lead ID is required");
    logStep("Lead ID received", { leadId });

    // Use atomic database function with row-level locking to prevent race conditions
    // This function locks the profile and lead rows, validates all conditions,
    // and performs the credit deduction + lead unlock in a single transaction
    const { data: result, error: rpcError } = await supabaseClient
      .rpc("deduct_credit_atomic", {
        p_user_id: user.id,
        p_lead_id: leadId,
      });

    if (rpcError) {
      logStep("RPC error", { error: rpcError.message });
      throw new Error(`Database error: ${rpcError.message}`);
    }

    // The function returns an array with one row
    const atomicResult = result?.[0];
    
    if (!atomicResult) {
      throw new Error("Unexpected database response");
    }

    if (!atomicResult.success) {
      logStep("Atomic operation failed", { error: atomicResult.error_message });
      throw new Error(atomicResult.error_message || "Failed to process credit");
    }

    logStep("Credit deducted atomically", { remainingCredits: atomicResult.remaining_credits });

    // Fetch the unlocked lead details to return to client
    const { data: lead, error: leadError } = await supabaseClient
      .from("leads")
      .select("id, postcode, job_type, display_value, customer_name, customer_email, customer_phone, customer_address, date")
      .eq("id", leadId)
      .single();

    if (leadError) {
      logStep("Warning: Could not fetch lead details", { error: leadError.message });
    }

    logStep("Lead unlocked successfully");

    return new Response(JSON.stringify({
      success: true,
      lead: lead || { id: leadId },
      remainingCredits: atomicResult.remaining_credits,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
