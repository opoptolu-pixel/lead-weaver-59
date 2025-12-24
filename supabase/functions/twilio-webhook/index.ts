import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[TWILIO-WEBHOOK] ${step}`, details ? JSON.stringify(details) : "");
};

// Positive confirmation keywords
const POSITIVE_RESPONSES = ["yes", "confirm", "confirmed", "ok", "okay", "y", "yep", "yeah", "sure", "go ahead"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse Twilio webhook payload (form-urlencoded)
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const body = formData.get("Body") as string;
    const messageSid = formData.get("MessageSid") as string;

    logStep("Received webhook", { from, body, messageSid });

    if (!from || !body) {
      throw new Error("Missing required fields: From or Body");
    }

    // Normalize phone number (remove whatsapp: prefix and +)
    const normalizedPhone = from.replace("whatsapp:", "").replace("+", "");
    
    // Find lead with this phone number that's pending confirmation
    const { data: leads, error: searchError } = await supabase
      .from("leads")
      .select("*")
      .eq("lead_status", "pending_confirmation")
      .order("confirmation_sent_at", { ascending: false });

    if (searchError) {
      throw new Error(`Search error: ${searchError.message}`);
    }

    // Match phone number (check various formats)
    const matchingLead = leads?.find(lead => {
      const leadPhone = lead.customer_phone.replace(/\D/g, "");
      const leadPhoneWithCode = leadPhone.startsWith("44") ? leadPhone : `44${leadPhone.startsWith("0") ? leadPhone.slice(1) : leadPhone}`;
      return normalizedPhone.endsWith(leadPhone) || normalizedPhone === leadPhoneWithCode || leadPhone.endsWith(normalizedPhone.slice(-10));
    });

    if (!matchingLead) {
      logStep("No matching lead found for phone", { normalizedPhone });
      // Return TwiML response even if no match
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>Thank you for your message. We couldn't find a pending request for your number.</Message>
        </Response>`,
        { 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/xml" 
          } 
        }
      );
    }

    logStep("Found matching lead", { leadId: matchingLead.id, jobType: matchingLead.job_type });

    // Check if response is positive
    const normalizedBody = body.toLowerCase().trim();
    const isPositive = POSITIVE_RESPONSES.some(keyword => 
      normalizedBody === keyword || normalizedBody.startsWith(keyword + " ") || normalizedBody.includes(keyword)
    );

    let newStatus: string;
    let responseMessage: string;

    if (isPositive) {
      newStatus = "published";
      responseMessage = `Great! Your cleaning request for ${matchingLead.job_type} has been confirmed and is now live. Local cleaning professionals will contact you soon!`;
      logStep("Positive confirmation received", { response: body });
    } else {
      // Check if it's a clear decline
      const declineKeywords = ["no", "cancel", "stop", "decline", "n", "nope"];
      const isDecline = declineKeywords.some(keyword => 
        normalizedBody === keyword || normalizedBody.startsWith(keyword + " ")
      );

      if (isDecline) {
        newStatus = "spam";
        responseMessage = "Your request has been cancelled. If you'd like to submit a new request in the future, please visit our website.";
        logStep("Request declined by customer", { response: body });
      } else {
        // Unclear response, ask for clarification
        logStep("Unclear response", { response: body });
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Message>Please reply with "YES" to confirm your cleaning request, or "NO" to cancel.</Message>
          </Response>`,
          { 
            headers: { 
              ...corsHeaders, 
              "Content-Type": "application/xml" 
            } 
          }
        );
      }
    }

    // Update lead status
    const updateData: Record<string, any> = {
      lead_status: newStatus,
      confirmation_response: body,
    };

    if (newStatus === "published") {
      updateData.published_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", matchingLead.id);

    if (updateError) {
      throw new Error(`Update error: ${updateError.message}`);
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      user_id: "00000000-0000-0000-0000-000000000000", // System user
      entity_type: "lead",
      entity_id: matchingLead.id,
      action: "customer_response",
      details: {
        previous_status: "pending_confirmation",
        new_status: newStatus,
        customer_response: body,
        is_positive: isPositive,
      },
    });

    logStep("Lead updated", { leadId: matchingLead.id, newStatus });

    // Return TwiML response
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>${responseMessage}</Message>
      </Response>`,
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/xml" 
        } 
      }
    );

  } catch (error: any) {
    logStep("Error", { message: error.message });
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>Sorry, there was an error processing your message. Please try again later.</Message>
      </Response>`,
      { 
        status: 200, // Twilio expects 200 even for errors
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/xml" 
        } 
      }
    );
  }
});