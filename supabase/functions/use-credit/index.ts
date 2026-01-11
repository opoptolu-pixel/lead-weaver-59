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

    // Check user profile status
    const { data: profileCheck, error: profileCheckError } = await supabaseClient
      .from("profiles")
      .select("is_suspended, suspension_reason, phone_verified, business_name, phone, contact_name, postcode")
      .eq("user_id", user.id)
      .single();

    if (profileCheckError) {
      logStep("ERROR fetching profile", { error: profileCheckError.message });
      throw new Error("Failed to verify account status");
    }

    if (profileCheck?.is_suspended) {
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

    // Check profile completion - business name, phone, contact name, postcode required
    const missingFields = [];
    if (!profileCheck?.business_name) missingFields.push("business name");
    if (!profileCheck?.phone) missingFields.push("phone number");
    if (!profileCheck?.contact_name) missingFields.push("contact name");
    if (!profileCheck?.postcode) missingFields.push("postcode");

    if (missingFields.length > 0) {
      logStep("BLOCKED - Incomplete profile", { missingFields });
      return new Response(JSON.stringify({ 
        error: `Please complete your profile before purchasing leads. Missing: ${missingFields.join(", ")}`,
        profileIncomplete: true,
        missingFields 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Check phone verification - required before any lead purchase
    if (!profileCheck?.phone_verified) {
      logStep("BLOCKED - Phone not verified");
      return new Response(JSON.stringify({ 
        error: "Please verify your phone number before purchasing leads.",
        phoneNotVerified: true 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
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

    // Send lead unlocked email notification
    if (user.email && lead) {
      try {
        const { data: template } = await supabaseClient
          .from("email_templates")
          .select("subject, body")
          .eq("name", "lead_unlocked")
          .eq("is_active", true)
          .maybeSingle();

        if (template) {
          const variables: Record<string, string> = {
            business_name: profile?.business_name || "Partner",
            contact_name: profile?.contact_name || "there",
            job_type: lead.job_type || "Cleaning",
            postcode: lead.postcode || "",
            customer_name: lead.customer_name || "Customer",
            customer_phone: lead.customer_phone || "Not provided",
            customer_email: lead.customer_email || "Not provided",
            customer_address: lead.customer_address || "Not provided",
            preferred_date: lead.date || "Flexible",
            display_value: lead.display_value || "",
            dashboard_url: "https://cleanda.co.uk/dashboard",
            leads_url: "https://cleanda.co.uk/leads",
            support_email: "hello@cleanda.co.uk",
            current_year: new Date().getFullYear().toString(),
          };

          let subject = template.subject;
          let html = template.body;
          
          Object.entries(variables).forEach(([key, value]) => {
            subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
            html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
          });

          // Call send-email function
          const emailResponse = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                to: user.email,
                subject,
                html,
                templateName: "lead_unlocked",
              }),
            }
          );

          if (emailResponse.ok) {
            logStep("Lead unlocked email sent", { to: user.email });
          } else {
            logStep("Warning: Failed to send lead unlocked email", { status: emailResponse.status });
          }
        }
      } catch (emailError: any) {
        logStep("Warning: Failed to send lead unlocked email", { error: emailError.message });
        // Don't fail the unlock if email fails
      }
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
