import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-recurring-cron-secret" };
const iso = (date: Date) => date.toISOString().slice(0, 10);
const atNoon = (date: string) => new Date(`${date}T12:00:00Z`);
const addDays = (date: string, days: number) => { const value = atNoon(date); value.setUTCDate(value.getUTCDate() + days); return iso(value); };
const nextVisitDate = (date: string, frequency: string) => { const value = atNoon(date); if (frequency === "fortnightly") value.setUTCDate(value.getUTCDate() + 14); else if (frequency === "monthly") value.setUTCMonth(value.getUTCMonth() + 1); else value.setUTCDate(value.getUTCDate() + 7); return iso(value); };
const nextBillingDate = (date: string, frequency: string) => frequency === "monthly" ? (() => { const value = atNoon(date); value.setUTCMonth(value.getUTCMonth() + 1); return iso(value); })() : addDays(date, frequency === "fortnightly" ? 14 : 7);
const visitDatesForPeriod = (start: string, end: string, frequency: string) => { const dates: string[] = []; for (let date = start; date <= end; date = nextVisitDate(date, frequency)) dates.push(date); return dates; };

async function materializeVisit(db: ReturnType<typeof createClient>, plan: any, cycle: any, scheduledDate: string, paymentIntentId: string) {
  let { data: visit, error: visitError } = await db.from("recurring_clean_visits").select("*").eq("plan_id", plan.id).eq("scheduled_date", scheduledDate).maybeSingle();
  if (visitError) throw visitError;
  if (!visit) {
    const { count } = await db.from("recurring_clean_visits").select("id", { count: "exact", head: true }).eq("plan_id", plan.id);
    const insert = await db.from("recurring_clean_visits").insert({ plan_id: plan.id, billing_cycle_id: cycle.id, occurrence_number: (count || 0) + 1, scheduled_date: scheduledDate, status: "processing", payment_attempts: 1 }).select().single();
    if (insert.error) throw insert.error;
    visit = insert.data;
  }
  if (visit.job_id) return visit.job_id;

  if (!visit.service_request_id) {
    const request = await db.from("service_requests").insert({ reference: `REC-${plan.id.slice(0, 8).toUpperCase()}-${scheduledDate.replaceAll("-", "")}`, customer_id: plan.customer_id, address_id: plan.address_id, service_type_id: plan.service_type_id, service_area_id: plan.service_area_id, status: "quoted", frequency: plan.frequency, preferred_date_from: scheduledDate, preferred_date_to: scheduledDate, customer_notes: plan.requirements, admin_notes: `Recurring plan ${plan.id} · billing cycle ${cycle.period_start}`, source: "recurring_plan" }).select().single();
    if (request.error) throw request.error;
    const update = await db.from("recurring_clean_visits").update({ service_request_id: request.data.id }).eq("id", visit.id);
    if (update.error) throw update.error;
    visit.service_request_id = request.data.id;
  }
  if (!visit.quote_id) {
    const quote = await db.from("quotes").insert({ service_request_id: visit.service_request_id, version: 1, status: "sent", customer_amount_pence: plan.customer_amount_pence, cleaner_payout_pence: plan.cleaner_payout_pence, currency: plan.currency, scheduled_date: scheduledDate, start_time: plan.start_time, expected_duration_minutes: plan.expected_duration_minutes, sent_at: new Date().toISOString(), recurring_plan_id: plan.id, recurring_visit_id: visit.id }).select().single();
    if (quote.error) throw quote.error;
    const { data: planAddOns, error: planAddOnsError } = await db
      .from("recurring_clean_plan_addons")
      .select("addon_id,addon_code,addon_name,category,quantity,unit_customer_price_pence,unit_cleaner_payout_pence,unit_duration_minutes")
      .eq("plan_id", plan.id);
    if (planAddOnsError) throw planAddOnsError;
    if (planAddOns?.length) {
      const { error: addOnCopyError } = await db.from("quote_addons").insert(planAddOns.map((addOn) => ({
        quote_id: quote.data.id,
        addon_id: addOn.addon_id,
        addon_code: addOn.addon_code,
        addon_name: addOn.addon_name,
        category: addOn.category,
        quantity: addOn.quantity,
        unit_customer_price_pence: addOn.unit_customer_price_pence,
        unit_cleaner_payout_pence: addOn.unit_cleaner_payout_pence,
        unit_duration_minutes: addOn.unit_duration_minutes,
      })));
      if (addOnCopyError) throw addOnCopyError;
    }
    const update = await db.from("recurring_clean_visits").update({ quote_id: quote.data.id }).eq("id", visit.id);
    if (update.error) throw update.error;
    visit.quote_id = quote.data.id;
  }
  const { data: jobId, error: finaliseError } = await db.rpc("finalize_agency_quote_payment", { p_quote_id: visit.quote_id, p_payment_reference: paymentIntentId, p_payment_intent_id: paymentIntentId, p_provider: "stripe" });
  if (finaliseError) throw finaliseError;
  const visitUpdate = await db.from("recurring_clean_visits").update({ status: "paid", billing_cycle_id: cycle.id, job_id: jobId, payment_intent_id: paymentIntentId, charged_at: new Date().toISOString() }).eq("id", visit.id);
  if (visitUpdate.error) throw visitUpdate.error;
  await db.from("jobs").update({ recurring_plan_id: plan.id, recurring_visit_id: visit.id }).eq("id", jobId);
  await db.from("customer_payments").update({ recurring_visit_id: visit.id, recurring_billing_cycle_id: cycle.id }).eq("job_id", jobId);
  return jobId;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "", anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "", service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const cronSecret = Deno.env.get("RECURRING_BILLING_CRON_SECRET");
    const isCron = !!cronSecret && req.headers.get("x-recurring-cron-secret") === cronSecret;
    if (!isCron) { const authorization = req.headers.get("Authorization"); const client = createClient(url, anon, { global: { headers: { Authorization: authorization || "" } } }); const { data: { user } } = await client.auth.getUser(); const { data: admin } = await client.rpc("is_admin", { _user_id: user?.id }); if (!user || !admin) throw new Error("Admin or scheduler access required"); }
    const db = createClient(url, service, { auth: { persistSession: false } }); const stripeKey = Deno.env.get("STRIPE_SECRET_KEY"); if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not configured"); const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const today = iso(new Date());
    const { data: plans, error } = await db.from("recurring_clean_plans").select("*").eq("status", "active").eq("payment_setup_status", "ready").limit(100);
    if (error) throw error;
    const results: string[] = [];
    for (const plan of plans || []) {
      const chargeDate = addDays(plan.next_billing_date, -plan.payment_collection_days_before);
      if (chargeDate > today) continue;
      const periodStart = plan.next_billing_date, nextPeriodStart = nextBillingDate(periodStart, plan.billing_frequency), periodEnd = addDays(nextPeriodStart, -1);
      const visitDates = visitDatesForPeriod(plan.next_visit_date, periodEnd, plan.frequency);
      if (!visitDates.length) { await db.from("recurring_clean_plans").update({ next_billing_date: nextPeriodStart }).eq("id", plan.id); results.push(`${plan.id}: no visits in billing period`); continue; }
      const amount = plan.customer_amount_pence * visitDates.length;
      let { data: cycle, error: cycleError } = await db.from("recurring_clean_billing_cycles").select("*").eq("plan_id", plan.id).eq("period_start", periodStart).maybeSingle();
      if (cycleError) throw cycleError;
      if (!cycle) { const created = await db.from("recurring_clean_billing_cycles").insert({ plan_id: plan.id, period_start: periodStart, period_end: periodEnd, scheduled_charge_date: chargeDate, amount_pence: amount, currency: plan.currency, status: "processing", payment_attempts: 1 }).select().single(); if (created.error) throw created.error; cycle = created.data; }
      try {
        let paymentIntentId = cycle.payment_intent_id as string | null;
        if (paymentIntentId) { const existingIntent = await stripe.paymentIntents.retrieve(paymentIntentId); if (existingIntent.status !== "succeeded") throw new Error(`Stripe payment is ${existingIntent.status}`); }
        else { const intent = await stripe.paymentIntents.create({ amount, currency: plan.currency.toLowerCase(), customer: plan.stripe_customer_id, payment_method: plan.stripe_payment_method_id, confirm: true, off_session: true, metadata: { recurring_plan_id: plan.id, recurring_billing_cycle_id: cycle.id, visit_count: String(visitDates.length) }, description: `Cleanda ${plan.billing_frequency} recurring clean billing — ${periodStart} to ${periodEnd}` }, { idempotencyKey: `cleanda-recurring-billing-${cycle.id}` }); if (intent.status !== "succeeded") throw new Error(`Stripe payment is ${intent.status}`); paymentIntentId = intent.id; const update = await db.from("recurring_clean_billing_cycles").update({ payment_intent_id: intent.id }).eq("id", cycle.id); if (update.error) throw update.error; cycle.payment_intent_id = intent.id; }
        for (const date of visitDates) await materializeVisit(db, plan, cycle, date, paymentIntentId);
        const followingVisit = nextVisitDate(visitDates[visitDates.length - 1], plan.frequency);
        await db.from("recurring_clean_billing_cycles").update({ status: "paid", paid_at: new Date().toISOString(), last_payment_error: null }).eq("id", cycle.id);
        await db.from("recurring_clean_plans").update({ next_billing_date: nextPeriodStart, next_visit_date: followingVisit, status: "active" }).eq("id", plan.id);
        results.push(`${plan.id}: ${visitDates.length} paid visit(s) created for ${periodStart} to ${periodEnd}`);
      } catch (chargeError) {
        const message = chargeError instanceof Error ? chargeError.message : String(chargeError);
        if (!cycle.payment_intent_id) { await db.from("recurring_clean_billing_cycles").update({ status: "payment_failed", last_payment_error: message }).eq("id", cycle.id); await db.from("recurring_clean_plans").update({ status: "payment_failed" }).eq("id", plan.id); }
        else await db.from("recurring_clean_billing_cycles").update({ last_payment_error: message }).eq("id", cycle.id);
        results.push(`${plan.id}: ${message}`);
      }
    }
    return new Response(JSON.stringify({ processed: results.length, results }), { headers: { ...headers, "Content-Type": "application/json" } });
  } catch (error) { return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } }); }
});
