import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-CREDITS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("Session ID is required");
    logStep("Session ID received", { sessionId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logStep("Session retrieved", { status: session.payment_status, metadata: session.metadata });

    if (session.payment_status !== "paid") {
      throw new Error("Payment has not been completed");
    }

    const userId = session.metadata?.user_id;
    const creditsToAdd = parseInt(session.metadata?.credits || "0", 10);

    if (!userId) throw new Error("User ID not found in session metadata");
    if (!creditsToAdd) throw new Error("Credits amount not found in session metadata");

    logStep("Adding credits", { userId, creditsToAdd });

    // Get current credits
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("credits")
      .eq("user_id", userId)
      .single();

    if (profileError) throw new Error(`Failed to fetch profile: ${profileError.message}`);

    const currentCredits = profile?.credits || 0;
    const newCredits = currentCredits + creditsToAdd;

    // Update credits
    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({ credits: newCredits })
      .eq("user_id", userId);

    if (updateError) throw new Error(`Failed to update credits: ${updateError.message}`);

    logStep("Credits updated successfully", { currentCredits, creditsToAdd, newCredits });

    // Fetch business profile for activity logging
    const { data: businessProfile } = await supabaseClient
      .from("profiles")
      .select("business_name, contact_name")
      .eq("user_id", userId)
      .maybeSingle();

    // Log credit purchase activity
    await supabaseClient.from("activity_logs").insert({
      user_id: userId,
      entity_type: "business",
      entity_id: userId,
      action: "credits_purchased",
      details: {
        credits_added: creditsToAdd,
        credits_total: newCredits,
        payment_method: "stripe",
        stripe_session_id: sessionId,
        business_name: businessProfile?.business_name || "Unknown Business",
        contact_name: businessProfile?.contact_name || null,
      },
    });
    logStep("Credit purchase activity logged");

    return new Response(JSON.stringify({
      success: true,
      creditsAdded: creditsToAdd,
      totalCredits: newCredits,
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
