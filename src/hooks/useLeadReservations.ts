import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface LeadReservation {
  leadId: string;
  visitorId: string;
  startedAt: string;
}

export const useLeadReservations = (visitorId?: string) => {
  const [reservedLeads, setReservedLeads] = useState<Map<string, LeadReservation>>(new Map());
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    // Generate a unique visitor ID if not provided
    const myVisitorId = visitorId || `visitor-${Math.random().toString(36).slice(2)}`;
    
    const reservationChannel = supabase.channel("lead-reservations", {
      config: {
        presence: {
          key: myVisitorId,
        },
      },
    });

    reservationChannel
      .on("presence", { event: "sync" }, () => {
        const state = reservationChannel.presenceState();
        const newReservedLeads = new Map<string, LeadReservation>();
        
        // Aggregate all reservations from all users
        Object.entries(state).forEach(([key, presences]) => {
          (presences as any[]).forEach((presence) => {
            // Don't show current user's reservations as "reserved by others"
            if (presence.visitorId && presence.visitorId !== myVisitorId && presence.leadId) {
              newReservedLeads.set(presence.leadId, {
                leadId: presence.leadId,
                visitorId: presence.visitorId,
                startedAt: presence.startedAt,
              });
            }
          });
        });
        
        setReservedLeads(newReservedLeads);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        setReservedLeads((prev) => {
          const updated = new Map(prev);
          (newPresences as any[]).forEach((presence) => {
            if (presence.visitorId && presence.visitorId !== myVisitorId && presence.leadId) {
              updated.set(presence.leadId, {
                leadId: presence.leadId,
                visitorId: presence.visitorId,
                startedAt: presence.startedAt,
              });
            }
          });
          return updated;
        });
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        setReservedLeads((prev) => {
          const updated = new Map(prev);
          (leftPresences as any[]).forEach((presence) => {
            if (presence.leadId) {
              updated.delete(presence.leadId);
            }
          });
          return updated;
        });
      })
      .subscribe();

    setChannel(reservationChannel);

    return () => {
      supabase.removeChannel(reservationChannel);
    };
  }, [visitorId]);

  // Reserve a lead when user starts checkout
  const reserveLead = useCallback(
    async (leadId: string) => {
      if (!channel) return;
      
      const visitorIdToUse = visitorId || `visitor-${Math.random().toString(36).slice(2)}`;
      
      await channel.track({
        leadId,
        visitorId: visitorIdToUse,
        startedAt: new Date().toISOString(),
      });
    },
    [channel, visitorId]
  );

  // Release reservation when checkout completes or is cancelled
  const releaseLead = useCallback(async () => {
    if (!channel) return;
    await channel.untrack();
  }, [channel]);

  // Check if a specific lead is reserved by someone else
  const isLeadReserved = useCallback(
    (leadId: string): boolean => {
      return reservedLeads.has(leadId);
    },
    [reservedLeads]
  );

  return {
    reservedLeads,
    reserveLead,
    releaseLead,
    isLeadReserved,
  };
};

export default useLeadReservations;
