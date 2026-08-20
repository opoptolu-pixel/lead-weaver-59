import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-recurring-cron-secret" };
const iso = (date: Date) => date.toISOString().slice(0, 10);
const nextDate = (date: string, frequency: string) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + (frequency === "fortnightly" ? 14 : frequency === "weekly" ? 7 : 0)); if (frequency === "monthly") value.setUTCMonth(value.getUTCMonth() + 1); return iso(value); };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "", anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "", service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const cronSecret = Deno.env.get("RECURRING_BILLING_CRON_SECRET");
    const isCron = !!cronSecret && req.headers.get("x-recurring-cron-secret") === cronSecret;
    if (!isCron) { const authorization = req.headers.get("Authorization"); const client = createClient(url, anon, { global: { headers: { Authorization: authorization || "" } } }); const { data: { user } } = await client.auth.getUser(); const { data: admin } = await client.rpc("is_admin", { _user_id: user?.id }); if (!user || !admin) throw new Error("Admin or scheduler access required"); }
    const db = createClient(url, service, { auth: { persistSession: false } }); const stripeKey = Deno.env.get("STRIPE_SECRET_KEY"); if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not configured"); const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const today = iso(new Date()); const { data: plans, error } = await db.from("recurring_clean_plans").select("*,customer:customers(id,name,email),service_type:service_types(name)").eq("status", "active").eq("payment_setup_status", "ready").lte("next_visit_date", today).limit(50); if (error) throw error;
    const results: string[] = [];
    for (const plan of plans || []) {
      const { count: completedOccurrences } = await db.from("recurring_clean_visits").select("id", { count: "exact", head: true }).eq("plan_id", plan.id);
      const { data: visit, error: visitError } = await db.from("recurring_clean_visits").insert({ plan_id: plan.id, occurrence_number: (completedOccurrences || 0) + 1, scheduled_date: plan.next_visit_date, status: "processing", payment_attempts: 1 }).select().single();
      if (visitError) { results.push(`${plan.id}: already processing or recorded`); continue; }
      try {
        const intent = await stripe.paymentIntents.create({ amount: plan.customer_amount_pence, currency: plan.currency.toLowerCase(), customer: plan.stripe_customer_id, payment_method: plan.stripe_payment_method_id, confirm: true, off_session: true, metadata: { recurring_plan_id: plan.id, recurring_visit_id: visit.id }, description: `Cleanda recurring ${plan.service_type.name} — ${plan.next_visit_date}` }, { idempotencyKey: `cleanda-recurring-${visit.id}` });
        if (intent.status !== "succeeded") throw new Error(`Stripe payment is ${intent.status}`);
        // The job is created only after Stripe confirms collection, using the existing guarded agency workflow.
        const { data: request, error: requestError } = await db.from("service_requests").insert({ reference: `REC-${plan.id.slice(0, 8).toUpperCase()}-${plan.next_visit_date.replaceAll("-", "")}`, customer_id: plan.customer_id, address_id: plan.address_id, service_type_id: plan.service_type_id, service_area_id: plan.service_area_id, status: "quoted", frequency: plan.frequency, preferred_date_from: plan.next_visit_date, preferred_date_to: plan.next_visit_date, customer_notes: plan.requirements, admin_notes: `Recurring plan ${plan.id}`, source: "recurring_plan" }).select().single(); if (requestError) throw requestError;
        const { data: quote, error: quoteError } = await db.from("quotes").insert({ service_request_id: request.id, version: 1, status: "sent", customer_amount_pence: plan.customer_amount_pence, cleaner_payout_pence: plan.cleaner_payout_pence, currency: plan.currency, scheduled_date: plan.next_visit_date, start_time: plan.start_time, expected_duration_minutes: plan.expected_duration_minutes, sent_at: new Date().toISOString(), recurring_plan_id: plan.id, recurring_visit_id: visit.id }).select().single(); if (quoteError) throw quoteError;
        const { data: jobId, error: finaliseError } = await db.rpc("finalize_agency_quote_payment", { p_quote_id: quote.id, p_payment_reference: intent.id, p_payment_intent_id: intent.id, p_provider: "stripe" }); if (finaliseError) throw finaliseError;
        await db.from("recurring_clean_visits").update({ status: "paid", service_request_id: request.id, quote_id: quote.id, job_id: jobId, payment_intent_id: intent.id, charged_at: new Date().toISOString() }).eq("id", visit.id);
        await db.from("jobs").update({ recurring_plan_id: plan.id, recurring_visit_id: visit.id }).eq("id", jobId);
        await db.from("customer_payments").update({ recurring_visit_id: visit.id }).eq("job_id", jobId);
        await db.from("recurring_clean_plans").update({ next_visit_date: nextDate(plan.next_visit_date, plan.frequency) }).eq("id", plan.id);
        results.push(`${plan.id}: charged and job created`);
      } catch (chargeError) { await db.from("recurring_clean_visits").update({ status: "payment_failed", last_payment_error: chargeError instanceof Error ? chargeError.message : String(chargeError) }).eq("id", visit.id); await db.from("recurring_clean_plans").update({ status: "payment_failed" }).eq("id", plan.id); results.push(`${plan.id}: payment failed`); }
    }
    return new Response(JSON.stringify({ processed: results.length, results }), { headers: { ...headers, "Content-Type": "application/json" } });
  } catch (error) { return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } }); }
});
