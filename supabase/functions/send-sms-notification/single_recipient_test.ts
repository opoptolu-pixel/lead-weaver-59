import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  AUTH_REQUIRED,
  buildNewLeadMessage,
  NOT_ELIGIBLE,
  NOTIFICATION_TYPE,
  normalizeRecipientPhone,
  sendSingleRecipientNotification,
  SingleRecipientError,
  type SingleRecipientDeps,
  type SingleRecipientRequest,
} from "./single-recipient.ts";

// No network and no database: every dependency is injected.
const originalFetch = globalThis.fetch;
globalThis.fetch = () => {
  throw new Error("network access is forbidden in tests");
};
addEventListener("unload", () => {
  globalThis.fetch = originalFetch;
});

const SERVICE_KEY = "service-role-key-for-tests";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_USER_ID = "22222222-2222-2222-2222-222222222222";
const LEAD_ID = "33333333-3333-3333-3333-333333333333";
const INTENT_ID = "44444444-4444-4444-4444-444444444444";

const LEAD = {
  id: LEAD_ID,
  postcode: "M5 3AA",
  job_type: "End of tenancy clean",
  display_value: "from £150",
  lead_status: "published",
};

function request(overrides: Partial<SingleRecipientRequest> = {}): SingleRecipientRequest {
  return {
    type: "new_lead",
    mode: "single_recipient",
    leadId: LEAD_ID,
    userId: USER_ID,
    idempotencyKey: INTENT_ID,
    ...overrides,
  };
}

interface Harness {
  deps: SingleRecipientDeps;
  sends: Array<{ phone: string; message: string }>;
}

function harness(overrides: Partial<SingleRecipientDeps> = {}): Harness {
  const sends: Array<{ phone: string; message: string }> = [];
  const deps: SingleRecipientDeps = {
    serviceRoleKey: SERVICE_KEY,
    authorization: `Bearer ${SERVICE_KEY}`,
    getLead: () => Promise.resolve(LEAD),
    getProfile: () =>
      Promise.resolve({
        user_id: USER_ID,
        phone: "07700900110",
        postcode: "M6 5AB",
        whatsapp_optin: true,
        is_closed: false,
        is_suspended: false,
      }),
    getEligibleRecipients: () =>
      Promise.resolve([
        { recipient: "447700900110", recipient_user_id: USER_ID },
        { recipient: "447700900111", recipient_user_id: OTHER_USER_ID },
      ]),
    getIntent: () =>
      Promise.resolve({
        id: INTENT_ID,
        lead_id: LEAD_ID,
        notification_type: NOTIFICATION_TYPE,
        recipient: "447700900110",
        recipient_user_id: USER_ID,
        status: "claimed",
      }),
    send: (phone, message) => {
      sends.push({ phone, message });
      return Promise.resolve({ sid: "SM-provider-reference" });
    },
    ...overrides,
  };
  return { deps, sends };
}

const MESSAGE = buildNewLeadMessage(LEAD);

async function expectRejection(deps: SingleRecipientDeps, req = request(), reason = NOT_ELIGIBLE) {
  const error = await assertRejects(
    () => sendSingleRecipientNotification(req, deps, MESSAGE),
    SingleRecipientError,
  );
  assertEquals((error as SingleRecipientError).reason, reason);
}

Deno.test("sends to exactly one server-resolved recipient", async () => {
  const { deps, sends } = harness();
  const result = await sendSingleRecipientNotification(request(), deps, MESSAGE);

  assertEquals(result.kind, "sent");
  assertEquals(result.userId, USER_ID);
  assertEquals(result.providerReference, "SM-provider-reference");
  assertEquals(sends.length, 1, "exactly one provider call");
  assertEquals(sends[0].phone, "07700900110");
  assert(sends[0].message.includes("M5"), "outward code only");
  assert(!sends[0].message.includes("\\n"), "message uses real newlines");
});

Deno.test("requires the internal service-role bearer token", async () => {
  const anon = harness({ authorization: "Bearer anon-key" });
  await expectRejection(anon.deps, request(), AUTH_REQUIRED);
  assertEquals(anon.sends.length, 0);

  const missing = harness({ authorization: null });
  await expectRejection(missing.deps, request(), AUTH_REQUIRED);
  assertEquals(missing.sends.length, 0);

  const unconfigured = harness({ serviceRoleKey: "" });
  await expectRejection(unconfigured.deps, request(), AUTH_REQUIRED);
  assertEquals(unconfigured.sends.length, 0);
});

Deno.test("a client-supplied phone number is never honoured", async () => {
  const withPhone = harness();
  await expectRejection(withPhone.deps, request({ recipientPhone: "+447000000000" }));
  assertEquals(withPhone.sends.length, 0);

  const withTo = harness();
  await expectRejection(withTo.deps, request({ to: "+447000000000" }));
  assertEquals(withTo.sends.length, 0);
});

Deno.test("recipient must be opted in, open, unsuspended and reachable", async () => {
  const cases = [
    { whatsapp_optin: false },
    { is_closed: true },
    { is_suspended: true },
    { phone: null },
    { postcode: null },
  ];
  for (const override of cases) {
    const { deps, sends } = harness({
      getProfile: () =>
        Promise.resolve({
          user_id: USER_ID,
          phone: "07700900110",
          postcode: "M6 5AB",
          whatsapp_optin: true,
          is_closed: false,
          is_suspended: false,
          ...override,
        }),
    });
    await expectRejection(deps);
    assertEquals(sends.length, 0);
  }
});

Deno.test("recipient must appear in the authoritative eligibility set", async () => {
  const outOfArea = harness({ getEligibleRecipients: () => Promise.resolve([]) });
  await expectRejection(outOfArea.deps);
  assertEquals(outOfArea.sends.length, 0);

  const differentUser = harness({
    getEligibleRecipients: () =>
      Promise.resolve([{ recipient: "447700900110", recipient_user_id: OTHER_USER_ID }]),
  });
  await expectRejection(differentUser.deps);
  assertEquals(differentUser.sends.length, 0);
});

Deno.test("intent must be a claimed dispatch owned by this recipient and lead", async () => {
  const baseIntent = {
    id: INTENT_ID,
    lead_id: LEAD_ID,
    notification_type: NOTIFICATION_TYPE,
    recipient: "447700900110",
    recipient_user_id: USER_ID,
    status: "claimed",
  };
  const cases = [
    { status: "pending" },
    { status: "dispatched" },
    { status: "outcome_unknown" },
    { recipient_user_id: OTHER_USER_ID },
    { recipient: "447700900999" },
    { lead_id: "55555555-5555-5555-5555-555555555555" },
    { notification_type: "other_notification" },
  ];
  for (const override of cases) {
    const { deps, sends } = harness({ getIntent: () => Promise.resolve({ ...baseIntent, ...override }) });
    await expectRejection(deps);
    assertEquals(sends.length, 0);
  }
});

Deno.test("lead must exist and be published", async () => {
  const missing = harness({ getLead: () => Promise.resolve(null) });
  await expectRejection(missing.deps);

  const unpublished = harness({ getLead: () => Promise.resolve({ ...LEAD, lead_status: "pending_confirmation" }) });
  await expectRejection(unpublished.deps);
  assertEquals(unpublished.sends.length, 0);
});

Deno.test("a provider failure propagates instead of being reported as sent", async () => {
  const { deps, sends } = harness({
    send: () => {
      sends.length; // touch closure
      return Promise.reject(new Error("provider timeout"));
    },
  });
  await assertRejects(() => sendSingleRecipientNotification(request(), deps, MESSAGE), Error, "provider timeout");
});

Deno.test("phone normalisation handles UK national and international forms", () => {
  assertEquals(normalizeRecipientPhone("07700900110"), "447700900110");
  assertEquals(normalizeRecipientPhone("+44 7700 900110"), "447700900110");
  assertEquals(normalizeRecipientPhone("447700900110"), "447700900110");
  assertEquals(normalizeRecipientPhone(""), "");
});

Deno.test("message body exposes only the outward postcode", () => {
  const message = buildNewLeadMessage(LEAD);
  assert(message.includes("M5"));
  assert(!message.includes("M5 3AA"));
  assert(message.includes("£150"));
  assert(!message.toLowerCase().includes("from £150"));
});
