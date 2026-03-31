import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CheckoutSession {
  leadId: string;
  visitorId: string;
  startedAt: string;
}

const RESERVATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const useCheckoutActivity = () => {
  const [activeCheckouts, setActiveCheckouts] = useState<CheckoutSession[]>([]);
  const [checkoutCount, setCheckoutCount] = useState(0);
  const timeoutCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Filter out expired checkouts (older than 5 minutes)
  const filterExpiredCheckouts = useCallback((sessions: CheckoutSession[]) => {
    const now = Date.now();
    return sessions.filter(session => {
      const sessionTime = new Date(session.startedAt).getTime();
      return now - sessionTime < RESERVATION_TIMEOUT_MS;
    });
  }, []);

  useEffect(() => {
    // Listen to the same channel as the user-facing reservation hook
    const channel = supabase.channel("lead-reservations", {
      config: {
        presence: {
          key: "admin-monitor-" + Math.random().toString(36).slice(2),
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const sessions: CheckoutSession[] = [];
        
        // Collect all active checkout sessions
        Object.entries(state).forEach(([key, presences]) => {
          // Skip admin monitors
          if (key.startsWith("admin-monitor")) return;
          
          (presences as any[]).forEach((presence) => {
            if (presence.leadId) {
              sessions.push({
                leadId: presence.leadId,
                visitorId: presence.visitorId || key,
                startedAt: presence.startedAt || new Date().toISOString(),
              });
            }
          });
        });
        
        const filtered = filterExpiredCheckouts(sessions);
        setActiveCheckouts(filtered);
        setCheckoutCount(filtered.length);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        if (key.startsWith("admin-monitor")) return;
        
        setActiveCheckouts((prev) => {
          const updated = [...prev];
          (newPresences as any[]).forEach((presence) => {
            if (presence.leadId && !updated.some(s => s.leadId === presence.leadId)) {
              updated.push({
                leadId: presence.leadId,
                visitorId: presence.visitorId || key,
                startedAt: presence.startedAt || new Date().toISOString(),
              });
            }
          });
          const filtered = filterExpiredCheckouts(updated);
          setCheckoutCount(filtered.length);
          return filtered;
        });
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        if (key.startsWith("admin-monitor")) return;
        
        setActiveCheckouts((prev) => {
          const leadIdsToRemove = new Set(
            (leftPresences as any[])
              .filter(p => p.leadId)
              .map(p => p.leadId)
          );
          const updated = prev.filter(s => !leadIdsToRemove.has(s.leadId));
          setCheckoutCount(updated.length);
          return updated;
        });
      })
      .subscribe();

    // Periodic cleanup of expired checkouts
    timeoutCheckRef.current = setInterval(() => {
      setActiveCheckouts(prev => {
        const filtered = filterExpiredCheckouts(prev);
        setCheckoutCount(filtered.length);
        return filtered;
      });
    }, 30000); // Check every 30 seconds

    return () => {
      supabase.removeChannel(channel);
      if (timeoutCheckRef.current) {
        clearInterval(timeoutCheckRef.current);
      }
    };
  }, [filterExpiredCheckouts]);

  return {
    activeCheckouts,
    checkoutCount,
  };
};

export default useCheckoutActivity;
