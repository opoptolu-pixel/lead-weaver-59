const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PostcodeResult {
  postcode: string;
  admin_district: string | null;
  region: string | null;
  country: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ success: true, locations: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchTerm = query.trim().toUpperCase();
    console.log('Searching UK locations for:', searchTerm);

    // Try postcode autocomplete first (for partial postcodes like M14, SW1, etc.)
    const postcodeResponse = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(searchTerm)}/autocomplete`
    );
    
    let locations: { postcode: string; area: string; type: 'postcode' | 'place' }[] = [];

    if (postcodeResponse.ok) {
      const postcodeData = await postcodeResponse.json();
      if (postcodeData.result && Array.isArray(postcodeData.result)) {
        // Get details for each postcode
        const postcodes = postcodeData.result.slice(0, 5);
        
        for (const postcode of postcodes) {
          try {
            const detailResponse = await fetch(
              `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`
            );
            if (detailResponse.ok) {
              const detail = await detailResponse.json();
              if (detail.result) {
                locations.push({
                  postcode: detail.result.postcode,
                  area: detail.result.admin_district || detail.result.region || detail.result.country || 'UK',
                  type: 'postcode'
                });
              }
            }
          } catch (e) {
            console.log('Error fetching postcode detail:', e);
          }
        }
      }
    }

    // Also try place name search
    const placeResponse = await fetch(
      `https://api.postcodes.io/places?q=${encodeURIComponent(query)}&limit=5`
    );

    if (placeResponse.ok) {
      const placeData = await placeResponse.json();
      if (placeData.result && Array.isArray(placeData.result)) {
        for (const place of placeData.result) {
          // Get the outcode for this place if available
          const outcode = place.outcode || '';
          locations.push({
            postcode: outcode || place.name_1,
            area: `${place.name_1}${place.county_unitary ? ', ' + place.county_unitary : ''}`,
            type: 'place'
          });
        }
      }
    }

    // If still no results and looks like a full postcode, try direct lookup
    if (locations.length === 0 && searchTerm.length >= 5) {
      const directResponse = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(searchTerm)}`
      );
      if (directResponse.ok) {
        const directData = await directResponse.json();
        if (directData.result) {
          locations.push({
            postcode: directData.result.postcode,
            area: directData.result.admin_district || directData.result.region || 'UK',
            type: 'postcode'
          });
        }
      }
    }

    // Remove duplicates
    const uniqueLocations = locations.filter((loc, index, self) =>
      index === self.findIndex(l => l.postcode === loc.postcode)
    );

    console.log(`Found ${uniqueLocations.length} UK locations`);

    return new Response(
      JSON.stringify({ success: true, locations: uniqueLocations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error searching UK locations:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to search locations', locations: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
