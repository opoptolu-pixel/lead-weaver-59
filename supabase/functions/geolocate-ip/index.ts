import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP from request headers
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('cf-connecting-ip')
      || req.headers.get('x-real-ip')
      || null;

    console.log('[GEOLOCATE-IP] Client IP:', clientIp);

    if (!clientIp) {
      return new Response(
        JSON.stringify({ 
          ip: null, 
          city: null, 
          country: null,
          error: 'Could not determine IP address'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use ip-api.com (free, no API key required, more accurate than ipapi.co)
    // It provides ISP info which helps indicate accuracy
    const geoResponse = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,message,country,city,regionName,isp,org,query`);
    
    if (!geoResponse.ok) {
      console.error('[GEOLOCATE-IP] Geolocation API error:', geoResponse.status);
      return new Response(
        JSON.stringify({ 
          ip: clientIp, 
          city: null, 
          country: null,
          error: 'Geolocation service unavailable'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geoData = await geoResponse.json();
    console.log('[GEOLOCATE-IP] Geolocation result:', JSON.stringify(geoData));

    if (geoData.status === 'fail') {
      return new Response(
        JSON.stringify({ 
          ip: clientIp, 
          city: null, 
          country: null,
          error: geoData.message || 'Geolocation lookup failed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return accurate location data
    // Note: ISP/org helps identify if this is a data center IP (less accurate) vs residential
    const isDataCenterIP = geoData.org?.toLowerCase().includes('amazon') ||
                           geoData.org?.toLowerCase().includes('google') ||
                           geoData.org?.toLowerCase().includes('microsoft') ||
                           geoData.org?.toLowerCase().includes('cloudflare') ||
                           geoData.isp?.toLowerCase().includes('hosting');

    return new Response(
      JSON.stringify({
        ip: clientIp,
        city: geoData.city || null,
        region: geoData.regionName || null,
        country: geoData.country || null,
        isp: geoData.isp || null,
        accuracy: isDataCenterIP ? 'low' : 'medium',
        accuracy_note: isDataCenterIP 
          ? 'IP appears to be from a data center/VPN - location may not reflect actual user location'
          : 'Location is estimated based on IP address'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GEOLOCATE-IP] Error:', error);
    return new Response(
      JSON.stringify({ 
        ip: null, 
        city: null, 
        country: null,
        error: 'Internal server error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
