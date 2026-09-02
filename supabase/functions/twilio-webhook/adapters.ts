import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
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

export function createSupabaseDb(client: SupabaseClient): DbPort {
  return {
    async claimReceipt(messageSid, leaseSeconds) {
      const { data, error } = await client.rpc("twilio_claim_inbound_receipt", {
        p_message_sid: messageSid,
        p_lease_seconds: leaseSeconds,
      });
      if (error) throw new Error(`Receipt claim failed: ${error.message}`);
      const payload = data as { claimed: boolean; recovered: boolean; receipt: ReceiptRecord };
      return { claimed: payload.claimed, recovered: payload.recovered, receipt: payload.receipt };
    },

    async findCandidateLeads(): Promise<LeadRecord[]> {
      const { data, error } = await client
        .from("leads")
        .select("id,customer_phone,lead_status,job_type,confirmation_response,published_at")
        .in("lead_status", ["pending_confirmation", "published"])
        .order("confirmation_sent_at", { ascending: false });
      if (error) throw error;
      return (data || []) as LeadRecord[];
    },

    async listRecipients(leadId): Promise<Recipient[]> {
      const { data, error } = await client.rpc("lead_notification_recipients", { p_lead_id: leadId });
      if (error) throw error;
      return (data || []) as Recipient[];
    },

    async transitionLeadAndCreateIntents(input) {
      const { data, error } = await client.rpc("twilio_transition_lead_and_create_intents", {
        p_message_sid: input.messageSid,
        p_lead_id: input.leadId,
        p_new_status: input.newStatus,
        p_confirmation_response: input.confirmationResponse,
        p_notification_type: input.notificationType,
        p_recipients: input.recipients,
      });
      if (error) throw error;
      const payload = data as { transitioned: boolean; intents: IntentRecord[] };
      return { transitioned: payload.transitioned, intents: payload.intents || [] };
    },

    async listIntents(messageSid, leadId, notificationType) {
      const { data, error } = await client
        .from("notification_intents")
        .select("*")
        .eq("message_sid", messageSid)
        .eq("lead_id", leadId)
        .eq("notification_type", notificationType)
        .order("recipient", { ascending: true });
      if (error) throw error;
      return (data || []) as IntentRecord[];
    },

    async claimIntent(intentId, leaseSeconds, reconciliationAuditId) {
      const { data, error } = await client.rpc("twilio_claim_notification_intent", {
        p_intent_id: intentId,
        p_lease_seconds: leaseSeconds,
        p_reconciliation_audit_id: reconciliationAuditId ?? null,
      });
      if (error) throw error;
      return data === true;
    },

    async recordIntentOutcome(intentId, status: Exclude<IntentStatus, "pending" | "claimed">, detail) {
      const { error } = await client.rpc("twilio_record_notification_outcome", {
        p_intent_id: intentId,
        p_status: status,
        p_provider_reference: detail?.providerReference ?? null,
        p_error: detail?.error ?? null,
      });
      if (error) throw error;
    },

    async finalizeReceipt(receiptId, input: FinalizeReceiptInput) {
      const { error } = await client.rpc("twilio_finalize_inbound_receipt", {
        p_receipt_id: receiptId,
        p_status: input.status,
        p_lead_id: input.leadId ?? null,
        p_transition_status: input.transitionStatus ?? null,
        p_response_kind: input.responseKind ?? null,
        p_acknowledgement: input.acknowledgement ?? null,
        p_notification_dispatched: input.notificationDispatched ?? false,
        p_error: input.error ?? null,
      });
      if (error) throw error;
    },
  };
}

/**
 * Per-recipient dispatch. The fan-out endpoint is never called for a whole batch,
 * so a timeout can never repeat an entire recipient set: each call targets one
 * recipient guarded by its own durable notification intent.
 */
export function createSmsProvider(options: {
  functionsBaseUrl: string;
  serviceKey: string;
  timeoutMs?: number;
}): ProviderPort {
  return {
    async dispatch(intent: IntentRecord): Promise<ProviderOutcome> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);
      try {
        const response = await fetch(`${options.functionsBaseUrl}/functions/v1/send-sms-notification`, {
          method: "POST",
          signal: controller.signal,
          headers: { Authorization: `Bearer ${options.serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "new_lead",
            mode: "single_recipient",
            leadId: intent.lead_id,
            userId: intent.recipient_user_id,
            idempotencyKey: intent.id,
          }),
        });
        const text = await response.text();
        if (response.ok) {
          let payload: { providerReference?: string | null } = {};
          try { payload = JSON.parse(text) as typeof payload; } catch { /* response body is optional */ }
          return { kind: "success", reference: payload.providerReference ?? intent.id };
        }
        // Rate limits and most provider errors are ambiguous: the provider may
        // have accepted the request before returning an error. Never retry them
        // automatically. Only statuses that definitively reject before queueing
        // are terminal rejections.
        const definitiveRejections = new Set([400, 401, 403, 404, 422]);
        if (definitiveRejections.has(response.status)) {
          return { kind: "rejected", retryable: false, error: `provider permanently rejected with ${response.status}` };
        }
        return { kind: "indeterminate", error: `provider outcome unknown (${response.status})` };
      } catch (error) {
        return {
          kind: "indeterminate",
          error: error instanceof Error ? error.name === "AbortError" ? "provider timeout" : error.message : "unknown provider error",
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function createServiceClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey);
}
