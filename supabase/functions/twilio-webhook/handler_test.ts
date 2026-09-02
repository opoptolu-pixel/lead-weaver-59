import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildTwilioSignature } from "./logic.ts";
import {
  DECLINE_MESSAGE,
  handleTwilioWebhook,
  IN_PROGRESS_MESSAGE,
  NOTIFICATION_TYPE,
  POSITIVE_MESSAGE,
  UNMATCHED_MESSAGE,
  handleTwilioWebhook as handler,
  dispatchNotificationIntents,
} from "./handler.ts";
import type { ProviderOutcome } from "./ports.ts";
import { FakeDb, FakeProvider, makeLead } from "./test_doubles.ts";

const CANONICAL_URL = "https://cleanda.co.uk/functions/v1/twilio-webhook";
const TOKEN = "test-auth-token";

// No network is available to these tests: every provider call goes through FakeProvider
// and every database call through FakeDb.
const originalFetch = globalThis.fetch;
globalThis.fetch = () => {
  throw new Error("network access is forbidden in tests");
};
addEventListener("unload", () => {
  globalThis.fetch = originalFetch;
});

function baseParams(overrides: Record<string, string> = {}) {
  return {
    AccountSid: "AC00000000000000000000000000000000",
    Body: "YES",
    From: "+447700900123",
    MessageSid: "SM00000000000000000000000000000001",
    ...overrides,
  };
}

async function signedRequest(params: Record<string, string>, options: {
  url?: string;
  signWith?: string;
  signature?: string | null;
  omitSignature?: boolean;
} = {}) {
  const body = new URLSearchParams(params);
  const headers = new Headers({ "Content-Type": "application/x-www-form-urlencoded" });
  if (!options.omitSignature) {
    const signature = options.signature ?? await buildTwilioSignature(options.signWith ?? CANONICAL_URL, params, TOKEN);
    headers.set("X-Twilio-Signature", signature);
  }
  return new Request(options.url ?? "http://proxy.internal/twilio-webhook", { method: "POST", headers, body });
}

function deps(db: FakeDb, provider: FakeProvider, env: Record<string, unknown> = {}) {
  return {
    db,
    provider,
    env: { twilioAuthToken: TOKEN, twilioWebhookUrl: CANONICAL_URL, allowRequestUrlFallback: false, ...env },
  };
}

const success = (): ProviderOutcome => ({ kind: "success", reference: "provider-ref" });
const rejected = (): ProviderOutcome => ({ kind: "rejected", error: "invalid phone number" });
const indeterminate = (): ProviderOutcome => ({ kind: "indeterminate", error: "provider timeout" });

function seed(recipients = 2) {
  return new FakeDb({
    leads: [makeLead()],
    recipients: Array.from({ length: recipients }, (_, index) => ({
      recipient: `4477009001${10 + index}`,
      recipient_user_id: `user-${index + 1}`,
    })),
  });
}

Deno.test("valid signed YES: one transition, one intent per recipient, one dispatch each", async () => {
  const db = seed();
  const provider = new FakeProvider(success);
  const response = await handleTwilioWebhook(await signedRequest(baseParams()), deps(db, provider));
  const xml = await response.text();

  assertEquals(response.status, 200);
  assert(xml.includes("confirmed and is now live"));
  assertEquals(db.transitions, 1);
  assertEquals(db.leads[0].lead_status, "published");
  assertEquals(db.intents.length, 2);
  assertEquals(provider.calls.length, 2);
  assertEquals(new Set(db.intents.map((intent) => intent.status)).size, 1);
  assertEquals(db.intents[0].status, "dispatched");
  assertEquals(db.intents[0].notification_type, NOTIFICATION_TYPE);
  assertEquals([...db.receipts.values()][0].status, "completed");
});

Deno.test("valid signed NO: lead marked spam, no notification intent, no provider call", async () => {
  const db = seed();
  const provider = new FakeProvider(success);
  const response = await handleTwilioWebhook(
    await signedRequest(baseParams({ Body: "NO" })),
    deps(db, provider),
  );
  const xml = await response.text();

  assert(xml.includes("cancelled"));
  assertEquals(db.leads[0].lead_status, "spam");
  assertEquals(db.intents.length, 0);
  assertEquals(provider.calls.length, 0);
  assertEquals([...db.receipts.values()][0].acknowledgement, DECLINE_MESSAGE);
});

Deno.test("missing and invalid signatures are rejected before any state change", async () => {
  const db = seed();
  const provider = new FakeProvider(success);

  const missing = await handleTwilioWebhook(
    await signedRequest(baseParams(), { omitSignature: true }),
    deps(db, provider),
  );
  assertEquals(missing.status, 403);
  await missing.text();

  const invalid = await handleTwilioWebhook(
    await signedRequest(baseParams(), { signature: "bogus" }),
    deps(db, provider),
  );
  assertEquals(invalid.status, 403);
  await invalid.text();

  // A signature computed against the proxy-rewritten URL must not validate.
  const proxySigned = await handleTwilioWebhook(
    await signedRequest(baseParams(), { signWith: "http://proxy.internal/twilio-webhook" }),
    deps(db, provider),
  );
  assertEquals(proxySigned.status, 403);
  await proxySigned.text();

  assertEquals(db.receipts.size, 0);
  assertEquals(db.transitions, 0);
});

Deno.test("missing TWILIO_WEBHOOK_URL fails closed in production mode", async () => {
  const db = seed();
  const provider = new FakeProvider(success);
  const response = await handleTwilioWebhook(
    await signedRequest(baseParams()),
    deps(db, provider, { twilioWebhookUrl: null }),
  );
  assertEquals(response.status, 503);
  await response.text();
  assertEquals(db.receipts.size, 0);
});

Deno.test("canonical URL with a query string validates only when the query string matches", async () => {
  const db = seed();
  const provider = new FakeProvider(success);
  const params = baseParams();
  const request = await signedRequest(params, {
    url: "http://proxy.internal/twilio-webhook?source=sms",
    signWith: `${CANONICAL_URL}?source=sms`,
  });
  const response = await handleTwilioWebhook(request, deps(db, provider));
  assertEquals(response.status, 200);
  await response.text();
  assertEquals(db.transitions, 1);
});

Deno.test("duplicate completed MessageSid replays the stored acknowledgement only", async () => {
  const db = seed(1);
  const provider = new FakeProvider(success);
  const first = await handleTwilioWebhook(await signedRequest(baseParams()), deps(db, provider));
  const firstXml = await first.text();

  const second = await handleTwilioWebhook(await signedRequest(baseParams()), deps(db, provider));
  const secondXml = await second.text();

  assertEquals(firstXml, secondXml);
  assertEquals(db.transitions, 1);
  assertEquals(db.intents.length, 1);
  assertEquals(provider.calls.length, 1);
});

Deno.test("two simultaneous requests with the same MessageSid produce one transition", async () => {
  const db = seed(1);
  const provider = new FakeProvider(success);
  const [a, b] = await Promise.all([
    handleTwilioWebhook(await signedRequest(baseParams()), deps(db, provider)),
    handleTwilioWebhook(await signedRequest(baseParams()), deps(db, provider)),
  ]);
  const bodies = [await a.text(), await b.text()];

  assertEquals(db.transitions, 1);
  assertEquals(db.intents.length, 1);
  assertEquals(provider.calls.length, 1);
  assert(bodies.some((body) => body.includes("confirmed and is now live")));
  assert(bodies.some((body) => body.includes("confirmed and is now live") || body.includes("being processed")));
});

Deno.test("in-flight duplicate receives the in-progress acknowledgement without new state", async () => {
  const db = seed(1);
  const provider = new FakeProvider(success);
  await db.claimReceipt(baseParams().MessageSid, 120); // lease still valid
  const response = await handleTwilioWebhook(await signedRequest(baseParams()), deps(db, provider));
  const xml = await response.text();

  assert(xml.includes(IN_PROGRESS_MESSAGE));
  assertEquals(db.transitions, 0);
  assertEquals(db.intents.length, 0);
  assertEquals(provider.calls.length, 0);
});

Deno.test("abandoned processing receipt is recovered without repeating a started dispatch", async () => {
  const db = seed(1);
  const provider = new FakeProvider(success);
  const params = baseParams();

  // First attempt: intent created and claimed (dispatch started), then the worker dies.
  const claim = await db.claimReceipt(params.MessageSid, 120);
  await db.transitionLeadAndCreateIntents({
    messageSid: params.MessageSid,
    leadId: "lead-1",
    newStatus: "published",
    confirmationResponse: "YES",
    notificationType: NOTIFICATION_TYPE,
    recipients: db.recipients,
  });
  await db.claimIntent(db.intents[0].id, 120);
  assertEquals(claim.claimed, true);

  // Lease expires.
  const receipt = db.receipts.get(params.MessageSid)!;
  receipt.lease_expires_at = Date.now() - 1000;

  const response = await handleTwilioWebhook(await signedRequest(params), deps(db, provider));
  const xml = await response.text();

  assert(xml.includes(POSITIVE_MESSAGE));
  assertEquals(db.transitions, 1);
  assertEquals(db.intents.length, 1);
  assertEquals(provider.calls.length, 0, "an already-started dispatch is never repeated");
  assertEquals(db.intents[0].status, "claimed");
});

Deno.test("published lead with a new MessageSid creates no second transition or intent", async () => {
  const db = seed(1);
  const provider = new FakeProvider(success);
  await handleTwilioWebhook(await signedRequest(baseParams()), deps(db, provider)).then((r) => r.text());

  const retried = await handleTwilioWebhook(
    await signedRequest(baseParams({ MessageSid: "SM00000000000000000000000000000002" })),
    deps(db, provider),
  );
  const xml = await retried.text();

  assert(xml.includes(POSITIVE_MESSAGE));
  assertEquals(db.transitions, 1);
  assertEquals(db.intents.length, 1);
  assertEquals(provider.calls.length, 1);
});

Deno.test("unmatched sender completes the receipt without touching leads", async () => {
  const db = seed(1);
  const provider = new FakeProvider(success);
  const response = await handleTwilioWebhook(
    await signedRequest(baseParams({ From: "+447999888777" })),
    deps(db, provider),
  );
  const xml = await response.text();

  assert(xml.includes(UNMATCHED_MESSAGE));
  assertEquals(db.transitions, 0);
  assertEquals(db.intents.length, 0);
});

Deno.test("per-recipient uniqueness holds across repeated intent creation", async () => {
  const db = seed(2);
  const params = baseParams();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await db.transitionLeadAndCreateIntents({
      messageSid: params.MessageSid,
      leadId: "lead-1",
      newStatus: "published",
      confirmationResponse: "YES",
      notificationType: NOTIFICATION_TYPE,
      recipients: db.recipients,
    });
    db.leads[0].lead_status = "pending_confirmation"; // force a re-attempt of intent creation
  }
  assertEquals(db.intents.length, 2);
  assertEquals(new Set(db.intents.map((intent) => intent.recipient)).size, 2);
});

Deno.test("provider definite rejection is retryable exactly once per claim, without duplicate dispatch", async () => {
  const db = seed(1);
  const rejecting = new FakeProvider(rejected);
  await handleTwilioWebhook(await signedRequest(baseParams()), deps(db, rejecting)).then((r) => r.text());

  assertEquals(db.intents[0].status, "failed_retryable");
  assertEquals(rejecting.calls.length, 1);

  // A later inbound webhook must NOT sweep another MessageSid's failed intent.
  const laterWebhookProvider = new FakeProvider(success);
  await handleTwilioWebhook(
    await signedRequest(baseParams({ MessageSid: "SM00000000000000000000000000000003" })),
    deps(db, laterWebhookProvider),
  ).then((r) => r.text());
  assertEquals(laterWebhookProvider.calls.length, 0);
  assertEquals(db.intents[0].status, "failed_retryable");

  // Controlled retry path (reconciliation): the intent is re-claimed atomically
  // and dispatched exactly once more, with no new intent created.
  const retryProvider = new FakeProvider(success);
  const summary = await dispatchNotificationIntents(deps(db, retryProvider), [...db.intents]);

  assertEquals(summary.dispatched, 1);
  assertEquals(db.intents.length, 1, "no second intent is created for the same recipient batch");
  assertEquals(db.intents[0].status, "dispatched");
  assertEquals(retryProvider.calls.length, 1);

  // Re-running reconciliation must not dispatch again.
  const idleProvider = new FakeProvider(success);
  await dispatchNotificationIntents(deps(db, idleProvider), [...db.intents]);
  assertEquals(idleProvider.calls.length, 0);
});


Deno.test("provider timeout marks outcome_unknown and is never retried automatically", async () => {
  const db = seed(1);
  const timingOut = new FakeProvider(indeterminate);
  const response = await handleTwilioWebhook(await signedRequest(baseParams()), deps(db, timingOut));
  const xml = await response.text();

  assert(xml.includes("confirmed and is now live"), "the customer is still acknowledged");
  assertEquals(db.intents[0].status, "outcome_unknown");
  assertEquals([...db.receipts.values()][0].status, "outcome_unknown");
  assertEquals(timingOut.calls.length, 1);

  // Any later attempt must not contact the provider again.
  const laterProvider = new FakeProvider(success);
  await handleTwilioWebhook(
    await signedRequest(baseParams({ MessageSid: "SM00000000000000000000000000000004" })),
    deps(db, laterProvider),
  ).then((r) => r.text());

  assertEquals(laterProvider.calls.length, 0);
  assertEquals(db.intents[0].status, "outcome_unknown");
  assertFalse(db.intents.some((intent) => intent.status === "dispatched"));
});

Deno.test("provider throwing is treated as indeterminate, not as failure", async () => {
  const db = seed(1);
  const throwing = new FakeProvider(() => {
    throw new Error("socket hang up");
  });
  await handler(await signedRequest(baseParams()), deps(db, throwing)).then((r) => r.text());
  assertEquals(db.intents[0].status, "outcome_unknown");
});
