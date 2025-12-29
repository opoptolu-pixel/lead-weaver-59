import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not set");

    const { sessionId, leadId } = await req.json();
    if (!sessionId) throw new Error("Session ID is required");
    if (!leadId) throw new Error("Lead ID is required");
    logStep("Parameters received", { sessionId, leadId });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Initialize Supabase client with service role key to bypass RLS
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer", "payment_intent"],
    });
    logStep("Session retrieved", { status: session.payment_status, customerEmail: session.customer_details?.email });

    if (session.payment_status !== "paid") {
      throw new Error("Payment has not been completed");
    }

    // Verify this session was for this lead
    if (session.metadata?.lead_id !== leadId) {
      throw new Error("Session does not match the requested lead");
    }

    const customerEmail = session.customer_details?.email;
    if (!customerEmail) {
      throw new Error("Customer email not found in session");
    }
    logStep("Customer email confirmed", { email: customerEmail });

    // Check if user already exists with this email
    const { data: existingUser } = await supabaseClient.auth.admin.listUsers();
    const userExists = existingUser?.users?.find(u => u.email === customerEmail);
    
    let userId: string;
    let isNewUser = false;

    if (userExists) {
      userId = userExists.id;
      logStep("Existing user found", { userId });
    } else {
      // Create a new user account with a secure random password (user will never see this)
      const securePassword = crypto.randomUUID() + crypto.randomUUID(); // Very long random password
      const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email: customerEmail,
        password: securePassword,
        email_confirm: true,
      });

      if (createError) throw new Error(`Failed to create user: ${createError.message}`);
      if (!newUser.user) throw new Error("Failed to create user account");
      
      userId = newUser.user.id;
      isNewUser = true;
      logStep("New user created", { userId });

      // Generate magic link for the new user
      const { data: magicLinkData, error: magicLinkError } = await supabaseClient.auth.admin.generateLink({
        type: "magiclink",
        email: customerEmail,
        options: {
          redirectTo: `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app')}/dashboard`,
        },
      });

      if (magicLinkError) {
        logStep("Magic link generation failed", { error: magicLinkError.message });
      } else {
        logStep("Magic link generated successfully");

        // Send welcome email with magic link via Resend
        try {
          const magicLink = magicLinkData.properties?.action_link;
          const emailSubject = "Welcome to Cleanda - Access Your Account";
          
          const emailResponse = await resend.emails.send({
            from: "Cleanda <hello@cleanda.co.uk>",
            to: [customerEmail],
            subject: emailSubject,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to Cleanda!</h1>
                  <p style="color: #7DD3A8; margin: 8px 0 0 0; font-size: 14px;">Partner Network</p>
                </div>
                
                <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
                  <p style="font-size: 16px; margin-bottom: 20px;">
                    Thank you for your purchase! Your lead has been unlocked and your account is ready.
                  </p>
                  
                  <p style="font-size: 16px; margin-bottom: 25px;">
                    Click the button below to securely access your dashboard:
                  </p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${magicLink}" style="background: linear-gradient(135deg, #0B3D2E 0%, #145A44 100%); color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
                      Access Your Dashboard
                    </a>
                  </div>
                  
                  <p style="font-size: 14px; color: #666; margin-top: 25px;">
                    This magic link will expire in 24 hours. If you didn't make this purchase, please ignore this email.
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 25px 0;">
                  
                  <p style="font-size: 12px; color: #999; text-align: center;">
                    © ${new Date().getFullYear()} Cleanda · All rights reserved
                  </p>
                </div>
              </body>
              </html>
            `,
          });
          
          // Log the email to email_logs table
          await supabaseClient
            .from("email_logs")
            .insert({
              template_name: "welcome_new_user",
              recipient_email: customerEmail,
              subject: emailSubject,
              status: "sent",
              resend_id: emailResponse.data?.id || null,
              is_test: false,
            });
          
          logStep("Welcome email sent and logged successfully", { resendId: emailResponse.data?.id });
        } catch (emailError: any) {
          logStep("Welcome email failed (non-blocking)", { error: emailError.message });
        }
      }
    }

    // ATOMIC: Check and update the lead in one operation to prevent race conditions
    // Only update if is_unlocked is still false (prevents two people buying same lead)
    const { data: updatedLead, error: updateError } = await supabaseClient
      .from("leads")
      .update({
        is_unlocked: true,
        unlocked_by: userId,
        unlocked_at: new Date().toISOString(),
        lead_status: "purchased",
        outcome_status: "purchased",
      })
      .eq("id", leadId)
      .eq("is_unlocked", false) // Critical: Only update if NOT already unlocked
      .select("id")
      .maybeSingle();

    if (updateError) throw new Error(`Failed to unlock lead: ${updateError.message}`);
    
    // If no row was updated, the lead was already purchased by someone else
    if (!updatedLead) {
      logStep("Lead already purchased by another user - initiating refund", { leadId, userId });
      
      // Get the payment intent to refund
      const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;
      let refundSuccess = false;
      let refundId: string | null = null;
      let refundError: string | null = null;
      
      if (paymentIntent?.id) {
        try {
          const refund = await stripe.refunds.create({
            payment_intent: paymentIntent.id,
            reason: "duplicate",
          });
          refundSuccess = true;
          refundId = refund.id;
          logStep("Refund issued successfully", { paymentIntentId: paymentIntent.id, refundId });
        } catch (err: any) {
          refundError = err.message;
          logStep("Refund failed - manual intervention required", { error: refundError });
        }
      }
      
      // Log refund event to activity_logs for admin visibility
      await supabaseClient.from("activity_logs").insert({
        user_id: userId,
        entity_type: "refund",
        entity_id: leadId,
        action: "auto_refund_duplicate",
        details: {
          reason: "duplicate_lead_purchase",
          lead_id: leadId,
          session_id: sessionId,
          payment_intent_id: paymentIntent?.id || null,
          refund_id: refundId,
          refund_success: refundSuccess,
          refund_error: refundError,
          amount: "£20",
          customer_email: customerEmail,
        },
      });
      logStep("Refund event logged to activity_logs");
      
      throw new Error("This lead was just purchased by another user. Your payment has been refunded.");
    }
    
    logStep("Lead unlocked successfully", { leadId, userId });

    // Fetch the business profile for activity logging
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("business_name, contact_name")
      .eq("user_id", userId)
      .maybeSingle();

    // Log the purchase activity
    await supabaseClient.from("activity_logs").insert({
      user_id: userId,
      entity_type: "lead",
      entity_id: leadId,
      action: "purchase",
      details: {
        payment_method: "stripe",
        session_id: sessionId,
        business_name: profile?.business_name || "Unknown Business",
        contact_name: profile?.contact_name || customerEmail,
        is_new_user: isNewUser,
        amount_paid: "£20",
      },
    });
    logStep("Purchase activity logged");

    // Increment leads_purchased counter on profile
    const { error: profileUpdateError } = await supabaseClient.rpc('increment_leads_purchased', { user_uuid: userId });
    if (profileUpdateError) {
      // Non-blocking - just log the error
      logStep("Failed to increment leads_purchased (non-blocking)", { error: profileUpdateError.message });
    }

    // Fetch the full lead details to return to the user
    const { data: lead, error: leadError } = await supabaseClient
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError) throw new Error(`Failed to fetch lead details: ${leadError.message}`);

    // Send WhatsApp notification with lead details (fire and forget)
    try {
      const whatsappUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp`;
      fetch(whatsappUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          type: "lead_unlocked",
          leadId: leadId,
          userId: userId,
        }),
      }).catch(err => logStep("WhatsApp notification failed (non-blocking)", { error: err.message }));
      logStep("WhatsApp notification triggered");
    } catch (whatsappError: any) {
      logStep("WhatsApp notification error (non-blocking)", { error: whatsappError.message });
    }

    return new Response(JSON.stringify({
      success: true,
      isNewUser,
      email: customerEmail,
      // No longer returning tempPassword - using magic link instead
      lead: {
        id: lead.id,
        postcode: lead.postcode,
        job_type: lead.job_type,
        display_value: lead.display_value,
        customer_name: lead.customer_name,
        customer_email: lead.customer_email,
        customer_phone: lead.customer_phone,
        customer_address: lead.customer_address,
        date: lead.date,
      },
    }), {
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