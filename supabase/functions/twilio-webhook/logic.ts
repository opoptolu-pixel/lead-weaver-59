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
