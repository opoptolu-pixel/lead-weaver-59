import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[BUY-CREDITS] ${step}${detailsStr}`);
};

// Credit pack configurations by priceId
const CREDIT_PACKS_BY_PRICE = {
  "price_1ShICWHaP2wEKuykqMEyAcKq": { credits: 1, name: "Pay As You Go" },
  "price_1ShIOvHaP2wEKuykcLfnYe6p": { credits: 5, name: "5 Credit Pack" },
  "price_1ShIRMHaP2wEKuykOtPHqxo4": { credits: 10, name: "10 Credit Pack" },
};

// Legacy support by pack size
const CREDIT_PACKS_BY_SIZE = {
  "5": "price_1ShIOvHaP2wEKuykcLfnYe6p",
  "10": "price_1ShIRMHaP2wEKuykOtPHqxo4",
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
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const body = await req.json();
    let priceId: string;
    let credits: number;

    // Support both priceId directly or packSize for backwards compatibility
    if (body.priceId) {
      priceId = body.priceId;
      const pack = CREDIT_PACKS_BY_PRICE[priceId as keyof typeof CREDIT_PACKS_BY_PRICE];
      if (!pack) throw new Error("Invalid price ID");
      credits = pack.credits;
      logStep("Using priceId", { priceId, credits });
    } else if (body.packSize) {
      const packSize = body.packSize;
      priceId = CREDIT_PACKS_BY_SIZE[packSize as keyof typeof CREDIT_PACKS_BY_SIZE];
      if (!priceId) throw new Error("Invalid credit pack size. Choose '5' or '10'");
      credits = CREDIT_PACKS_BY_PRICE[priceId as keyof typeof CREDIT_PACKS_BY_PRICE].credits;
      logStep("Using packSize", { packSize, priceId, credits });
    } else {
      throw new Error("Either priceId or packSize is required");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://lovableproject.com";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/credits-success?session_id={CHECKOUT_SESSION_ID}&credits=${credits}`,
      cancel_url: `${origin}/billing`,
      metadata: {
        user_id: user.id,
        credits: credits.toString(),
        price_id: priceId,
      },
    });

    logStep("Checkout session created", { sessionId: session.id, credits });

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