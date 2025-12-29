import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface LeadReservation {
  leadId: string;
  visitorId: string;
  startedAt: string;
}

const RESERVATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Generate a stable visitor ID that persists across renders
const getOrCreateVisitorId = (userId?: string): string => {
  if (userId) return `user-${userId}`;
  
  // Check sessionStorage for existing visitor ID
  const storageKey = 'lead-reservation-visitor-id';
  let storedId = sessionStorage.getItem(storageKey);
  
  if (!storedId) {
    storedId = `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(storageKey, storedId);
  }
  
  return storedId;
};

export const useLeadReservations = (userId?: string) => {
  const [reservedLeads, setReservedLeads] = useState<Map<string, LeadReservation>>(new Map());
  const [myReservedLeadId, setMyReservedLeadId] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const myVisitorIdRef = useRef<string>(getOrCreateVisitorId(userId));
  const timeoutCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Filter out expired reservations (older than 5 minutes)
  const filterExpiredReservations = useCallback((reservations: Map<string, LeadReservation>) => {
    const now = Date.now();
    const filtered = new Map<string, LeadReservation>();
    
    reservations.forEach((reservation, leadId) => {
      const reservationTime = new Date(reservation.startedAt).getTime();
      if (now - reservationTime < RESERVATION_TIMEOUT_MS) {
        filtered.set(leadId, reservation);
      }
    });
    
    return filtered;
  }, []);

  useEffect(() => {
    const myVisitorId = myVisitorIdRef.current;
    console.log('[LeadReservations] Initializing with visitorId:', myVisitorId);
    
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
        console.log('[LeadReservations] Presence sync, full state:', JSON.stringify(state));
        const newReservedLeads = new Map<string, LeadReservation>();
        
        // Aggregate all reservations from all users (excluding self)
        Object.entries(state).forEach(([key, presences]) => {
          (presences as any[]).forEach((presence) => {
            console.log('[LeadReservations] Processing presence:', presence, 'myVisitorId:', myVisitorId);
            // Skip current user's reservations - they shouldn't see their own as "reserved"
            if (presence.visitorId && presence.visitorId !== myVisitorId && presence.leadId) {
              console.log('[LeadReservations] Adding reservation for lead:', presence.leadId);
              newReservedLeads.set(presence.leadId, {
                leadId: presence.leadId,
                visitorId: presence.visitorId,
                startedAt: presence.startedAt,
              });
            }
          });
        });
        
        console.log('[LeadReservations] Reserved leads after sync:', newReservedLeads.size);
        // Filter out expired reservations
        setReservedLeads(filterExpiredReservations(newReservedLeads));
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        console.log('[LeadReservations] Presence join:', key, newPresences);
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
          return filterExpiredReservations(updated);
        });
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        console.log('[LeadReservations] Presence leave:', key, leftPresences);
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
      .subscribe((status) => {
        console.log('[LeadReservations] Channel subscription status:', status);
      });

    channelRef.current = reservationChannel;

    // Set up periodic check to filter expired reservations
    timeoutCheckRef.current = setInterval(() => {
      setReservedLeads(prev => filterExpiredReservations(prev));
    }, 30000); // Check every 30 seconds

    return () => {
      console.log('[LeadReservations] Cleaning up channel');
      supabase.removeChannel(reservationChannel);
      if (timeoutCheckRef.current) {
        clearInterval(timeoutCheckRef.current);
      }
    };
  }, [userId, filterExpiredReservations]);

  // Reserve a lead when user starts checkout - use consistent visitor ID
  const reserveLead = useCallback(
    async (leadId: string) => {
      const channel = channelRef.current;
      if (!channel) {
        console.log('[LeadReservations] No channel available for reserving lead');
        return;
      }
      
      const myVisitorId = myVisitorIdRef.current;
      console.log('[LeadReservations] Reserving lead:', leadId, 'with visitorId:', myVisitorId);
      
      const trackResult = await channel.track({
        leadId,
        visitorId: myVisitorId,
        startedAt: new Date().toISOString(),
      });
      
      console.log('[LeadReservations] Track result:', trackResult);
      
      setMyReservedLeadId(leadId);
      
      // Auto-release after 5 minutes
      setTimeout(() => {
        console.log('[LeadReservations] Auto-releasing lead after timeout');
        releaseLead();
      }, RESERVATION_TIMEOUT_MS);
    },
    []
  );

  // Release reservation when checkout completes or is cancelled
  const releaseLead = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel) {
      console.log('[LeadReservations] No channel available for releasing lead');
      return;
    }
    console.log('[LeadReservations] Releasing lead reservation');
    await channel.untrack();
    setMyReservedLeadId(null);
  }, []);

  // Check if a specific lead is reserved by someone else
  const isLeadReserved = useCallback(
    (leadId: string): boolean => {
      const reserved = reservedLeads.has(leadId);
      console.log('[LeadReservations] isLeadReserved check:', leadId, reserved, 'reservedLeads size:', reservedLeads.size);
      return reserved;
    },
    [reservedLeads]
  );

  return {
    reservedLeads,
    reserveLead,
    releaseLead,
    isLeadReserved,
    myReservedLeadId,
  };
};

export default useLeadReservations;
