#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const failures = [];
const runtimeRoots = ["src", "supabase/functions", "supabase/config.toml"];
const excludedDirectoryNames = new Set(["node_modules", "dist", ".git", "migrations", "tests", "__tests__"]);
const files = [];

function collect(path) {
  if (!existsSync(path)) return;
  if (statSync(path).isFile()) {
    files.push(path);
    return;
  }
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectoryNames.has(entry.name)) continue;
    collect(join(path, entry.name));
  }
}

for (const runtimeRoot of runtimeRoots) collect(join(root, runtimeRoot));
const source = files.map((file) => ({ file: relative(root, file), text: readFileSync(file, "utf8") }));
const allText = source.map(({ text }) => text).join("\n");

function fail(message) { failures.push(message); }
function assertAbsent(pattern, message) {
  const matches = source.filter(({ text }) => pattern.test(text));
  if (matches.length) fail(`${message}: ${matches.map(({ file }) => file).join(", ")}`);
}

assertAbsent(/doaytcmktjlugblidubz/i, "Manchester project ID reference");
assertAbsent(/sparkle-job-link-c4027cb4/i, "Manchester repository reference");
assertAbsent(/https?:\/\/(?:www\.)?cleanda\.co(?!\.uk)(?:[/:"'`]|$)/i, "non-legacy Cleanda domain reference");
assertAbsent(/functions\/v1\/(?:process-agency-balances|send-agency-quote|submit-service-request|resolve-no-show-customer|send-recurring-payment-setup|send-inbox-email)/i, "Manchester-only Edge Function call");
assertAbsent(/(?:to|navigate|href|path)\s*[:=]\s*["'`](?:\/agency|\/cleaner\/jobs|\/operations|\/managed-agency)/i, "managed-agency frontend route");
assertAbsent(/(?:agency_no_show_cover_update|agency_no_show_refund|agency_no_show_rescheduled|agency_quote_payment_link)/i, "managed-agency communication template fixture");
assertAbsent(/https?:\/\/[^\s"'`]+\.supabase\.co\/functions\/v1\//i, "cross-project Supabase function URL");

const requiredFunctions = [
  "submit-cleaning-request", "customer-confirmation", "twilio-webhook", "auto-publish-leads",
  "send-sms-notification", "unlock-lead", "verify-payment", "buy-credits", "verify-credits", "use-credit",
  "stripe-webhook", "send-email", "process-email-sequences", "process-scheduled-emails", "send-booking-reminders",
  "insurance-expiry-reminder",
];
for (const name of requiredFunctions) {
  if (!existsSync(join(root, "supabase/functions", name, "index.ts"))) fail(`required legacy function missing: ${name}`);
}

const retiredAgencyPath = join(root, "supabase/functions/process-cleaner-job-notifications/index.ts");
if (existsSync(retiredAgencyPath)) {
  const retiredSource = readFileSync(retiredAgencyPath, "utf8");
  if (!/410|Gone|retired|agency-only/i.test(retiredSource) || /createClient|fetch\(|Resend|Deno\.env\.get\("(?:RESEND|TWILIO|SUPABASE)/.test(retiredSource)) {
    fail("retired agency-only function is not a non-mutating 410 gate");
  }
}

if (failures.length) {
  console.error("Legacy isolation check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Legacy isolation check passed (${files.length} runtime files scanned; migrations, docs, tests and dependencies excluded).`);
