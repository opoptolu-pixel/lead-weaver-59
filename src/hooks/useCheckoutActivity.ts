import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CheckoutSession {
  leadId: string;
  visitorId: string;
  startedAt: string;
}

export const useCheckoutActivity = () => {
  const [activeCheckouts, setActiveCheckouts] = useState<CheckoutSession[]>([]);
  const [checkoutCount, setCheckoutCount] = useState(0);

  useEffect(() => {
    const channel = supabase.channel("admin-checkout-monitor", {
      config: {
        presence: {
          key: "admin-monitor",
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const sessions: CheckoutSession[] = [];
        
        // Collect all active checkout sessions
        Object.entries(state).forEach(([key, presences]) => {
          // Skip admin monitor's own presence
          if (key === "admin-monitor") return;
          
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
        
        setActiveCheckouts(sessions);
        setCheckoutCount(sessions.length);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        if (key === "admin-monitor") return;
        
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
          setCheckoutCount(updated.length);
          return updated;
        });
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        if (key === "admin-monitor") return;
        
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    activeCheckouts,
    checkoutCount,
  };
};

export default useCheckoutActivity;
