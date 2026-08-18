import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const escapeHtml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const renderTemplate = (value: string, variables: Record<string, string>) => Object.entries(variables).reduce((output, [key, replacement]) => output.replaceAll(`{{${key}}}`, replacement), value);
const money = (pence: number, currency = "GBP") => (pence / 100).toLocaleString("en-GB", { style: "currency", currency });

type ResolutionAction = "cover" | "reschedule" | "cancel_refund";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) throw new Error("Authentication required");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    if (!serviceRoleKey || !resendKey) throw new Error("Required service configuration is missing");

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Authentication required");
    const { data: isAdmin, error: adminError } = await userClient.rpc("is_admin", { _user_id: user.id });
    if (adminError || !isAdmin) throw new Error("Admin access required");

    const body = await req.json();
    const jobId = String(body.jobId || "");
    const action = body.action as ResolutionAction;
    const reason = String(body.reason || "").trim();
    if (!jobId || !["cover", "reschedule", "cancel_refund"].includes(action) || reason.length < 5) throw new Error("Choose an outcome and provide a customer-resolution note of at least 5 characters");

    const db = createClient(supabaseUrl, serviceRoleKey);
    const { data: job, error: jobError } = await db.from("jobs").select("id,reference,status,scheduled_date,start_time,expected_duration_minutes,currency,customer:customers(name,email),service_type:service_types(name)").eq("id", jobId).single();
    if (jobError || !job) throw new Error(jobError?.message || "Job not found");
    if (job.status !== "awaiting_assignment") throw new Error("Only a job awaiting reassignment can be resolved through this workflow");
    const { data: noShowEvent } = await db.from("job_events").select("id").eq("job_id", jobId).eq("event_type", "cleaner_no_show").limit(1).maybeSingle();
    if (!noShowEvent) throw new Error("This workflow is only available after a recorded cleaner no-show");

    const customer = job.customer as unknown as { name: string; email: string } | null;
    const service = job.service_type as unknown as { name: string } | null;
    if (!customer?.email || !service?.name) throw new Error("Customer booking details are incomplete");
    const common = { customer_name: escapeHtml(customer.name), service_name: escapeHtml(service.name), job_reference: escapeHtml(job.reference), scheduled_date: escapeHtml(job.scheduled_date), start_time: escapeHtml(job.start_time?.slice(0, 5) || "To be confirmed") };
    let templateName = "agency_no_show_cover_update";
    let eventType = "no_show_customer_cover_requested";
    let variables: Record<string, string> = common;
    let refundOutcome: string | null = null;

    if (action === "reschedule") {
      const scheduledDate = String(body.scheduledDate || "");
      const startTime = String(body.startTime || "");
      const durationMinutes = Number(body.durationMinutes || 0);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) || !/^\d{2}:\d{2}/.test(startTime) || !Number.isInteger(durationMinutes) || durationMinutes < 30) throw new Error("Enter a valid new date, start time and duration");
      if (new Date(`${scheduledDate}T00:00:00`).getTime() < new Date().setHours(0, 0, 0, 0)) throw new Error("The new booking date cannot be in the past");
      const { error } = await db.from("jobs").update({ scheduled_date: scheduledDate, start_time: startTime, expected_duration_minutes: durationMinutes, updated_at: new Date().toISOString() }).eq("id", jobId).eq("status", "awaiting_assignment");
      if (error) throw error;
      templateName = "agency_no_show_rescheduled";
      eventType = "no_show_customer_rescheduled";
      variables = { ...common, scheduled_date: escapeHtml(scheduledDate), start_time: escapeHtml(startTime.slice(0, 5)), duration: escapeHtml(`${durationMinutes / 60} hour${durationMinutes === 60 ? "" : "s"}`) };
    }

    if (action === "cancel_refund") {
      const refundMethod = String(body.refundMethod || "");
      if (!["stripe_full_refund", "manual_refund_due"].includes(refundMethod)) throw new Error("Choose how the refund will be handled");
      const { data: payment, error: paymentError } = await db.from("customer_payments").select("id,amount_pence,currency,status,provider,provider_reference,refund_status").eq("job_id", jobId).eq("status", "paid").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (paymentError || !payment) throw new Error("A paid customer payment is required before cancellation and refund");
      if (payment.refund_status === "refunded") throw new Error("This customer payment has already been refunded");

      let refundReference: string | null = null;
      if (refundMethod === "stripe_full_refund") {
        if (payment.provider !== "stripe" || !payment.provider_reference?.startsWith("pi_")) throw new Error("This payment cannot be automatically refunded through Stripe. Use the manual refund option instead.");
        if (!stripeKey) throw new Error("Stripe refunds are not configured");
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const refund = await stripe.refunds.create({ payment_intent: payment.provider_reference, amount: payment.amount_pence }, { idempotencyKey: `cleanda-no-show-refund-${payment.id}` });
        refundReference = refund.id;
        const { error: paymentUpdateError } = await db.from("customer_payments").update({ status: "refunded", refund_status: "refunded", refund_amount_pence: payment.amount_pence, refund_reference: refundReference, refund_requested_at: new Date().toISOString(), refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", payment.id);
        if (paymentUpdateError) throw paymentUpdateError;
        refundOutcome = "Your full refund has been issued to your original payment method. Your bank may take a few working days to show it.";
      } else {
        const { error: paymentUpdateError } = await db.from("customer_payments").update({ refund_status: "manual_due", refund_amount_pence: payment.amount_pence, refund_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", payment.id);
        if (paymentUpdateError) throw paymentUpdateError;
        refundOutcome = "We have recorded your full refund for manual payment. Our team will send it to your original agreed method and confirm the reference with you.";
      }
      const { error: cancelError } = await db.from("jobs").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", jobId).eq("status", "awaiting_assignment");
      if (cancelError) throw cancelError;
      await db.from("job_assignments").update({ status: "revoked", updated_at: new Date().toISOString(), response_notes: "Customer booking cancelled after cleaner no-show" }).eq("job_id", jobId).in("status", ["offered", "accepted"]);
      await db.from("cleaner_payouts").update({ status: "cancelled", held_reason: "Customer booking cancelled after cleaner no-show", updated_at: new Date().toISOString() }).eq("job_id", jobId).not("status", "in", "(paid,cancelled)");
      templateName = "agency_no_show_refund";
      eventType = refundMethod === "stripe_full_refund" ? "no_show_booking_cancelled_refunded" : "no_show_booking_cancelled_manual_refund_due";
      variables = { ...common, refund_amount: escapeHtml(money(payment.amount_pence, payment.currency || "GBP")), refund_timing: escapeHtml(refundOutcome) };
    }

    const { error: eventError } = await db.from("job_events").insert({ job_id: jobId, actor_user_id: user.id, event_type: eventType, details: { action, reason, refund_outcome: refundOutcome } });
    if (eventError) throw eventError;

    const { data: template } = await db.from("email_templates").select("id,subject,body,is_active").eq("name", templateName).maybeSingle();
    if (template && !template.is_active) throw new Error("The customer resolution email template is disabled");
    const subject = template ? renderTemplate(template.subject, variables) : "An update on your Cleanda booking";
    const html = template ? renderTemplate(template.body, variables) : `<p>Hello ${variables.customer_name},</p><p>${escapeHtml(reason)}</p>`;
    const resend = new Resend(resendKey);
    const { data: sent, error: sendError } = await resend.emails.send({ from: "Cleanda <hello@cleanda.co.uk>", to: [customer.email], subject, html });
    if (!sendError) await db.from("email_logs").insert({ template_id: template?.id || null, template_name: templateName, recipient_email: customer.email, subject, status: "sent", resend_id: sent?.id || null, is_test: false });

    return new Response(JSON.stringify({ success: true, emailSent: !sendError, emailError: sendError?.message || null, action, refundOutcome }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
