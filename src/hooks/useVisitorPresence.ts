import { useEffect, useRef, useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { channelManager, Visitor } from "./useVisitorData";

interface PageVisit {
  page: string;
  enteredAt: string;
  leftAt?: string;
  timeSpent?: number;
}

interface GeoLocation {
  city: string;
  region: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
}

// Generate a unique visitor ID per session
const getVisitorId = (): string => {
  if (typeof window === "undefined") return "ssr_visitor";
  
  let visitorId = sessionStorage.getItem("visitor_id");
  if (!visitorId) {
    visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem("visitor_id", visitorId);
  }
  return visitorId;
};

// Get cached geolocation from session storage
const getCachedGeolocation = (): GeoLocation | null => {
  if (typeof window === "undefined") return null;
  
  try {
    const cached = sessionStorage.getItem("visitor_geolocation");
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

// Cache geolocation in session storage
const cacheGeolocation = (geo: GeoLocation) => {
  if (typeof window === "undefined") return;
  
  try {
    sessionStorage.setItem("visitor_geolocation", JSON.stringify(geo));
  } catch {
    // Ignore storage errors
  }
};

// Fetch geolocation from free IP geolocation API
const fetchGeolocation = async (): Promise<GeoLocation | null> => {
  // Check cache first
  const cached = getCachedGeolocation();
  if (cached) return cached;
  
  try {
    // Using ip-api.com (free, no API key required, 45 requests/minute limit)
    const response = await fetch("http://ip-api.com/json/?fields=city,region,country,countryCode,lat,lon", {
      method: "GET",
    });
    
    if (!response.ok) {
      console.warn("Geolocation API failed:", response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.city) {
      const geo: GeoLocation = {
        city: data.city,
        region: data.region,
        country: data.country,
        countryCode: data.countryCode,
        lat: data.lat,
        lon: data.lon,
      };
      cacheGeolocation(geo);
      return geo;
    }
    
    return null;
  } catch (error) {
    console.warn("Failed to fetch geolocation:", error);
    return null;
  }
};

// Store page history in session storage
const getPageHistory = (): PageVisit[] => {
  if (typeof window === "undefined") return [];
  
  try {
    const history = sessionStorage.getItem("page_history");
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
};

const savePageHistory = (history: PageVisit[]) => {
  if (typeof window === "undefined") return;
  
  try {
    // Keep only last 20 page visits
    const trimmed = history.slice(-20);
    sessionStorage.setItem("page_history", JSON.stringify(trimmed));
  } catch {
    // Ignore storage errors
  }
};

export function useVisitorPresence() {
  const location = useLocation();
  const { user } = useAuth();
  
  // Use state for visitorId to ensure consistent hook order
  const [visitorId] = useState(() => getVisitorId());
  const [geolocation, setGeolocation] = useState<GeoLocation | null>(() => getCachedGeolocation());
  
  const lastPageRef = useRef<string | null>(null);
  const pageEnterTimeRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number>(Date.now());
  const isSubscribedRef = useRef(false);

  // Fetch geolocation on mount
  useEffect(() => {
    if (!geolocation) {
      fetchGeolocation().then((geo) => {
        if (geo) {
          setGeolocation(geo);
        }
      });
    }
  }, [geolocation]);

  const trackPageVisit = useCallback((currentPath: string, previousPath: string | null) => {
    const now = Date.now();
    const history = getPageHistory();
    
    // Update time spent on previous page
    if (previousPath && history.length > 0) {
      const lastVisit = history[history.length - 1];
      if (lastVisit.page === previousPath && !lastVisit.leftAt) {
        lastVisit.leftAt = new Date().toISOString();
        lastVisit.timeSpent = Math.round((now - new Date(lastVisit.enteredAt).getTime()) / 1000);
      }
    }
    
    // Add new page visit
    history.push({
      page: currentPath,
      enteredAt: new Date().toISOString(),
    });
    
    savePageHistory(history);
    pageEnterTimeRef.current = now;
  }, []);

  const getSessionDuration = useCallback(() => {
    return Math.round((Date.now() - sessionStartRef.current) / 1000);
  }, []);

  const getVisitorData = useCallback((): Visitor => {
    return {
      visitorId,
      currentPage: location.pathname,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      joinedAt: new Date().toISOString(),
      isAuthenticated: !!user,
      userId: user?.id || null,
      pageHistory: getPageHistory(),
      sessionDuration: getSessionDuration(),
      geolocation: geolocation || undefined,
    };
  }, [visitorId, location.pathname, user, getSessionDuration, geolocation]);

  // Subscribe and track initial presence
  useEffect(() => {
    const callback = () => {
      // On first sync, track our presence
      if (!isSubscribedRef.current) {
        isSubscribedRef.current = true;
        trackPageVisit(location.pathname, null);
        channelManager.track(getVisitorData());
      }
    };
    
    const unsubscribe = channelManager.subscribe(callback);
    
    return () => {
      isSubscribedRef.current = false;
      unsubscribe();
    };
  }, [location.pathname, trackPageVisit, getVisitorData]);

  // Update presence when page changes or geolocation is fetched
  useEffect(() => {
    const previousPage = lastPageRef.current;
    
    if (isSubscribedRef.current) {
      if (previousPage !== location.pathname) {
        // Track the page transition
        trackPageVisit(location.pathname, previousPage);
        lastPageRef.current = location.pathname;
      }
      channelManager.track(getVisitorData());
    }
  }, [location.pathname, user, geolocation, trackPageVisit, getVisitorData]);

  // Update session duration periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (isSubscribedRef.current) {
        channelManager.track(getVisitorData());
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [getVisitorData]);
}
