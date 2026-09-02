import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  AUTH_REQUIRED,
  buildNewLeadMessage,
  sendSingleRecipientNotification,
  SingleRecipientError,
  type SingleRecipientRequest,
} from "./single-recipient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[SMS-NOTIFICATION] ${step}`, details ? JSON.stringify(details) : "");
};

interface SMSNotificationRequest extends Partial<SingleRecipientRequest> {
  type: "new_lead" | "lead_unlocked";
  leadId: string;
  userId?: string;
  mode?: "single_recipient";
}

interface PostcodeCoords {
  latitude: number;
  longitude: number;
}

const MAX_DISTANCE_MILES = 30;

// Get coordinates for a UK postcode using postcodes.io
async function getPostcodeCoords(postcode: string): Promise<PostcodeCoords | null> {
  try {
    const cleanPostcode = postcode.replace(/\s+/g, "").toUpperCase();
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleanPostcode)}`);
    
    if (!response.ok) {
      logStep("Postcode lookup failed", { postcode, status: response.status });
      return null;
    }
    
    const data = await response.json();
    if (data.status === 200 && data.result) {
      return {
        latitude: data.result.latitude,
        longitude: data.result.longitude,
      };
    }
    return null;
  } catch (err: any) {
    logStep("Postcode lookup error", { postcode, error: err.message });
    return null;
  }
}

// Calculate distance between two coordinates using Haversine formula (returns miles)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function maskPhone(phone: string): string {
  return phone.length > 4 ? `***${phone.slice(-4)}` : "***";
}

async function sendSMS(to: string, body: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_SMS_FROM");

  if (!accountSid || !authToken) {
    throw new Error("Missing Twilio credentials");
  }

  if (!from) {
    throw new Error("Missing TWILIO_SMS_FROM");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const formData = new URLSearchParams();
  formData.append("To", to);
  formData.append("From", from);
  formData.append("Body", body);

  logStep("Sending SMS", { recipient: maskPhone(to), bodyLength: body.length });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const result = await response.json();

  if (!response.ok) {
    logStep("Twilio SMS rejected", { status: response.status, code: result.code });
    throw new Error(`Twilio error: ${result.message || result.code || "Unknown error"}`);
  }

  logStep("SMS sent successfully", { sid: result.sid, status: result.status });
  return result;
}

// Format phone number to E.164 format
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("44")) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith("0")) {
    return `+44${cleaned.slice(1)}`;
  }
  return `+44${cleaned}`;
}

// Extract outward code from postcode
function getOutwardCode(postcode: string): string {
  if (!postcode) return "Unknown";
  const trimmed = postcode.trim().toUpperCase();
  if (trimmed.includes(" ")) {
    return trimmed.split(" ")[0];
  }
  if (trimmed.length > 4) {
    return trimmed.slice(0, -3);
  }
  return trimmed;
}

// Extract value without "from" prefix
function extractValue(displayValue: string): string {
  if (!displayValue) return "Contact for quote";
  return displayValue.replace(/^from\s+/i, "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const request = await req.json() as SMSNotificationRequest;
    const { type, leadId, userId } = request;
    logStep("Received request", { type, leadId, userId });

    if (request.mode === "single_recipient") {
      const singleRequest = request as SingleRecipientRequest;
      const leadResult = await supabase
        .from("leads")
        .select("id, postcode, job_type, display_value, lead_status")
        .eq("id", singleRequest.leadId)
        .maybeSingle();
      const profileResult = await supabase
        .from("profiles")
        .select("user_id, phone, postcode, whatsapp_optin, is_closed")
        .eq("user_id", singleRequest.userId)
        .maybeSingle();
      const recipientsResult = await supabase.rpc("lead_notification_recipients", {
        p_lead_id: singleRequest.leadId,
      });
      const intentResult = await supabase
        .from("notification_intents")
        .select("id, lead_id, notification_type, recipient, recipient_user_id, status")
        .eq("id", singleRequest.idempotencyKey)
        .maybeSingle();

      if (leadResult.error || profileResult.error || recipientsResult.error || intentResult.error) {
        throw new Error("Single-recipient eligibility lookup failed");
      }

      const singleLead = leadResult.data;
      const singleProfile = profileResult.data;
      const leadCoords = singleLead?.postcode ? await getPostcodeCoords(singleLead.postcode) : null;
      const recipientCoords = singleProfile?.postcode ? await getPostcodeCoords(singleProfile.postcode) : null;
      const withinLocationRule = Boolean(leadCoords && recipientCoords) && calculateDistance(
        leadCoords?.latitude ?? 0,
        leadCoords?.longitude ?? 0,
        recipientCoords?.latitude ?? 0,
        recipientCoords?.longitude ?? 0,
      ) <= MAX_DISTANCE_MILES;

      const message = singleLead
        ? `New lead in ${getOutwardCode(singleLead.postcode)}!\\n\\n${singleLead.job_type}\\nValue: ${extractValue(singleLead.display_value)}\\n\\nLogin to Cleanda to view and unlock this lead.\\n\\n-Cleanda`
        : "";
      try {
        const result = await sendSingleRecipientNotification(singleRequest, {
          serviceRoleKey: supabaseServiceKey,
          authorization: req.headers.get("Authorization"),
          getLead: async () => singleLead,
          getProfile: async () => singleProfile,
          getEligibleRecipients: async () => withinLocationRule ? (recipientsResult.data || []) : [],
          getIntent: async () => intentResult.data,
          send: (recipientPhone, notificationMessage) => sendSMS(formatPhoneNumber(recipientPhone), notificationMessage),
        }, message);
        return new Response(JSON.stringify({ success: true, outcome: result.kind, providerReference: result.providerReference, userId: result.userId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Single-recipient notification rejected";
        const status = message === "Internal authentication required" ? 401 : 422;
        return new Response(JSON.stringify({ success: false, outcome: "rejected", error: status === 401 ? "Internal authentication required" : "Recipient is not eligible" }), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error(`Lead not found: ${leadError?.message}`);
    }

    logStep("Lead found", { jobType: lead.job_type, postcode: lead.postcode });

    if (type === "new_lead") {
      // Get lead coordinates for distance filtering
      const leadCoords = await getPostcodeCoords(lead.postcode);
      
      if (!leadCoords) {
        logStep("Could not get lead coordinates, skipping location filter", { postcode: lead.postcode });
      }

      // Send to all opted-in users within distance
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .eq("whatsapp_optin", true)
        .not("phone", "is", null)
        .not("postcode", "is", null)
        .or("is_closed.is.null,is_closed.eq.false");

      if (profilesError) {
        throw new Error(`Error fetching profiles: ${profilesError.message}`);
      }

      logStep("Found opted-in users with postcodes", { count: profiles?.length || 0 });

      const outwardPostcode = getOutwardCode(lead.postcode);
      const cleanValue = extractValue(lead.display_value);
      
      // New lead SMS message
      const message = `New lead in ${outwardPostcode}!\n\n` +
        `${lead.job_type}\n` +
        `Value: ${cleanValue}\n\n` +
        `Login to Cleanda to view and unlock this lead.\n\n` +
        `- Cleanda`;

      const results = [];
      const seenPhones = new Set<string>();
      for (const profile of profiles || []) {
        if (!profile.phone || !profile.postcode) continue;

        const formattedPhone = formatPhoneNumber(profile.phone);
        if (seenPhones.has(formattedPhone)) {
          results.push({ userId: profile.user_id, status: "skipped", reason: "duplicate_phone" });
          continue;
        }
        seenPhones.add(formattedPhone);

        // Check distance if we have lead coordinates
        if (leadCoords) {
          const cleanerCoords = await getPostcodeCoords(profile.postcode);
          
          if (!cleanerCoords) {
            logStep("Could not get cleaner coordinates, skipping", { userId: profile.user_id, postcode: profile.postcode });
            results.push({ userId: profile.user_id, status: "skipped", reason: "invalid_postcode" });
            continue;
          }
          
          const distance = calculateDistance(
            leadCoords.latitude, leadCoords.longitude,
            cleanerCoords.latitude, cleanerCoords.longitude
          );
          
          logStep("Distance calculated", { 
            userId: profile.user_id, 
            cleanerPostcode: profile.postcode,
            leadPostcode: lead.postcode,
            distanceMiles: distance.toFixed(1)
          });
          
          if (distance > MAX_DISTANCE_MILES) {
            results.push({ userId: profile.user_id, status: "skipped", reason: "too_far", distance: distance.toFixed(1) });
            continue;
          }
        }

        try {
          const { error: reservationError } = await supabase
            .from("lead_sms_notification_deliveries")
            .insert({ lead_id: lead.id, phone: formattedPhone });

          if (reservationError?.code === "23505") {
            results.push({ userId: profile.user_id, status: "skipped", reason: "already_notified" });
            continue;
          }
          if (reservationError) throw reservationError;

          await sendSMS(formattedPhone, message);
          results.push({ userId: profile.user_id, status: "sent" });
        } catch (err: any) {
          await supabase
            .from("lead_sms_notification_deliveries")
            .delete()
            .eq("lead_id", lead.id)
            .eq("phone", formattedPhone);
          logStep("Failed to send to user", { userId: profile.user_id, error: err.message });
          results.push({ userId: profile.user_id, status: "failed", error: err.message });
        }
      }

      logStep("Notification results summary", {
        total: results.length,
        sent: results.filter(r => r.status === "sent").length,
        skipped: results.filter(r => r.status === "skipped").length,
        failed: results.filter(r => r.status === "failed").length
      });

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === "lead_unlocked") {
      // Send full details to the user who unlocked
      if (!userId) {
        throw new Error("userId required for lead_unlocked type");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (profileError || !profile) {
        throw new Error(`Profile not found: ${profileError?.message}`);
      }

      if (!profile.phone || !profile.whatsapp_optin || profile.is_closed) {
        logStep("User not opted in, no phone, or account closed", { userId });
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Lead unlocked SMS message with customer details
      const message = `Lead unlocked!\n\n` +
        `Customer: ${lead.customer_name || "Not provided"}\n` +
        `Phone: ${lead.customer_phone || "Not provided"}\n` +
        `Email: ${lead.customer_email || "Not provided"}\n` +
        `Address: ${lead.customer_address || "Contact for address"}\n\n` +
        `Good luck with this job!\n` +
        `- Cleanda`;

      const formattedPhone = formatPhoneNumber(profile.phone);
      await sendSMS(formattedPhone, message);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid notification type");

  } catch (error: any) {
    logStep("Error", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
