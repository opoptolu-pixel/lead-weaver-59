import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[AUTO-PUBLISH] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logStep("Starting auto-publish check");

    // Find leads pending confirmation where auto_publish_at has passed
    const { data: leadsToPublish, error: searchError } = await supabase
      .from("leads")
      .select("*")
      .eq("lead_status", "pending_confirmation")
      .lte("auto_publish_at", new Date().toISOString());

    if (searchError) {
      throw new Error(`Search error: ${searchError.message}`);
    }

    logStep("Found leads to auto-publish", { count: leadsToPublish?.length || 0 });

    if (!leadsToPublish || leadsToPublish.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No leads to auto-publish",
        count: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const lead of leadsToPublish) {
      // Update lead to published
      const { error: updateError } = await supabase
        .from("leads")
        .update({
          lead_status: "published",
          published_at: new Date().toISOString(),
          confirmation_response: "auto_published_timeout",
        })
        .eq("id", lead.id);

      if (updateError) {
        logStep("Failed to update lead", { leadId: lead.id, error: updateError.message });
        results.push({ leadId: lead.id, success: false, error: updateError.message });
        continue;
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: "00000000-0000-0000-0000-000000000000", // System user
        entity_type: "lead",
        entity_id: lead.id,
        action: "auto_published",
        details: {
          previous_status: "pending_confirmation",
          new_status: "published",
          reason: "No response within timeout period",
          auto_publish_at: lead.auto_publish_at,
        },
      });

      // Send SMS notification to opted-in users about the new lead
      try {
        const smsUrl = `${supabaseUrl}/functions/v1/send-sms-notification`;
        fetch(smsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            type: "new_lead",
            leadId: lead.id,
          }),
        }).catch(err => logStep("SMS notification failed (non-blocking)", { leadId: lead.id, error: err.message }));
        logStep("SMS notification triggered for new lead", { leadId: lead.id });
      } catch (smsError: any) {
        logStep("SMS notification error (non-blocking)", { leadId: lead.id, error: smsError.message });
      }

      logStep("Auto-published lead", { leadId: lead.id });
      results.push({ leadId: lead.id, success: true });
    }

    const successCount = results.filter(r => r.success).length;

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Auto-published ${successCount} leads`,
      count: successCount,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    logStep("Error", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});