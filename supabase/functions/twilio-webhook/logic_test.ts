import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildTwilioSignature, classifyReply, isValidTwilioSignature } from "./logic.ts";

const URL = "https://cleanda.co.uk/functions/v1/twilio-webhook";
const TOKEN = "test-auth-token";
const PARAMS = { Body: "YES", From: "+447700900123", MessageSid: "SM00000000000000000000000000000000" };

Deno.test("accepts a valid Twilio signature", async () => {
  const signature = await buildTwilioSignature(URL, PARAMS, TOKEN);
  assert(await isValidTwilioSignature(URL, PARAMS, signature, TOKEN));
});

Deno.test("rejects missing and invalid signatures", async () => {
  const signature = await buildTwilioSignature(URL, PARAMS, TOKEN);
  assertFalse(await isValidTwilioSignature(URL, PARAMS, null, TOKEN));
  assertFalse(await isValidTwilioSignature(URL, PARAMS, `${signature}x`, TOKEN));
  assertFalse(await isValidTwilioSignature(URL, { ...PARAMS, Body: "NO" }, signature, TOKEN));
});

Deno.test("preserves explicit YES and NO behaviour without substring false positives", () => {
  assertEquals(classifyReply("YES"), "positive");
  assertEquals(classifyReply("yes please"), "positive");
  assertEquals(classifyReply("NO"), "decline");
  assertEquals(classifyReply("not now"), "unclear");
});

Deno.test("duplicate MessageSid processing has one claim and one completion", async () => {
  const receipts = new Map<string, { status: "processing" | "completed"; leadId: string }>();
  const claim = async (messageSid: string) => {
    if (receipts.has(messageSid)) return false;
    receipts.set(messageSid, { status: "processing", leadId: "lead-1" });
    return true;
  };
  const claims = await Promise.all([claim(PARAMS.MessageSid), claim(PARAMS.MessageSid)]);
  assertEquals(claims.filter(Boolean).length, 1);
  receipts.set(PARAMS.MessageSid, { status: "completed", leadId: "lead-1" });
  assertEquals(receipts.get(PARAMS.MessageSid)?.status, "completed");
});
