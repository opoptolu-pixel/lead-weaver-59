import { classifyReply, isValidTwilioSignature, leadPhoneMatches, resolveCanonicalWebhookUrl } from "./logic.ts";
import type { DbPort, IntentRecord, ProviderPort, ReceiptRecord } from "./ports.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

export const POSITIVE_MESSAGE =
  "We have received and confirmed your cleaning request. Local cleaning professionals will contact you soon.";
export const DECLINE_MESSAGE =
  "Your request has been cancelled. If you'd like to submit a new request in the future, please visit our website.";
export const UNCLEAR_MESSAGE = 'Please reply with "YES" to confirm your cleaning request, or "NO" to cancel.';
export const UNMATCHED_MESSAGE = "Thank you for your message. We couldn't find a pending request for your number.";
export const INVALID_MESSAGE = "Your message could not be accepted. Please try again.";
export const ERROR_MESSAGE = "Sorry, there was an error processing your message. Please try again later.";
export const IN_PROGRESS_MESSAGE = "Your message is being processed. We will respond shortly.";

export const NOTIFICATION_TYPE = "new_lead_sms";
const RECEIPT_LEASE_SECONDS = 120;
const INTENT_LEASE_SECONDS = 120;

export interface HandlerEnv {
  twilioAuthToken?: string | null;
  twilioWebhookUrl?: string | null;
  /** Only ever true for local/mocked runs; production must leave this false. */
  allowRequestUrlFallback?: boolean;
}

export interface HandlerDeps {
  db: DbPort;
  provider: ProviderPort;
  env: HandlerEnv;
}

export function twiml(message: string, status = 200): Response {
  const escaped = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`,
    { status, headers: { ...corsHeaders, "Content-Type": "application/xml" } },
  );
}

function acknowledgementForReceipt(receipt: ReceiptRecord): string {
  if (receipt.acknowledgement) return receipt.acknowledgement;
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
      return INVALID_MESSAGE;
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

interface DispatchSummary {
  dispatched: number;
  unknown: number;
  failed: number;
  skipped: number;
}

/**
 * At-most-once dispatch.
 *
 * Exactly-once delivery across PostgreSQL and an external messaging provider is
 * impossible without provider-supported idempotency keys: the provider can accept
 * a message and the acknowledgement can still be lost. This routine therefore
 * guarantees at-most-once automatic dispatch per (MessageSid, lead, type,
 * recipient) and escalates indeterminate outcomes to human reconciliation.
 */
async function dispatchIntents(deps: HandlerDeps, intents: IntentRecord[]): Promise<DispatchSummary> {
  const summary: DispatchSummary = { dispatched: 0, unknown: 0, failed: 0, skipped: 0 };

  for (const intent of intents) {
    // Terminal / in-flight intents are never touched again automatically.
    if (intent.status === "dispatched") { summary.dispatched += 1; continue; }
    if (intent.status === "outcome_unknown") { summary.unknown += 1; continue; }
    if (intent.status === "skipped") { summary.skipped += 1; continue; }
    if (intent.status === "permanently_failed") { summary.failed += 1; continue; }

    // Atomic claim: records dispatch_started_at before any provider contact.
    const claimed = await deps.db.claimIntent(intent.id, INTENT_LEASE_SECONDS);
    if (!claimed) {
      // Another worker owns it, or it is in a state that forbids automatic retry.
      summary.unknown += intent.status === "claimed" ? 1 : 0;
      continue;
    }

    let outcome;
    try {
      outcome = await deps.provider.dispatch(intent);
    } catch (error) {
      // A thrown error is indeterminate: the request may already have been accepted.
      outcome = { kind: "indeterminate" as const, error: error instanceof Error ? error.message : String(error) };
    }

    switch (outcome.kind) {
      case "success":
        await deps.db.recordIntentOutcome(intent.id, "dispatched", { providerReference: outcome.reference });
        summary.dispatched += 1;
        break;
      case "skipped":
        await deps.db.recordIntentOutcome(intent.id, "skipped", { error: outcome.reason });
        summary.skipped += 1;
        break;
      case "rejected":
        // Definitive rejection before acceptance: a controlled retry may re-claim.
        await deps.db.recordIntentOutcome(intent.id, "failed_retryable", { error: outcome.error });
        summary.failed += 1;
        break;
      case "indeterminate":
      default:
        await deps.db.recordIntentOutcome(intent.id, "outcome_unknown", { error: outcome.error });
        summary.unknown += 1;
        break;
    }
  }

  return summary;
}

export async function handleTwilioWebhook(req: Request, deps: HandlerDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  const authToken = deps.env.twilioAuthToken;
  if (!authToken) return new Response("Webhook authentication is not configured", { status: 503, headers: corsHeaders });

  const canonical = resolveCanonicalWebhookUrl({
    configuredUrl: deps.env.twilioWebhookUrl,
    requestUrl: req.url,
    allowRequestUrlFallback: deps.env.allowRequestUrlFallback === true,
  });
  if (!canonical.ok) {
    // Fail closed: never validate against a proxy-rewritten request URL.
    return new Response("Webhook URL is not configured", { status: 503, headers: corsHeaders });
  }

  const params = formParams(await req.formData());
  const valid = await isValidTwilioSignature(
    canonical.url,
    params,
    req.headers.get("X-Twilio-Signature"),
    authToken,
  );
  if (!valid) return new Response("Invalid Twilio signature", { status: 403, headers: corsHeaders });

  const messageSid = params.MessageSid;
  const from = params.From;
  const body = params.Body;
  if (!messageSid || !from || !body) return twiml(INVALID_MESSAGE);

  let claim: { claimed: boolean; recovered: boolean; receipt: ReceiptRecord };
  try {
    claim = await deps.db.claimReceipt(messageSid, RECEIPT_LEASE_SECONDS);
  } catch {
    return twiml(ERROR_MESSAGE);
  }

  // Duplicate webhook: replay the stored acknowledgement, never re-transition.
  if (!claim.claimed) {
    if (claim.receipt.status === "completed") return twiml(acknowledgementForReceipt(claim.receipt));
    if (claim.receipt.status === "outcome_unknown" || claim.receipt.status === "permanently_failed") {
      return twiml(acknowledgementForReceipt(claim.receipt));
    }
    return twiml(IN_PROGRESS_MESSAGE);
  }

  const receipt = claim.receipt;

  try {
    const leads = await deps.db.findCandidateLeads();
    const matchingLead = leads.find((lead) => leadPhoneMatches(lead.customer_phone || "", from));

    if (!matchingLead) {
      await deps.db.finalizeReceipt(receipt.id, {
        status: "completed",
        transitionStatus: "unmatched",
        responseKind: "unmatched",
        acknowledgement: UNMATCHED_MESSAGE,
      });
      return twiml(UNMATCHED_MESSAGE);
    }

    const alreadyConfirmed = matchingLead.lead_status === "published" &&
      Boolean(matchingLead.confirmation_response) && Boolean(matchingLead.published_at);

    const replyKind = classifyReply(body);

    if (alreadyConfirmed) {
      // A previously published lead may still hold un-dispatched intents from an
      // abandoned attempt with this same MessageSid; those are resumed, never duplicated.
      const existing = await deps.db.listIntents(messageSid, matchingLead.id, NOTIFICATION_TYPE);
      const summary = await dispatchIntents(deps, existing);
      await deps.db.finalizeReceipt(receipt.id, {
        status: summary.unknown > 0 ? "outcome_unknown" : "completed",
        leadId: matchingLead.id,
        transitionStatus: "unchanged",
        responseKind: "already_confirmed",
        acknowledgement: POSITIVE_MESSAGE,
        notificationDispatched: summary.dispatched > 0,
      });
      return twiml(POSITIVE_MESSAGE);
    }

    if (replyKind === "unclear") {
      await deps.db.finalizeReceipt(receipt.id, {
        status: "completed",
        leadId: matchingLead.id,
        transitionStatus: "unclear",
        responseKind: "unclear",
        acknowledgement: UNCLEAR_MESSAGE,
      });
      return twiml(UNCLEAR_MESSAGE);
    }

    const newStatus = replyKind === "positive" ? "published" : "spam";
    const recipients = newStatus === "published" ? await deps.db.listRecipients(matchingLead.id) : [];

    // Atomic: the lead transition and the unique notification intents commit together.
    const result = await deps.db.transitionLeadAndCreateIntents({
      messageSid,
      leadId: matchingLead.id,
      newStatus,
      confirmationResponse: body,
      notificationType: NOTIFICATION_TYPE,
      recipients,
    });

    const intents = result.transitioned
      ? result.intents
      : await deps.db.listIntents(messageSid, matchingLead.id, NOTIFICATION_TYPE);

    const summary = await dispatchIntents(deps, intents);

    if (!result.transitioned) {
      await deps.db.finalizeReceipt(receipt.id, {
        status: summary.unknown > 0 ? "outcome_unknown" : "completed",
        leadId: matchingLead.id,
        transitionStatus: "unchanged",
        responseKind: "already_confirmed",
        acknowledgement: POSITIVE_MESSAGE,
        notificationDispatched: summary.dispatched > 0,
      });
      return twiml(POSITIVE_MESSAGE);
    }

    const acknowledgement = newStatus === "published"
      ? `Great! Your cleaning request for ${matchingLead.job_type ?? "cleaning"} has been confirmed and is now live. Local cleaning professionals will contact you soon!`
      : DECLINE_MESSAGE;

    await deps.db.finalizeReceipt(receipt.id, {
      status: summary.unknown > 0 ? "outcome_unknown" : "completed",
      leadId: matchingLead.id,
      transitionStatus: newStatus,
      responseKind: newStatus === "published" ? "confirmed" : "cancelled",
      acknowledgement,
      notificationDispatched: summary.dispatched > 0,
      error: summary.unknown > 0 ? "one or more notification dispatches returned an indeterminate result" : null,
    });

    return twiml(acknowledgement);
  } catch (error) {
    await deps.db.finalizeReceipt(receipt.id, {
      status: "failed_retryable",
      responseKind: "error",
      error: error instanceof Error ? error.message : String(error),
    });
    return twiml(ERROR_MESSAGE);
  }
}
