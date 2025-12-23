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

// Phase 1 Job Types - Only bundled jobs that naturally exceed £100
const PHASE1_JOB_TYPES: Record<string, { displayValue: string; value: number }> = {
  "Carpet Cleaning (2–3 Rooms)": { displayValue: "£100–£150", value: 125 },
  "Sofa + Carpet Cleaning": { displayValue: "£120–£180", value: 150 },
  "Sofa + Mattress Cleaning": { displayValue: "£100–£140", value: 120 },
  "Carpet + Mattress Cleaning": { displayValue: "£110–£160", value: 135 },
  "3 Rooms Deep Clean": { displayValue: "£140–£200", value: 170 },
  "End of Tenancy Clean (1–2 Bed)": { displayValue: "£150–£220", value: 185 },
  "Airbnb Refresh (Full Package)": { displayValue: "£130–£180", value: 155 },
  "Move-In / Move-Out Clean": { displayValue: "£140–£200", value: 170 },
  // Legacy mappings for backwards compatibility
  "End of Tenancy": { displayValue: "£150–£220", value: 185 },
  "Deep Clean": { displayValue: "£140–£200", value: 170 },
  "Move-In Clean": { displayValue: "£140–£200", value: 170 },
};

const MINIMUM_JOB_VALUE = 100;

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

    // Get job type info or use defaults
    const jobTypeInfo = PHASE1_JOB_TYPES[body.jobType];
    
    // Calculate value - use provided estimate or lookup
    let displayValue = body.estimatedValue || jobTypeInfo?.displayValue || "£100–£150";
    let value = jobTypeInfo?.value || 125;

    // CRITICAL: Enforce £100 minimum job value
    if (value < MINIMUM_JOB_VALUE) {
      console.error(`Job value ${value} below minimum ${MINIMUM_JOB_VALUE} for job type: ${body.jobType}`);
      return new Response(
        JSON.stringify({ 
          error: "Job value too low", 
          message: "We only accept jobs with a minimum value of £100. Please select a larger service package." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert lead into database
    const { data, error } = await supabase.from("leads").insert({
      customer_name: body.customerName,
      customer_email: body.customerEmail,
      customer_phone: body.customerPhone,
      customer_address: body.customerAddress,
      postcode: body.postcode.toUpperCase(),
      job_type: body.jobType,
      date: body.preferredDate,
      display_value: displayValue,
      value: value,
      source: "website",
      lead_status: "new",
      outcome_status: "pending",
      job_notes: body.jobDescription || null,
    }).select().single();

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to submit request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Lead created successfully:", data.id, "| Job Type:", body.jobType, "| Value:", value);

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
