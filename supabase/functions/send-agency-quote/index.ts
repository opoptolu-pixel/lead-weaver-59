import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) throw new Error("Authentication required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not configured");
    if (!resendKey) throw new Error("RESEND_API_KEY is not configured");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Authentication required");

    const { data: isAdmin, error: adminError } = await userClient.rpc("is_admin", {
      _user_id: user.id,
    });
    if (adminError || !isAdmin) throw new Error("Admin access required");

    const { quoteId } = await req.json();
    if (!quoteId) throw new Error("quoteId is required");

    const db = createClient(supabaseUrl, serviceRoleKey);
    const { data: quote, error: quoteError } = await db
      .from("quotes")
      .select("id,status,customer_amount_pence,currency,valid_until,scheduled_date,start_time,expected_duration_minutes,request:service_requests(id,reference,customer:customers(name,email),service_type:service_types(name))")
      .eq("id", quoteId)
      .single();
    if (quoteError || !quote) throw new Error(quoteError?.message || "Quote not found");
    if (quote.status !== "draft") throw new Error("Only a draft quote can be sent");
    if (!quote.scheduled_date || !quote.expected_duration_minutes) {
      throw new Error("Complete scheduling details before sending");
    }

    const validUntil = quote.valid_until
      ? new Date(quote.valid_until).getTime()
      : Date.now() + 24 * 60 * 60 * 1000;
    if (validUntil <= Date.now() + 30 * 60 * 1000) {
      throw new Error("The quote must remain valid for at least 30 minutes");
    }

    const request = quote.request as unknown as {
      id: string;
      reference: string;
      customer: { name: string; email: string };
      service_type: { name: string };
    };
    if (!request?.customer?.email) throw new Error("The customer does not have an email address");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const expirySeconds = Math.min(24 * 60 * 60, Math.floor((validUntil - Date.now()) / 1000));
    const siteUrl = (Deno.env.get("SITE_URL") || "https://cleanda.co.uk").replace(/\/$/, "");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: request.customer.email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: (quote.currency || "GBP").toLowerCase(),
          unit_amount: quote.customer_amount_pence,
          product_data: {
            name: `Cleanda — ${request.service_type.name}`,
            description: `${quote.scheduled_date}${quote.start_time ? ` at ${quote.start_time.slice(0, 5)}` : ""}`,
          },
        },
      }],
      metadata: { agency_quote_id: quote.id, service_request_reference: request.reference },
      success_url: `${siteUrl}/request-cleaning/thank-you?payment=success`,
      cancel_url: `${siteUrl}/?payment=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + expirySeconds,
    });
    if (!session.url) throw new Error("Stripe did not return a payment link");

    // Persist the payable state before delivery so a fast Stripe webhook can
    // never arrive while the quote is still a draft.
    const sentAt = new Date().toISOString();
    const { error: updateQuoteError } = await db
      .from("quotes")
      .update({ status: "sent", sent_at: sentAt, stripe_checkout_session_id: session.id, created_by: user.id })
      .eq("id", quote.id)
      .eq("status", "draft");
    if (updateQuoteError) throw updateQuoteError;

    const { error: requestError } = await db
      .from("service_requests")
      .update({ status: "quoted", updated_at: sentAt })
      .eq("id", request.id);
    if (requestError) throw requestError;

    const pounds = (quote.customer_amount_pence / 100).toLocaleString("en-GB", {
      style: "currency",
      currency: "GBP",
    });
    const resend = new Resend(resendKey);
    const { error: emailError } = await resend.emails.send({
      from: "Cleanda <hello@cleanda.co.uk>",
      to: [request.customer.email],
      subject: `Your Cleanda cleaning quote — ${pounds}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#102235"><h1>Your Cleanda quote</h1><p>Hello ${escapeHtml(request.customer.name)},</p><p>We have confirmed your requirements for <strong>${escapeHtml(request.service_type.name)}</strong>.</p><div style="padding:20px;background:#f4faf7;border-radius:12px"><p><strong>Price:</strong> ${escapeHtml(pounds)}</p><p><strong>Date:</strong> ${escapeHtml(quote.scheduled_date)}${quote.start_time ? ` at ${escapeHtml(quote.start_time.slice(0, 5))}` : ""}</p><p><strong>Reference:</strong> ${escapeHtml(request.reference)}</p></div><p>Your booking is confirmed only after payment.</p><p><a href="${escapeHtml(session.url)}" style="display:inline-block;background:#16a765;color:white;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Accept and pay securely</a></p><p>This secure payment link expires in 24 hours.</p></div>`,
    });
    if (emailError) throw new Error(`Quote email failed: ${emailError.message}`);

    const { error: deliveryUpdateError } = await db
      .from("quotes")
      .update({ payment_link_sent_at: new Date().toISOString() })
      .eq("id", quote.id);
    if (deliveryUpdateError) throw deliveryUpdateError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[SEND-AGENCY-QUOTE]", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
