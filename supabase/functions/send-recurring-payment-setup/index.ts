import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) throw new Error("Authentication required");
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not configured");
    const userDb = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await userDb.auth.getUser();
    const { data: isAdmin } = await userDb.rpc("is_admin", { _user_id: user?.id });
    if (!user || !isAdmin) throw new Error("Admin access required");
    const { planId } = await req.json();
    if (!planId) throw new Error("planId is required");

    const db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: plan, error } = await db.from("recurring_clean_plans")
      .select("id,status,stripe_customer_id,billing_frequency,customer:customers(name,email),service_type:service_types(name)")
      .eq("id", planId).single();
    if (error || !plan) throw new Error(error?.message || "Recurring plan not found");
    if (["cancelled", "active"].includes(plan.status) && plan.status !== "payment_setup_required") throw new Error("This plan cannot collect a new card");
    const customer = plan.customer as unknown as { name: string; email: string };
    if (!customer?.email) throw new Error("The customer does not have an email address");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const stripeCustomerId = plan.stripe_customer_id || (await stripe.customers.create({ name: customer.name, email: customer.email, metadata: { recurring_plan_id: plan.id } })).id;
    const siteUrl = (Deno.env.get("SITE_URL") || "https://cleanda.co.uk").replace(/\/$/, "");
    const session = await stripe.checkout.sessions.create({
      mode: "setup", customer: stripeCustomerId, payment_method_types: ["card"],
      metadata: { recurring_plan_id: plan.id, flow: "recurring_payment_setup" },
      setup_intent_data: { metadata: { recurring_plan_id: plan.id } },
      success_url: `${siteUrl}/recurring-payment-setup?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?recurring_payment=cancelled`,
    });
    if (!session.url) throw new Error("Stripe did not return a secure setup link");
    await db.from("recurring_clean_plans").update({ stripe_customer_id: stripeCustomerId, payment_setup_status: "link_sent", payment_setup_sent_at: new Date().toISOString() }).eq("id", plan.id);
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const service = (plan.service_type as unknown as { name: string })?.name || "recurring clean";
      await new Resend(resendKey).emails.send({ from: "Cleanda <hello@cleanda.co.uk>", to: [customer.email], subject: "Set up your recurring Cleanda payment", html: `<h1>Set up your recurring payment</h1><p>Hello ${customer.name}, please securely save the card you would like Cleanda to use for your ${service}. Cleanda will charge your agreed ${plan.billing_frequency || "monthly"} billing cycle; your cleaner visits are scheduled separately.</p><p><a href="${session.url}">Securely save your card</a></p>` });
    }
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
