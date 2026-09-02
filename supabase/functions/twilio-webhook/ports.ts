// Ports used by the inbound Twilio handler. Adapters supply either the real
// Supabase/provider implementations (index.ts) or in-memory fakes (tests).

export type ReceiptStatus =
  | "processing"
  | "completed"
  | "failed_retryable"
  | "outcome_unknown"
  | "permanently_failed";

export type IntentStatus =
  | "pending"
  | "claimed"
  | "dispatched"
  | "skipped"
  | "failed_retryable"
  | "outcome_unknown"
  | "permanently_failed";

export type ResponseKind =
  | "confirmed"
  | "cancelled"
  | "already_confirmed"
  | "unmatched"
  | "unclear"
  | "invalid"
  | "error";

export interface ReceiptRecord {
  id: string;
  message_sid: string;
  status: ReceiptStatus;
  lead_id: string | null;
  transition_status: string | null;
  response_kind: ResponseKind;
  acknowledgement: string | null;
  notification_dispatched: boolean;
  attempt_count: number;
}

export interface IntentRecord {
  id: string;
  message_sid: string;
  lead_id: string;
  notification_type: string;
  recipient: string;
  recipient_user_id: string | null;
  status: IntentStatus;
  provider_reference: string | null;
  dispatch_started_at: string | null;
  dispatched_at: string | null;
  outcome_unknown_reason?: string | null;
  last_error?: string | null;
}

export interface LeadRecord {
  id: string;
  customer_phone: string | null;
  lead_status: string;
  job_type: string | null;
  confirmation_response: string | null;
  published_at: string | null;
}

export interface Recipient {
  recipient: string;
  recipient_user_id: string | null;
}

export interface FinalizeReceiptInput {
  status: ReceiptStatus;
  leadId?: string | null;
  transitionStatus?: string | null;
  responseKind?: ResponseKind;
  acknowledgement?: string | null;
  notificationDispatched?: boolean;
  error?: string | null;
}

export interface DbPort {
  claimReceipt(messageSid: string, leaseSeconds: number): Promise<{
    claimed: boolean;
    recovered: boolean;
    receipt: ReceiptRecord;
  }>;
  findCandidateLeads(): Promise<LeadRecord[]>;
  listRecipients(leadId: string): Promise<Recipient[]>;
  transitionLeadAndCreateIntents(input: {
    messageSid: string;
    leadId: string;
    newStatus: "published" | "spam";
    confirmationResponse: string;
    notificationType: string;
    recipients: Recipient[];
  }): Promise<{ transitioned: boolean; intents: IntentRecord[] }>;
  listIntents(messageSid: string, leadId: string, notificationType: string): Promise<IntentRecord[]>;
  claimIntent(intentId: string, leaseSeconds: number, reconciliationAuditId?: string): Promise<boolean>;
  recordIntentOutcome(
    intentId: string,
    status: Exclude<IntentStatus, "pending" | "claimed">,
    detail?: { providerReference?: string | null; error?: string | null },
  ): Promise<void>;
  finalizeReceipt(receiptId: string, input: FinalizeReceiptInput): Promise<void>;
}

export type ProviderOutcome =
  | { kind: "success"; reference: string | null }
  | { kind: "rejected"; error: string; retryable: boolean }
  | { kind: "indeterminate"; error: string }
  | { kind: "skipped"; reason: string };

export interface ProviderPort {
  /** Dispatch exactly one notification to exactly one recipient. */
  dispatch(intent: IntentRecord): Promise<ProviderOutcome>;
}
