import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!stripeKey) throw new Error("Stripe is not configured");

    const body = await req.json();
    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let sessionIds: string[] = [];
    if (body.sessionId) {
      sessionIds = [String(body.sessionId)];
    } else if (body.reconcileAll === true) {
      const authorization = req.headers.get("Authorization");
      if (!authorization) throw new Error("Admin authentication required");
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) throw new Error("Admin authentication required");
      const { data: isAdmin } = await userClient.rpc("is_admin", {
        _user_id: user.id,
      });
      if (!isAdmin) throw new Error("Admin access required");

      const { data: quotes, error: quoteError } = await db
        .from("quotes")
        .select("stripe_checkout_session_id")
        .eq("status", "sent")
        .not("stripe_checkout_session_id", "is", null);
      if (quoteError) throw quoteError;
      sessionIds = (quotes || [])
        .map((quote) => quote.stripe_checkout_session_id)
        .filter((value): value is string => Boolean(value));
    } else {
      throw new Error("A Stripe session is required");
    }

    const results = [];
    for (const sessionId of sessionIds) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const quoteId = session.metadata?.agency_quote_id;
      if (!quoteId || session.payment_status !== "paid") continue;

      const { data: jobId, error: finalizationError } = await db.rpc(
        "finalize_agency_quote_payment",
        {
          p_quote_id: quoteId,
          p_payment_reference: session.id,
          p_payment_intent_id:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null,
          p_provider: "stripe",
        },
      );
      if (finalizationError) throw finalizationError;

      const { data: job } = await db
        .from("jobs")
        .select("reference")
        .eq("id", jobId)
        .single();
      results.push({ jobId, jobReference: job?.reference || null });
    }

    return new Response(
      JSON.stringify({
        confirmed: results.length > 0,
        reconciled: results.length,
        jobReference: results[0]?.jobReference || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[CONFIRM-AGENCY-PAYMENT]", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
