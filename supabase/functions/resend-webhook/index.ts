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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    logStep("Payload received", { type: payload.type, data: payload.data?.email_id });

    const { type, data } = payload;
    const resendId = data?.email_id;

    if (!resendId) {
      logStep("No email_id in payload, skipping");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let updateData: Record<string, any> = {};

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
          clicked_at: new Date().toISOString(),
        };
        break;
      case "email.bounced":
        updateData = {
          status: "bounced",
          bounced_at: new Date().toISOString(),
          bounce_type: data?.bounce?.type || "unknown",
        };
        break;
      case "email.complained":
        updateData = {
          status: "complained",
        };
        break;
      default:
        logStep("Unknown event type", { type });
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    }

    logStep("Updating email log", { resendId, updateData });

    const { error } = await supabase
      .from("email_logs")
      .update(updateData)
      .eq("resend_id", resendId);

    if (error) {
      logStep("Error updating email log", { error: error.message });
    } else {
      logStep("Email log updated successfully");
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
