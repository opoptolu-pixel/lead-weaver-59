import { useState, useEffect } from "react";
import { Zap, Clock, MapPin, Briefcase, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface CheckoutSession {
  leadId: string;
  visitorId: string;
  startedAt: string;
}

interface LeadDetails {
  id: string;
  postcode: string;
  job_type: string;
  display_value: string;
}

interface LiveCheckoutsPanelProps {
  activeCheckouts: CheckoutSession[];
  checkoutCount: number;
}

export const LiveCheckoutsPanel = ({ activeCheckouts, checkoutCount }: LiveCheckoutsPanelProps) => {
  const [leadDetails, setLeadDetails] = useState<Map<string, LeadDetails>>(new Map());
  const [, setTick] = useState(0);

  // Fetch lead details for active checkouts
  useEffect(() => {
    const fetchLeadDetails = async () => {
      if (activeCheckouts.length === 0) {
        setLeadDetails(new Map());
        return;
      }

      const leadIds = activeCheckouts.map(c => c.leadId);
      const { data } = await supabase
        .from("leads")
        .select("id, postcode, job_type, display_value")
        .in("id", leadIds);

      if (data) {
        const detailsMap = new Map<string, LeadDetails>();
        data.forEach(lead => {
          detailsMap.set(lead.id, lead);
        });
        setLeadDetails(detailsMap);
      }
    };

    fetchLeadDetails();
  }, [activeCheckouts]);

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getElapsedTime = (startedAt: string) => {
    try {
      return formatDistanceToNow(new Date(startedAt), { addSuffix: false, includeSeconds: true });
    } catch {
      return "just now";
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Zap className={`w-5 h-5 ${checkoutCount > 0 ? "text-green-500" : "text-muted-foreground"}`} />
            {checkoutCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            )}
          </div>
          <h3 className="font-heading font-semibold text-foreground">Live Checkouts</h3>
        </div>
        <Badge variant={checkoutCount > 0 ? "default" : "secondary"} className={checkoutCount > 0 ? "bg-green-500" : ""}>
          {checkoutCount} active
        </Badge>
      </div>

      {checkoutCount === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No active checkouts right now</p>
          <p className="text-xs mt-1">Checkouts will appear here in real-time</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeCheckouts.map((checkout) => {
            const lead = leadDetails.get(checkout.leadId);
            return (
              <div
                key={checkout.leadId}
                className="flex items-center justify-between p-3 bg-green-500/5 border border-green-500/20 rounded-lg animate-pulse-slow"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    {lead ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {lead.postcode}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {lead.display_value}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          {lead.job_type}
                        </p>
                      </>
                    ) : (
                      <div className="animate-pulse">
                        <div className="h-4 w-20 bg-muted rounded mb-1"></div>
                        <div className="h-3 w-32 bg-muted rounded"></div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-amber-500">
                    <Clock className="w-4 h-4" />
                    <span className="font-mono text-sm font-medium">
                      {getElapsedTime(checkout.startedAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    in checkout
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {checkoutCount > 0 && (
        <p className="text-xs text-muted-foreground text-center mt-4">
          Potential revenue: <span className="font-semibold text-green-500">£{checkoutCount * 20}</span>
        </p>
      )}
    </div>
  );
};

export default LiveCheckoutsPanel;
