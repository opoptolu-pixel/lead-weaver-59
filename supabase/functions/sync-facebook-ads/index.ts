import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FacebookInsight {
  date_start: string
  date_stop: string
  spend: string
  impressions: string
  clicks: string
  actions?: Array<{ action_type: string; value: string }>
}

interface FacebookAdsMetrics {
  date: string
  spend: number
  impressions: number
  clicks: number
  conversions: number
  currency: string
}

async function fetchFacebookAdsData(
  accessToken: string,
  adAccountId: string,
  startDate: string,
  endDate: string
): Promise<FacebookAdsMetrics[]> {
  console.log(`Fetching Facebook Ads data from ${startDate} to ${endDate}`)
  
  // Format ad account ID (ensure it has act_ prefix)
  const formattedAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  
  const url = new URL(`https://graph.facebook.com/v18.0/${formattedAccountId}/insights`)
  url.searchParams.set('access_token', accessToken)
  url.searchParams.set('level', 'account')
  url.searchParams.set('fields', 'spend,impressions,clicks,actions')
  url.searchParams.set('time_range', JSON.stringify({
    since: startDate,
    until: endDate
  }))
  url.searchParams.set('time_increment', '1') // Daily breakdown
  
  console.log(`Facebook API URL: ${url.toString().replace(accessToken, '[REDACTED]')}`)
  
  const response = await fetch(url.toString())
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('Facebook API error:', errorText)
    throw new Error(`Facebook API error: ${errorText}`)
  }
  
  const data = await response.json()
  console.log(`Received ${data.data?.length || 0} days of data from Facebook`)
  
  if (!data.data || data.data.length === 0) {
    console.log('No data returned from Facebook API')
    return []
  }
  
  const metrics: FacebookAdsMetrics[] = data.data.map((insight: FacebookInsight) => {
    // Count conversions from actions (leads, purchases, etc.)
    let conversions = 0
    if (insight.actions) {
      const conversionTypes = ['lead', 'purchase', 'complete_registration', 'contact', 'submit_application']
      insight.actions.forEach(action => {
        if (conversionTypes.some(type => action.action_type.includes(type))) {
          conversions += parseInt(action.value, 10) || 0
        }
      })
    }
    
    return {
      date: insight.date_start,
      spend: parseFloat(insight.spend) || 0,
      impressions: parseInt(insight.impressions, 10) || 0,
      clicks: parseInt(insight.clicks, 10) || 0,
      conversions,
      currency: 'GBP' // Facebook returns spend in account currency
    }
  })
  
  return metrics
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get secrets
    const accessToken = Deno.env.get('FACEBOOK_ACCESS_TOKEN')
    const adAccountId = Deno.env.get('FACEBOOK_AD_ACCOUNT_ID')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!accessToken || !adAccountId) {
      throw new Error('Facebook credentials not configured. Please set FACEBOOK_ACCESS_TOKEN and FACEBOOK_AD_ACCOUNT_ID.')
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing')
    }

    // Parse request body for date range
    let startDate: string
    let endDate: string
    
    // Default to last 30 days
    const defaultEnd = new Date()
    const defaultStart = new Date()
    defaultStart.setDate(defaultStart.getDate() - 30)
    
    startDate = defaultStart.toISOString().split('T')[0]
    endDate = defaultEnd.toISOString().split('T')[0]
    
    try {
      const body = await req.json()
      if (body.startDate) startDate = body.startDate
      if (body.endDate) endDate = body.endDate
    } catch {
      // Use defaults if no body or invalid JSON
      console.log('[FACEBOOK-ADS-SYNC] Using default date range')
    }
    
    console.log(`[FACEBOOK-ADS-SYNC] Date range: ${startDate} to ${endDate}`)

    console.log(`Syncing Facebook Ads data from ${startDate} to ${endDate}`)

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Ensure facebook_ads platform exists in settings
    const { data: existingSettings } = await supabase
      .from('ad_platform_settings')
      .select('*')
      .eq('platform', 'facebook_ads')
      .single()

    if (!existingSettings) {
      await supabase
        .from('ad_platform_settings')
        .insert({
          platform: 'facebook_ads',
          is_enabled: true,
          sync_status: 'syncing'
        })
    } else {
      await supabase
        .from('ad_platform_settings')
        .update({ sync_status: 'syncing', error_message: null })
        .eq('platform', 'facebook_ads')
    }

    // Fetch data from Facebook
    const metrics = await fetchFacebookAdsData(accessToken, adAccountId, startDate, endDate)

    console.log(`Processing ${metrics.length} days of Facebook data`)

    // Upsert data into ad_spend table
    if (metrics.length > 0) {
      const records = metrics.map(m => ({
        platform: 'facebook_ads',
        date: m.date,
        spend_amount: m.spend,
        impressions: m.impressions,
        clicks: m.clicks,
        conversions: m.conversions,
        currency: m.currency,
        synced_at: new Date().toISOString()
      }))

      const { error: upsertError } = await supabase
        .from('ad_spend')
        .upsert(records, {
          onConflict: 'platform,date',
          ignoreDuplicates: false
        })

      if (upsertError) {
        console.error('Error upserting Facebook data:', upsertError)
        throw upsertError
      }
    }

    // Update platform settings with success
    await supabase
      .from('ad_platform_settings')
      .update({
        is_enabled: true,
        last_sync_at: new Date().toISOString(),
        sync_status: 'success',
        error_message: null
      })
      .eq('platform', 'facebook_ads')

    console.log('Facebook Ads sync completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${metrics.length} days of Facebook Ads data`,
        dateRange: { startDate, endDate },
        recordsProcessed: metrics.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Facebook Ads sync error:', errorMessage)

    // Try to update error status
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        await supabase
          .from('ad_platform_settings')
          .update({
            sync_status: 'error',
            error_message: errorMessage
          })
          .eq('platform', 'facebook_ads')
      }
    } catch (updateError) {
      console.error('Failed to update error status:', updateError)
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
