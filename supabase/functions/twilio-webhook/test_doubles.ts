// In-memory doubles reproducing the uniqueness and claim semantics of the
// proposed schema. No network, no provider and no database is contacted.

import type {
  DbPort,
  FinalizeReceiptInput,
  IntentRecord,
  IntentStatus,
  LeadRecord,
  ProviderOutcome,
  ProviderPort,
  ReceiptRecord,
  Recipient,
} from "./ports.ts";

export interface FakeReceipt extends ReceiptRecord {
  lease_expires_at: number | null;
  processing_started_at: number;
  last_error: string | null;
}

export class FakeDb implements DbPort {
  receipts = new Map<string, FakeReceipt>();
  intents: IntentRecord[] = [];
  leads: LeadRecord[] = [];
  recipients: Recipient[] = [];
  transitions = 0;
  now = () => Date.now();
  private sequence = 0;

  constructor(init?: { leads?: LeadRecord[]; recipients?: Recipient[] }) {
    this.leads = init?.leads ?? [];
    this.recipients = init?.recipients ?? [];
  }

  private nextId(prefix: string) {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  claimReceipt(messageSid: string, leaseSeconds: number) {
    const existing = this.receipts.get(messageSid);
    if (!existing) {
      const receipt: FakeReceipt = {
        id: this.nextId("receipt"),
        message_sid: messageSid,
        status: "processing",
        lead_id: null,
        transition_status: null,
        response_kind: "error",
        acknowledgement: null,
        notification_dispatched: false,
        attempt_count: 1,
        lease_expires_at: this.now() + leaseSeconds * 1000,
        processing_started_at: this.now(),
        last_error: null,
      };
      this.receipts.set(messageSid, receipt);
      return Promise.resolve({ claimed: true, recovered: false, receipt });
    }

    const leaseExpired = existing.status === "processing" &&
      (existing.lease_expires_at ?? existing.processing_started_at) < this.now();

    if (leaseExpired || existing.status === "failed_retryable") {
      existing.status = "processing";
      existing.attempt_count += 1;
      existing.lease_expires_at = this.now() + leaseSeconds * 1000;
      return Promise.resolve({ claimed: true, recovered: true, receipt: existing });
    }

    return Promise.resolve({ claimed: false, recovered: false, receipt: existing });
  }

  findCandidateLeads() {
    return Promise.resolve(
      this.leads.filter((lead) => ["pending_confirmation", "published"].includes(lead.lead_status)),
    );
  }

  listRecipients(_leadId: string) {
    return Promise.resolve(this.recipients);
  }

  transitionLeadAndCreateIntents(input: {
    messageSid: string;
    leadId: string;
    newStatus: "published" | "spam";
    confirmationResponse: string;
    notificationType: string;
    recipients: Recipient[];
  }) {
    const lead = this.leads.find((candidate) => candidate.id === input.leadId);
    if (!lead || lead.lead_status !== "pending_confirmation") {
      return Promise.resolve({ transitioned: false, intents: [] as IntentRecord[] });
    }

    lead.lead_status = input.newStatus;
    lead.confirmation_response = input.confirmationResponse;
    if (input.newStatus === "published") lead.published_at = new Date(this.now()).toISOString();
    this.transitions += 1;

    if (input.newStatus === "published") {
      for (const recipient of input.recipients) {
        const duplicate = this.intents.some((intent) =>
          intent.message_sid === input.messageSid &&
          intent.lead_id === input.leadId &&
          intent.notification_type === input.notificationType &&
          intent.recipient === recipient.recipient
        );
        if (duplicate) continue; // UNIQUE (message_sid, lead_id, notification_type, recipient)
        this.intents.push({
          id: this.nextId("intent"),
          message_sid: input.messageSid,
          lead_id: input.leadId,
          notification_type: input.notificationType,
          recipient: recipient.recipient,
          recipient_user_id: recipient.recipient_user_id,
          status: "pending",
          provider_reference: null,
          dispatch_started_at: null,
          dispatched_at: null,
        });
      }
    }

    return Promise.resolve({
      transitioned: true,
      intents: this.intentsFor(input.messageSid, input.leadId, input.notificationType),
    });
  }

  private intentsFor(messageSid: string, leadId: string, notificationType: string) {
    return this.intents
      .filter((intent) =>
        intent.message_sid === messageSid &&
        intent.lead_id === leadId &&
        intent.notification_type === notificationType
      )
      .sort((left, right) => left.recipient.localeCompare(right.recipient));
  }

  listIntents(messageSid: string, leadId: string, notificationType: string) {
    return Promise.resolve(this.intentsFor(messageSid, leadId, notificationType));
  }

  claimIntent(intentId: string, _leaseSeconds: number, reconciliationAuditId?: string) {
    const intent = this.intents.find((candidate) => candidate.id === intentId);
    if (!intent) return Promise.resolve(false);
    if (intent.status === "failed_retryable" && !reconciliationAuditId) return Promise.resolve(false);
    if (intent.status !== "pending" && intent.status !== "failed_retryable") return Promise.resolve(false);
    intent.status = "claimed";
    intent.dispatch_started_at = new Date(this.now()).toISOString();
    return Promise.resolve(true);
  }

  recordIntentOutcome(
    intentId: string,
    status: Exclude<IntentStatus, "pending" | "claimed">,
    detail?: { providerReference?: string | null; error?: string | null },
  ) {
    const intent = this.intents.find((candidate) => candidate.id === intentId);
    if (!intent) return Promise.resolve();
    intent.status = status;
    if (status === "dispatched") {
      intent.dispatched_at = new Date(this.now()).toISOString();
      intent.provider_reference = detail?.providerReference ?? intent.provider_reference;
    }
    return Promise.resolve();
  }

  finalizeReceipt(receiptId: string, input: FinalizeReceiptInput) {
    const receipt = [...this.receipts.values()].find((candidate) => candidate.id === receiptId);
    if (!receipt) return Promise.resolve();
    receipt.status = input.status;
    receipt.lead_id = input.leadId ?? receipt.lead_id;
    receipt.transition_status = input.transitionStatus ?? receipt.transition_status;
    receipt.response_kind = input.responseKind ?? receipt.response_kind;
    receipt.acknowledgement = input.acknowledgement ?? receipt.acknowledgement;
    receipt.notification_dispatched = input.notificationDispatched ?? false;
    receipt.last_error = input.error ?? null;
    receipt.lease_expires_at = null;
    return Promise.resolve();
  }
}

export class FakeProvider implements ProviderPort {
  calls: string[] = [];
  constructor(private readonly outcomes: (intent: IntentRecord) => ProviderOutcome) {}

  dispatch(intent: IntentRecord): Promise<ProviderOutcome> {
    this.calls.push(intent.recipient);
    return Promise.resolve(this.outcomes(intent));
  }
}

export function makeLead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: "lead-1",
    customer_phone: "07700900123",
    lead_status: "pending_confirmation",
    job_type: "End of tenancy clean",
    confirmation_response: null,
    published_at: null,
    ...overrides,
  };
}
