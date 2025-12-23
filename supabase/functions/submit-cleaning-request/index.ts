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

    // Determine display value based on job type
    const getDisplayValue = (jobType: string): string => {
      const values: Record<string, string> = {
        "End of Tenancy": "£150-£350",
        "Deep Clean": "£100-£250",
        "Regular Clean": "£60-£120",
        "Carpet Cleaning": "£80-£200",
        "Oven Cleaning": "£50-£100",
        "Window Cleaning": "£40-£120",
        "Office Clean": "£100-£300",
        "Move-In Clean": "£120-£300",
        "Post-Construction": "£200-£500",
        "One-Off Clean": "£80-£180",
      };
      return values[jobType] || "£80-£200";
    };

    // Calculate value (use middle of range for sorting)
    const getValue = (jobType: string): number => {
      const values: Record<string, number> = {
        "End of Tenancy": 250,
        "Deep Clean": 175,
        "Regular Clean": 90,
        "Carpet Cleaning": 140,
        "Oven Cleaning": 75,
        "Window Cleaning": 80,
        "Office Clean": 200,
        "Move-In Clean": 210,
        "Post-Construction": 350,
        "One-Off Clean": 130,
      };
      return values[jobType] || 100;
    };

    // Insert lead into database
    const { data, error } = await supabase.from("leads").insert({
      customer_name: body.customerName,
      customer_email: body.customerEmail,
      customer_phone: body.customerPhone,
      customer_address: body.customerAddress,
      postcode: body.postcode.toUpperCase(),
      job_type: body.jobType,
      date: body.preferredDate,
      display_value: body.estimatedValue || getDisplayValue(body.jobType),
      value: getValue(body.jobType),
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

    console.log("Lead created successfully:", data.id);

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