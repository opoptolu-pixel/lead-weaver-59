import { useEffect, useState } from 'react';

export interface UtmData {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_page: string | null;
  referrer: string | null;
  captured_at: string | null;
}

const UTM_STORAGE_KEY = 'cleanda_utm_data';

// Map common sources to standardized names
const normalizeSource = (source: string | null): string => {
  if (!source) return 'direct';
  
  const lowerSource = source.toLowerCase();
  
  // Facebook variations
  if (lowerSource.includes('facebook') || lowerSource === 'fb' || lowerSource === 'ig' || lowerSource.includes('instagram')) {
    return 'facebook';
  }
  
  // Google variations
  if (lowerSource.includes('google') || lowerSource === 'gclid') {
    return 'google';
  }
  
  // TikTok variations
  if (lowerSource.includes('tiktok') || lowerSource === 'tt') {
    return 'tiktok';
  }
  
  // Bing/Microsoft
  if (lowerSource.includes('bing') || lowerSource.includes('microsoft')) {
    return 'bing';
  }
  
  return lowerSource;
};

// Detect organic search from referrer
const detectOrganicSource = (referrer: string | null): string | null => {
  if (!referrer) return null;
  
  const lowerReferrer = referrer.toLowerCase();
  
  if (lowerReferrer.includes('google.')) return 'google_organic';
  if (lowerReferrer.includes('bing.')) return 'bing_organic';
  if (lowerReferrer.includes('yahoo.')) return 'yahoo_organic';
  if (lowerReferrer.includes('duckduckgo.')) return 'duckduckgo_organic';
  
  return null;
};

// Get UTM data from URL
const getUtmFromUrl = (): Partial<UtmData> => {
  if (typeof window === 'undefined') return {};
  
  const params = new URLSearchParams(window.location.search);
  
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_content: params.get('utm_content'),
    utm_term: params.get('utm_term'),
    landing_page: window.location.pathname,
    referrer: document.referrer || null,
  };
};

// Get stored UTM data
export const getStoredUtmData = (): UtmData | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(UTM_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('[UTM] Error reading stored UTM data:', e);
  }
  return null;
};

// Get the lead source for submission
export const getLeadSource = (): {
  source: string;
  medium: string | null;
  campaign: string | null;
  utm_data: UtmData | null;
} => {
  const utmData = getStoredUtmData();
  
  if (!utmData) {
    return {
      source: 'direct',
      medium: null,
      campaign: null,
      utm_data: null,
    };
  }
  
  // Determine source with priority: UTM > organic detection > referrer > direct
  let source = 'direct';
  
  if (utmData.utm_source) {
    source = normalizeSource(utmData.utm_source);
  } else {
    const organicSource = detectOrganicSource(utmData.referrer);
    if (organicSource) {
      source = organicSource;
    } else if (utmData.referrer && utmData.referrer.length > 0) {
      // Has referrer but not a search engine - could be social or other site
      try {
        const referrerHost = new URL(utmData.referrer).hostname.replace('www.', '');
        if (referrerHost.includes('facebook.com') || referrerHost.includes('instagram.com')) {
          source = 'facebook_organic';
        } else if (referrerHost.includes('tiktok.com')) {
          source = 'tiktok_organic';
        } else if (referrerHost.includes('twitter.com') || referrerHost.includes('x.com')) {
          source = 'twitter_organic';
        } else if (referrerHost.includes('linkedin.com')) {
          source = 'linkedin_organic';
        } else {
          source = 'referral';
        }
      } catch {
        source = 'referral';
      }
    }
  }
  
  return {
    source,
    medium: utmData.utm_medium,
    campaign: utmData.utm_campaign,
    utm_data: utmData,
  };
};

/**
 * Hook to capture and store UTM parameters on first visit (first-touch attribution)
 * Only stores on first visit - subsequent visits don't overwrite
 */
export const useUtmTracking = () => {
  const [utmData, setUtmData] = useState<UtmData | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Check if we already have stored UTM data (first-touch)
    const existingData = getStoredUtmData();
    
    if (existingData) {
      // First-touch already captured, use existing data
      setUtmData(existingData);
      setIsInitialized(true);
      return;
    }
    
    // First visit - capture UTM params
    const currentUtm = getUtmFromUrl();
    
    const newUtmData: UtmData = {
      utm_source: currentUtm.utm_source || null,
      utm_medium: currentUtm.utm_medium || null,
      utm_campaign: currentUtm.utm_campaign || null,
      utm_content: currentUtm.utm_content || null,
      utm_term: currentUtm.utm_term || null,
      landing_page: currentUtm.landing_page || null,
      referrer: currentUtm.referrer || null,
      captured_at: new Date().toISOString(),
    };
    
    // Store for first-touch attribution
    try {
      localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(newUtmData));
      console.log('[UTM] First-touch attribution captured:', {
        source: newUtmData.utm_source || 'none',
        medium: newUtmData.utm_medium || 'none',
        referrer: newUtmData.referrer ? 'present' : 'none',
      });
    } catch (e) {
      console.error('[UTM] Error storing UTM data:', e);
    }
    
    setUtmData(newUtmData);
    setIsInitialized(true);
  }, []);

  return {
    utmData,
    isInitialized,
    getLeadSource,
  };
};

export default useUtmTracking;
