import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// Job Value Bands for Phase 2 Analytics
type ValueBand = "standard" | "premium" | "high-value";

const getValueBand = (value: number): ValueBand => {
  if (value >= 200) return "high-value";
  if (value >= 150) return "premium";
  return "standard";
};

// Phase 1 + Phase 2 Job Types
const JOB_TYPES: Record<string, { displayValue: string; value: number; phase: number; category: string }> = {
  // Phase 1 - Core Services (£100+)
  "Carpet Cleaning (2–3 Rooms)": { displayValue: "from £100", value: 125, phase: 1, category: "carpet" },
  "Sofa + Carpet Cleaning": { displayValue: "from £120", value: 150, phase: 1, category: "upholstery" },
  "Sofa + Mattress Cleaning": { displayValue: "from £100", value: 120, phase: 1, category: "upholstery" },
  "Carpet + Mattress Cleaning": { displayValue: "from £110", value: 135, phase: 1, category: "carpet" },
  "Deep Clean (3+ Rooms)": { displayValue: "from £140", value: 170, phase: 1, category: "deep-clean" },
  "End of Tenancy Clean": { displayValue: "from £150", value: 185, phase: 1, category: "tenancy" },
  "Airbnb / Short-Let Refresh": { displayValue: "from £130", value: 155, phase: 1, category: "short-let" },
  "Move-In / Move-Out Clean": { displayValue: "from £140", value: 170, phase: 1, category: "tenancy" },
  "Post-Tenancy Carpet & Upholstery": { displayValue: "from £120", value: 140, phase: 1, category: "tenancy" },
  "One-Off Deep Clean": { displayValue: "from £100", value: 120, phase: 1, category: "deep-clean" },
  
  // Phase 2 - Commercial & Specialist (£120+)
  "Office Carpet + Upholstery Clean": { displayValue: "from £150", value: 180, phase: 2, category: "commercial" },
  "Post-Construction Deep Clean": { displayValue: "from £200", value: 250, phase: 2, category: "construction" },
  "Large Property Window + Interior": { displayValue: "from £180", value: 220, phase: 2, category: "window" },
  "Multi-Room + Upholstery Deep Clean": { displayValue: "from £160", value: 190, phase: 2, category: "deep-clean" },
  
  // Legacy mappings for backwards compatibility
  "End of Tenancy": { displayValue: "from £150", value: 185, phase: 1, category: "tenancy" },
  "Deep Clean": { displayValue: "from £140", value: 170, phase: 1, category: "deep-clean" },
  "Move-In Clean": { displayValue: "from £140", value: 170, phase: 1, category: "tenancy" },
  "One-Off Clean": { displayValue: "from £100", value: 120, phase: 1, category: "deep-clean" },
};
const MINIMUM_JOB_VALUE = 100;
const PHASE2_MINIMUM_VALUE = 120; // Phase 2 jobs require higher minimum

// UK Postcode validation regex
const UK_POSTCODE_REGEX = /^([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})$/i;

const validatePostcode = (postcode: string): boolean => {
  const cleaned = postcode.replace(/\s+/g, '');
  return UK_POSTCODE_REGEX.test(cleaned);
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
    let value = jobTypeInfo?.value || 125;
    const phase = jobTypeInfo?.phase || 1;
    const category = jobTypeInfo?.category || "general";

    // SMART ENFORCEMENT: Different minimum for Phase 2 jobs
    const requiredMinimum = phase === 2 ? PHASE2_MINIMUM_VALUE : MINIMUM_JOB_VALUE;

    // CRITICAL: Enforce minimum job value
    if (value < requiredMinimum) {
      console.error(`Job value ${value} below minimum ${requiredMinimum} for job type: ${body.jobType} (Phase ${phase})`);
      return new Response(
        JSON.stringify({ 
          error: "Job value too low", 
          message: `We only accept ${phase === 2 ? 'commercial/specialist' : ''} jobs with a minimum value of £${requiredMinimum}. Please select a larger service package.` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine value band for analytics
    const valueBand = getValueBand(value);

    // Determine initial lead status - auto-flag edge cases for review
    let leadStatus = "new";
    let adminNotes = null;
    
    // SMART ENFORCEMENT: Flag leads that are borderline
    if (value < 110) {
      adminNotes = `[AUTO-FLAG] Borderline value (£${value}). Review for quality.`;
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Your cleaning request has been submitted successfully!",
        referenceId: data.id.slice(0, 8).toUpperCase()
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
