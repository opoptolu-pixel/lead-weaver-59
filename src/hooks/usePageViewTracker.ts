import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Routes that should NOT be tracked (admin and authenticated areas)
const EXCLUDED_ROUTES = [
  "/admin",
  "/admin-login",
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
  "/support",
];

// Minimum seconds between recording the same page path
const DEDUP_INTERVAL_MS = 30_000;

// ── Helpers ──────────────────────────────────────────────

const getOrCreate = (key: string, factory: () => string): string => {
  if (typeof window === "undefined") return `ssr_${key}`;
  let val = sessionStorage.getItem(key);
  if (!val) {
    val = factory();
    sessionStorage.setItem(key, val);
  }
  return val;
};

const getVisitorId = () =>
  getOrCreate("visitor_id", () => `visitor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

const getSessionId = () =>
  getOrCreate("session_id", () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

interface CachedGeo {
  city: string;
  region: string;
  country: string;
}

const getCachedGeolocation = (): CachedGeo | null => {
  try {
    const cached = sessionStorage.getItem("visitor_geolocation");
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

const getDeviceType = (ua: string): "desktop" | "mobile" | "tablet" => {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
};

const PAGE_TITLES: Record<string, string> = {
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

const getPageTitle = (path: string): string =>
  PAGE_TITLES[path] || document.title || path;

// ── Deduplication ────────────────────────────────────────

/** Returns true if this page was recently recorded (prevents remount duplicates). */
const isDuplicate = (path: string): boolean => {
  try {
    const key = "pv_last_recorded";
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const { path: lastPath, ts } = JSON.parse(raw);
      if (lastPath === path && Date.now() - ts < DEDUP_INTERVAL_MS) {
        return true;
      }
    }
  } catch { /* ignore */ }
  return false;
};

const markRecorded = (path: string) => {
  try {
    sessionStorage.setItem("pv_last_recorded", JSON.stringify({ path, ts: Date.now() }));
  } catch { /* ignore */ }
};

// ── Hook ─────────────────────────────────────────────────

export function usePageViewTracker() {
  const location = useLocation();
  const lastPageRef = useRef<string | null>(null);
  const pageEnterTimeRef = useRef<number>(Date.now());
  const lastPageViewIdRef = useRef<string | null>(null);

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

  const recordPageView = useCallback(async (pagePath: string): Promise<string | null> => {
    // Dedup: skip if this exact page was recorded very recently
    if (isDuplicate(pagePath)) {
      return null;
    }

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

      markRecorded(pagePath);
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

    if (isExcludedRoute) return;

    // Update time on previous page if navigating away
    if (lastPageRef.current && lastPageViewIdRef.current && lastPageRef.current !== currentPath) {
      const timeOnPage = Math.round((Date.now() - pageEnterTimeRef.current) / 1000);
      updateTimeOnPage(lastPageViewIdRef.current, timeOnPage);
    }

    // Record new page view
    lastPageRef.current = currentPath;
    pageEnterTimeRef.current = Date.now();

    recordPageView(currentPath).then((id) => {
      if (id) lastPageViewIdRef.current = id;
    });

    // Update time on page when user leaves the site
    const handleBeforeUnload = () => {
      if (lastPageViewIdRef.current) {
        const timeOnPage = Math.round((Date.now() - pageEnterTimeRef.current) / 1000);
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/page_views?id=eq.${lastPageViewIdRef.current}`;
        fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            Prefer: "return=minimal",
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
