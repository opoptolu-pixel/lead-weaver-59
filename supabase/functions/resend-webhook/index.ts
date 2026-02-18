import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RESEND-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received", { method: req.method, url: req.url });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    const { type, data } = payload;
    const resendId = data?.email_id;
    const recipientEmail = (data?.to?.[0] || data?.email || "").toLowerCase().trim();

    logStep("Event received", { type, resendId, recipientEmail });

    if (!type) {
      logStep("No event type in payload, skipping");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let updateData: Record<string, any> = {};
    let shouldSuppress = false;
    let suppressReason = "";
    let bounceType = "";

    switch (type) {
      case "email.delivered":
        updateData = {
          status: "delivered",
          delivered_at: new Date().toISOString(),
        };
        break;

      case "email.opened":
        updateData = {
          status: "opened",
          opened_at: new Date().toISOString(),
        };
        break;

      case "email.clicked":
        updateData = {
          status: "clicked",
          clicked_at: new Date().toISOString(),
        };
        break;

      case "email.bounced":
        bounceType = (data?.bounce?.type || "permanent").toLowerCase();
        updateData = {
          status: "bounced",
          bounced_at: new Date().toISOString(),
          bounce_type: bounceType,
        };
        // Suppress on permanent bounces; treat unknown as permanent to be safe
        if (bounceType !== "temporary" && bounceType !== "transient") {
          shouldSuppress = true;
          suppressReason = "hard_bounce";
          logStep("Hard bounce detected — will suppress", { recipientEmail, bounceType });
        } else {
          logStep("Soft/temporary bounce — no suppression", { recipientEmail, bounceType });
        }
        break;

      case "email.complained":
        updateData = {
          status: "complained",
        };
        shouldSuppress = true;
        suppressReason = "complained";
        logStep("Spam complaint — will suppress", { recipientEmail });
        break;

      default:
        logStep("Unhandled event type", { type });
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    }

    // --- Update email_logs by resend_id ---
    if (resendId) {
      logStep("Updating email_logs by resend_id", { resendId, updateData });

      const { data: updated, error: updateError } = await supabase
        .from("email_logs")
        .update(updateData)
        .eq("resend_id", resendId)
        .select("id");

      if (updateError) {
        logStep("Error updating email_logs by resend_id", { error: updateError.message });
      } else {
        logStep("email_logs update result", { rowsUpdated: updated?.length ?? 0, resendId });

        // Fallback: if no rows updated and we have recipient email, try by email + no resend_id set
        if ((updated?.length ?? 0) === 0 && recipientEmail) {
          logStep("No rows matched by resend_id — attempting fallback by recipient_email", { recipientEmail });

          // Find recent unmatched log rows for this recipient (sent in last 7 days, no resend_id)
          const { data: fallbackRows, error: fallbackErr } = await supabase
            .from("email_logs")
            .update({ ...updateData, resend_id: resendId })
            .eq("recipient_email", recipientEmail)
            .is("resend_id", null)
            .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .select("id");

          if (fallbackErr) {
            logStep("Fallback update error", { error: fallbackErr.message });
          } else {
            logStep("Fallback update result", { rowsUpdated: fallbackRows?.length ?? 0 });
          }
        }
      }

      // Also update email_sequence_logs (for sequence emails tracked separately)
      const { data: seqUpdated, error: seqError } = await supabase
        .from("email_sequence_logs")
        .update({
          ...(updateData.opened_at ? { opened_at: updateData.opened_at, status: "opened" } : {}),
          ...(updateData.clicked_at ? { clicked_at: updateData.clicked_at, status: "clicked" } : {}),
          ...(updateData.status === "bounced" ? { status: "bounced" } : {}),
        })
        .eq("resend_id", resendId)
        .select("id");

      if (seqError) {
        logStep("Error updating email_sequence_logs", { error: seqError.message });
      } else if ((seqUpdated?.length ?? 0) > 0) {
        logStep("email_sequence_logs updated", { rowsUpdated: seqUpdated?.length });
      }
    }

    // --- Auto-add to suppression list ---
    if (shouldSuppress && recipientEmail) {
      logStep("Adding to suppression list", { email: recipientEmail, reason: suppressReason });

      const { error: suppressError } = await supabase
        .from("email_suppressions")
        .insert({
          email: recipientEmail,
          reason: suppressReason,
          bounce_type: bounceType || null,
          source_resend_id: resendId || null,
          suppressed_at: new Date().toISOString(),
        })
        .onConflict("email")
        .ignore();

      if (suppressError) {
        logStep("Error inserting suppression (may already exist)", { error: suppressError.message });
      } else {
        logStep("Suppression added successfully", { email: recipientEmail });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error(`[RESEND-WEBHOOK] ERROR: ${error.message}`, error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
