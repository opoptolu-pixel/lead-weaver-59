#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const failures = [];
const runtimeRoots = ["src", "supabase/functions", "supabase/config.toml"];
const excludedDirectoryNames = new Set(["node_modules", "dist", ".git", "migrations", "tests", "__tests__"]);
const files = [];

function collect(path, sink = files) {
  if (!existsSync(path)) return;
  if (statSync(path).isFile()) {
    sink.push(path);
    return;
  }
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectoryNames.has(entry.name)) continue;
    collect(join(path, entry.name), sink);
  }
}

for (const runtimeRoot of runtimeRoots) collect(join(root, runtimeRoot));
const source = files.map((file) => ({ file: relative(root, file), text: readFileSync(file, "utf8") }));

function fail(message) { failures.push(message); }
function assertAbsent(pattern, message) {
  const matches = source.filter(({ text }) => pattern.test(text));
  if (matches.length) fail(`${message}: ${matches.map(({ file }) => file).join(", ")}`);
}

// --- Managed (Manchester) project isolation ---------------------------------

assertAbsent(/doaytcmktjlugblidubz/i, "Manchester project ID reference");
assertAbsent(/sparkle-job-link-c4027cb4/i, "Manchester repository reference");
assertAbsent(/https?:\/\/(?:www\.)?cleanda\.co(?!\.uk)(?:[/:"'`]|$)/i, "non-legacy Cleanda domain reference");
assertAbsent(/functions\/v1\/(?:process-agency-balances|send-agency-quote|submit-service-request|resolve-no-show-customer|send-recurring-payment-setup|send-inbox-email)/i, "Manchester-only Edge Function call");
assertAbsent(/(?:to|navigate|href|path)\s*[:=]\s*["'`](?:\/agency|\/cleaner\/jobs|\/operations|\/managed-agency)/i, "managed-agency frontend route");
assertAbsent(/(?:agency_no_show_cover_update|agency_no_show_refund|agency_no_show_rescheduled|agency_quote_payment_link)/i, "managed-agency communication template fixture");
assertAbsent(/https?:\/\/[^\s"'`]+\.supabase\.co\/functions\/v1\//i, "cross-project Supabase function URL");

// --- Legacy marketplace functions must remain present -----------------------

const requiredFunctions = [
  "submit-cleaning-request", "customer-confirmation", "twilio-webhook", "auto-publish-leads",
  "send-sms-notification", "unlock-lead", "verify-payment", "buy-credits", "verify-credits", "use-credit",
  "stripe-webhook", "send-email", "process-email-sequences", "process-scheduled-emails", "send-booking-reminders",
  "insurance-expiry-reminder",
];
for (const name of requiredFunctions) {
  if (!existsSync(join(root, "supabase/functions", name, "index.ts"))) fail(`required legacy function missing: ${name}`);
}

// --- The single confirmed agency-only function must be a 410 no-op ----------
// No gates are created for the other eight functions while deployment is unverified.

const retiredAgencyPath = join(root, "supabase/functions/process-cleaner-job-notifications/index.ts");
if (!existsSync(retiredAgencyPath)) {
  fail("process-cleaner-job-notifications 410 gate is missing");
} else {
  const retiredSource = readFileSync(retiredAgencyPath, "utf8");
  const isGone = /\b410\b/.test(retiredSource) && /gone|retired/i.test(retiredSource);
  const mutates = /createClient|fetch\(|Resend|Deno\.env\.get\("(?:RESEND|TWILIO|SUPABASE)/.test(retiredSource);
  if (!isGone || mutates) fail("process-cleaner-job-notifications is not a non-mutating 410 no-op");
}

// --- Twilio webhook may not be deployable ahead of its required schema ------

const appliedMigrations = existsSync(join(root, "supabase/migrations"))
  ? readdirSync(join(root, "supabase/migrations")).filter((name) => name.endsWith(".sql"))
      .map((name) => readFileSync(join(root, "supabase/migrations", name), "utf8")).join("\n")
  : "";

const webhookFiles = [];
collect(join(root, "supabase/functions/twilio-webhook"), webhookFiles);
const webhookSource = webhookFiles.map((file) => readFileSync(file, "utf8")).join("\n");

const requiredSchemaObjects = [
  "notification_intents",
  "twilio_claim_inbound_receipt",
  "twilio_transition_lead_and_create_intents",
  "twilio_claim_notification_intent",
  "twilio_record_notification_outcome",
  "twilio_finalize_inbound_receipt",
  "lead_notification_recipients",
];
const missingSchema = requiredSchemaObjects.filter(
  (object) => webhookSource.includes(object) && !appliedMigrations.includes(object),
);
if (missingSchema.length) {
  fail(
    `twilio-webhook depends on schema objects that no applied migration provides (deployment blocked): ${missingSchema.join(", ")}. ` +
    "Apply docs/proposed-migrations/20260902120000_twilio_dispatch_outbox.sql first.",
  );
}

// The handler must never fall back to a proxy-rewritten URL in production wiring.
const indexSource = readFileSync(join(root, "supabase/functions/twilio-webhook/index.ts"), "utf8");
if (!/allowRequestUrlFallback:\s*false/.test(indexSource)) {
  fail("twilio-webhook production wiring must set allowRequestUrlFallback: false");
}
if (!/TWILIO_WEBHOOK_URL/.test(indexSource)) {
  fail("twilio-webhook production wiring must read TWILIO_WEBHOOK_URL");
}

// --- Contained cron / trigger / template configuration must stay contained --

const containmentPatterns = [
  [/cron\.(?:schedule|alter_job)\s*\(\s*'?[^)]*(?:cleaner-job-notifications|cleaner-compliance-reminders|recurring-clean-visits)/i, "contained agency cron job reintroduced"],
  [/ALTER\s+TABLE[^;]*ENABLE\s+TRIGGER[^;]*(?:queue_cleaner_job_notifications|cleaner_compliance|recurring_clean)/i, "contained agency trigger re-enabled"],
  [/UPDATE\s+public\.email_templates[^;]*is_active\s*=\s*true[^;]*agency/i, "contained agency email template re-activated"],
];
const containmentScope = [...source];
for (const [pattern, message] of containmentPatterns) {
  const matches = containmentScope.filter(({ text }) => pattern.test(text));
  if (matches.length) fail(`${message}: ${matches.map(({ file }) => file).join(", ")}`);
}

if (failures.length) {
  console.error("Legacy isolation check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Legacy isolation check passed (${files.length} runtime files scanned; docs, tests and dependencies excluded).`);
