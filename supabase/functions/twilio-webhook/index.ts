import { createServiceClient, createSmsProvider, createSupabaseDb } from "./adapters.ts";
import { corsHeaders, handleTwilioWebhook } from "./handler.ts";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response("Webhook backend is not configured", { status: 503, headers: corsHeaders });
  }

  const client = createServiceClient(supabaseUrl, serviceKey);

  return await handleTwilioWebhook(req, {
    db: createSupabaseDb(client),
    provider: createSmsProvider({ functionsBaseUrl: supabaseUrl, serviceKey }),
    env: {
      twilioAuthToken: Deno.env.get("TWILIO_AUTH_TOKEN"),
      twilioWebhookUrl: Deno.env.get("TWILIO_WEBHOOK_URL"),
      // Production must fail closed when TWILIO_WEBHOOK_URL is absent.
      allowRequestUrlFallback: false,
    },
  });
});
