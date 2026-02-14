import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fixed USD to GBP conversion rate - update periodically or fetch live
const USD_TO_GBP_RATE = 0.79;

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
  spendGBP: number
  impressions: number
  clicks: number
  currency: string
}

async function fetchFacebookAdsData(
  accessToken: string,
  adAccountId: string,
  startDate: string,
  endDate: string
): Promise<FacebookAdsMetrics[]> {
  console.log(`Fetching Facebook Ads data from ${startDate} to ${endDate}`)
  
  const formattedAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`
  
  const url = new URL(`https://graph.facebook.com/v18.0/${formattedAccountId}/insights`)
  url.searchParams.set('access_token', accessToken)
  url.searchParams.set('level', 'account')
  url.searchParams.set('fields', 'spend,impressions,clicks')
  url.searchParams.set('time_range', JSON.stringify({
    since: startDate,
    until: endDate
  }))
  url.searchParams.set('time_increment', '1')
  
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
    return []
  }
  
  return data.data.map((insight: FacebookInsight) => ({
    date: insight.date_start,
    spend: parseFloat(insight.spend) || 0,
    spendGBP: (parseFloat(insight.spend) || 0) * USD_TO_GBP_RATE,
    impressions: parseInt(insight.impressions, 10) || 0,
    clicks: parseInt(insight.clicks, 10) || 0,
    currency: 'USD',
  }))
}

async function countRealConversions(
  supabase: ReturnType<typeof createClient>,
  date: string
): Promise<number> {
  // Count leads from Facebook sources on this specific date
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd = `${date}T23:59:59.999Z`
  
  const { count, error } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)
    .or('source.ilike.%facebook%,source.eq.facebook,source.eq.facebook_ads,source.eq.facebook_organic')
  
  if (error) {
    console.error(`Error counting conversions for ${date}:`, error)
    return 0
  }
  
  console.log(`Real conversions for ${date}: ${count}`)
  return count || 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const accessToken = Deno.env.get('FACEBOOK_ACCESS_TOKEN')
    const adAccountId = Deno.env.get('FACEBOOK_AD_ACCOUNT_ID')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!accessToken || !adAccountId) {
      throw new Error('Facebook credentials not configured.')
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing')
    }

    // Parse date range (default last 30 days)
    const defaultEnd = new Date()
    const defaultStart = new Date()
    defaultStart.setDate(defaultStart.getDate() - 30)
    
    let startDate = defaultStart.toISOString().split('T')[0]
    let endDate = defaultEnd.toISOString().split('T')[0]
    
    try {
      const body = await req.json()
      if (body.startDate) startDate = body.startDate
      if (body.endDate) endDate = body.endDate
    } catch {
      console.log('[FACEBOOK-ADS-SYNC] Using default date range')
    }
    
    console.log(`[FACEBOOK-ADS-SYNC] Date range: ${startDate} to ${endDate}`)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Ensure platform settings exist
    const { data: existingSettings } = await supabase
      .from('ad_platform_settings')
      .select('*')
      .eq('platform', 'facebook_ads')
      .single()

    if (!existingSettings) {
      await supabase
        .from('ad_platform_settings')
        .insert({ platform: 'facebook_ads', is_enabled: true, sync_status: 'syncing' })
    } else {
      await supabase
        .from('ad_platform_settings')
        .update({ sync_status: 'syncing', error_message: null })
        .eq('platform', 'facebook_ads')
    }

    // Fetch spend data from Facebook
    const metrics = await fetchFacebookAdsData(accessToken, adAccountId, startDate, endDate)
    console.log(`Processing ${metrics.length} days of Facebook data`)

    // For each day, count real conversions from leads DB
    if (metrics.length > 0) {
      const records = await Promise.all(metrics.map(async (m) => {
        const conversions = await countRealConversions(supabase, m.date)
        return {
          platform: 'facebook_ads',
          date: m.date,
          spend_amount: m.spendGBP, // Store converted GBP amount
          impressions: m.impressions,
          clicks: m.clicks,
          conversions, // Real conversions from leads DB
          currency: 'GBP', // Converted to GBP
          synced_at: new Date().toISOString()
        }
      }))

      console.log(`Records to upsert:`, JSON.stringify(records))

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

    // Update platform settings
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
        recordsProcessed: metrics.length,
        conversionRate: USD_TO_GBP_RATE,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Facebook Ads sync error:', errorMessage)

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        await supabase
          .from('ad_platform_settings')
          .update({ sync_status: 'error', error_message: errorMessage })
          .eq('platform', 'facebook_ads')
      }
    } catch (updateError) {
      console.error('Failed to update error status:', updateError)
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
