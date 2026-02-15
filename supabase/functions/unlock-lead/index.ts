import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    
    // Parse request body once
    const requestBody = await req.json();
    const { leadId, visitorId } = requestBody;
    if (!leadId) throw new Error("Lead ID is required");
    logStep("Request parsed", { leadId, visitorId });

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
          .select("is_verified, leads_purchased, is_suspended, suspension_reason, phone_verified, business_name, phone, contact_name, postcode")
          .eq("user_id", userId)
          .maybeSingle();

        if (profileError) {
          logStep("Profile fetch error", { error: profileError.message });
        }

        // CRITICAL: Check if user is suspended
        if (profile?.is_suspended) {
          throw new Error(profile.suspension_reason || "Your account is suspended. Please contact support.");
        }

        // Check profile completion - business name, phone, contact name, postcode required
        const missingFields = [];
        if (!profile?.business_name) missingFields.push("business name");
        if (!profile?.phone) missingFields.push("phone number");
        if (!profile?.contact_name) missingFields.push("contact name");
        if (!profile?.postcode) missingFields.push("postcode");

        if (missingFields.length > 0) {
          throw new Error(`Please complete your profile before purchasing leads. Missing: ${missingFields.join(", ")}`);
        }

        // Check phone verification - required before any lead purchase
        if (!profile?.phone_verified) {
          throw new Error("Please verify your phone number before purchasing leads.");
        }

        // Check insurance certificate expiry
        const { data: insuranceDocs } = await supabaseClient
          .from("verification_documents")
          .select("expiry_date, status")
          .eq("user_id", userId)
          .eq("document_type", "insurance")
          .eq("status", "approved")
          .order("expiry_date", { ascending: false })
          .limit(1);

        if (insuranceDocs && insuranceDocs.length > 0) {
          const expiryDate = new Date(insuranceDocs[0].expiry_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (expiryDate < today) {
            logStep("BLOCKED - Insurance expired", { expiryDate: insuranceDocs[0].expiry_date });
            throw new Error("Your insurance certificate has expired. Please upload a valid certificate before purchasing leads.");
          }
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

    const origin = req.headers.get("origin") || "https://cleanda.co.uk";

    // Look up existing Stripe customer by email (so saved cards are pre-filled)
    let stripeCustomerId: string | undefined;
    let userEmail: string | undefined;
    if (userId) {
      const { data: { user: authUser } } = await supabaseClient.auth.admin.getUserById(userId);
      userEmail = authUser?.email ?? undefined;
      if (userEmail) {
        const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
        if (customers.data.length > 0) {
          stripeCustomerId = customers.data[0].id;
          logStep("Existing Stripe customer found", { stripeCustomerId });
        }
      }
    }

    // Create a Stripe Checkout session for the lead unlock
    // Price ID for £20 lead unlock
    const LEAD_UNLOCK_PRICE_ID = "price_1ShICWHaP2wEKuykqMEyAcKq";

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      customer_email: stripeCustomerId ? undefined : userEmail,
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
