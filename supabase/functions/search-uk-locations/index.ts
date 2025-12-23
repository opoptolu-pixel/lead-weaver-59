const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UK city/region to postcode prefix mapping
const CITY_POSTCODE_MAP: Record<string, string[]> = {
  // England - Major Cities
  'manchester': ['M'],
  'london': ['E', 'EC', 'N', 'NW', 'SE', 'SW', 'W', 'WC'],
  'birmingham': ['B'],
  'liverpool': ['L'],
  'leeds': ['LS'],
  'sheffield': ['S'],
  'bristol': ['BS'],
  'newcastle': ['NE'],
  'nottingham': ['NG'],
  'leicester': ['LE'],
  'coventry': ['CV'],
  'bradford': ['BD'],
  'stoke': ['ST'],
  'wolverhampton': ['WV'],
  'derby': ['DE'],
  'southampton': ['SO'],
  'portsmouth': ['PO'],
  'plymouth': ['PL'],
  'reading': ['RG'],
  'luton': ['LU'],
  'bolton': ['BL'],
  'bournemouth': ['BH'],
  'middlesbrough': ['TS'],
  'sunderland': ['SR'],
  'brighton': ['BN'],
  'hull': ['HU'],
  'peterborough': ['PE'],
  'stockport': ['SK'],
  'oxford': ['OX'],
  'cambridge': ['CB'],
  'york': ['YO'],
  'norwich': ['NR'],
  'ipswich': ['IP'],
  'exeter': ['EX'],
  'gloucester': ['GL'],
  'lincoln': ['LN'],
  'carlisle': ['CA'],
  'chester': ['CH'],
  'worcester': ['WR'],
  'bath': ['BA'],
  'canterbury': ['CT'],
  'salisbury': ['SP'],
  'truro': ['TR'],
  'durham': ['DH'],
  'wakefield': ['WF'],
  'doncaster': ['DN'],
  'barnsley': ['S'],
  'rotherham': ['S'],
  'wigan': ['WN'],
  'warrington': ['WA'],
  'oldham': ['OL'],
  'rochdale': ['OL'],
  'blackburn': ['BB'],
  'blackpool': ['FY'],
  'preston': ['PR'],
  'burnley': ['BB'],
  'lancaster': ['LA'],
  'crewe': ['CW'],
  'macclesfield': ['SK'],
  'telford': ['TF'],
  'shrewsbury': ['SY'],
  'hereford': ['HR'],
  'swindon': ['SN'],
  'slough': ['SL'],
  'watford': ['WD'],
  'hemel hempstead': ['HP'],
  'stevenage': ['SG'],
  'harlow': ['CM'],
  'chelmsford': ['CM'],
  'colchester': ['CO'],
  'southend': ['SS'],
  'basildon': ['SS'],
  'guildford': ['GU'],
  'crawley': ['RH'],
  'worthing': ['BN'],
  'eastbourne': ['BN'],
  'hastings': ['TN'],
  'maidstone': ['ME'],
  'chatham': ['ME'],
  'dartford': ['DA'],
  'gravesend': ['DA'],
  'tonbridge': ['TN'],
  'ashford': ['TN'],
  'dover': ['CT'],
  'margate': ['CT'],
  'thanet': ['CT'],
  'folkestone': ['CT'],
  'taunton': ['TA'],
  'yeovil': ['BA'],
  'weston-super-mare': ['BS'],
  'torquay': ['TQ'],
  'paignton': ['TQ'],
  'barnstaple': ['EX'],
  'weymouth': ['DT'],
  'dorchester': ['DT'],
  'poole': ['BH'],
  'basingstoke': ['RG'],
  'winchester': ['SO'],
  'andover': ['SP'],
  'newbury': ['RG'],
  'aylesbury': ['HP'],
  'milton keynes': ['MK'],
  'northampton': ['NN'],
  'kettering': ['NN'],
  'corby': ['NN'],
  'wellingborough': ['NN'],
  'bedford': ['MK'],
  'loughborough': ['LE'],
  'nuneaton': ['CV'],
  'rugby': ['CV'],
  'leamington': ['CV'],
  'stratford-upon-avon': ['CV'],
  'redditch': ['B'],
  'kidderminster': ['DY'],
  'dudley': ['DY'],
  'walsall': ['WS'],
  'west bromwich': ['B'],
  'solihull': ['B'],
  'sutton coldfield': ['B'],
  'tamworth': ['B'],
  'burton': ['DE'],
  'stafford': ['ST'],
  'newcastle-under-lyme': ['ST'],
  'cannock': ['WS'],
  'lichfield': ['WS'],
  'grimsby': ['DN'],
  'scunthorpe': ['DN'],
  'boston': ['PE'],
  'grantham': ['NG'],
  'mansfield': ['NG'],
  'worksop': ['S'],
  'chesterfield': ['S'],
  'buxton': ['SK'],
  'matlock': ['DE'],
  'harrogate': ['HG'],
  'scarborough': ['YO'],
  'bridlington': ['YO'],
  'beverley': ['HU'],
  'goole': ['DN'],
  'selby': ['YO'],
  'ripon': ['HG'],
  'skipton': ['BD'],
  'keighley': ['BD'],
  'halifax': ['HX'],
  'huddersfield': ['HD'],
  'dewsbury': ['WF'],
  'pontefract': ['WF'],
  'castleford': ['WF'],
  'batley': ['WF'],
  
  // Scotland
  'edinburgh': ['EH'],
  'glasgow': ['G'],
  'aberdeen': ['AB'],
  'dundee': ['DD'],
  'inverness': ['IV'],
  'stirling': ['FK'],
  'perth': ['PH'],
  'falkirk': ['FK'],
  'kilmarnock': ['KA'],
  'ayr': ['KA'],
  'dumfries': ['DG'],
  'paisley': ['PA'],
  'greenock': ['PA'],
  'motherwell': ['ML'],
  'hamilton': ['ML'],
  'cumbernauld': ['G'],
  'livingston': ['EH'],
  'kirkcaldy': ['KY'],
  'dunfermline': ['KY'],
  
  // Wales
  'cardiff': ['CF'],
  'swansea': ['SA'],
  'newport': ['NP'],
  'wrexham': ['LL'],
  'barry': ['CF'],
  'neath': ['SA'],
  'port talbot': ['SA'],
  'bridgend': ['CF'],
  'cwmbran': ['NP'],
  'pontypool': ['NP'],
  'caerphilly': ['CF'],
  'merthyr tydfil': ['CF'],
  'rhondda': ['CF'],
  'llanelli': ['SA'],
  'carmarthen': ['SA'],
  'aberystwyth': ['SY'],
  'bangor': ['LL'],
  'colwyn bay': ['LL'],
  'rhyl': ['LL'],
  
  // Northern Ireland
  'belfast': ['BT'],
  'londonderry': ['BT'],
  'derry': ['BT'],
  'lisburn': ['BT'],
  'newry': ['BT'],
  'bangor ni': ['BT'],
  'craigavon': ['BT'],
  'ballymena': ['BT'],
  'newtownabbey': ['BT'],
  'carrickfergus': ['BT'],
  'coleraine': ['BT'],
  'omagh': ['BT'],
  'enniskillen': ['BT'],
  'armagh': ['BT'],
  'dungannon': ['BT'],
  'portadown': ['BT'],
  'lurgan': ['BT'],
  
  // Regions
  'greater manchester': ['M', 'OL', 'BL', 'WN', 'SK'],
  'west midlands': ['B', 'CV', 'DY', 'WS', 'WV'],
  'west yorkshire': ['LS', 'BD', 'HX', 'HD', 'WF'],
  'south yorkshire': ['S', 'DN'],
  'merseyside': ['L', 'CH'],
  'tyne and wear': ['NE', 'SR'],
  'greater london': ['E', 'EC', 'N', 'NW', 'SE', 'SW', 'W', 'WC'],
  'essex': ['CM', 'CO', 'SS', 'RM', 'IG'],
  'kent': ['CT', 'DA', 'ME', 'TN', 'BR'],
  'surrey': ['GU', 'KT', 'RH', 'SM', 'CR', 'TW'],
  'hampshire': ['SO', 'PO', 'GU', 'SP', 'RG'],
  'lancashire': ['PR', 'BB', 'FY', 'LA'],
  'yorkshire': ['YO', 'HG', 'LS', 'BD', 'HX', 'HD', 'WF', 'S', 'DN', 'HU'],
  'cornwall': ['TR', 'PL'],
  'devon': ['EX', 'TQ', 'PL'],
  'dorset': ['DT', 'BH'],
  'somerset': ['TA', 'BA', 'BS'],
  'norfolk': ['NR', 'IP', 'PE'],
  'suffolk': ['IP', 'CO', 'NR'],
  'lincolnshire': ['LN', 'PE', 'DN', 'NG'],
  'nottinghamshire': ['NG', 'S'],
  'derbyshire': ['DE', 'SK', 'S'],
  'leicestershire': ['LE', 'CV', 'NN'],
  'northamptonshire': ['NN', 'MK'],
  'oxfordshire': ['OX', 'RG'],
  'berkshire': ['RG', 'SL'],
  'buckinghamshire': ['HP', 'MK', 'SL'],
  'hertfordshire': ['AL', 'EN', 'SG', 'WD', 'HP'],
  'cambridgeshire': ['CB', 'PE'],
  'cumbria': ['CA', 'LA'],
  'northumberland': ['NE'],
  'durham county': ['DH', 'DL', 'TS'],
  'cheshire': ['CH', 'CW', 'SK', 'WA'],
  'staffordshire': ['ST', 'WS', 'DE'],
  'shropshire': ['SY', 'TF'],
  'herefordshire': ['HR'],
  'worcestershire': ['WR', 'DY', 'B'],
  'warwickshire': ['CV', 'B'],
  'gloucestershire': ['GL'],
  'wiltshire': ['SN', 'SP', 'BA'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ success: true, locations: [], postcodePrefixes: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchTerm = query.trim().toLowerCase();
    console.log('Searching UK locations for:', searchTerm);

    // Check if the search matches a city/region name
    // Use strict matching to avoid partial matches (e.g., "london" shouldn't match "londonderry")
    let matchedPrefixes: string[] = [];
    let matchedCity: string | null = null;
    
    for (const [city, prefixes] of Object.entries(CITY_POSTCODE_MAP)) {
      // Only match if:
      // 1. Exact match: "london" === "london"
      // 2. City starts with search AND the next char after search in city is a space or end
      //    e.g., searching "new" matches "new york" but not "newcastle"
      // 3. Search starts with city AND they're very close in length (within 2 chars)
      //    This handles typos like "manchster" for "manchester"
      
      const isExactMatch = city === searchTerm;
      
      // Check if city starts with search term and it's a complete word
      const cityStartsWithSearch = city.startsWith(searchTerm) && 
        (city.length === searchTerm.length || city[searchTerm.length] === ' ');
      
      // Only match if exact or starts-with as complete word
      if (isExactMatch || cityStartsWithSearch) {
        matchedPrefixes = [...new Set([...matchedPrefixes, ...prefixes])];
        if (!matchedCity || city === searchTerm) matchedCity = city;
      }
    }

    let locations: { postcode: string; area: string; type: 'postcode' | 'place' | 'city' }[] = [];

    // If we found a city match, add it as a location
    if (matchedCity && matchedPrefixes.length > 0) {
      const cityName = matchedCity.charAt(0).toUpperCase() + matchedCity.slice(1);
      locations.push({
        postcode: matchedPrefixes.join(', '),
        area: `${cityName} (${matchedPrefixes.length > 1 ? 'multiple areas' : matchedPrefixes[0] + ' postcodes'})`,
        type: 'city'
      });
    }

    // Try postcode autocomplete (for partial postcodes like M14, SW1, etc.)
    const searchTermUpper = query.trim().toUpperCase();
    const postcodeResponse = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(searchTermUpper)}/autocomplete`
    );
    
    if (postcodeResponse.ok) {
      const postcodeData = await postcodeResponse.json();
      if (postcodeData.result && Array.isArray(postcodeData.result)) {
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
          const outcode = place.outcode || '';
          locations.push({
            postcode: outcode || place.name_1,
            area: `${place.name_1}${place.county_unitary ? ', ' + place.county_unitary : ''}`,
            type: 'place'
          });
          
          // Extract postcode prefix from outcode for filtering leads
          // e.g., "NG34" -> "NG34", "NG" -> "NG"
          if (outcode) {
            matchedPrefixes.push(outcode);
          }
        }
      }
    }
    
    // De-duplicate prefixes
    matchedPrefixes = [...new Set(matchedPrefixes)];

    // If still no results and looks like a full postcode, try direct lookup
    if (locations.length === 0 && searchTermUpper.length >= 5) {
      const directResponse = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(searchTermUpper)}`
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
      index === self.findIndex(l => l.postcode === loc.postcode && l.type === loc.type)
    );

    console.log(`Found ${uniqueLocations.length} UK locations, ${matchedPrefixes.length} postcode prefixes`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        locations: uniqueLocations,
        postcodePrefixes: matchedPrefixes,
        matchedCity: matchedCity
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error searching UK locations:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to search locations', locations: [], postcodePrefixes: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
