import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

  // Health check endpoint
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "healthy", function: "auto-publish-leads", timestamp: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
      const { data: publishedLead, error: updateError } = await supabase
        .from("leads")
        .update({
          lead_status: "published",
          published_at: new Date().toISOString(),
          confirmation_response: "auto_published_timeout",
        })
        .eq("id", lead.id)
        .eq("lead_status", "pending_confirmation")
        .select("id")
        .maybeSingle();

      if (updateError) {
        logStep("Failed to update lead", { leadId: lead.id, error: updateError.message });
        results.push({ leadId: lead.id, success: false, error: updateError.message });
        continue;
      }

      if (!publishedLead) {
        results.push({ leadId: lead.id, success: true, skipped: true, reason: "already_processed" });
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

      // Send email notification to businesses in the area using template
      try {
        // Get the postcode area (first part of postcode)
        const postcodeArea = lead.postcode?.split(" ")[0] || lead.postcode?.slice(0, -3) || "";
        
        // Find businesses that might be interested (matching postcode prefix)
        const { data: matchingBusinesses } = await supabase
          .from("profiles")
          .select("user_id, business_name, contact_name")
          .eq("is_verified", true)
          .eq("is_suspended", false)
          .not("postcode", "is", null);

        if (matchingBusinesses && matchingBusinesses.length > 0) {
          // Get the email template
          const { data: template } = await supabase
            .from("email_templates")
            .select("subject, body")
            .eq("name", "lead_available_notification")
            .eq("is_active", true)
            .maybeSingle();

          if (template) {
            // Send to each matching business (limit to prevent spam)
            const businessesToNotify = matchingBusinesses.slice(0, 20);
            
            for (const business of businessesToNotify) {
              try {
                // Get user email
                const { data: userEmail } = await supabase.rpc("get_user_email", { 
                  user_uuid: business.user_id 
                });

                if (userEmail) {
                  const variables: Record<string, string> = {
                    business_name: business.business_name || "Partner",
                    contact_name: business.contact_name || "there",
                    job_type: lead.job_type || "Cleaning",
                    postcode_area: postcodeArea,
                    postcode: lead.postcode || "",
                    display_value: lead.display_value || "",
                    preferred_date: lead.date || "Flexible",
                    leads_url: "https://cleanda.co.uk/leads",
                    dashboard_url: "https://cleanda.co.uk/dashboard",
                    support_email: "hello@cleanda.co.uk",
                    current_year: new Date().getFullYear().toString(),
                  };

                  let subject = template.subject;
                  let html = template.body;
                  
                  Object.entries(variables).forEach(([key, value]) => {
                    subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
                    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
                  });

                  // Fire and forget - don't wait for each email
                  fetch(`${supabaseUrl}/functions/v1/send-email`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify({
                      to: userEmail,
                      subject,
                      html,
                      templateName: "lead_available_notification",
                    }),
                  }).catch(err => logStep("Email notification failed", { business: business.user_id, error: err.message }));
                }
              } catch (emailError: any) {
                logStep("Error sending email to business", { business: business.user_id, error: emailError.message });
              }
            }
            logStep("Email notifications triggered", { count: businessesToNotify.length, leadId: lead.id });
          }
        }
      } catch (emailError: any) {
        logStep("Email notification error (non-blocking)", { leadId: lead.id, error: emailError.message });
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