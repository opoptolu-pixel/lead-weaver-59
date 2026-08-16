import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
const renderTemplate = (value: string, variables: Record<string, string>) => Object.entries(variables).reduce((output,[key,replacement]) => output.replaceAll(`{{${key}}}`,replacement),value);

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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // ─── checkout.session.completed ───────────────────────────────────
    // Server-side lead unlock: ensures the lead is unlocked even if
    // the browser redirect to /payment-success fails.
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const leadId = session.metadata?.lead_id;
      const agencyQuoteId = session.metadata?.agency_quote_id;
      const customerEmail = session.customer_details?.email;

      logStep("checkout.session.completed", { leadId, customerEmail, sessionId: session.id });

      if (agencyQuoteId && session.payment_status === "paid") {
        const { data: jobId, error: agencyError } = await supabaseClient.rpc("finalize_agency_quote_payment", {
          p_quote_id: agencyQuoteId,
          p_payment_reference: session.id,
          p_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
          p_provider: "stripe",
        });
        if (agencyError) throw agencyError;
        logStep("Agency quote paid and job created", { agencyQuoteId, jobId });

        const { data: claimedQuote, error: claimError } = await supabaseClient
          .from("quotes")
          .update({ payment_confirmation_sent_at: new Date().toISOString() })
          .eq("id", agencyQuoteId)
          .is("payment_confirmation_sent_at", null)
          .select("id,customer_amount_pence,currency,scheduled_date,start_time,expected_duration_minutes,request:service_requests(reference,customer:customers(name,email),service_type:service_types(name))")
          .maybeSingle();
        if (claimError) throw claimError;

        if (claimedQuote) {
          try {
            const resendKey = Deno.env.get("RESEND_API_KEY");
            if (!resendKey) throw new Error("RESEND_API_KEY is not configured");
            const request = claimedQuote.request as unknown as {
              reference: string;
              customer: { name: string; email: string };
              service_type: { name: string };
            };
            if (!request?.customer?.email) {
              throw new Error("The booking customer does not have an email address");
            }
            const { data: job } = await supabaseClient
              .from("jobs")
              .select("reference")
              .eq("id", jobId)
              .single();
            const price = (claimedQuote.customer_amount_pence / 100).toLocaleString("en-GB", {
              style: "currency",
              currency: claimedQuote.currency || "GBP",
            });
            const duration = claimedQuote.expected_duration_minutes
              ? `${claimedQuote.expected_duration_minutes / 60} hour${claimedQuote.expected_duration_minutes === 60 ? "" : "s"}`
              : "To be confirmed";
            const resend = new Resend(resendKey);
            const variables = {customer_name:escapeHtml(request.customer.name),service_name:escapeHtml(request.service_type.name),customer_price:escapeHtml(price),scheduled_date:escapeHtml(claimedQuote.scheduled_date),start_time:escapeHtml(claimedQuote.start_time?.slice(0,5)||"To be confirmed"),duration:escapeHtml(duration),request_reference:escapeHtml(request.reference),job_reference:escapeHtml(job?.reference||"Created")};
            const {data:messageTemplate}=await supabaseClient.from("email_templates").select("subject,body,is_active").eq("name","agency_payment_confirmation").maybeSingle();
            if(messageTemplate&&!messageTemplate.is_active)throw new Error("The payment confirmation template is disabled");
            const { error: confirmationError } = await resend.emails.send({
              from: "Cleanda <hello@cleanda.co.uk>",
              to: [request.customer.email],
              subject: messageTemplate?renderTemplate(messageTemplate.subject,variables):`Your Cleanda booking is confirmed — ${request.reference}`,
              html: messageTemplate?renderTemplate(messageTemplate.body,variables):`<h1>Booking confirmed</h1><p>Hello ${escapeHtml(request.customer.name)}, your payment of ${escapeHtml(price)} has been received.</p>`,
            });
            if (confirmationError) throw confirmationError;
            logStep("Agency payment confirmation email sent", {
              agencyQuoteId,
              jobId,
            });
          } catch (emailError) {
            await supabaseClient
              .from("quotes")
              .update({ payment_confirmation_sent_at: null })
              .eq("id", agencyQuoteId);
            logStep("Agency payment confirmation email failed", {
              agencyQuoteId,
              error: emailError instanceof Error ? emailError.message : String(emailError),
            });
          }
        }
      }

      if (leadId && session.payment_status === "paid") {
        // Check if lead is already unlocked (verify-payment may have beaten us)
        const { data: lead } = await supabaseClient
          .from("leads")
          .select("id, is_unlocked, unlocked_by")
          .eq("id", leadId)
          .maybeSingle();

        if (lead && !lead.is_unlocked) {
          // Resolve the user
          let userId: string | null = session.metadata?.user_id || null;

          if (!userId && customerEmail) {
            const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
            const found = existingUsers?.users?.find(u => u.email === customerEmail);
            if (found) {
              userId = found.id;
            } else {
              // Create user (same flow as verify-payment)
              const securePassword = crypto.randomUUID() + crypto.randomUUID();
              const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
                email: customerEmail,
                password: securePassword,
                email_confirm: true,
              });
              if (!createError && newUser.user) {
                userId = newUser.user.id;
                logStep("New user created via webhook", { userId });

                // Send magic link email
                try {
                  const resendApiKey = Deno.env.get("RESEND_API_KEY");
                  if (resendApiKey) {
                    const { Resend } = await import("npm:resend@2.0.0");
                    const resend = new Resend(resendApiKey);

                    const { data: magicLinkData } = await supabaseClient.auth.admin.generateLink({
                      type: "magiclink",
                      email: customerEmail,
                      options: { redirectTo: "https://cleanda.co.uk/dashboard" },
                    });

                    const magicLink = magicLinkData?.properties?.action_link;
                    if (magicLink) {
                      await resend.emails.send({
                        from: "Cleanda <hello@cleanda.co.uk>",
                        to: [customerEmail],
                        subject: "Welcome to Cleanda - Access Your Account",
                        html: `
                          <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to Cleanda!</h1>
                              <p style="color: #7DD3A8; margin: 8px 0 0 0; font-size: 14px;">Partner Network</p>
                            </div>
                            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
                              <p style="font-size: 16px; margin-bottom: 20px;">Thank you for your purchase! Your lead has been unlocked and your account is ready.</p>
                              <p style="font-size: 16px; margin-bottom: 25px;">Click the button below to securely access your dashboard:</p>
                              <div style="text-align: center; margin: 30px 0;">
                                <a href="${magicLink}" style="background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">Access Your Dashboard</a>
                              </div>
                              <p style="font-size: 14px; color: #666; margin-top: 25px;">This magic link will expire in 24 hours.</p>
                              <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 25px 0;">
                              <p style="font-size: 12px; color: #999; text-align: center;">© ${new Date().getFullYear()} Cleanda · All rights reserved</p>
                            </div>
                          </body></html>
                        `,
                      });
                      logStep("Welcome email sent via webhook");
                    }
                  }
                } catch (emailErr: any) {
                  logStep("Welcome email failed via webhook (non-blocking)", { error: emailErr.message });
                }
              } else {
                logStep("Failed to create user via webhook", { error: createError?.message });
              }
            }
          }

          if (userId) {
            // Unlock the lead atomically
            const { data: updatedLead, error: updateError } = await supabaseClient
              .from("leads")
              .update({
                is_unlocked: true,
                unlocked_by: userId,
                unlocked_at: new Date().toISOString(),
                lead_status: "purchased",
                outcome_status: "purchased",
                amount_paid: 12,
              })
              .eq("id", leadId)
              .eq("is_unlocked", false)
              .select("id")
              .maybeSingle();

            if (updateError) {
              logStep("Failed to unlock lead via webhook", { error: updateError.message });
            } else if (updatedLead) {
              logStep("Lead unlocked via webhook", { leadId, userId });

              // Complete reservation
              await supabaseClient.rpc("complete_lead_reservation", { p_lead_id: leadId });

              // Increment leads_purchased
              await supabaseClient.rpc("increment_leads_purchased", { user_uuid: userId });

              // Log activity
              const { data: profile } = await supabaseClient
                .from("profiles")
                .select("business_name, contact_name")
                .eq("user_id", userId)
                .maybeSingle();

              await supabaseClient.from("activity_logs").insert({
                user_id: userId,
                entity_type: "lead",
                entity_id: leadId,
                action: "purchase",
                details: {
                  payment_method: "stripe",
                  session_id: session.id,
                  business_name: profile?.business_name || "Unknown Business",
                  contact_name: profile?.contact_name || customerEmail,
                  amount_paid: "£12",
                  source: "stripe_webhook_checkout_completed",
                },
              });

              // Fire-and-forget SMS notification
              try {
                const smsUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms-notification`;
                fetch(smsUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                  },
                  body: JSON.stringify({ type: "lead_unlocked", leadId, userId }),
                }).catch(err => logStep("SMS via webhook failed (non-blocking)", { error: err.message }));
              } catch (_) { /* non-blocking */ }

              logStep("All post-purchase side effects completed via webhook");
            } else {
              logStep("Lead was unlocked between check and update (race with verify-payment, safe)", { leadId });
            }
          } else {
            logStep("Could not resolve userId for checkout session", { leadId, customerEmail });
          }
        } else if (lead?.is_unlocked) {
          logStep("Lead already unlocked (verify-payment handled it)", { leadId, owner: lead.unlocked_by });
        }
      } else if (!leadId && session.metadata?.credits && session.metadata?.user_id) {
        // ─── Credit purchase fallback ─────────────────────────────────
        const creditsToAdd = parseInt(session.metadata.credits, 10);
        const creditUserId = session.metadata.user_id;

        if (session.payment_status === "paid" && creditsToAdd > 0) {
          logStep("Processing credit purchase via webhook", { creditUserId, creditsToAdd });

          // Check if credits were already added (idempotency via activity_logs)
          const { data: existingLog } = await supabaseClient
            .from("activity_logs")
            .select("id")
            .eq("user_id", creditUserId)
            .eq("action", "credits_purchased")
            .filter("details->>stripe_session_id", "eq", session.id)
            .maybeSingle();

          if (existingLog) {
            logStep("Credits already added for this session (idempotent skip)", { sessionId: session.id });
          } else {
            // Get current credits
            const { data: profile, error: profileError } = await supabaseClient
              .from("profiles")
              .select("credits, business_name, contact_name")
              .eq("user_id", creditUserId)
              .single();

            if (profileError) {
              logStep("Failed to fetch profile for credit purchase", { error: profileError.message });
            } else {
              const currentCredits = profile?.credits || 0;
              const newCredits = currentCredits + creditsToAdd;

              const { error: updateError } = await supabaseClient
                .from("profiles")
                .update({ credits: newCredits })
                .eq("user_id", creditUserId);

              if (updateError) {
                logStep("Failed to update credits via webhook", { error: updateError.message });
              } else {
                logStep("Credits added via webhook", { currentCredits, creditsToAdd, newCredits });

                // Log activity
                await supabaseClient.from("activity_logs").insert({
                  user_id: creditUserId,
                  entity_type: "business",
                  entity_id: creditUserId,
                  action: "credits_purchased",
                  details: {
                    credits_added: creditsToAdd,
                    credits_total: newCredits,
                    payment_method: "stripe",
                    stripe_session_id: session.id,
                    amount_paid: (session.amount_total || 0) / 100,
                    business_name: profile?.business_name || "Unknown Business",
                    contact_name: profile?.contact_name || null,
                    source: "stripe_webhook_checkout_completed",
                  },
                });
                logStep("Credit purchase activity logged via webhook");
              }
            }
          }
        }
      } else {
        logStep("Skipping checkout.session.completed — no lead_id or credits metadata, or not paid", { leadId, paymentStatus: session.payment_status });
      }
    }

    // ─── charge.refunded ──────────────────────────────────────────────
    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = charge.payment_intent as string | null;
      const customerEmail = charge.billing_details?.email || charge.receipt_email;
      const amountRefunded = charge.amount_refunded;

      logStep("Processing refund", { paymentIntentId, customerEmail, amountRefunded });

      // Try to find the lead via checkout session metadata
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
            logStep("Credit purchase refund detected", { credits, userId });

            if (userId) {
              const creditCount = parseInt(credits, 10);
              if (!isNaN(creditCount) && creditCount > 0) {
                await supabaseClient.rpc("increment_leads_purchased", { user_uuid: userId });
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
