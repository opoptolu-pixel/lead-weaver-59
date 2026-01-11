import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GoogleAdsMetrics {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  currency: string;
}

// Get a fresh access token using the refresh token
async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_ADS_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google OAuth credentials");
  }

  console.log("[GOOGLE-ADS-SYNC] Refreshing access token...");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[GOOGLE-ADS-SYNC] Token refresh failed:", errorText);
    throw new Error(`Failed to refresh token: ${errorText}`);
  }

  const data = await response.json();
  console.log("[GOOGLE-ADS-SYNC] Access token refreshed successfully");
  return data.access_token;
}

// Fetch ad spend data from Google Ads API
async function fetchGoogleAdsData(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<GoogleAdsMetrics[]> {
  const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");
  const customerId = Deno.env.get("GOOGLE_ADS_CUSTOMER_ID")?.replace(/-/g, "");

  if (!developerToken || !customerId) {
    throw new Error("Missing Google Ads API credentials");
  }

  console.log(`[GOOGLE-ADS-SYNC] Fetching data for customer ${customerId} from ${startDate} to ${endDate}`);

  const query = `
    SELECT
      segments.date,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      customer.currency_code
    FROM customer
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY segments.date DESC
  `;

  const response = await fetch(
    `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[GOOGLE-ADS-SYNC] API request failed:", errorText);
    
    // Check for common Google Ads API issues
    if (response.status === 501 || errorText.includes("UNIMPLEMENTED")) {
      console.warn("[GOOGLE-ADS-SYNC] API not enabled for this account - returning empty data");
      // Return empty array instead of throwing - allows graceful handling
      return [];
    }
    
    throw new Error(`Google Ads API error: ${errorText}`);
  }

  const results: GoogleAdsMetrics[] = [];
  const data = await response.json();

  console.log("[GOOGLE-ADS-SYNC] Raw API response:", JSON.stringify(data).substring(0, 500));

  // Parse the streaming response
  if (Array.isArray(data)) {
    for (const batch of data) {
      if (batch.results) {
        for (const row of batch.results) {
          const date = row.segments?.date;
          const costMicros = row.metrics?.costMicros || 0;
          const impressions = row.metrics?.impressions || 0;
          const clicks = row.metrics?.clicks || 0;
          const conversions = row.metrics?.conversions || 0;
          const currency = row.customer?.currencyCode || "GBP";

          if (date) {
            results.push({
              date,
              spend: Number(costMicros) / 1_000_000, // Convert micros to actual currency
              impressions: Number(impressions),
              clicks: Number(clicks),
              conversions: Number(conversions),
              currency,
            });
          }
        }
      }
    }
  }

  console.log(`[GOOGLE-ADS-SYNC] Parsed ${results.length} daily records`);
  return results;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[GOOGLE-ADS-SYNC] Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for date range
    let startDate: string;
    let endDate: string;

    try {
      const body = await req.json();
      startDate = body.startDate;
      endDate = body.endDate;
    } catch {
      // Default to last 30 days
      const now = new Date();
      endDate = now.toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = thirtyDaysAgo.toISOString().split("T")[0];
    }

    console.log(`[GOOGLE-ADS-SYNC] Date range: ${startDate} to ${endDate}`);

    // Get access token
    const accessToken = await getAccessToken();

    // Fetch Google Ads data
    const adsData = await fetchGoogleAdsData(accessToken, startDate, endDate);

    if (adsData.length === 0) {
      console.log("[GOOGLE-ADS-SYNC] No data returned from Google Ads");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No data available for the specified date range",
          synced: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert data into ad_spend table
    let syncedCount = 0;
    for (const record of adsData) {
      const { error } = await supabase
        .from("ad_spend")
        .upsert(
          {
            platform: "google_ads",
            date: record.date,
            spend_amount: record.spend,
            impressions: record.impressions,
            clicks: record.clicks,
            conversions: record.conversions,
            currency: record.currency,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "platform,date" }
        );

      if (error) {
        console.error(`[GOOGLE-ADS-SYNC] Failed to upsert record for ${record.date}:`, error);
      } else {
        syncedCount++;
      }
    }

    // Update ad_platform_settings
    await supabase
      .from("ad_platform_settings")
      .upsert(
        {
          platform: "google_ads",
          is_enabled: true,
          last_sync_at: new Date().toISOString(),
          sync_status: "success",
          error_message: null,
        },
        { onConflict: "platform" }
      );

    console.log(`[GOOGLE-ADS-SYNC] Successfully synced ${syncedCount} records`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully synced ${syncedCount} records`,
        synced: syncedCount,
        dateRange: { startDate, endDate },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[GOOGLE-ADS-SYNC] Error:", errorMessage);

    // Try to update platform settings with error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase
        .from("ad_platform_settings")
        .upsert(
          {
            platform: "google_ads",
            sync_status: "error",
            error_message: errorMessage,
          },
          { onConflict: "platform" }
        );
    } catch (updateError) {
      console.error("[GOOGLE-ADS-SYNC] Failed to update error status:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
