import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Generate a unique visitor ID per session
const getVisitorId = (): string => {
  let visitorId = sessionStorage.getItem("visitor_id");
  if (!visitorId) {
    visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem("visitor_id", visitorId);
  }
  return visitorId;
};

export function useVisitorPresence() {
  const location = useLocation();
  const { user } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const visitorId = getVisitorId();

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
        await channel.track({
          visitorId,
          currentPage: location.pathname,
          userAgent: navigator.userAgent,
          joinedAt: new Date().toISOString(),
          isAuthenticated: !!user,
          userId: user?.id || null,
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
    if (channelRef.current) {
      channelRef.current.track({
        visitorId,
        currentPage: location.pathname,
        userAgent: navigator.userAgent,
        joinedAt: new Date().toISOString(),
        isAuthenticated: !!user,
        userId: user?.id || null,
      });
    }
  }, [location.pathname, user]);
}
