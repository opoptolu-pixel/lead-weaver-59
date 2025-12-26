import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  Clock, 
  MousePointer,
  ArrowRight,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PageVisit {
  page: string;
  enteredAt: string;
  leftAt?: string;
  timeSpent?: number;
}

interface Visitor {
  visitorId: string;
  currentPage: string;
  pageHistory?: PageVisit[];
  sessionDuration?: number;
}

interface PresenceState {
  [key: string]: Visitor[];
}

interface PageStats {
  page: string;
  visits: number;
  avgTimeSpent: number;
}

const getPageName = (path: string): string => {
  const pathMap: Record<string, string> = {
    "/": "Home",
    "/for-cleaners": "For Cleaners",
    "/request-cleaning": "Request",
    "/leads": "Leads",
    "/auth": "Auth",
    "/dashboard": "Dashboard",
    "/settings": "Settings",
    "/billing": "Billing",
    "/contact": "Contact",
    "/blog": "Blog",
  };
  
  if (path.startsWith("/admin")) return "Admin";
  if (path.startsWith("/blog/")) return "Article";
  
  return pathMap[path] || path;
};

export function VisitorAnalyticsCard() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [pageStats, setPageStats] = useState<PageStats[]>([]);

  useEffect(() => {
    // Use same channel as VisitorPresenceTracker to receive real data
    const channel = supabase.channel("site-visitors");

    channel
      .on("presence", { event: "sync" }, () => {
        console.log("Analytics: Presence sync received");
        const state = channel.presenceState() as PresenceState;
        const allVisitors: Visitor[] = [];
        
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            allVisitors.push(presence);
          });
        });
        
        setVisitors(allVisitors);
        
        // Aggregate page statistics from all visitors' page history
        const statsMap = new Map<string, { visits: number; totalTime: number; count: number }>();
        
        allVisitors.forEach((visitor) => {
          if (visitor.pageHistory) {
            visitor.pageHistory.forEach((visit) => {
              const pageName = getPageName(visit.page);
              const current = statsMap.get(pageName) || { visits: 0, totalTime: 0, count: 0 };
              current.visits += 1;
              if (visit.timeSpent) {
                current.totalTime += visit.timeSpent;
                current.count += 1;
              }
              statsMap.set(pageName, current);
            });
          }
        });
        
        const stats = Array.from(statsMap.entries())
          .map(([page, data]) => ({
            page,
            visits: data.visits,
            avgTimeSpent: data.count > 0 ? Math.round(data.totalTime / data.count) : 0,
          }))
          .sort((a, b) => b.visits - a.visits)
          .slice(0, 6);
        
        setPageStats(stats);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const journeyPaths = useMemo(() => {
    const paths: { from: string; to: string; count: number }[] = [];
    const pathMap = new Map<string, number>();
    
    visitors.forEach((visitor) => {
      if (visitor.pageHistory && visitor.pageHistory.length > 1) {
        for (let i = 0; i < visitor.pageHistory.length - 1; i++) {
          const from = getPageName(visitor.pageHistory[i].page);
          const to = getPageName(visitor.pageHistory[i + 1].page);
          const key = `${from}->${to}`;
          pathMap.set(key, (pathMap.get(key) || 0) + 1);
        }
      }
    });
    
    return Array.from(pathMap.entries())
      .map(([key, count]) => {
        const [from, to] = key.split('->');
        return { from, to, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [visitors]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const totalPageViews = pageStats.reduce((sum, p) => sum + p.visits, 0);

  return (
    <Card className="border-0 bg-gradient-to-br from-card via-card to-muted/30 shadow-elevated">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2.5 text-lg font-semibold">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <BarChart3 className="w-5 h-5 text-blue-500" />
          </div>
          <span className="flex-1">Click-Through Analytics</span>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            Live Session
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-xl p-4 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <MousePointer className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Page Views</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{totalPageViews}</span>
          </div>
          <div className="bg-muted/50 rounded-xl p-4 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Active Journeys</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{visitors.length}</span>
          </div>
        </div>

        {/* Page Visit Chart */}
        {pageStats.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pages by Visits</span>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pageStats} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis 
                    type="category" 
                    dataKey="page" 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    width={70}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value} visits`, 'Visits']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar 
                    dataKey="visits" 
                    fill="hsl(var(--secondary))" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Time on Page */}
        {pageStats.some(p => p.avgTimeSpent > 0) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Avg Time on Page</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {pageStats
                .filter(p => p.avgTimeSpent > 0)
                .slice(0, 4)
                .map((stat) => (
                  <div 
                    key={stat.page}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/30"
                  >
                    <span className="text-xs text-muted-foreground">{stat.page}</span>
                    <span className="text-xs font-medium text-foreground">{formatTime(stat.avgTimeSpent)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* User Journeys */}
        {journeyPaths.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Common Paths</span>
            </div>
            <div className="space-y-1.5">
              {journeyPaths.map((path, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/30 border border-border/30"
                >
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {path.from}
                  </Badge>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {path.to}
                  </Badge>
                  <span className="ml-auto text-muted-foreground font-medium">{path.count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {visitors.length === 0 && (
          <div className="text-center py-6 space-y-2">
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
              <BarChart3 className="w-5 h-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">No session data yet</p>
            <p className="text-xs text-muted-foreground/70">Analytics will populate as visitors browse</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
