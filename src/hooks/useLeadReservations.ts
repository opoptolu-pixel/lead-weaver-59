import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LeadReservation {
  leadId: string;
  expiresAt: string;
  reservedByMe: boolean;
}

// Generate a stable visitor ID that persists across page loads
const getOrCreateVisitorId = (userId?: string): string => {
  if (userId) return `user-${userId}`;
  
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
  const visitorIdRef = useRef<string>(getOrCreateVisitorId(userId));
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch all active reservations from database
  const fetchReservations = useCallback(async (leadIds: string[]) => {
    if (leadIds.length === 0) return;
    
    const visitorId = visitorIdRef.current;
    const newReservedLeads = new Map<string, LeadReservation>();
    
    // Check each lead for active reservations
    for (const leadId of leadIds) {
      try {
        const { data, error } = await supabase.rpc('check_lead_reservation', {
          p_lead_id: leadId,
          p_visitor_id: visitorId
        });
        
        if (error) {
          console.error('[LeadReservations] Error checking reservation:', error);
          continue;
        }
        
        const result = data?.[0];
        if (result?.is_reserved && !result?.reserved_by_me) {
          newReservedLeads.set(leadId, {
            leadId,
            expiresAt: result.expires_at,
            reservedByMe: false
          });
        }
      } catch (err) {
        console.error('[LeadReservations] Error:', err);
      }
    }
    
    setReservedLeads(newReservedLeads);
  }, []);

  // Reserve a lead when user starts checkout
  const reserveLead = useCallback(async (leadId: string): Promise<{ success: boolean; message: string }> => {
    const visitorId = visitorIdRef.current;
    
    try {
      const { data, error } = await supabase.rpc('reserve_lead', {
        p_lead_id: leadId,
        p_visitor_id: visitorId
      });
      
      if (error) {
        console.error('[LeadReservations] Reserve error:', error);
        return { success: false, message: error.message };
      }
      
      const result = data?.[0];
      if (!result?.success) {
        return { success: false, message: result?.message || 'Failed to reserve lead' };
      }
      
      setMyReservedLeadId(leadId);
      return { success: true, message: result.message };
    } catch (err) {
      console.error('[LeadReservations] Reserve exception:', err);
      return { success: false, message: 'Failed to reserve lead' };
    }
  }, []);

  // Release reservation (mark as expired)
  const releaseLead = useCallback(async () => {
    setMyReservedLeadId(null);
  }, []);

  // Check if a specific lead is reserved by someone else
  const isLeadReserved = useCallback((leadId: string): boolean => {
    return reservedLeads.has(leadId);
  }, [reservedLeads]);

  // Check single lead reservation status
  const checkLeadReservation = useCallback(async (leadId: string): Promise<{ isReserved: boolean; reservedByMe: boolean; expiresAt?: string }> => {
    const visitorId = visitorIdRef.current;
    
    try {
      const { data, error } = await supabase.rpc('check_lead_reservation', {
        p_lead_id: leadId,
        p_visitor_id: visitorId
      });
      
      if (error) {
        console.error('[LeadReservations] Check error:', error);
        return { isReserved: false, reservedByMe: false };
      }
      
      const result = data?.[0];
      return {
        isReserved: result?.is_reserved || false,
        reservedByMe: result?.reserved_by_me || false,
        expiresAt: result?.expires_at
      };
    } catch (err) {
      console.error('[LeadReservations] Check exception:', err);
      return { isReserved: false, reservedByMe: false };
    }
  }, []);

  // Set up periodic refresh to update reservation status
  useEffect(() => {
    // Refresh every 10 seconds to check for expired reservations
    refreshIntervalRef.current = setInterval(() => {
      setReservedLeads(prev => {
        const now = new Date();
        const filtered = new Map<string, LeadReservation>();
        prev.forEach((reservation, leadId) => {
          if (new Date(reservation.expiresAt) > now) {
            filtered.set(leadId, reservation);
          }
        });
        return filtered;
      });
    }, 10000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  return {
    reservedLeads,
    reserveLead,
    releaseLead,
    isLeadReserved,
    myReservedLeadId,
    fetchReservations,
    checkLeadReservation,
    visitorId: visitorIdRef.current,
  };
};

export default useLeadReservations;
