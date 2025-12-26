import { useState, useEffect } from "react";
import { useVisitorData, Visitor } from "@/hooks/useVisitorData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Eye, 
  Users, 
  Globe, 
  Monitor, 
  Smartphone, 
  Clock, 
  TrendingUp,
  Activity,
  MapPin
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

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

const getPageColor = (page: string): string => {
  const colorMap: Record<string, string> = {
    "Homepage": "bg-blue-500/10 text-blue-600 border-blue-200",
    "For Cleaners": "bg-purple-500/10 text-purple-600 border-purple-200",
    "Request Form": "bg-secondary/10 text-secondary border-secondary/30",
    "Browse Leads": "bg-amber-500/10 text-amber-600 border-amber-200",
    "Login/Signup": "bg-slate-500/10 text-slate-600 border-slate-200",
    "Dashboard": "bg-indigo-500/10 text-indigo-600 border-indigo-200",
    "Admin Panel": "bg-red-500/10 text-red-600 border-red-200",
  };
  return colorMap[page] || "bg-muted text-muted-foreground border-border";
};

export function LiveVisitorsCard() {
  const visitors = useVisitorData();
  const [pageBreakdown, setPageBreakdown] = useState<Record<string, number>>({});
  const [avgSessionDuration, setAvgSessionDuration] = useState(0);
  const [peakVisitors, setPeakVisitors] = useState(0);

  useEffect(() => {
    // Track peak visitors
    if (visitors.length > peakVisitors) {
      setPeakVisitors(visitors.length);
    }
    
    // Calculate page breakdown
    const breakdown: Record<string, number> = {};
    visitors.forEach((v) => {
      const page = getPageName(v.currentPage);
      breakdown[page] = (breakdown[page] || 0) + 1;
    });
    setPageBreakdown(breakdown);
    
    // Calculate average session duration
    const now = new Date().getTime();
    const durations = visitors.map(v => {
      const joinedTime = new Date(v.joinedAt).getTime();
      return (now - joinedTime) / 1000 / 60; // in minutes
    });
    if (durations.length > 0) {
      setAvgSessionDuration(durations.reduce((a, b) => a + b, 0) / durations.length);
    }
  }, [visitors, peakVisitors]);

  const desktopCount = visitors.filter(v => getDeviceType(v.userAgent) === "desktop").length;
  const mobileCount = visitors.filter(v => getDeviceType(v.userAgent) === "mobile").length;
  const authenticatedCount = visitors.filter(v => v.isAuthenticated).length;

  const formatDuration = (minutes: number): string => {
    if (minutes < 1) return "< 1m";
    if (minutes < 60) return `${Math.round(minutes)}m`;
    return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
  };

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-card via-card to-muted/30 shadow-elevated">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 via-transparent to-primary/5 opacity-50" />
      
      {/* Live indicator with pulse animation */}
      <div className="absolute top-4 right-4 flex items-center gap-2 bg-secondary/10 px-3 py-1.5 rounded-full border border-secondary/20">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary"></span>
        </span>
        <span className="text-xs text-secondary font-semibold tracking-wide">LIVE</span>
      </div>

      <CardHeader className="pb-3 relative z-10">
        <CardTitle className="flex items-center gap-2.5 text-lg font-semibold">
          <div className="p-2 bg-secondary/10 rounded-lg">
            <Eye className="w-5 h-5 text-secondary" />
          </div>
          <span>Live Visitors</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5 relative z-10">
        {/* Main count with animation */}
        <div className="flex items-end gap-3">
          <div className="relative">
            <span className={cn(
              "text-5xl font-bold tracking-tight transition-all duration-300",
              visitors.length > 0 ? "text-foreground" : "text-muted-foreground"
            )}>
              {visitors.length}
            </span>
            {visitors.length > 0 && (
              <div className="absolute -right-2 -top-1">
                <Activity className="w-4 h-4 text-secondary animate-pulse" />
              </div>
            )}
          </div>
          <div className="flex flex-col pb-1">
            <span className="text-sm text-muted-foreground">visitors</span>
            <span className="text-xs text-muted-foreground/70">on site now</span>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/50 rounded-xl p-3 text-center border border-border/50">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <Monitor className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-semibold text-foreground">{desktopCount}</span>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Desktop</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 text-center border border-border/50">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <Smartphone className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-semibold text-foreground">{mobileCount}</span>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Mobile</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 text-center border border-border/50">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <Users className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-semibold text-foreground">{authenticatedCount}</span>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Logged In</p>
          </div>
        </div>

        {/* Session stats */}
        <div className="flex items-center justify-between bg-gradient-to-r from-secondary/5 to-transparent rounded-lg p-3 border border-secondary/10">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-secondary" />
            <span className="text-sm text-muted-foreground">Avg session</span>
          </div>
          <span className="text-sm font-semibold text-foreground">{formatDuration(avgSessionDuration)}</span>
        </div>

        {/* Page breakdown with colored badges */}
        {Object.keys(pageBreakdown).length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Viewing Now</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(pageBreakdown)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([page, count]) => (
                  <Badge 
                    key={page} 
                    variant="outline"
                    className={cn(
                      "text-xs font-medium px-2.5 py-1 transition-all hover:scale-105",
                      getPageColor(page)
                    )}
                  >
                    <span className="font-semibold mr-1">{count}</span>
                    {page}
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {/* Recent visitors list with improved design */}
        {visitors.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Recent Activity</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Peak: {peakVisitors}</span>
            </div>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
              {visitors
                .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
                .slice(0, 5)
                .map((visitor, idx) => (
                  <div 
                    key={visitor.visitorId || idx} 
                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-1.5 rounded-md",
                        visitor.isAuthenticated ? "bg-secondary/10" : "bg-muted"
                      )}>
                        {getDeviceType(visitor.userAgent) === "mobile" ? (
                          <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-foreground">
                          {visitor.isAuthenticated ? "Member" : "Guest"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {getPageName(visitor.currentPage)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(visitor.joinedAt), { addSuffix: false })}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {visitors.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">No active visitors</p>
            <p className="text-xs text-muted-foreground/70">Visitors will appear here in real-time</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
