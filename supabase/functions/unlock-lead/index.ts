import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[UNLOCK-LEAD] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // Get authorization header to identify user
    const authHeader = req.headers.get("Authorization");
    
    const { leadId } = await req.json();
    if (!leadId) throw new Error("Lead ID is required");
    logStep("Lead ID received", { leadId });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Initialize Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // If user is authenticated, check verification status
    let userId: string | null = null;
    if (authHeader) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        userId = user.id;
        logStep("User identified", { userId });

        // Check user's verification status, suspension, and lead count
        const { data: profile, error: profileError } = await supabaseClient
          .from("profiles")
          .select("is_verified, leads_purchased, is_suspended, suspension_reason")
          .eq("user_id", userId)
          .maybeSingle();

        if (profileError) {
          logStep("Profile fetch error", { error: profileError.message });
        }

        // CRITICAL: Check if user is suspended
        if (profile?.is_suspended) {
          throw new Error(profile.suspension_reason || "Your account is suspended. Please contact support.");
        }

        const MAX_UNVERIFIED_LEADS = 3;
        if (profile && !profile.is_verified && profile.leads_purchased >= MAX_UNVERIFIED_LEADS) {
          throw new Error("You've reached the maximum of 3 leads for unverified businesses. Please complete verification to continue purchasing leads.");
        }
        logStep("Verification check passed", { isVerified: profile?.is_verified, leadsPurchased: profile?.leads_purchased });
      }
    }

    // Verify the lead exists and is not already unlocked
    const { data: lead, error: leadError } = await supabaseClient
      .from("leads")
      .select("id, postcode, job_type, display_value, is_unlocked")
      .eq("id", leadId)
      .maybeSingle();

    if (leadError) throw new Error(`Error fetching lead: ${leadError.message}`);
    if (!lead) throw new Error("Lead not found");
    if (lead.is_unlocked) throw new Error("This lead has already been unlocked");
    logStep("Lead verified", { postcode: lead.postcode, jobType: lead.job_type });

    const origin = req.headers.get("origin") || "https://lovableproject.com";

    // Create a Stripe Checkout session for the lead unlock
    // Price ID for £20 lead unlock
    const LEAD_UNLOCK_PRICE_ID = "price_1ShICWHaP2wEKuykqMEyAcKq";

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: LEAD_UNLOCK_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/payment-success?lead_id=${leadId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/leads`,
      metadata: {
        lead_id: leadId,
        postcode: lead.postcode,
        job_type: lead.job_type,
      },
      // Allow customer to enter their email - this will be used to create their account
      customer_creation: "always",
      payment_intent_data: {
        metadata: {
          lead_id: leadId,
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
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
