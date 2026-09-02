import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildTwilioSignature,
  classifyReply,
  isValidTwilioSignature,
  leadPhoneMatches,
  resolveCanonicalWebhookUrl,
} from "./logic.ts";

const CANONICAL_URL = "https://cleanda.co.uk/functions/v1/twilio-webhook";
const TOKEN = "test-auth-token";
const PARAMS = { Body: "YES", From: "+447700900123", MessageSid: "SM00000000000000000000000000000000" };

Deno.test("accepts a valid Twilio signature", async () => {
  const signature = await buildTwilioSignature(CANONICAL_URL, PARAMS, TOKEN);
  assert(await isValidTwilioSignature(CANONICAL_URL, PARAMS, signature, TOKEN));
});

Deno.test("rejects missing and invalid signatures", async () => {
  const signature = await buildTwilioSignature(CANONICAL_URL, PARAMS, TOKEN);
  assertFalse(await isValidTwilioSignature(CANONICAL_URL, PARAMS, null, TOKEN));
  assertFalse(await isValidTwilioSignature(CANONICAL_URL, PARAMS, `${signature}x`, TOKEN));
  assertFalse(await isValidTwilioSignature(CANONICAL_URL, { ...PARAMS, Body: "NO" }, signature, TOKEN));
  assertFalse(await isValidTwilioSignature(CANONICAL_URL, PARAMS, signature, ""));
});

Deno.test("signature covers every received parameter in sorted order", async () => {
  const extended = { ...PARAMS, AccountSid: "AC123", NumMedia: "0" };
  const signature = await buildTwilioSignature(CANONICAL_URL, extended, TOKEN);
  assert(await isValidTwilioSignature(CANONICAL_URL, extended, signature, TOKEN));
  // Dropping a received parameter must invalidate the signature.
  assertFalse(await isValidTwilioSignature(CANONICAL_URL, PARAMS, signature, TOKEN));
});

Deno.test("canonical URL resolution fails closed without configuration", () => {
  const result = resolveCanonicalWebhookUrl({ configuredUrl: "", requestUrl: "http://proxy.internal/twilio-webhook" });
  assertFalse(result.ok);
});

Deno.test("canonical URL ignores a proxy-rewritten request URL", () => {
  const result = resolveCanonicalWebhookUrl({
    configuredUrl: CANONICAL_URL,
    requestUrl: "http://proxy.internal/twilio-webhook",
  });
  assert(result.ok);
  assertEquals(result.ok && result.url, CANONICAL_URL);
});

Deno.test("canonical URL preserves the exact received query string", () => {
  const result = resolveCanonicalWebhookUrl({
    configuredUrl: CANONICAL_URL,
    requestUrl: "http://proxy.internal/twilio-webhook?source=sms&v=2",
  });
  assert(result.ok);
  assertEquals(result.ok && result.url, `${CANONICAL_URL}?source=sms&v=2`);
});

Deno.test("configured query string wins over the request query string", () => {
  const result = resolveCanonicalWebhookUrl({
    configuredUrl: `${CANONICAL_URL}?source=sms`,
    requestUrl: "http://proxy.internal/twilio-webhook?source=spoofed",
  });
  assertEquals(result.ok && result.url, `${CANONICAL_URL}?source=sms`);
});

Deno.test("signature validation differs between the query and no-query canonical URLs", async () => {
  const withQuery = `${CANONICAL_URL}?source=sms`;
  const signature = await buildTwilioSignature(withQuery, PARAMS, TOKEN);
  assert(await isValidTwilioSignature(withQuery, PARAMS, signature, TOKEN));
  assertFalse(await isValidTwilioSignature(CANONICAL_URL, PARAMS, signature, TOKEN));
});

Deno.test("preserves explicit YES and NO behaviour without substring false positives", () => {
  assertEquals(classifyReply("YES"), "positive");
  assertEquals(classifyReply("yes please"), "positive");
  assertEquals(classifyReply("NO"), "decline");
  assertEquals(classifyReply("not now"), "unclear");
});

Deno.test("phone matching handles UK national and international formats", () => {
  assert(leadPhoneMatches("07700900123", "+447700900123"));
  assert(leadPhoneMatches("+44 7700 900123", "447700900123"));
  assertFalse(leadPhoneMatches("07700900999", "+447700900123"));
  assertFalse(leadPhoneMatches("", "+447700900123"));
});
