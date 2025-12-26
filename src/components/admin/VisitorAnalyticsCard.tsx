import { useState, useEffect, useMemo } from "react";
import { useVisitorData, Visitor } from "@/hooks/useVisitorData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  Clock, 
  MousePointer,
  ArrowRight,
  TrendingUp,
  UserX,
  UserCheck,
  Users,
  RefreshCw
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

// Track return visitors using localStorage
const RETURN_VISITOR_KEY = "visitor_first_visit";

const isReturnVisitor = (): boolean => {
  if (typeof window === "undefined") return false;
  
  const firstVisit = localStorage.getItem(RETURN_VISITOR_KEY);
  if (!firstVisit) {
    localStorage.setItem(RETURN_VISITOR_KEY, new Date().toISOString());
    return false;
  }
  return true;
};

export function VisitorAnalyticsCard() {
  const visitors = useVisitorData();
  const [pageStats, setPageStats] = useState<PageStats[]>([]);

  // Calculate bounce rate (visitors with only 1 page view)
  const { bounceRate, bouncedCount, engagedCount } = useMemo(() => {
    if (visitors.length === 0) {
      return { bounceRate: 0, bouncedCount: 0, engagedCount: 0 };
    }
    
    let bounced = 0;
    let engaged = 0;
    
    visitors.forEach((visitor) => {
      const pageHistory = visitor.pageHistory || [];
      // Unique pages visited
      const uniquePages = new Set(pageHistory.map(p => p.page));
      
      if (uniquePages.size <= 1) {
        bounced++;
      } else {
        engaged++;
      }
    });
    
    const rate = visitors.length > 0 ? Math.round((bounced / visitors.length) * 100) : 0;
    return { bounceRate: rate, bouncedCount: bounced, engagedCount: engaged };
  }, [visitors]);

  // Estimate return vs new visitors
  const { newVisitors, returnVisitors } = useMemo(() => {
    // Since we can't reliably track return visitors across sessions from presence data,
    // we'll estimate based on session duration - longer sessions tend to be return visitors
    let newCount = 0;
    let returnCount = 0;
    
    visitors.forEach((visitor) => {
      // Consider someone a "return visitor" if they have >5 pages in history
      // or session duration > 2 minutes (indicating familiarity with the site)
      const pageCount = visitor.pageHistory?.length || 0;
      const sessionDuration = visitor.sessionDuration || 0;
      
      if (pageCount > 5 || sessionDuration > 120) {
        returnCount++;
      } else {
        newCount++;
      }
    });
    
    return { newVisitors: newCount, returnVisitors: returnCount };
  }, [visitors]);

  // Average session duration
  const avgSessionDuration = useMemo(() => {
    if (visitors.length === 0) return 0;
    
    const totalDuration = visitors.reduce((sum, v) => sum + (v.sessionDuration || 0), 0);
    return Math.round(totalDuration / visitors.length);
  }, [visitors]);

  useEffect(() => {
    // Aggregate page statistics from all visitors' page history
    const statsMap = new Map<string, { visits: number; totalTime: number; count: number }>();
    
    visitors.forEach((visitor) => {
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
  }, [visitors]);

  const journeyPaths = useMemo(() => {
    const paths: { from: string; to: string; count: number }[] = [];
    const pathMap = new Map<string, number>();
    
    visitors.forEach((visitor) => {
      if (visitor.pageHistory && visitor.pageHistory.length > 1) {
        for (let i = 0; i < visitor.pageHistory.length - 1; i++) {
          const from = getPageName(visitor.pageHistory[i].page);
          const to = getPageName(visitor.pageHistory[i + 1].page);
          // Skip self-transitions
          if (from === to) continue;
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
          <span className="flex-1">Visitor Analytics</span>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            Live Session
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Page Views */}
          <div className="bg-muted/50 rounded-xl p-3 border border-border/50">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <MousePointer className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Views</span>
            </div>
            <span className="text-xl font-bold text-foreground">{totalPageViews}</span>
          </div>
          
          {/* Bounce Rate */}
          <div className="bg-muted/50 rounded-xl p-3 border border-border/50">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <UserX className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Bounce</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={cn(
                "text-xl font-bold",
                bounceRate > 70 ? "text-red-500" : bounceRate > 40 ? "text-amber-500" : "text-green-500"
              )}>
                {bounceRate}%
              </span>
              <span className="text-[10px] text-muted-foreground">({bouncedCount})</span>
            </div>
          </div>
          
          {/* Return Visitors */}
          <div className="bg-muted/50 rounded-xl p-3 border border-border/50">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Return</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-secondary">{returnVisitors}</span>
              <span className="text-[10px] text-muted-foreground">/ {visitors.length}</span>
            </div>
          </div>
          
          {/* Avg Session */}
          <div className="bg-muted/50 rounded-xl p-3 border border-border/50">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Avg Time</span>
            </div>
            <span className="text-xl font-bold text-foreground">{formatTime(avgSessionDuration)}</span>
          </div>
        </div>

        {/* Visitor Type Breakdown */}
        <div className="flex gap-2">
          <div className="flex-1 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">New Visitors</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">{newVisitors}</span>
              <span className="text-xs text-muted-foreground">
                {visitors.length > 0 ? Math.round((newVisitors / visitors.length) * 100) : 0}%
              </span>
            </div>
          </div>
          <div className="flex-1 p-3 bg-secondary/10 rounded-lg border border-secondary/20">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-secondary" />
              <span className="text-xs text-secondary font-medium">Engaged</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-secondary">{engagedCount}</span>
              <span className="text-xs text-muted-foreground">
                {visitors.length > 0 ? Math.round((engagedCount / visitors.length) * 100) : 0}%
              </span>
            </div>
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
