const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RETIREMENT_ID = "LEGACY-AGENCY-FUNCTION-RETIRED-001";

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(JSON.stringify({
    error: "gone",
    retirement_id: RETIREMENT_ID,
    message: "This managed-agency function has been retired from the Cleanda legacy marketplace.",
  }), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
