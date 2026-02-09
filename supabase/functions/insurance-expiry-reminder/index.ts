import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "Cleanda <hello@cleanda.co.uk>";
const RESEND_API_URL = "https://api.resend.com/emails";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[INSURANCE-EXPIRY-REMINDER] ${step}${detailsStr}`);
};

// Reminder intervals in days before expiry
const REMINDER_INTERVALS = [30, 14, 7, 1, 0];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let totalSent = 0;
    let totalFailed = 0;

    // Check for each reminder interval
    for (const daysBeforeExpiry of REMINDER_INTERVALS) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      logStep(`Checking for insurance expiring in ${daysBeforeExpiry} days`, { targetDate: targetDateStr });

      // Get insurance documents expiring on the target date
      const { data: expiringDocs, error: fetchError } = await supabase
        .from("verification_documents")
        .select(`
          id,
          user_id,
          expiry_date,
          document_type
        `)
        .eq("document_type", "insurance")
        .eq("status", "approved")
        .eq("expiry_date", targetDateStr);

      if (fetchError) {
        logStep(`Error fetching documents for ${daysBeforeExpiry} days`, { error: fetchError.message });
        continue;
      }

      logStep(`Found ${expiringDocs?.length || 0} documents expiring in ${daysBeforeExpiry} days`);

      if (!expiringDocs || expiringDocs.length === 0) {
        continue;
      }

      for (const doc of expiringDocs) {
        try {
          // Get user email and profile
          const { data: userEmail } = await supabase.rpc("get_user_email", { user_uuid: doc.user_id });
          
          const { data: profile } = await supabase
            .from("profiles")
            .select("business_name, contact_name")
            .eq("user_id", doc.user_id)
            .maybeSingle();

          if (!userEmail) {
            logStep("No email found for user", { userId: doc.user_id });
            continue;
          }

          const businessName = profile?.business_name || profile?.contact_name || "Business Owner";
          const contactName = profile?.contact_name || businessName;
          const expiryDate = new Date(doc.expiry_date).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });
          const currentYear = new Date().getFullYear().toString();

          // Determine urgency level for styling
          const isExpired = daysBeforeExpiry <= 0;
          const isUrgent = daysBeforeExpiry <= 7;
          const urgencyColor = isExpired ? "#dc2626" : isUrgent ? "#ef4444" : "#f59e0b";
          const urgencyText = isExpired
            ? "has expired"
            : daysBeforeExpiry === 1 
              ? "expires tomorrow" 
              : `expires in ${daysBeforeExpiry} days`;

          // If expired, revoke verification status
          if (isExpired) {
            const { error: updateError } = await supabase
              .from("profiles")
              .update({ 
                is_verified: false, 
                verification_status: "expired_insurance" 
              })
              .eq("user_id", doc.user_id);
            
            if (updateError) {
              logStep("Failed to revoke verification", { userId: doc.user_id, error: updateError.message });
            } else {
              logStep("Verification revoked due to expired insurance", { userId: doc.user_id });
            }

            // Log the activity
            await supabase.from("activity_logs").insert({
              user_id: doc.user_id,
              entity_type: "verification",
              entity_id: doc.id,
              action: "insurance_expired",
              details: {
                business_name: businessName,
                expiry_date: doc.expiry_date,
              },
            });
          }

          const subject = isExpired
            ? `🚫 Your Insurance Has Expired - Action Required`
            : isUrgent 
              ? `⚠️ Urgent: Your Insurance ${urgencyText}`
              : `Reminder: Your Insurance ${urgencyText}`;

          const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h2 style="color: #0B3D2E; margin-bottom: 20px;">Insurance Expiry Reminder</h2>
    
    <p>Hi ${contactName},</p>
    
    <p>This is a friendly reminder that your insurance certificate for <strong>${businessName}</strong> ${urgencyText}.</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: ${isUrgent ? '#fef2f2' : '#fffbeb'}; border-left: 4px solid ${urgencyColor};">
      <strong>Expiry Date:</strong> ${expiryDate}<br>
      <strong>Days Remaining:</strong> ${daysBeforeExpiry}
    </div>
    
    <p><strong>What you need to do:</strong></p>
    <p>1. Renew your insurance policy before it expires<br>
    2. Upload your new insurance certificate to Cleanda<br>
    3. Keep your verification status active</p>
    
    ${isUrgent ? `<p style="background-color: #fef2f2; padding: 12px; border-radius: 4px; color: #dc2626;"><strong>⚠️ Important:</strong> If your insurance expires, your account verification status may be affected and you may not be able to unlock new leads until you upload a valid certificate.</p>` : ''}
    
    <p><a href="https://cleanda.co.uk/settings/verification" style="display: inline-block; background-color: #0B3D2E; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Upload New Insurance</a></p>
    
    <p>If you have already renewed your insurance, please upload the new certificate at your earliest convenience.</p>
    
    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888888;">
      You are receiving this because you are a registered Cleanda partner.<br>
      Cleanda Ltd ${currentYear}
    </p>
  </div>
</body>
</html>`;

          // Send the email
          const response = await fetch(RESEND_API_URL, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: [userEmail],
              subject: subject,
              html: htmlBody,
            }),
          });

          const responseData = await response.json();

          if (!response.ok) {
            throw new Error(responseData.message || "Failed to send email");
          }

          // Log the email
          await supabase
            .from("email_logs")
            .insert({
              template_name: "insurance_expiry_reminder",
              recipient_email: userEmail,
              subject: subject,
              status: "sent",
              resend_id: responseData.id,
            });

          logStep("Reminder sent successfully", { 
            userId: doc.user_id, 
            daysBeforeExpiry,
            resendId: responseData.id 
          });
          totalSent++;
        } catch (error: any) {
          logStep("Failed to send reminder", { 
            userId: doc.user_id, 
            error: error.message 
          });
          totalFailed++;
        }
      }
    }

    logStep("Processing complete", { totalSent, totalFailed });

    return new Response(JSON.stringify({ 
      success: true, 
      sent: totalSent, 
      failed: totalFailed 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
