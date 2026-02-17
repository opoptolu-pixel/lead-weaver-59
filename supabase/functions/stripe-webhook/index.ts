import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("No stripe-signature header");

    // Verify webhook signature
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    logStep("Event received", { type: event.type, id: event.id });

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = charge.payment_intent as string | null;
      const customerEmail = charge.billing_details?.email || charge.receipt_email;
      const amountRefunded = charge.amount_refunded;

      logStep("Processing refund", { paymentIntentId, customerEmail, amountRefunded });

      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      // Try to find the lead via checkout session metadata
      // Search for the checkout session that created this payment intent
      if (paymentIntentId) {
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: paymentIntentId,
          limit: 1,
        });

        if (sessions.data.length > 0) {
          const session = sessions.data[0];
          const leadId = session.metadata?.lead_id;
          const userId = session.metadata?.user_id;
          const credits = session.metadata?.credits;

          if (leadId) {
            // This was a lead purchase refund
            const { error } = await supabaseClient
              .from("leads")
              .update({
                refunded_at: new Date().toISOString(),
                refund_reason: "Refund processed via Stripe",
                outcome_status: "refunded",
              })
              .eq("id", leadId);

            if (error) {
              logStep("Failed to update lead refund status", { leadId, error: error.message });
            } else {
              logStep("Lead marked as refunded", { leadId });
            }

            // Log to activity_logs
            if (userId) {
              await supabaseClient.from("activity_logs").insert({
                user_id: userId,
                entity_type: "refund",
                entity_id: leadId,
                action: "stripe_webhook_refund",
                details: {
                  payment_intent_id: paymentIntentId,
                  amount_refunded: amountRefunded,
                  customer_email: customerEmail,
                  source: "stripe_webhook",
                },
              });
              logStep("Activity log created for lead refund");
            }
          } else if (credits) {
            // This was a credit purchase refund
            logStep("Credit purchase refund detected", { credits, userId });

            if (userId) {
              // Deduct credits that were refunded
              const creditCount = parseInt(credits, 10);
              if (!isNaN(creditCount) && creditCount > 0) {
                const { error } = await supabaseClient.rpc("increment_leads_purchased", { user_uuid: userId });
                // Note: We log it but don't deduct credits automatically to avoid issues
                // Admin should review credit refunds manually
              }

              await supabaseClient.from("activity_logs").insert({
                user_id: userId,
                entity_type: "refund",
                entity_id: userId,
                action: "stripe_webhook_credit_refund",
                details: {
                  payment_intent_id: paymentIntentId,
                  credits_refunded: credits,
                  amount_refunded: amountRefunded,
                  customer_email: customerEmail,
                  source: "stripe_webhook",
                },
              });
              logStep("Activity log created for credit refund");
            }
          }
        } else {
          logStep("No checkout session found for payment intent", { paymentIntentId });
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
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
