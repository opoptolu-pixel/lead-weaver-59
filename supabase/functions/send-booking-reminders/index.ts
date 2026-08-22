import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const in1Day = addDays(now, 1);
    const in2Days = addDays(now, 2);
    const in3Days = addDays(now, 3);

    logStep("Checking for reminders", { today, in1Day, in2Days, in3Days });

    // Fetch all booked leads with a booked_date that matches our reminder windows
    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, customer_name, customer_phone, job_type, postcode, booked_date, sms_reminders_sent, unlocked_by")
      .eq("job_status", "booked")
      .not("booked_date", "is", null)
      .in("booked_date", [today, in1Day, in2Days, in3Days]);

    if (error) {
      throw new Error(`Error fetching leads: ${error.message}`);
    }

    logStep("Found leads needing reminders", { count: leads?.length || 0 });

    const results: any[] = [];

    for (const lead of leads || []) {
      const sentReminders: string[] = lead.sms_reminders_sent || [];
      const bookedDate = lead.booked_date;
      const formattedDate = formatDate(bookedDate);

      // --- CLEANER REMINDERS (3 day, 2 day, morning) ---
      let cleanerReminderType: string | null = null;
      let cleanerMessage = "";

      if (bookedDate === in3Days && !sentReminders.includes("3_day")) {
        cleanerReminderType = "3_day";
        cleanerMessage = `Reminder: You have a cleaning job booked for ${formattedDate}.\n\nCustomer: ${lead.customer_name}\nJob: ${lead.job_type}\nArea: ${lead.postcode}\n\n3 days to go! Make sure you're prepared.\n- Cleanda`;
      } else if (bookedDate === in2Days && !sentReminders.includes("2_day")) {
        cleanerReminderType = "2_day";
        cleanerMessage = `Reminder: Your cleaning job is in 2 days (${formattedDate}).\n\nCustomer: ${lead.customer_name}\nJob: ${lead.job_type}\nArea: ${lead.postcode}\n\nAlmost there! Get everything ready.\n- Cleanda`;
      } else if (bookedDate === today && !sentReminders.includes("morning")) {
        cleanerReminderType = "morning";
        cleanerMessage = `Today's the day! Your cleaning job is today.\n\nCustomer: ${lead.customer_name}\nJob: ${lead.job_type}\nArea: ${lead.postcode}\n\nGood luck with the job!\n- Cleanda`;
      }

      // Send cleaner reminder
      if (cleanerReminderType && lead.unlocked_by) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone, whatsapp_optin, business_name, is_closed")
          .eq("user_id", lead.unlocked_by)
          .single();

        if (profile?.is_closed) {
          results.push({ leadId: lead.id, status: "skipped", reason: "account_closed", recipient: "cleaner" });
        } else if (profile?.phone && profile?.whatsapp_optin) {
          try {
            await sendSMS(formatPhoneNumber(profile.phone), cleanerMessage);
            sentReminders.push(cleanerReminderType);
            results.push({ leadId: lead.id, status: "sent", reminderType: cleanerReminderType, recipient: "cleaner" });
          } catch (err: any) {
            logStep("Failed cleaner reminder", { leadId: lead.id, error: err.message });
            results.push({ leadId: lead.id, status: "failed", reminderType: cleanerReminderType, recipient: "cleaner", error: err.message });
          }
        } else {
          results.push({ leadId: lead.id, status: "skipped", reason: "no_phone_or_optin", recipient: "cleaner" });
        }
      }

      // --- CUSTOMER REMINDERS (1 day before, morning of) ---
      let customerReminderType: string | null = null;
      let customerMessage = "";

      let businessName = "your cleaner";
      if (lead.unlocked_by) {
        const { data: cp } = await supabase
          .from("profiles")
          .select("business_name")
          .eq("user_id", lead.unlocked_by)
          .single();
        if (cp?.business_name) businessName = cp.business_name;
      }

      if (bookedDate === in1Day && !sentReminders.includes("customer_1_day")) {
        customerReminderType = "customer_1_day";
        customerMessage = `Hi ${lead.customer_name}, this is a reminder that your ${lead.job_type.toLowerCase()} is booked for tomorrow (${formattedDate}).\n\nYour cleaner: ${businessName}\n\nIf you need to make any changes, please contact them directly.\n- Cleanda`;
      } else if (bookedDate === today && !sentReminders.includes("customer_morning")) {
        customerReminderType = "customer_morning";
        customerMessage = `Hi ${lead.customer_name}, your ${lead.job_type.toLowerCase()} is scheduled for today!\n\nYour cleaner: ${businessName}\n\nWe hope everything goes well.\n- Cleanda`;
      }

      if (customerReminderType && lead.customer_phone) {
        try {
          await sendSMS(formatPhoneNumber(lead.customer_phone), customerMessage);
          sentReminders.push(customerReminderType);
          results.push({ leadId: lead.id, status: "sent", reminderType: customerReminderType, recipient: "customer" });
        } catch (err: any) {
          logStep("Failed customer reminder", { leadId: lead.id, error: err.message });
          results.push({ leadId: lead.id, status: "failed", reminderType: customerReminderType, recipient: "customer", error: err.message });
        }
      }

      // Persist all sent reminders
      await supabase
        .from("leads")
        .update({ sms_reminders_sent: sentReminders })
        .eq("id", lead.id);
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
