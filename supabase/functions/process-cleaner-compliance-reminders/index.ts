import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const render = (value: string, variables: Record<string, string>) =>
  Object.entries(variables).reduce(
    (output, [key, replacement]) => output.split(`{{${key}}}`).join(replacement),
    value,
  );

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!supabaseUrl || !serviceRoleKey || !resendKey) {
      throw new Error("Required Supabase or Resend configuration is missing");
    }

    const db = createClient(supabaseUrl, serviceRoleKey);
    const resend = new Resend(resendKey);
    const dateParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const datePart = (type: string) => dateParts.find((part) => part.type === type)?.value || "";
    const today = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;

    const { data: reminders, error } = await db
      .from("cleaner_compliance_reminders")
      .select("id,cleaner_id,reminder_type,scheduled_for,attempts,cleaner:cleaner_profiles(user_id,full_name)")
      .in("status", ["scheduled", "failed"])
      .lte("scheduled_for", today)
      .lt("attempts", 5)
      .order("scheduled_for")
      .limit(50);
    if (error) throw error;

    const siteUrl = (Deno.env.get("SITE_URL") || "https://cleanda.co.uk").replace(/\/$/, "");
    const results: Array<Record<string, unknown>> = [];

    for (const reminder of reminders || []) {
      const cleaner = reminder.cleaner as unknown as { user_id: string; full_name: string | null };
      const { data: claimed } = await db
        .from("cleaner_compliance_reminders")
        .update({ status: "processing", attempts: reminder.attempts + 1, last_error: null })
        .eq("id", reminder.id)
        .in("status", ["scheduled", "failed"])
        .select("id")
        .maybeSingle();
      if (!claimed) continue;
      try {
        const { data: vetting, error: vettingError } = await db
          .from("cleaner_vetting_records")
          .select("right_to_work_basis,right_to_work_expires_on")
          .eq("cleaner_id", reminder.cleaner_id)
          .single();
        if (vettingError) throw vettingError;

        if (vetting.right_to_work_basis !== "time_limited" || !vetting.right_to_work_expires_on) {
          await db.from("cleaner_compliance_reminders").update({ status: "cancelled" }).eq("id", reminder.id);
          results.push({ id: reminder.id, status: "cancelled", reason: "No current time-limited permission" });
          continue;
        }

        const { data: authUser, error: userError } = await db.auth.admin.getUserById(cleaner.user_id);
        if (userError || !authUser.user?.email) throw userError || new Error("Cleaner email not found");

        const { data: template, error: templateError } = await db
          .from("email_templates")
          .select("subject,body,is_active")
          .eq("name", reminder.reminder_type)
          .single();
        if (templateError) throw templateError;
        if (!template.is_active) {
          await db.from("cleaner_compliance_reminders").update({ status: "cancelled", last_error: "Template disabled" }).eq("id", reminder.id);
          results.push({ id: reminder.id, status: "cancelled", reason: "Template disabled" });
          continue;
        }

        const expiryDate = new Date(`${vetting.right_to_work_expires_on}T12:00:00`).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const variables = {
          cleaner_name: cleaner.full_name || "there",
          expiry_date: expiryDate,
          profile_url: `${siteUrl}/dashboard?section=profile`,
        };
        const { data: sent, error: sendError } = await resend.emails.send({
          from: "Cleanda <hello@cleanda.co.uk>",
          to: [authUser.user.email],
          subject: render(template.subject, variables),
          html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#10243a">${render(template.body, variables)}<p>Cleanda Operations</p></div>`,
        });
        if (sendError) throw sendError;

        const { error: updateError } = await db
          .from("cleaner_compliance_reminders")
          .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
          .eq("id", reminder.id)
          .eq("status", "processing");
        if (updateError) throw updateError;
        results.push({ id: reminder.id, status: "sent", provider_reference: sent?.id || null });
      } catch (itemError) {
        await db.from("cleaner_compliance_reminders").update({
          status: "failed",
          last_error: String((itemError as Error).message || itemError).slice(0, 1000),
        }).eq("id", reminder.id).eq("status", "processing");
        results.push({ id: reminder.id, status: "failed", error: String((itemError as Error).message || itemError) });
      }
    }

    return json({ processed: results.length, results });
  } catch (error) {
    return json({ error: String((error as Error).message || error) }, 500);
  }
});
