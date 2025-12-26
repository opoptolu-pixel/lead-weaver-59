import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Users, Globe, Monitor, Smartphone, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Visitor {
  visitorId: string;
  currentPage: string;
  userAgent: string;
  joinedAt: string;
  isAuthenticated: boolean;
  userId?: string;
}

interface PresenceState {
  [key: string]: Visitor[];
}

const getDeviceType = (userAgent: string): "desktop" | "mobile" | "tablet" => {
  if (/tablet|ipad/i.test(userAgent)) return "tablet";
  if (/mobile|android|iphone/i.test(userAgent)) return "mobile";
  return "desktop";
};

const getPageName = (path: string): string => {
  const pathMap: Record<string, string> = {
    "/": "Homepage",
    "/for-cleaners": "For Cleaners",
    "/request-cleaning": "Request Form",
    "/leads": "Browse Leads",
    "/auth": "Login/Signup",
    "/dashboard": "Dashboard",
    "/settings": "Settings",
    "/billing": "Billing",
    "/contact": "Contact",
    "/blog": "Blog",
  };
  
  if (path.startsWith("/admin")) return "Admin Panel";
  if (path.startsWith("/blog/")) return "Blog Article";
  
  return pathMap[path] || path;
};

export function LiveVisitorsCard() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [pageBreakdown, setPageBreakdown] = useState<Record<string, number>>({});

  useEffect(() => {
    const channel = supabase.channel("site-visitors", {
      config: {
        presence: {
          key: "visitors",
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as PresenceState;
        const allVisitors: Visitor[] = [];
        
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            allVisitors.push(presence);
          });
        });
        
        setVisitors(allVisitors);
        
        // Calculate page breakdown
        const breakdown: Record<string, number> = {};
        allVisitors.forEach((v) => {
          const page = getPageName(v.currentPage);
          breakdown[page] = (breakdown[page] || 0) + 1;
        });
        setPageBreakdown(breakdown);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        console.log("Visitor joined:", newPresences);
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        console.log("Visitor left:", leftPresences);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const desktopCount = visitors.filter(v => getDeviceType(v.userAgent) === "desktop").length;
  const mobileCount = visitors.filter(v => getDeviceType(v.userAgent) === "mobile").length;
  const authenticatedCount = visitors.filter(v => v.isAuthenticated).length;

  return (
    <Card className="relative overflow-hidden">
      {/* Live indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
        <span className="text-xs text-muted-foreground font-medium">LIVE</span>
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Eye className="w-5 h-5 text-secondary" />
          Live Visitors
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main count */}
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-foreground">{visitors.length}</span>
          <span className="text-sm text-muted-foreground">on site now</span>
        </div>

        {/* Device breakdown */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Monitor className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground font-medium">{desktopCount}</span>
            <span className="text-muted-foreground">desktop</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground font-medium">{mobileCount}</span>
            <span className="text-muted-foreground">mobile</span>
          </div>
        </div>

        {/* Auth breakdown */}
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            <span className="text-foreground font-medium">{authenticatedCount}</span> logged in,{" "}
            <span className="text-foreground font-medium">{visitors.length - authenticatedCount}</span> guests
          </span>
        </div>

        {/* Page breakdown */}
        {Object.keys(pageBreakdown).length > 0 && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">PAGE BREAKDOWN</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(pageBreakdown)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([page, count]) => (
                  <Badge 
                    key={page} 
                    variant="secondary" 
                    className="text-xs font-normal"
                  >
                    {page}: {count}
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {/* Recent visitors list */}
        {visitors.length > 0 && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">RECENT ACTIVITY</span>
            </div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {visitors
                .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
                .slice(0, 5)
                .map((visitor, idx) => (
                  <div 
                    key={visitor.visitorId || idx} 
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {getDeviceType(visitor.userAgent) === "mobile" ? (
                        <Smartphone className="w-3 h-3 text-muted-foreground" />
                      ) : (
                        <Monitor className="w-3 h-3 text-muted-foreground" />
                      )}
                      <span className="text-muted-foreground">
                        {visitor.isAuthenticated ? "User" : "Guest"} on{" "}
                        <span className="text-foreground">{getPageName(visitor.currentPage)}</span>
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(visitor.joinedAt), { addSuffix: false })}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {visitors.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No active visitors right now
          </div>
        )}
      </CardContent>
    </Card>
  );
}
