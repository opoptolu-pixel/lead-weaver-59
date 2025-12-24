import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "Deep Clean UK <noreply@deepcleanco.uk>";
const RESEND_API_URL = "https://api.resend.com/emails";

interface CleaningRequest {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  postcode: string;
  jobType: string;
  preferredDate: string;
  jobDescription?: string;
  estimatedValue?: string;
}

// Job Value Bands for Phase 2 Analytics (thresholds in pence)
type ValueBand = "standard" | "premium" | "high-value";

const getValueBand = (valueInPence: number): ValueBand => {
  if (valueInPence >= 20000) return "high-value"; // £200+
  if (valueInPence >= 15000) return "premium";    // £150+
  return "standard";
};

// Phase 1 + Phase 2 Job Types - ALL VALUES IN PENCE (e.g., £125 = 12500)
const JOB_TYPES: Record<string, { displayValue: string; value: number; phase: number; category: string }> = {
  // Phase 1 - Core Services (£100+)
  "Carpet Cleaning (2–3 Rooms)": { displayValue: "from £100", value: 12500, phase: 1, category: "carpet" },
  "Sofa + Carpet Cleaning": { displayValue: "from £120", value: 15000, phase: 1, category: "upholstery" },
  "Sofa + Mattress Cleaning": { displayValue: "from £100", value: 12000, phase: 1, category: "upholstery" },
  "Carpet + Mattress Cleaning": { displayValue: "from £110", value: 13500, phase: 1, category: "carpet" },
  "Deep Clean (3+ Rooms)": { displayValue: "from £140", value: 17000, phase: 1, category: "deep-clean" },
  "End of Tenancy Clean": { displayValue: "from £150", value: 18500, phase: 1, category: "tenancy" },
  "Airbnb / Short-Let Refresh": { displayValue: "from £130", value: 15500, phase: 1, category: "short-let" },
  "Move-In / Move-Out Clean": { displayValue: "from £140", value: 17000, phase: 1, category: "tenancy" },
  "Post-Tenancy Carpet & Upholstery": { displayValue: "from £120", value: 14000, phase: 1, category: "tenancy" },
  "One-Off Deep Clean": { displayValue: "from £100", value: 12000, phase: 1, category: "deep-clean" },
  
  // Phase 2 - Commercial & Specialist (£120+)
  "Office Carpet + Upholstery Clean": { displayValue: "from £150", value: 18000, phase: 2, category: "commercial" },
  "Post-Construction Deep Clean": { displayValue: "from £200", value: 25000, phase: 2, category: "construction" },
  "Large Property Window + Interior": { displayValue: "from £180", value: 22000, phase: 2, category: "window" },
  "Multi-Room + Upholstery Deep Clean": { displayValue: "from £160", value: 19000, phase: 2, category: "deep-clean" },
  
  // Legacy mappings for backwards compatibility
  "End of Tenancy": { displayValue: "from £150", value: 18500, phase: 1, category: "tenancy" },
  "Deep Clean": { displayValue: "from £140", value: 17000, phase: 1, category: "deep-clean" },
  "Move-In Clean": { displayValue: "from £140", value: 17000, phase: 1, category: "tenancy" },
  "One-Off Clean": { displayValue: "from £100", value: 12000, phase: 1, category: "deep-clean" },
};
// Minimum values in PENCE
const MINIMUM_JOB_VALUE = 10000; // £100
const PHASE2_MINIMUM_VALUE = 12000; // £120

// UK Postcode validation regex
const UK_POSTCODE_REGEX = /^([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})$/i;

const validatePostcode = (postcode: string): boolean => {
  const cleaned = postcode.replace(/\s+/g, '');
  return UK_POSTCODE_REGEX.test(cleaned);
};

// Generate confirmation email HTML
const generateConfirmationEmail = (
  customerName: string,
  jobType: string,
  preferredDate: string,
  postcode: string,
  referenceId: string
): string => {
  const formattedDate = new Date(preferredDate).toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0B3D2E; padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Deep Clean UK</h1>
              <p style="color: #7DD3A8; margin: 8px 0 0 0; font-size: 14px;">Professional Cleaning Services</p>
            </td>
          </tr>
          
          <!-- Success Icon -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <div style="width: 70px; height: 70px; background-color: #E8F5E9; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">
                <span style="font-size: 36px;">✓</span>
              </div>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <h2 style="color: #0B3D2E; margin: 0 0 10px 0; font-size: 24px; text-align: center;">Request Received!</h2>
              <p style="color: #666666; font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 30px 0;">
                Hi ${customerName}, thank you for choosing Deep Clean UK. We've received your cleaning request and will connect you with a trusted local cleaner soon.
              </p>
              
              <!-- Booking Details Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8f9fa; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
                <tr>
                  <td>
                    <h3 style="color: #0B3D2E; margin: 0 0 20px 0; font-size: 18px;">Your Request Details</h3>
                    
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                          <span style="color: #888888; font-size: 14px;">Reference Number</span><br>
                          <span style="color: #0B3D2E; font-size: 16px; font-weight: 600;">#${referenceId}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                          <span style="color: #888888; font-size: 14px;">Service Type</span><br>
                          <span style="color: #333333; font-size: 16px;">${jobType}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
                          <span style="color: #888888; font-size: 14px;">Preferred Date</span><br>
                          <span style="color: #333333; font-size: 16px;">${formattedDate}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #888888; font-size: 14px;">Location</span><br>
                          <span style="color: #333333; font-size: 16px;">${postcode}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- What's Next -->
              <h3 style="color: #0B3D2E; margin: 0 0 15px 0; font-size: 18px;">What Happens Next?</h3>
              <ol style="color: #666666; font-size: 15px; line-height: 1.8; padding-left: 20px; margin: 0 0 25px 0;">
                <li>A verified local cleaner will review your request</li>
                <li>They'll contact you within 24 hours to confirm details</li>
                <li>You'll agree on the final price and schedule</li>
                <li>Enjoy your sparkling clean space!</li>
              </ol>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 25px 40px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="color: #888888; font-size: 14px; margin: 0 0 10px 0;">
                Questions? Reply to this email or visit our website.
              </p>
              <p style="color: #aaaaaa; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Deep Clean UK. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// Replace template variables with actual values
const replaceTemplateVariables = (template: string, variables: Record<string, string>): string => {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  });
  return result;
};

// Send confirmation email via Resend
const sendConfirmationEmail = async (
  supabase: any,
  customerEmail: string,
  customerName: string,
  jobType: string,
  preferredDate: string,
  postcode: string,
  referenceId: string
): Promise<void> => {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.log("[SUBMIT-CLEANING] RESEND_API_KEY not configured, skipping email");
    return;
  }

  try {
    // Try to fetch template from database
    const { data: template } = await supabase
      .from("email_templates")
      .select("subject, body")
      .eq("name", "cleaning_request_confirmation")
      .eq("is_active", true)
      .maybeSingle();

    const formattedDate = new Date(preferredDate).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const variables: Record<string, string> = {
      customer_name: customerName,
      job_type: jobType,
      preferred_date: formattedDate,
      postcode: postcode,
      reference_id: referenceId,
      current_year: new Date().getFullYear().toString(),
    };

    let subject: string;
    let html: string;

    if (template) {
      // Use database template
      subject = replaceTemplateVariables(template.subject, variables);
      html = replaceTemplateVariables(template.body, variables);
      console.log("[SUBMIT-CLEANING] Using database template");
    } else {
      // Use fallback template
      subject = `Cleaning Request Confirmed - Ref #${referenceId}`;
      html = generateConfirmationEmail(customerName, jobType, preferredDate, postcode, referenceId);
      console.log("[SUBMIT-CLEANING] Using fallback template (no database template found)");
    }

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [customerEmail],
        subject: subject,
        html: html,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("[SUBMIT-CLEANING] Email send failed:", responseData);
    } else {
      console.log("[SUBMIT-CLEANING] Confirmation email sent:", { id: responseData.id, to: customerEmail });
    }
  } catch (error) {
    console.error("[SUBMIT-CLEANING] Email error:", error);
    // Don't throw - email failure shouldn't fail the request
  }
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CleaningRequest = await req.json();
    
    // Validate required fields
    if (!body.customerName || !body.customerEmail || !body.customerPhone || !body.customerAddress || !body.postcode || !body.jobType || !body.preferredDate) {
      console.error("Missing required fields:", body);
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Validate UK postcode
    if (!validatePostcode(body.postcode)) {
      console.error("Invalid UK postcode:", body.postcode);
      return new Response(
        JSON.stringify({ error: "Invalid postcode", message: "Please enter a valid UK postcode (e.g., SW1A 1AA)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get job type info or use defaults
    const jobTypeInfo = JOB_TYPES[body.jobType];
    
    // Calculate value - use provided estimate or lookup
    let displayValue = body.estimatedValue || jobTypeInfo?.displayValue || "from £100";
    let value = jobTypeInfo?.value || 12500; // Default £125 in pence
    const phase = jobTypeInfo?.phase || 1;
    const category = jobTypeInfo?.category || "general";

    // SMART ENFORCEMENT: Different minimum for Phase 2 jobs
    const requiredMinimum = phase === 2 ? PHASE2_MINIMUM_VALUE : MINIMUM_JOB_VALUE;

    // CRITICAL: Enforce minimum job value
    if (value < requiredMinimum) {
      const minPounds = requiredMinimum / 100;
      console.error(`Job value ${value} pence below minimum ${requiredMinimum} pence for job type: ${body.jobType} (Phase ${phase})`);
      return new Response(
        JSON.stringify({ 
          error: "Job value too low", 
          message: `We only accept ${phase === 2 ? 'commercial/specialist' : ''} jobs with a minimum value of £${minPounds}. Please select a larger service package.` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine value band for analytics
    const valueBand = getValueBand(value);

    // Determine initial lead status - auto-flag edge cases for review
    let leadStatus = "new";
    let adminNotes = null;
    
    // SMART ENFORCEMENT: Flag leads that are borderline (under £110)
    if (value < 11000) {
      adminNotes = `[AUTO-FLAG] Borderline value (£${value / 100}). Review for quality.`;
    }
    
    // Flag Phase 2 jobs for priority review
    if (phase === 2) {
      adminNotes = (adminNotes ? adminNotes + " | " : "") + `[PHASE 2] ${category} service - verify commercial requirements.`;
    }

    // Format postcode: ensure space between outward and inward code
    const formatPostcode = (pc: string): string => {
      const cleaned = pc.replace(/\s+/g, '').toUpperCase();
      // Inward code is always 3 characters (1 number + 2 letters)
      if (cleaned.length > 3 && !pc.includes(' ')) {
        return cleaned.slice(0, -3) + ' ' + cleaned.slice(-3);
      }
      return pc.toUpperCase();
    };

    // Insert lead into database with enhanced metadata
    const { data, error } = await supabase.from("leads").insert({
      customer_name: body.customerName,
      customer_email: body.customerEmail,
      customer_phone: body.customerPhone,
      customer_address: body.customerAddress,
      postcode: formatPostcode(body.postcode),
      job_type: body.jobType,
      date: body.preferredDate,
      display_value: displayValue,
      value: value,
      source: "website",
      lead_status: leadStatus,
      outcome_status: "pending",
      job_notes: body.jobDescription || null,
      admin_notes: adminNotes,
      quality_score: phase === 2 ? 80 : 70, // Phase 2 jobs get higher quality score
    }).select().single();

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to submit request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const referenceId = data.id.slice(0, 8).toUpperCase();

    // Enhanced logging for analytics
    console.log("Lead created:", {
      id: data.id,
      jobType: body.jobType,
      value: value,
      valueBand: valueBand,
      phase: phase,
      category: category,
      postcode: body.postcode.toUpperCase(),
    });

    // Send confirmation email (non-blocking)
    await sendConfirmationEmail(
      supabase,
      body.customerEmail,
      body.customerName,
      body.jobType,
      body.preferredDate,
      formatPostcode(body.postcode),
      referenceId
    );

    // Trigger both WhatsApp and SMS confirmation for customer to confirm the lead
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      
      // Send WhatsApp confirmation
      const whatsappPromise = fetch(`${supabaseUrl}/functions/v1/customer-confirmation`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId: data.id,
          method: "whatsapp",
          autoPublishHours: 24,
        }),
      });

      // Send SMS confirmation
      const smsPromise = fetch(`${supabaseUrl}/functions/v1/customer-confirmation`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId: data.id,
          method: "sms",
          autoPublishHours: 24,
        }),
      });

      // Execute both in parallel
      const [whatsappResponse, smsResponse] = await Promise.all([whatsappPromise, smsPromise]);
      
      const whatsappResult = await whatsappResponse.json();
      const smsResult = await smsResponse.json();
      
      console.log("[SUBMIT-CLEANING] Confirmation messages triggered:", { 
        leadId: data.id, 
        whatsapp: whatsappResponse.ok ? "sent" : whatsappResult.error,
        sms: smsResponse.ok ? "sent" : smsResult.error,
      });
    } catch (confirmError) {
      console.error("[SUBMIT-CLEANING] Error triggering confirmations:", confirmError);
      // Don't fail the request if confirmation trigger fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Your cleaning request has been submitted successfully!",
        referenceId: referenceId
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
