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

    // Check if user account is suspended BEFORE any reservation or atomic operations
    const { data: profileCheck, error: profileCheckError } = await supabaseClient
      .from("profiles")
      .select("is_suspended, suspension_reason")
      .eq("user_id", user.id)
      .single();

    if (!profileCheckError && profileCheck?.is_suspended) {
      logStep("Account suspended - blocking purchase", { 
        reason: profileCheck.suspension_reason 
      });
      return new Response(JSON.stringify({ 
        error: "Your account has been suspended. You cannot purchase leads until this is resolved. Please contact support at hello@cleanda.co.uk",
        suspended: true,
        reason: profileCheck.suspension_reason
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Additional stricter rate limiting for lead unlocking specifically
    const { data: strictRateLimit, error: strictRateLimitError } = await supabaseClient
      .rpc("enforce_lead_unlock_rate_limit", { p_user_id: user.id });

    if (!strictRateLimitError && strictRateLimit?.[0] && !strictRateLimit[0].allowed) {
      logStep("Strict rate limit hit", { message: strictRateLimit[0].message });
      return new Response(JSON.stringify({ 
        error: strictRateLimit[0].message,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      });
    }

    const { leadId, visitorId } = await req.json();
    if (!leadId) throw new Error("Lead ID is required");
    logStep("Lead ID received", { leadId, visitorId });
    
    // Check if this lead is reserved by someone else
    if (visitorId) {
      const { data: reservationCheck, error: reservationError } = await supabaseClient
        .rpc('check_lead_reservation', {
          p_lead_id: leadId,
          p_visitor_id: visitorId
        });
      
      if (!reservationError && reservationCheck?.[0]) {
        const reservation = reservationCheck[0];
        if (reservation.is_reserved && !reservation.reserved_by_me) {
          throw new Error("This lead is currently being checked out by another user. Please try again in a few minutes.");
        }
      }
      
      // Create/update reservation for this checkout
      const { data: reserveResult, error: reserveError } = await supabaseClient
        .rpc('reserve_lead', {
          p_lead_id: leadId,
          p_visitor_id: visitorId
        });
      
      if (reserveError) {
        logStep("Warning: Could not create reservation", { error: reserveError.message });
      } else if (reserveResult?.[0] && !reserveResult[0].success) {
        throw new Error(reserveResult[0].message || "Failed to reserve lead");
      } else {
        logStep("Lead reserved", { reservationId: reserveResult?.[0]?.reservation_id });
      }
    }

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
      // Return a more user-friendly response for suspended accounts
      const errorMessage = atomicResult.error_message || "Failed to process credit";
      
      // Check if this is a suspension error and return 403 instead of 500
      if (errorMessage.toLowerCase().includes('suspended')) {
        return new Response(JSON.stringify({ 
          error: "Your account has been suspended. You cannot purchase leads until this is resolved. Please contact support at hello@cleanda.co.uk",
          suspended: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }
      
      throw new Error(errorMessage);
    }

    logStep("Credit deducted atomically", { remainingCredits: atomicResult.remaining_credits });

    // Fetch the business profile for activity logging
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("business_name, contact_name")
      .eq("user_id", user.id)
      .maybeSingle();

    // Log the purchase activity
    await supabaseClient.from("activity_logs").insert({
      user_id: user.id,
      entity_type: "lead",
      entity_id: leadId,
      action: "purchase",
      details: {
        payment_method: "credit",
        business_name: profile?.business_name || "Unknown Business",
        contact_name: profile?.contact_name || user.email,
        credits_remaining: atomicResult.remaining_credits,
      },
    });
    logStep("Purchase activity logged");

    // Fetch the unlocked lead details to return to client
    const { data: lead, error: leadError } = await supabaseClient
      .from("leads")
      .select("id, postcode, job_type, display_value, customer_name, customer_email, customer_phone, customer_address, date")
      .eq("id", leadId)
      .single();

    if (leadError) {
      logStep("Warning: Could not fetch lead details", { error: leadError.message });
    }
    
    // Complete the reservation (mark as completed, not expired)
    await supabaseClient.rpc('complete_lead_reservation', { p_lead_id: leadId });
    logStep("Lead reservation completed");

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
