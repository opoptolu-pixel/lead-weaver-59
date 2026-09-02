import { createClient } from "npm:@supabase/supabase-js@2";
import { isValidTwilioSignature, classifyReply, normalizePhone } from "./logic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
const POSITIVE_MESSAGE = "We have received and confirmed your cleaning request. Local cleaning professionals will contact you soon.";
const DECLINE_MESSAGE = "Your request has been cancelled. If you'd like to submit a new request in the future, please visit our website.";
const UNCLEAR_MESSAGE = 'Please reply with "YES" to confirm your cleaning request, or "NO" to cancel.';
const UNMATCHED_MESSAGE = "Thank you for your message. We couldn't find a pending request for your number.";
const ERROR_MESSAGE = "Sorry, there was an error processing your message. Please try again later.";

type Receipt = {
  id: string;
  status: "processing" | "completed" | "failed";
  lead_id: string | null;
  transition_status: "published" | "spam" | "unchanged" | "unmatched" | "unclear" | "invalid" | null;
  response_kind: "confirmed" | "cancelled" | "already_confirmed" | "unmatched" | "unclear" | "invalid" | "error";
  notification_dispatched: boolean;
};

function twiml(message: string): Response {
  const escaped = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`, {
    headers: { ...corsHeaders, "Content-Type": "application/xml" },
  });
}

function responseForReceipt(receipt: Pick<Receipt, "response_kind">): string {
  switch (receipt.response_kind) {
    case "confirmed":
    case "already_confirmed":
      return POSITIVE_MESSAGE;
    case "cancelled":
      return DECLINE_MESSAGE;
    case "unmatched":
      return UNMATCHED_MESSAGE;
    case "unclear":
      return UNCLEAR_MESSAGE;
    case "invalid":
      return "Your message could not be accepted. Please try again.";
    default:
      return ERROR_MESSAGE;
  }
}

function formParams(formData: FormData): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") params[key] = value;
  }
  return params;
}

async function claimReceipt(supabase: ReturnType<typeof createClient>, messageSid: string): Promise<{ claimed: boolean; receipt: Receipt }> {
  const { data, error } = await supabase
    .from("twilio_inbound_receipts")
    .insert({ message_sid: messageSid, response_kind: "error", status: "processing", processing_started_at: new Date().toISOString() })
    .select("id,status,lead_id,transition_status,response_kind,notification_dispatched")
    .single();

  if (!error && data) return { claimed: true, receipt: data as Receipt };
  if (error?.code !== "23505") throw new Error(`Receipt claim failed: ${error?.message || "unknown error"}`);

  const { data: existing, error: existingError } = await supabase
    .from("twilio_inbound_receipts")
    .select("id,status,lead_id,transition_status,response_kind,notification_dispatched")
    .eq("message_sid", messageSid)
    .single();
  if (existingError || !existing) throw new Error(`Receipt lookup failed: ${existingError?.message || "not found"}`);
  return { claimed: false, receipt: existing as Receipt };
}

async function completeReceipt(
  supabase: ReturnType<typeof createClient>,
  receiptId: string,
  update: Partial<Pick<Receipt, "lead_id" | "transition_status" | "response_kind" | "notification_dispatched">>,
): Promise<void> {
  const { error } = await supabase.from("twilio_inbound_receipts").update({
    ...update,
    status: "completed",
    completed_at: new Date().toISOString(),
    last_error: null,
  }).eq("id", receiptId);
  if (error) throw error;
}

async function failReceipt(supabase: ReturnType<typeof createClient>, receiptId: string, error: unknown): Promise<void> {
  await supabase.from("twilio_inbound_receipts").update({
    status: "failed",
    last_error: String(error instanceof Error ? error.message : error).slice(0, 1000),
  }).eq("id", receiptId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const webhookUrl = Deno.env.get("TWILIO_WEBHOOK_URL") || req.url;
  if (!authToken) return new Response("Webhook authentication is not configured", { status: 503, headers: corsHeaders });

  const formData = await req.formData();
  const params = formParams(formData);
  const validSignature = await isValidTwilioSignature(webhookUrl, params, req.headers.get("X-Twilio-Signature"), authToken);
  if (!validSignature) return new Response("Invalid Twilio signature", { status: 403, headers: corsHeaders });

  const messageSid = params.MessageSid;
  const from = params.From;
  const body = params.Body;
  if (!messageSid || !from || !body) return twiml("Your message could not be accepted. Please try again.");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return new Response("Webhook backend is not configured", { status: 503, headers: corsHeaders });
  const supabase = createClient(supabaseUrl, serviceKey);

  let claim: { claimed: boolean; receipt: Receipt };
  try {
    claim = await claimReceipt(supabase, messageSid);
  } catch (error) {
    return twiml(ERROR_MESSAGE);
  }

  if (!claim.claimed) {
    if (claim.receipt.status === "completed") return twiml(responseForReceipt(claim.receipt));
    return twiml("Your message is being processed. We will respond shortly.");
  }

  const receiptId = claim.receipt.id;
  try {
    const normalizedPhone = normalizePhone(from);
    const { data: leads, error: searchError } = await supabase
      .from("leads")
      .select("*")
      .in("lead_status", ["pending_confirmation", "published"])
      .order("confirmation_sent_at", { ascending: false });
    if (searchError) throw searchError;

    const matchingLead = (leads || []).find((lead) => {
      const leadPhone = normalizePhone(lead.customer_phone || "");
      const leadPhoneWithCode = leadPhone.startsWith("44") ? leadPhone : `44${leadPhone.startsWith("0") ? leadPhone.slice(1) : leadPhone}`;
      return normalizedPhone.endsWith(leadPhone) || normalizedPhone === leadPhoneWithCode || leadPhone.endsWith(normalizedPhone.slice(-10));
    });

    if (!matchingLead) {
      await completeReceipt(supabase, receiptId, { transition_status: "unmatched", response_kind: "unmatched" });
      return twiml(UNMATCHED_MESSAGE);
    }

    const isAlreadyConfirmed = matchingLead.lead_status === "published" && matchingLead.confirmation_response && matchingLead.published_at;
    if (isAlreadyConfirmed) {
      await completeReceipt(supabase, receiptId, { lead_id: matchingLead.id, transition_status: "unchanged", response_kind: "already_confirmed" });
      return twiml(POSITIVE_MESSAGE);
    }

    const replyKind = classifyReply(body);
    if (replyKind === "unclear") {
      await completeReceipt(supabase, receiptId, { lead_id: matchingLead.id, transition_status: "unclear", response_kind: "unclear" });
      return twiml(UNCLEAR_MESSAGE);
    }

    const newStatus = replyKind === "positive" ? "published" : "spam";
    const updateData: Record<string, string> = { lead_status: newStatus, confirmation_response: body };
    if (newStatus === "published") updateData.published_at = new Date().toISOString();

    const { data: transitionedLead, error: updateError } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", matchingLead.id)
      .eq("lead_status", "pending_confirmation")
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;

    if (!transitionedLead) {
      await completeReceipt(supabase, receiptId, { lead_id: matchingLead.id, transition_status: "unchanged", response_kind: "already_confirmed" });
      return twiml(POSITIVE_MESSAGE);
    }

    await supabase.from("activity_logs").insert({
      user_id: SYSTEM_USER_ID,
      entity_type: "lead",
      entity_id: matchingLead.id,
      action: "customer_response",
      details: { previous_status: "pending_confirmation", new_status: newStatus, is_positive: replyKind === "positive", method: "sms" },
    });

    let notificationDispatched = false;
    if (newStatus === "published") {
      const notificationResponse = await fetch(`${supabaseUrl}/functions/v1/send-sms-notification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "new_lead", leadId: matchingLead.id }),
      });
      await notificationResponse.text();
      notificationDispatched = notificationResponse.ok;
    }

    const responseKind = newStatus === "published" ? "confirmed" : "cancelled";
    await completeReceipt(supabase, receiptId, {
      lead_id: matchingLead.id,
      transition_status: newStatus,
      response_kind: responseKind,
      notification_dispatched: notificationDispatched,
    });
    return twiml(newStatus === "published" ? `Great! Your cleaning request for ${matchingLead.job_type} has been confirmed and is now live. Local cleaning professionals will contact you soon!` : DECLINE_MESSAGE);
  } catch (error) {
    await failReceipt(supabase, receiptId, error);
    return twiml(ERROR_MESSAGE);
  }
});
