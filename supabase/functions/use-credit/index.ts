import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[USE-CREDIT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { leadId } = await req.json();
    if (!leadId) throw new Error("Lead ID is required");
    logStep("Lead ID received", { leadId });

    // Get user's current credits and suspension status
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("credits, is_suspended, suspension_reason")
      .eq("user_id", user.id)
      .single();

    if (profileError) throw new Error(`Failed to fetch profile: ${profileError.message}`);

    // CRITICAL: Check if user is suspended
    if (profile?.is_suspended) {
      throw new Error(profile.suspension_reason || "Your account is suspended. Please contact support.");
    }

    const currentCredits = profile?.credits || 0;
    if (currentCredits < 1) {
      throw new Error("Insufficient credits. Please purchase more credits.");
    }
    logStep("Credits check passed", { currentCredits });

    // Verify the lead exists and is not already unlocked
    const { data: lead, error: leadError } = await supabaseClient
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    if (leadError) throw new Error(`Error fetching lead: ${leadError.message}`);
    if (!lead) throw new Error("Lead not found");
    if (lead.is_unlocked) throw new Error("This lead has already been unlocked");
    logStep("Lead verified", { postcode: lead.postcode });

    // Deduct credit
    const { error: creditError } = await supabaseClient
      .from("profiles")
      .update({ credits: currentCredits - 1 })
      .eq("user_id", user.id);

    if (creditError) throw new Error(`Failed to deduct credit: ${creditError.message}`);
    logStep("Credit deducted", { newCredits: currentCredits - 1 });

    // Unlock the lead and update status
    const { error: updateError } = await supabaseClient
      .from("leads")
      .update({
        is_unlocked: true,
        unlocked_by: user.id,
        unlocked_at: new Date().toISOString(),
        lead_status: "purchased",
        outcome_status: "purchased",
      })
      .eq("id", leadId);

    if (updateError) throw new Error(`Failed to unlock lead: ${updateError.message}`);
    logStep("Lead unlocked successfully");

    // Increment leads_purchased counter (fire-and-forget)
    const incrementLeads = async () => {
      try {
        const { data: currentProfile } = await supabaseClient
          .from("profiles")
          .select("leads_purchased")
          .eq("user_id", user.id)
          .single();
        
        await supabaseClient
          .from("profiles")
          .update({ leads_purchased: (currentProfile?.leads_purchased || 0) + 1 })
          .eq("user_id", user.id);
        
        logStep("Leads purchased counter updated");
      } catch (err) {
        logStep("Failed to update leads_purchased", { error: (err as Error).message });
      }
    };
    incrementLeads();

    return new Response(JSON.stringify({
      success: true,
      lead: {
        id: lead.id,
        postcode: lead.postcode,
        job_type: lead.job_type,
        display_value: lead.display_value,
        customer_name: lead.customer_name,
        customer_email: lead.customer_email,
        customer_phone: lead.customer_phone,
        customer_address: lead.customer_address,
        date: lead.date,
      },
      remainingCredits: currentCredits - 1,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
