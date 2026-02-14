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

// Minimum ms between recording the same page path
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

const uid = () => `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const getVisitorId = () => getOrCreate("visitor_id", () => `visitor_${uid()}`);
const getSessionId = () => getOrCreate("session_id", () => `session_${uid()}`);

interface CachedGeo { city: string; region: string; country: string }

const getCachedGeolocation = (): CachedGeo | null => {
  try {
    const cached = sessionStorage.getItem("visitor_geolocation");
    return cached ? JSON.parse(cached) : null;
  } catch { return null; }
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

const isDuplicate = (path: string): boolean => {
  try {
    const raw = sessionStorage.getItem("pv_last_recorded");
    if (raw) {
      const { path: lastPath, ts } = JSON.parse(raw);
      if (lastPath === path && Date.now() - ts < DEDUP_INTERVAL_MS) return true;
    }
  } catch { /* ignore */ }
  return false;
};

const markRecorded = (path: string, id: string) => {
  try {
    sessionStorage.setItem("pv_last_recorded", JSON.stringify({ path, ts: Date.now(), id }));
  } catch { /* ignore */ }
};

// ── Direct REST insert (bypasses .select() RLS issue) ────

const insertPageViewDirect = async (row: Record<string, unknown>): Promise<boolean> => {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/page_views`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(row),
    });
    return res.ok;
  } catch {
    return false;
  }
};

// ── Hook ─────────────────────────────────────────────────

export function usePageViewTracker() {
  const location = useLocation();
  const lastPageRef = useRef<string | null>(null);
  const pageEnterTimeRef = useRef<number>(Date.now());
  const lastPageViewIdRef = useRef<string | null>(null);

  const updateTimeOnPage = useCallback((pageViewId: string, timeOnPage: number) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/page_views?id=eq.${pageViewId}`;
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
  }, []);

  const recordPageView = useCallback(async (pagePath: string): Promise<string | null> => {
    if (isDuplicate(pagePath)) return null;

    // Generate a UUID client-side so we can reference it for time_on_page updates
    const id = crypto.randomUUID();
    const visitorId = getVisitorId();
    const sessionId = getSessionId();
    const userAgent = navigator.userAgent;
    const geo = getCachedGeolocation();

    const ok = await insertPageViewDirect({
      id,
      visitor_id: visitorId,
      session_id: sessionId,
      page_path: pagePath,
      page_title: getPageTitle(pagePath),
      device_type: getDeviceType(userAgent),
      referrer: document.referrer || null,
      city: geo?.city || null,
      region: geo?.region || null,
      country: geo?.country || null,
      user_agent: userAgent,
      time_on_page: 0,
    });

    if (ok) {
      markRecorded(pagePath, id);
      return id;
    }
    return null;
  }, []);

  useEffect(() => {
    const currentPath = location.pathname;

    const isExcludedRoute = EXCLUDED_ROUTES.some(
      (route) => currentPath === route || currentPath.startsWith(`${route}/`)
    );
    if (isExcludedRoute) return;

    // Update time on previous page if navigating away
    if (lastPageRef.current && lastPageViewIdRef.current && lastPageRef.current !== currentPath) {
      const timeOnPage = Math.round((Date.now() - pageEnterTimeRef.current) / 1000);
      updateTimeOnPage(lastPageViewIdRef.current, timeOnPage);
    }

    lastPageRef.current = currentPath;
    pageEnterTimeRef.current = Date.now();

    recordPageView(currentPath).then((id) => {
      if (id) lastPageViewIdRef.current = id;
    });

    // Update time on page when user leaves
    const handleBeforeUnload = () => {
      if (lastPageViewIdRef.current) {
        const timeOnPage = Math.round((Date.now() - pageEnterTimeRef.current) / 1000);
        updateTimeOnPage(lastPageViewIdRef.current, timeOnPage);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [location.pathname, recordPageView, updateTimeOnPage]);
}
