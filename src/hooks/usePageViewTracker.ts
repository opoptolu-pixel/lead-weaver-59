import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Routes that should NOT be tracked (admin and authenticated areas)
const EXCLUDED_ROUTES = [
  "/admin",
  "/dashboard",
  "/leads",
  "/settings",
  "/billing",
  "/disputes",
  "/performance",
  "/verification",
  "/onboarding",
  "/auth",
  "/credits-success",
  "/payment-success",
];

interface GeoLocation {
  city: string;
  region: string;
  country: string;
}

// Get visitor ID from session storage
const getVisitorId = (): string => {
  if (typeof window === "undefined") return "ssr_visitor";
  
  let visitorId = sessionStorage.getItem("visitor_id");
  if (!visitorId) {
    visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem("visitor_id", visitorId);
  }
  return visitorId;
};

// Get session ID (new per browser session)
const getSessionId = (): string => {
  if (typeof window === "undefined") return "ssr_session";
  
  let sessionId = sessionStorage.getItem("session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem("session_id", sessionId);
  }
  return sessionId;
};

// Get cached geolocation
const getCachedGeolocation = (): GeoLocation | null => {
  if (typeof window === "undefined") return null;
  
  try {
    const cached = sessionStorage.getItem("visitor_geolocation");
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

// Detect device type from user agent
const getDeviceType = (userAgent: string): "desktop" | "mobile" | "tablet" => {
  if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
    return "tablet";
  }
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)) {
    return "mobile";
  }
  return "desktop";
};

// Get page title
const getPageTitle = (path: string): string => {
  const pageTitles: Record<string, string> = {
    "/": "Home",
    "/request-cleaning": "Request Cleaning",
    "/for-cleaners": "For Cleaners",
    "/contact": "Contact",
    "/blog": "Blog",
    "/privacy-policy": "Privacy Policy",
    "/terms-of-use": "Terms of Use",
    "/gdpr": "GDPR",
    "/refund-policy": "Refund Policy",
  };
  return pageTitles[path] || document.title || path;
};

export function usePageViewTracker() {
  const location = useLocation();
  const lastPageRef = useRef<string | null>(null);
  const pageEnterTimeRef = useRef<number>(Date.now());
  const lastPageViewIdRef = useRef<string | null>(null);

  // Update time_on_page for the previous page view
  const updateTimeOnPage = useCallback(async (pageViewId: string, timeOnPage: number) => {
    try {
      await supabase
        .from("page_views")
        .update({ time_on_page: timeOnPage })
        .eq("id", pageViewId);
    } catch (error) {
      console.warn("Failed to update time on page:", error);
    }
  }, []);

  // Record a page view
  const recordPageView = useCallback(async (pagePath: string): Promise<string | null> => {
    const visitorId = getVisitorId();
    const sessionId = getSessionId();
    const userAgent = navigator.userAgent;
    const deviceType = getDeviceType(userAgent);
    const geo = getCachedGeolocation();
    const pageTitle = getPageTitle(pagePath);

    try {
      const { data, error } = await supabase
        .from("page_views")
        .insert({
          visitor_id: visitorId,
          session_id: sessionId,
          page_path: pagePath,
          page_title: pageTitle,
          device_type: deviceType,
          referrer: document.referrer || null,
          city: geo?.city || null,
          region: geo?.region || null,
          country: geo?.country || null,
          user_agent: userAgent,
          time_on_page: 0,
        })
        .select("id")
        .single();

      if (error) {
        console.warn("Failed to record page view:", error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.warn("Failed to record page view:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    const currentPath = location.pathname;
    
    // Check if route should be excluded
    const isExcludedRoute = EXCLUDED_ROUTES.some(
      (route) => currentPath === route || currentPath.startsWith(`${route}/`)
    );

    if (isExcludedRoute) {
      return;
    }

    // Update time on previous page if exists
    if (lastPageRef.current && lastPageViewIdRef.current && lastPageRef.current !== currentPath) {
      const timeOnPage = Math.round((Date.now() - pageEnterTimeRef.current) / 1000);
      updateTimeOnPage(lastPageViewIdRef.current, timeOnPage);
    }

    // Record new page view
    lastPageRef.current = currentPath;
    pageEnterTimeRef.current = Date.now();
    
    recordPageView(currentPath).then((id) => {
      lastPageViewIdRef.current = id;
    });

    // Update time on page when user leaves
    const handleBeforeUnload = () => {
      if (lastPageViewIdRef.current) {
        const timeOnPage = Math.round((Date.now() - pageEnterTimeRef.current) / 1000);
        // Use sendBeacon with proper headers for reliable delivery on page unload
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/page_views?id=eq.${lastPageViewIdRef.current}`;
        const blob = new Blob(
          [JSON.stringify({ time_on_page: timeOnPage })],
          { type: "application/json" }
        );
        // sendBeacon doesn't support custom headers, so fall back to keepalive fetch
        fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ time_on_page: timeOnPage }),
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [location.pathname, recordPageView, updateTimeOnPage]);
}
