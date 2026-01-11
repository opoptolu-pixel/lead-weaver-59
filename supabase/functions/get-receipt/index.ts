import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user?.email) {
      throw new Error("User not authenticated");
    }

    const { leadId } = await req.json();
    
    if (!leadId) {
      throw new Error("Lead ID is required");
    }

    // First get the lead to verify it exists and is unlocked
    const { data: lead, error: leadError } = await supabaseClient
      .from("leads")
      .select("id, job_type, postcode, unlocked_at, unlocked_by, value")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error("Lead not found");
    }

    // Verify the user owns this lead
    if (lead.unlocked_by !== user.id) {
      throw new Error("You don't have access to this lead's receipt");
    }

    if (leadError || !lead) {
      throw new Error("Lead not found or access denied");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find the customer in Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      // No Stripe customer - generate a simple receipt without Stripe data
      return new Response(
        JSON.stringify({
          receipt: {
            type: "internal",
            date: lead.unlocked_at,
            leadId: lead.id,
            jobType: lead.job_type,
            postcode: lead.postcode,
            amount: 20,
            customerEmail: user.email,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const customerId = customers.data[0].id;

    // Find charges/payment intents around the unlock time
    const unlockTime = new Date(lead.unlocked_at).getTime() / 1000;
    
    // Search for payment intents within a reasonable time window (1 hour before to 1 hour after)
    const paymentIntents = await stripe.paymentIntents.list({
      customer: customerId,
      created: {
        gte: Math.floor(unlockTime - 3600),
        lte: Math.ceil(unlockTime + 3600),
      },
      limit: 10,
    });

    // Find successful payment
    const successfulPayment = paymentIntents.data.find(
      (pi: { status: string }) => pi.status === "succeeded"
    );

    if (successfulPayment) {
      // Get the charge for receipt URL
      const charges = await stripe.charges.list({
        payment_intent: successfulPayment.id,
        limit: 1,
      });

      if (charges.data.length > 0 && charges.data[0].receipt_url) {
        return new Response(
          JSON.stringify({
            receipt: {
              type: "stripe",
              receiptUrl: charges.data[0].receipt_url,
              date: lead.unlocked_at,
              leadId: lead.id,
              jobType: lead.job_type,
              postcode: lead.postcode,
              amount: successfulPayment.amount / 100,
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    // Check for credit purchases (checkout sessions)
    const sessions = await stripe.checkout.sessions.list({
      customer: customerId,
      limit: 50,
    });

    // Find session around the unlock time
    for (const session of sessions.data) {
      if (
        session.payment_status === "paid" &&
        session.created >= unlockTime - 86400 && // within 24 hours before
        session.created <= unlockTime + 3600
      ) {
        // Get the payment intent from the session
        if (session.payment_intent) {
          const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
          const charges = await stripe.charges.list({
            payment_intent: pi.id,
            limit: 1,
          });

          if (charges.data.length > 0 && charges.data[0].receipt_url) {
            return new Response(
              JSON.stringify({
                receipt: {
                  type: "stripe",
                  receiptUrl: charges.data[0].receipt_url,
                  date: lead.unlocked_at,
                  leadId: lead.id,
                  jobType: lead.job_type,
                  postcode: lead.postcode,
                  amount: session.amount_total ? session.amount_total / 100 : 20,
                }
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
          }
        }
      }
    }

    // Fallback: return internal receipt if no Stripe receipt found
    return new Response(
      JSON.stringify({
        receipt: {
          type: "internal",
          date: lead.unlocked_at,
          leadId: lead.id,
          jobType: lead.job_type,
          postcode: lead.postcode,
          amount: 20,
          customerEmail: user.email,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error getting receipt:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});