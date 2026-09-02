export interface SingleRecipientRequest {
  type: "new_lead";
  mode: "single_recipient";
  leadId: string;
  userId: string;
  idempotencyKey: string;
  recipientPhone?: unknown;
}

export interface SingleRecipientLead {
  id: string;
  postcode: string;
  job_type: string;
  display_value: string;
  lead_status: string;
}

export interface SingleRecipientProfile {
  user_id: string;
  phone: string | null;
  postcode: string | null;
  whatsapp_optin: boolean | null;
  is_closed: boolean | null;
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
  | { kind: "sent"; providerReference: string | null; userId: string }
  | { kind: "skipped"; reason: string; userId: string };

export function normalizeRecipientPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("44")) return digits;
  if (digits.startsWith("0")) return `44${digits.slice(1)}`;
  return `44${digits}`;
}

function isInternalAuthorization(authorization: string | null, serviceRoleKey: string | null | undefined): boolean {
  return Boolean(serviceRoleKey) && authorization === `Bearer ${serviceRoleKey}`;
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 8 && value.length <= 200;
}

export async function sendSingleRecipientNotification(
  request: SingleRecipientRequest,
  deps: SingleRecipientDeps,
  message: string,
): Promise<SingleRecipientResult> {
  if (!isInternalAuthorization(deps.authorization, deps.serviceRoleKey)) {
    throw new Error("Internal authentication required");
  }
  if (
    request.type !== "new_lead" ||
    request.mode !== "single_recipient" ||
    !validIdentifier(request.leadId) ||
    !validIdentifier(request.userId) ||
    !validIdentifier(request.idempotencyKey) ||
    request.recipientPhone !== undefined
  ) {
    throw new Error("Invalid single-recipient request");
  }

  const [lead, profile, intent, eligibleRecipients] = await Promise.all([
    deps.getLead(request.leadId),
    deps.getProfile(request.userId),
    deps.getIntent(request.idempotencyKey),
    deps.getEligibleRecipients(request.leadId),
  ]);

  if (!lead || !profile || !intent) throw new Error("Single-recipient notification is not eligible");
  if (lead.id !== request.leadId || lead.lead_status !== "published") {
    throw new Error("Lead is not eligible for notification");
  }
  if (intent.id !== request.idempotencyKey || intent.lead_id !== lead.id || intent.notification_type !== "new_lead_sms") {
    throw new Error("Notification intent does not match the request");
  }
  if (intent.recipient_user_id !== request.userId || intent.status !== "claimed") {
    throw new Error("Notification intent is not owned by this dispatch");
  }
  if (!profile.phone || !profile.postcode || !profile.whatsapp_optin || profile.is_closed) {
    throw new Error("Recipient is not eligible for notification");
  }

  const normalizedProfilePhone = normalizeRecipientPhone(profile.phone);
  const matchingRecipient = eligibleRecipients.find((recipient) =>
    recipient.recipient_user_id === request.userId &&
    normalizeRecipientPhone(recipient.recipient) === normalizedProfilePhone,
  );
  if (!matchingRecipient || normalizeRecipientPhone(intent.recipient) !== normalizedProfilePhone) {
    throw new Error("Recipient does not match the lead eligibility rules");
  }

  const result = await deps.send(profile.phone, message);
  return { kind: "sent", providerReference: result.sid ?? null, userId: request.userId };
}
