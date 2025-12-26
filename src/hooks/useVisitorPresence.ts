import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PageVisit {
  page: string;
  enteredAt: string;
  leftAt?: string;
  timeSpent?: number;
}

// Generate a unique visitor ID per session
const getVisitorId = (): string => {
  let visitorId = sessionStorage.getItem("visitor_id");
  if (!visitorId) {
    visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem("visitor_id", visitorId);
  }
  return visitorId;
};

// Store page history in session storage
const getPageHistory = (): PageVisit[] => {
  try {
    const history = sessionStorage.getItem("page_history");
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
};

const savePageHistory = (history: PageVisit[]) => {
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const visitorId = getVisitorId();
  const lastPageRef = useRef<string | null>(null);
  const pageEnterTimeRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number>(Date.now());

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

  useEffect(() => {
    const channel = supabase.channel("site-visitors", {
      config: {
        presence: {
          key: visitorId,
        },
      },
    });

    channelRef.current = channel;

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // Track initial page visit
        trackPageVisit(location.pathname, null);
        
        await channel.track({
          visitorId,
          currentPage: location.pathname,
          userAgent: navigator.userAgent,
          joinedAt: new Date().toISOString(),
          isAuthenticated: !!user,
          userId: user?.id || null,
          pageHistory: getPageHistory(),
          sessionDuration: getSessionDuration(),
        });
      }
    });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  // Update presence when page changes
  useEffect(() => {
    const previousPage = lastPageRef.current;
    
    if (previousPage !== location.pathname) {
      // Track the page transition
      trackPageVisit(location.pathname, previousPage);
      lastPageRef.current = location.pathname;
      
      if (channelRef.current) {
        channelRef.current.track({
          visitorId,
          currentPage: location.pathname,
          userAgent: navigator.userAgent,
          joinedAt: new Date().toISOString(),
          isAuthenticated: !!user,
          userId: user?.id || null,
          pageHistory: getPageHistory(),
          sessionDuration: getSessionDuration(),
        });
      }
    }
  }, [location.pathname, user, trackPageVisit, getSessionDuration]);

  // Update session duration periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (channelRef.current) {
        channelRef.current.track({
          visitorId,
          currentPage: location.pathname,
          userAgent: navigator.userAgent,
          joinedAt: new Date().toISOString(),
          isAuthenticated: !!user,
          userId: user?.id || null,
          pageHistory: getPageHistory(),
          sessionDuration: getSessionDuration(),
        });
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [location.pathname, user, getSessionDuration]);
}
