import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${detailsStr}`);
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

    const { sessionId, leadId } = await req.json();
    if (!sessionId) throw new Error("Session ID is required");
    if (!leadId) throw new Error("Lead ID is required");
    logStep("Parameters received", { sessionId, leadId });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Initialize Supabase client with service role key to bypass RLS
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer", "payment_intent"],
    });
    logStep("Session retrieved", { status: session.payment_status, customerEmail: session.customer_details?.email });

    if (session.payment_status !== "paid") {
      throw new Error("Payment has not been completed");
    }

    // Verify this session was for this lead
    if (session.metadata?.lead_id !== leadId) {
      throw new Error("Session does not match the requested lead");
    }

    const customerEmail = session.customer_details?.email;
    if (!customerEmail) {
      throw new Error("Customer email not found in session");
    }
    logStep("Customer email confirmed", { email: customerEmail });

    // Check if user already exists with this email
    const { data: existingUser } = await supabaseClient.auth.admin.listUsers();
    const userExists = existingUser?.users?.find(u => u.email === customerEmail);
    
    let userId: string;
    let isNewUser = false;
    let tempPassword: string | null = null;

    if (userExists) {
      userId = userExists.id;
      logStep("Existing user found", { userId });
    } else {
      // Create a new user account with a random password
      tempPassword = crypto.randomUUID().slice(0, 12);
      const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email: customerEmail,
        password: tempPassword,
        email_confirm: true,
      });

      if (createError) throw new Error(`Failed to create user: ${createError.message}`);
      if (!newUser.user) throw new Error("Failed to create user account");
      
      userId = newUser.user.id;
      isNewUser = true;
      logStep("New user created", { userId });
    }

    // Update the lead as unlocked
    const { error: updateError } = await supabaseClient
      .from("leads")
      .update({
        is_unlocked: true,
        unlocked_by: userId,
        unlocked_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (updateError) throw new Error(`Failed to unlock lead: ${updateError.message}`);
    logStep("Lead unlocked successfully", { leadId, userId });

    // Fetch the full lead details to return to the user
    const { data: lead, error: leadError } = await supabaseClient
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError) throw new Error(`Failed to fetch lead details: ${leadError.message}`);

    return new Response(JSON.stringify({
      success: true,
      isNewUser,
      email: customerEmail,
      tempPassword: isNewUser ? tempPassword : null,
      lead: {
        id: lead.id,
        postcode: lead.postcode,
        job_type: lead.job_type,
        display_value: lead.display_value,
        customer_name: lead.customer_name,
        customer_email: lead.customer_email,
        customer_phone: lead.customer_phone,
        customer_address: lead.customer_address,
        date: lead.date,
      },
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
