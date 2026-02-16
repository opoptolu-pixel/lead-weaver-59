import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // 5 requests per minute per IP (slightly higher for main form)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const getClientIP = (req: Request): string => {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
         req.headers.get("x-real-ip") ||
         req.headers.get("cf-connecting-ip") ||
         "unknown";
};

const checkRateLimit = (ip: string): { allowed: boolean; retryAfter?: number } => {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  // Clean up expired entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetAt < now) rateLimitMap.delete(key);
    }
  }
  
  if (!record || record.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  record.count++;
  return { allowed: true };
};

const FROM_EMAIL = "Cleanda <hello@cleanda.co.uk>";
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
  propertyType?: string;
  bedrooms?: string;
  frequency?: string;
  additionalNotes?: string; // Customer notes visible to cleaner after purchase
  // UTM tracking fields
  source?: string;
  medium?: string;
  campaign?: string;
  utmData?: {
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
    utm_term: string | null;
    landing_page: string | null;
    referrer: string | null;
    captured_at: string | null;
  };
  // Fallback attribution
  browserReferrer?: string | null;
  browserUserAgent?: string | null;
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

// Generate simplified confirmation email HTML for better deliverability
// Minimal styling, high text-to-code ratio, no complex tables
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
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h2 style="color: #0B3D2E; margin-bottom: 20px;">Cleanda - Request Received</h2>
    
    <p>Hi ${customerName},</p>
    
    <p>Thank you for choosing Cleanda. Your cleaning request has been received and we are now matching you with a trusted cleaner in your area.</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #0B3D2E;">
      <strong>Your Booking Details:</strong><br>
      Reference: #${referenceId}<br>
      Service: ${jobType}<br>
      Preferred Date: ${formattedDate}<br>
      Location: ${postcode}
    </div>
    
    <p><strong>What happens next?</strong></p>
    <p>1. We are finding the best cleaner for your job<br>
    2. A cleaner will contact you within 24 hours<br>
    3. Enjoy a sparkling clean space</p>
    
    <p>Questions? Just reply to this email.</p>
    
    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888888;">
      Cleanda Ltd ${currentYear}
    </p>
  </div>
</body>
</html>`;
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

    // Generate plain text version for better deliverability
    const plainText = html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

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
        text: plainText,
        headers: {
          "Organization": "Cleanda Ltd",
        },
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("[SUBMIT-CLEANING] Email send failed:", responseData);
    } else {
      console.log("[SUBMIT-CLEANING] Confirmation email sent:", { id: responseData.id, to: customerEmail });
      
      // Log the email to email_logs table
      try {
        await supabase
          .from("email_logs")
          .insert({
            template_name: template ? "cleaning_request_confirmation" : "cleaning_request_confirmation_fallback",
            recipient_email: customerEmail,
            subject: subject,
            status: "sent",
            resend_id: responseData.id || null,
            is_test: false,
          });
        console.log("[SUBMIT-CLEANING] Email logged to email_logs");
      } catch (logError) {
        console.error("[SUBMIT-CLEANING] Failed to log email (non-blocking):", logError);
      }
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
    // Check rate limit
    const clientIP = getClientIP(req);
    const rateLimit = checkRateLimit(clientIP);
    
    if (!rateLimit.allowed) {
      console.warn(`[SUBMIT-CLEANING] Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { 
          status: 429, 
          headers: { 
            "Content-Type": "application/json", 
            "Retry-After": String(rateLimit.retryAfter),
            ...corsHeaders 
          } 
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CleaningRequest = await req.json();
    
    console.log("[SUBMIT-CLEANING] Processing request from IP:", clientIP);
    
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

    // Determine initial lead status - leads go straight to pending_confirmation
    let leadStatus = "pending_confirmation";
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

    // Determine lead source - with fallback detection for in-app browsers and organic search
    let leadSource = body.source || "direct";
    
    // If source is "direct" or "website", try to detect from referrer or user agent
    if (leadSource === "direct" || leadSource === "website") {
      const ref = (body.browserReferrer || body.utmData?.referrer || "").toLowerCase();
      const ua = (body.browserUserAgent || "").toLowerCase();
      
      // Check referrer for Facebook/Instagram domains
      const isFacebookReferrer = ref.includes("facebook.com") || ref.includes("fb.com") || 
                                  ref.includes("instagram.com") || ref.includes("l.instagram.com") ||
                                  ref.includes("lm.facebook.com") || ref.includes("m.facebook.com");
      
      // Check user agent for Facebook/Instagram in-app browser
      const isFacebookUA = ua.includes("fb_iab") || ua.includes("fbav/") || 
                           ua.includes("instagram") || ua.includes("fban/");
      
      // Check referrer for Google organic search
      const isGoogleOrganic = ref.includes("google.com") || ref.includes("google.co.uk");
      
      // Check referrer for other search engines
      const isBingOrganic = ref.includes("bing.com");
      const isYahooOrganic = ref.includes("yahoo.com") || ref.includes("yahoo.co.uk");
      const isDuckDuckGo = ref.includes("duckduckgo.com");
      
      // Check for TikTok
      const isTikTok = ref.includes("tiktok.com") || ua.includes("tiktok") || ua.includes("bytedance");
      
      if (isFacebookReferrer || isFacebookUA) {
        leadSource = ua.includes("instagram") ? "facebook_organic" : "facebook";
        console.log(`[SUBMIT-CLEANING] Fallback attribution: detected ${leadSource}`);
      } else if (isGoogleOrganic) {
        leadSource = "google_organic";
        console.log(`[SUBMIT-CLEANING] Fallback attribution: detected google_organic from referrer`);
      } else if (isBingOrganic) {
        leadSource = "bing_organic";
        console.log(`[SUBMIT-CLEANING] Fallback attribution: detected bing_organic`);
      } else if (isYahooOrganic) {
        leadSource = "yahoo_organic";
      } else if (isDuckDuckGo) {
        leadSource = "duckduckgo_organic";
      } else if (isTikTok) {
        leadSource = "tiktok";
      } else if (ref && ref.length > 0) {
        // Has external referrer but not a known source
        try {
          const refHost = new URL(ref).hostname;
          // Don't mark our own site as referral
          if (!refHost.includes("cleanda") && !refHost.includes("lovable")) {
            leadSource = "referral";
            console.log(`[SUBMIT-CLEANING] Fallback attribution: referral from ${refHost}`);
          }
        } catch {
          // Invalid URL, keep as direct
        }
      }
    }
    
    // Build job notes: combine customer additional notes with job description and campaign info
    let jobNotes = "";
    
    // Add customer's additional notes first (most important for cleaner)
    if (body.additionalNotes && body.additionalNotes.trim()) {
      jobNotes = body.additionalNotes.trim();
    }
    
    // Add job description (date range info)
    if (body.jobDescription) {
      jobNotes = jobNotes ? `${jobNotes}\n\n${body.jobDescription}` : body.jobDescription;
    }
    
    // Add campaign context for internal tracking
    if (body.utmData && body.campaign) {
      const campaignNote = `[Campaign: ${body.campaign}]`;
      jobNotes = jobNotes ? `${jobNotes}\n\n${campaignNote}` : campaignNote;
    }
    
    // Convert to null if empty
    const finalJobNotes = jobNotes.trim() || null;

    // Build full UTM attribution data for storage
    const utmDataJson = {
      utm_source: body.utmData?.utm_source || null,
      utm_medium: body.utmData?.utm_medium || null,
      utm_campaign: body.utmData?.utm_campaign || null,
      utm_content: body.utmData?.utm_content || null,
      utm_term: body.utmData?.utm_term || null,
      landing_page: body.utmData?.landing_page || null,
      referrer: body.browserReferrer || body.utmData?.referrer || null,
      user_agent: body.browserUserAgent || null,
      detected_source: leadSource,
      captured_at: body.utmData?.captured_at || new Date().toISOString(),
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
      source: leadSource,
      lead_status: leadStatus,
      outcome_status: "pending",
      job_notes: finalJobNotes,
      admin_notes: adminNotes,
      quality_score: phase === 2 ? 80 : 70,
      property_type: body.propertyType || null,
      bedrooms: body.bedrooms || null,
      frequency: body.frequency || null,
      utm_data: utmDataJson,
    }).select().single();

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to submit request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const referenceId = data.id.slice(0, 8).toUpperCase();

    // Auto-subscribe to email list for better deliverability
    try {
      await supabase
        .from("email_subscribers")
        .upsert({
          email: body.customerEmail,
          name: body.customerName,
          source: "cleaning_request",
          source_id: data.id,
          is_active: true,
        }, { onConflict: "email" });
      console.log("[SUBMIT-CLEANING] Email subscriber added/updated:", body.customerEmail);
    } catch (subError) {
      console.error("[SUBMIT-CLEANING] Failed to add subscriber (non-blocking):", subError);
    }

    // Enhanced logging for analytics with UTM data
    console.log("Lead created:", {
      id: data.id,
      jobType: body.jobType,
      value: value,
      valueBand: valueBand,
      phase: phase,
      category: category,
      postcode: body.postcode.toUpperCase(),
      source: leadSource,
      medium: body.medium || null,
      campaign: body.campaign || null,
    });

    // Log lead creation to activity_logs with UTM attribution
    try {
      await supabase.from("activity_logs").insert({
        user_id: "00000000-0000-0000-0000-000000000000", // System user for customer-initiated actions
        entity_type: "lead",
        entity_id: data.id,
        action: "lead_created",
        details: {
          customer_name: body.customerName,
          job_type: body.jobType,
          postcode: formatPostcode(body.postcode),
          value: value,
          display_value: displayValue,
          source: leadSource,
          medium: body.medium || null,
          campaign: body.campaign || null,
          phase: phase,
          category: category,
          utm_data: body.utmData || null,
        },
      });
      console.log("[SUBMIT-CLEANING] Lead creation logged to activity_logs with attribution");
    } catch (activityError) {
      console.error("[SUBMIT-CLEANING] Failed to log activity (non-blocking):", activityError);
    }

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

    // Trigger SMS confirmation for customer to confirm the lead
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      
      // Send SMS confirmation
      const smsResponse = await fetch(`${supabaseUrl}/functions/v1/customer-confirmation`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId: data.id,
          autoPublishHours: 24,
        }),
      });

      const smsResult = await smsResponse.json();
      const smsOk = smsResponse.ok;
      
      console.log("[SUBMIT-CLEANING] Confirmation SMS triggered:", { 
        leadId: data.id, 
        sms: smsOk ? "sent" : smsResult.error,
      });
      
      // If SMS confirmation failed, update lead status to confirmation_failed
      if (!smsOk) {
        console.error("[SUBMIT-CLEANING] SMS confirmation failed, marking lead as confirmation_failed");
        await supabase
          .from("leads")
          .update({ lead_status: "confirmation_failed" })
          .eq("id", data.id);
      }
    } catch (confirmError) {
      console.error("[SUBMIT-CLEANING] Error triggering confirmations:", confirmError);
      // Mark as confirmation_failed if there's an error
      await supabase
        .from("leads")
        .update({ lead_status: "confirmation_failed" })
        .eq("id", data.id);
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
