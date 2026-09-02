export type ReplyKind = "positive" | "decline" | "unclear";

export const POSITIVE_RESPONSES = ["yes", "confirm", "confirmed", "ok", "okay", "y", "yep", "yeah", "sure", "go ahead"];
export const DECLINE_RESPONSES = ["no", "cancel", "stop", "decline", "n", "nope"];

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function classifyReply(body: string): ReplyKind {
  const normalized = body.toLowerCase().trim();
  if (POSITIVE_RESPONSES.some((keyword) => normalized === keyword || normalized.startsWith(`${keyword} `))) {
    return "positive";
  }
  if (DECLINE_RESPONSES.some((keyword) => normalized === keyword || normalized.startsWith(`${keyword} `))) {
    return "decline";
  }
  return "unclear";
}

/**
 * Twilio signs the absolute URL it was configured to call. Behind a proxy the
 * request URL can be rewritten, so signature calculation must use a configured
 * canonical URL. The exact query string that Twilio appended is preserved.
 *
 * Fails closed in production when TWILIO_WEBHOOK_URL is absent.
 */
export function resolveCanonicalWebhookUrl(options: {
  configuredUrl?: string | null;
  requestUrl: string;
  allowRequestUrlFallback?: boolean;
}): { ok: true; url: string } | { ok: false; reason: string } {
  const requested = new URL(options.requestUrl);
  const configured = (options.configuredUrl || "").trim();

  if (!configured) {
    if (!options.allowRequestUrlFallback) {
      return { ok: false, reason: "TWILIO_WEBHOOK_URL is not configured" };
    }
    return { ok: true, url: requested.toString() };
  }

  let canonical: URL;
  try {
    canonical = new URL(configured);
  } catch {
    return { ok: false, reason: "TWILIO_WEBHOOK_URL is not a valid absolute URL" };
  }

  // A configured URL without a query string inherits the exact query string of
  // the received request; a configured URL with its own query string wins.
  if (!canonical.search && requested.search) {
    canonical = new URL(canonical.toString() + requested.search);
  }

  return { ok: true, url: canonical.toString() };
}

export function buildTwilioSignature(url: string, params: Record<string, string>, authToken: string): Promise<string> {
  const canonical = url + Object.keys(params).sort().map((key) => `${key}${params[key]}`).join("");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  ).then((key) => crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonical)))
    .then((signature) => bytesToBase64(new Uint8Array(signature)));
}

export async function isValidTwilioSignature(
  url: string,
  params: Record<string, string>,
  providedSignature: string | null,
  authToken: string,
): Promise<boolean> {
  if (!providedSignature || !authToken) return false;
  const expected = await buildTwilioSignature(url, params, authToken);
  return timingSafeEqual(expected, providedSignature);
}

export function leadPhoneMatches(leadPhone: string, inboundPhone: string): boolean {
  const lead = normalizePhone(leadPhone || "");
  const inbound = normalizePhone(inboundPhone || "");
  if (!lead || !inbound) return false;
  const leadWithCode = lead.startsWith("44") ? lead : `44${lead.startsWith("0") ? lead.slice(1) : lead}`;
  return inbound.endsWith(lead) || inbound === leadWithCode || lead.endsWith(inbound.slice(-10));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}
