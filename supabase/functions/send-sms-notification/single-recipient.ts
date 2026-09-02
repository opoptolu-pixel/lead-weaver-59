// Strictly authenticated internal single-recipient dispatch.
//
// This module is pure: every database read and the provider call are injected,
// so it is fully testable without a network or a database. It exists so the
// inbound-webhook dispatcher can notify exactly ONE recipient per durable
// notification intent, instead of re-triggering the whole fan-out batch.
//
// Legacy marketplace note: recipients are resolved from public.profiles
// (cleaning businesses). The managed-agency tables (cleaner_profiles,
// cleaner_service_areas, cleaner_service_capabilities) are contained and are
// deliberately NOT consulted here.

export interface SingleRecipientRequest {
  type: "new_lead";
  mode: "single_recipient";
  leadId: string;
  userId: string;
  idempotencyKey: string;
  /** Must never be supplied: the recipient is resolved server-side by user ID. */
  recipientPhone?: unknown;
  /** Must never be supplied: the phone is never client-selectable. */
  to?: unknown;
}

export interface SingleRecipientLead {
  id: string;
  postcode: string | null;
  job_type: string | null;
  display_value: string | null;
  lead_status: string;
}

export interface SingleRecipientProfile {
  user_id: string;
  phone: string | null;
  postcode: string | null;
  whatsapp_optin: boolean | null;
  is_closed: boolean | null;
  is_suspended?: boolean | null;
}

export interface SingleRecipientIntent {
  id: string;
  lead_id: string;
  notification_type: string;
  recipient: string;
  recipient_user_id: string | null;
  status: string;
}

export interface SingleRecipientDeps {
  serviceRoleKey: string | null | undefined;
  authorization: string | null;
  getLead: (leadId: string) => Promise<SingleRecipientLead | null>;
  getProfile: (userId: string) => Promise<SingleRecipientProfile | null>;
  getEligibleRecipients: (leadId: string) => Promise<Array<{ recipient: string; recipient_user_id: string | null }>>;
  getIntent: (intentId: string) => Promise<SingleRecipientIntent | null>;
  send: (recipientPhone: string, message: string) => Promise<{ sid?: string | null }>;
}

export type SingleRecipientResult =
  | { kind: "sent"; providerReference: string | null; userId: string };

export const NOTIFICATION_TYPE = "new_lead_sms";

/** Reason codes are stable and safe to log: they contain no PII. */
export const AUTH_REQUIRED = "internal_authentication_required";
export const NOT_ELIGIBLE = "recipient_not_eligible";

export class SingleRecipientError extends Error {
  constructor(readonly reason: string, readonly detail: string) {
    super(detail);
    this.name = "SingleRecipientError";
  }
}

export function normalizeRecipientPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("44")) return digits;
  if (digits.startsWith("0")) return `44${digits.slice(1)}`;
  return `44${digits}`;
}

export function getOutwardCode(postcode: string | null): string {
  if (!postcode) return "your area";
  const trimmed = postcode.trim().toUpperCase();
  if (trimmed.includes(" ")) return trimmed.split(" ")[0];
  if (trimmed.length > 4) return trimmed.slice(0, -3);
  return trimmed;
}

export function extractValue(displayValue: string | null): string {
  if (!displayValue) return "Contact for quote";
  return displayValue.replace(/^from\s+/i, "").trim();
}

/** One shared message body for both the fan-out and single-recipient paths. */
export function buildNewLeadMessage(lead: {
  postcode: string | null;
  job_type: string | null;
  display_value: string | null;
}): string {
  return `New lead in ${getOutwardCode(lead.postcode)}!\n\n` +
    `${lead.job_type ?? "Cleaning job"}\n` +
    `Value: ${extractValue(lead.display_value)}\n\n` +
    `Login to Cleanda to view and unlock this lead.\n\n` +
    `- Cleanda`;
}

/** Constant-time comparison so a bearer token cannot be probed byte by byte. */
function timingSafeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

function isInternalAuthorization(authorization: string | null, serviceRoleKey: string | null | undefined): boolean {
  if (!serviceRoleKey || !authorization) return false;
  return timingSafeEqual(authorization, `Bearer ${serviceRoleKey}`);
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 8 && value.length <= 200;
}

/**
 * Sends to EXACTLY ONE recipient, and only when every one of these holds:
 *  - the caller presents the internal service-role bearer token;
 *  - the request carries no client-supplied phone number;
 *  - the lead exists and is published;
 *  - the notification intent exists, belongs to this lead and recipient user,
 *    and is already 'claimed' (the caller owns the dispatch);
 *  - the recipient's profile is opted in, open, unsuspended and has a phone;
 *  - the recipient appears in the authoritative eligibility set for the lead.
 * Any failure throws before the provider is contacted, so the dispatcher
 * classifies it as a definite pre-acceptance rejection.
 */
export async function sendSingleRecipientNotification(
  request: SingleRecipientRequest,
  deps: SingleRecipientDeps,
  message: string,
): Promise<SingleRecipientResult> {
  if (!isInternalAuthorization(deps.authorization, deps.serviceRoleKey)) {
    throw new SingleRecipientError(AUTH_REQUIRED, "internal authentication required");
  }
  if (
    request.type !== "new_lead" ||
    request.mode !== "single_recipient" ||
    !validIdentifier(request.leadId) ||
    !validIdentifier(request.userId) ||
    !validIdentifier(request.idempotencyKey) ||
    request.recipientPhone !== undefined ||
    request.to !== undefined
  ) {
    throw new SingleRecipientError(NOT_ELIGIBLE, "invalid single-recipient request");
  }
  if (!message.trim()) {
    throw new SingleRecipientError(NOT_ELIGIBLE, "empty notification message");
  }

  const [lead, profile, intent, eligibleRecipients] = await Promise.all([
    deps.getLead(request.leadId),
    deps.getProfile(request.userId),
    deps.getIntent(request.idempotencyKey),
    deps.getEligibleRecipients(request.leadId),
  ]);

  if (!lead || !profile || !intent) {
    throw new SingleRecipientError(NOT_ELIGIBLE, "lead, profile or notification intent not found");
  }
  if (lead.id !== request.leadId || lead.lead_status !== "published") {
    throw new SingleRecipientError(NOT_ELIGIBLE, "lead is not published");
  }
  if (
    intent.id !== request.idempotencyKey ||
    intent.lead_id !== lead.id ||
    intent.notification_type !== NOTIFICATION_TYPE
  ) {
    throw new SingleRecipientError(NOT_ELIGIBLE, "notification intent does not match the request");
  }
  if (intent.recipient_user_id !== request.userId || intent.status !== "claimed") {
    throw new SingleRecipientError(NOT_ELIGIBLE, "notification intent is not an owned, claimed dispatch");
  }
  if (
    !profile.phone ||
    !profile.postcode ||
    !profile.whatsapp_optin ||
    profile.is_closed === true ||
    profile.is_suspended === true
  ) {
    throw new SingleRecipientError(NOT_ELIGIBLE, "recipient profile is not eligible");
  }

  const normalizedProfilePhone = normalizeRecipientPhone(profile.phone);
  if (!normalizedProfilePhone) {
    throw new SingleRecipientError(NOT_ELIGIBLE, "recipient phone is unusable");
  }

  const matching = eligibleRecipients.filter((candidate) =>
    candidate.recipient_user_id === request.userId &&
    normalizeRecipientPhone(candidate.recipient) === normalizedProfilePhone
  );
  if (matching.length !== 1) {
    throw new SingleRecipientError(NOT_ELIGIBLE, "recipient does not uniquely match the lead eligibility rules");
  }
  if (normalizeRecipientPhone(intent.recipient) !== normalizedProfilePhone) {
    throw new SingleRecipientError(NOT_ELIGIBLE, "intent recipient does not match the resolved profile phone");
  }

  // Exactly one provider call, to exactly one server-resolved number.
  const result = await deps.send(profile.phone, message);
  return { kind: "sent", providerReference: result?.sid ?? null, userId: request.userId };
}
