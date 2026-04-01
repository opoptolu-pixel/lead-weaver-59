import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, UserPlus, FileText, CreditCard } from "lucide-react";

interface ConversionPayload {
  eventType: string;
  new?: {
    id?: string;
    customer_name?: string;
    job_type?: string;
    postcode?: string;
    display_value?: string;
    business_name?: string;
    contact_name?: string;
  };
}

export function ConversionNotifications() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element for notification sound (optional)
    audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleAAANI/I3r5dAAE3lMXXwl0AAT2a0NXMXAA=");

    // Listen for new cleaning requests (leads)
    const leadsChannel = supabase
      .channel('conversion-leads')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads'
        },
        (payload: ConversionPayload) => {
          const lead = payload.new;
          if (lead) {
            // Play sound
            try {
              audioRef.current?.play().catch(() => {});
            } catch {}
            
            toast.success(
              <div className="flex items-start gap-3">
                <div className="p-2 bg-secondary/10 rounded-lg shrink-0">
                  <Sparkles className="w-4 h-4 text-secondary" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold">New Cleaning Request!</span>
                  <span className="text-sm text-muted-foreground">
                    {lead.job_type} in {lead.postcode}
                  </span>
                  <span className="text-xs text-muted-foreground mt-0.5">
                    {lead.display_value}
                  </span>
                </div>
              </div>,
              {
                duration: 8000,
                className: "border-secondary/20",
              }
            );
          }
        }
      )
      .subscribe();

    // Listen for new business signups
    const profilesChannel = supabase
      .channel('conversion-profiles')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          // Play sound
          try {
            audioRef.current?.play().catch(() => {});
          } catch {}
          
          toast.success(
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                <UserPlus className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold">New Cleaner Signup!</span>
                <span className="text-sm text-muted-foreground">
                  A new cleaning business just registered
                </span>
              </div>
            </div>,
            {
              duration: 8000,
              className: "border-blue-500/20",
            }
          );
        }
      )
      .subscribe();

    // Listen for lead purchases
    const purchasesChannel = supabase
      .channel('conversion-purchases')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads',
          filter: 'is_unlocked=eq.true'
        },
        (payload: { old?: { is_unlocked?: boolean }; new?: { is_unlocked?: boolean; job_type?: string; postcode?: string } }) => {
          // Only notify when lead was just unlocked (was false, now true)
          if (payload.old && !payload.old.is_unlocked && payload.new?.is_unlocked) {
            const lead = payload.new;
            
            // Play sound
            try {
              audioRef.current?.play().catch(() => {});
            } catch {}
            
            toast.success(
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
                  <CreditCard className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold">Lead Purchased! 💰</span>
                  <span className="text-sm text-muted-foreground">
                    {lead.job_type} in {lead.postcode}
                  </span>
                   <span className="text-xs text-secondary font-medium mt-0.5">
                    +£12 revenue
                  </span>
                </div>
              </div>,
              {
                duration: 8000,
                className: "border-amber-500/20",
              }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(purchasesChannel);
    };
  }, []);

  return null;
}
