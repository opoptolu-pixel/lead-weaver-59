import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[BOOKING-REMINDERS] ${step}`, details ? JSON.stringify(details) : "");
};

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("44")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+44${cleaned.slice(1)}`;
  return `+44${cleaned}`;
}

async function sendSMS(to: string, body: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_SMS_FROM");

  if (!accountSid || !authToken || !from) {
    throw new Error("Missing Twilio credentials");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const formData = new URLSearchParams();
  formData.append("To", to);
  formData.append("From", from);
  formData.append("Body", body);

  logStep("Sending SMS", { to, bodyLength: body.length });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const result = await response.json();
  if (!response.ok) {
    logStep("Twilio SMS error", result);
    throw new Error(`Twilio error: ${result.message || result.code}`);
  }

  logStep("SMS sent successfully", { sid: result.sid });
  return result;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" };
  return d.toLocaleDateString("en-GB", options);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date in YYYY-MM-DD format (UK timezone)
    const now = new Date();
    const ukOffset = now.toLocaleString("en-GB", { timeZone: "Europe/London" });
    const ukDate = new Date(ukOffset.replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$2-$1"));
    const todayStr = now.toISOString().split("T")[0];

    // Calculate target dates for reminders
    const addDays = (date: Date, days: number) => {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d.toISOString().split("T")[0];
    };

    const today = todayStr;
    const in2Days = addDays(now, 2);
    const in3Days = addDays(now, 3);

    logStep("Checking for reminders", { today, in2Days, in3Days });

    // Fetch all booked leads with a booked_date that matches our reminder windows
    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, customer_name, customer_phone, job_type, postcode, booked_date, sms_reminders_sent, unlocked_by")
      .eq("job_status", "booked")
      .not("booked_date", "is", null)
      .in("booked_date", [today, in2Days, in3Days]);

    if (error) {
      throw new Error(`Error fetching leads: ${error.message}`);
    }

    logStep("Found leads needing reminders", { count: leads?.length || 0 });

    const results: any[] = [];

    for (const lead of leads || []) {
      const sentReminders: string[] = lead.sms_reminders_sent || [];
      const bookedDate = lead.booked_date;
      let reminderType: string | null = null;
      let message = "";

      const formattedDate = formatDate(bookedDate);

      if (bookedDate === in3Days && !sentReminders.includes("3_day")) {
        reminderType = "3_day";
        message = `Reminder: You have a cleaning job booked for ${formattedDate}.\n\n` +
          `Customer: ${lead.customer_name}\n` +
          `Job: ${lead.job_type}\n` +
          `Area: ${lead.postcode}\n\n` +
          `3 days to go! Make sure you're prepared.\n` +
          `- Cleanda`;
      } else if (bookedDate === in2Days && !sentReminders.includes("2_day")) {
        reminderType = "2_day";
        message = `Reminder: Your cleaning job is in 2 days (${formattedDate}).\n\n` +
          `Customer: ${lead.customer_name}\n` +
          `Job: ${lead.job_type}\n` +
          `Area: ${lead.postcode}\n\n` +
          `Almost there! Get everything ready.\n` +
          `- Cleanda`;
      } else if (bookedDate === today && !sentReminders.includes("morning")) {
        reminderType = "morning";
        message = `Today's the day! Your cleaning job is today.\n\n` +
          `Customer: ${lead.customer_name}\n` +
          `Job: ${lead.job_type}\n` +
          `Area: ${lead.postcode}\n\n` +
          `Good luck with the job!\n` +
          `- Cleanda`;
      }

      if (!reminderType) {
        results.push({ leadId: lead.id, status: "skipped", reason: "already_sent" });
        continue;
      }

      // Get the cleaner's phone from their profile
      if (!lead.unlocked_by) {
        results.push({ leadId: lead.id, status: "skipped", reason: "no_owner" });
        continue;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("phone, whatsapp_optin")
        .eq("user_id", lead.unlocked_by)
        .single();

      if (!profile?.phone || !profile?.whatsapp_optin) {
        results.push({ leadId: lead.id, status: "skipped", reason: "no_phone_or_optin" });
        continue;
      }

      try {
        const formattedPhone = formatPhoneNumber(profile.phone);
        await sendSMS(formattedPhone, message);

        // Mark reminder as sent
        const updatedReminders = [...sentReminders, reminderType];
        await supabase
          .from("leads")
          .update({ sms_reminders_sent: updatedReminders })
          .eq("id", lead.id);

        results.push({ leadId: lead.id, status: "sent", reminderType });
      } catch (err: any) {
        logStep("Failed to send reminder", { leadId: lead.id, error: err.message });
        results.push({ leadId: lead.id, status: "failed", error: err.message });
      }
    }

    logStep("Reminder results", {
      total: results.length,
      sent: results.filter(r => r.status === "sent").length,
      skipped: results.filter(r => r.status === "skipped").length,
      failed: results.filter(r => r.status === "failed").length,
    });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logStep("Error", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
