import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { 
  Calendar,
  Monitor,
  Smartphone,
  Tablet,
  Eye,
  Clock,
  MapPin,
  TrendingUp,
  TrendingDown,
  Download,
  Loader2,
  FileText,
  Users,
  Globe2,
  ArrowUpRight,
  MousePointerClick,
  UserPlus,
  UserCheck,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/contexts/AdminContext";
import { exportToCsv } from "@/lib/exportCsv";
import { toast } from "sonner";

const COLORS = [
  "hsl(var(--secondary))", 
  "hsl(142, 76%, 36%)", 
  "hsl(200, 80%, 50%)", 
  "hsl(280, 65%, 60%)", 
  "hsl(30, 80%, 55%)",
  "hsl(340, 70%, 55%)",
  "hsl(170, 60%, 45%)",
  "hsl(45, 80%, 50%)",
];

interface PageViewData {
  id: string;
  visitor_id: string;
  session_id: string;
  page_path: string;
  page_title: string | null;
  device_type: string | null;
  referrer: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  time_on_page: number | null;
  created_at: string;
}

const getPageName = (path: string): string => {
  const pageNames: Record<string, string> = {
    "/": "Home",
    "/request-cleaning": "Request Cleaning",
    "/for-cleaners": "For Cleaners",
    "/contact": "Contact",
    "/blog": "Blog",
    "/privacy-policy": "Privacy Policy",
    "/terms-of-use": "Terms of Use",
    "/gdpr": "GDPR",
    "/refund-policy": "Refund Policy",
    "/auth": "Login/Signup",
  };
  return pageNames[path] || path;
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

const getReferrerDomain = (referrer: string | null): string => {
  if (!referrer) return "Direct";
  try {
    const url = new URL(referrer);
    const domain = url.hostname.replace("www.", "");
    // Categorize known sources
    if (domain.includes("google")) return "Google";
    if (domain.includes("facebook") || domain.includes("fb.")) return "Facebook";
    if (domain.includes("instagram")) return "Instagram";
    if (domain.includes("twitter") || domain.includes("x.com")) return "X (Twitter)";
    if (domain.includes("linkedin")) return "LinkedIn";
    if (domain.includes("bing")) return "Bing";
    if (domain.includes("tiktok")) return "TikTok";
    if (domain.includes("youtube")) return "YouTube";
    if (domain.includes("lovable")) return "Direct";
    return domain;
  } catch {
    return "Direct";
  }
};

const getReferrerCategory = (referrer: string | null): string => {
  if (!referrer) return "Direct";
  const domain = getReferrerDomain(referrer);
  if (domain === "Direct") return "Direct";
  if (["Google", "Bing"].includes(domain)) return "Organic Search";
  if (["Facebook", "Instagram", "X (Twitter)", "LinkedIn", "TikTok", "YouTube"].includes(domain)) return "Social";
  return "Referral";
};

// Fetch all page views with pagination to overcome the 1000-row limit
async function fetchAllPageViews(startISO: string, endISO: string): Promise<PageViewData[]> {
  const allData: PageViewData[] = [];
  const batchSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("page_views")
      .select("*")
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .order("created_at", { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allData.push(...(data as PageViewData[]));
      offset += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

export function HistoricalVisitorAnalytics() {
  const { getDateFilter, dateRange } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [pageViews, setPageViews] = useState<PageViewData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { start, end } = getDateFilter();
        const data = await fetchAllPageViews(start.toISOString(), end.toISOString());
        setPageViews(data);
      } catch (error) {
        console.error("Error fetching page views:", error);
        toast.error("Failed to load visitor analytics");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange, getDateFilter]);

  // ========================
  // COMPUTED ANALYTICS
  // ========================

  const stats = useMemo(() => {
    const uniqueVisitors = new Set(pageViews.map(pv => pv.visitor_id)).size;
    const uniqueSessions = new Set(pageViews.map(pv => pv.session_id)).size;
    const totalViews = pageViews.length;
    const validTimes = pageViews.filter(pv => pv.time_on_page && pv.time_on_page > 0);
    const avgTimeOnPage = validTimes.reduce((sum, pv) => sum + (pv.time_on_page || 0), 0) / (validTimes.length || 1);

    // Device breakdown
    const deviceCounts = { desktop: 0, mobile: 0, tablet: 0 };
    pageViews.forEach(pv => {
      if (pv.device_type === "desktop") deviceCounts.desktop++;
      else if (pv.device_type === "mobile") deviceCounts.mobile++;
      else if (pv.device_type === "tablet") deviceCounts.tablet++;
    });

    // Bounce rate: sessions with only 1 page view
    const sessionPageCounts = new Map<string, number>();
    pageViews.forEach(pv => {
      sessionPageCounts.set(pv.session_id, (sessionPageCounts.get(pv.session_id) || 0) + 1);
    });
    const bouncedSessions = Array.from(sessionPageCounts.values()).filter(count => count === 1).length;
    const bounceRate = uniqueSessions > 0 ? Math.round((bouncedSessions / uniqueSessions) * 100) : 0;

    // New vs returning visitors (based on visitor_id appearing in multiple sessions)
    const visitorSessions = new Map<string, Set<string>>();
    pageViews.forEach(pv => {
      if (!visitorSessions.has(pv.visitor_id)) visitorSessions.set(pv.visitor_id, new Set());
      visitorSessions.get(pv.visitor_id)!.add(pv.session_id);
    });
    const returningVisitors = Array.from(visitorSessions.values()).filter(s => s.size > 1).length;
    const newVisitors = uniqueVisitors - returningVisitors;

    return {
      uniqueVisitors,
      uniqueSessions,
      totalViews,
      avgTimeOnPage: Math.round(avgTimeOnPage),
      pagesPerSession: uniqueSessions > 0 ? (totalViews / uniqueSessions).toFixed(1) : "0",
      deviceCounts,
      bounceRate,
      newVisitors,
      returningVisitors,
    };
  }, [pageViews]);

  // Daily stats for chart
  const dailyStats = useMemo(() => {
    const dailyMap = new Map<string, { views: number; visitors: Set<string>; sessions: Set<string> }>();

    pageViews.forEach(pv => {
      const date = new Date(pv.created_at).toISOString().split("T")[0];
      if (!dailyMap.has(date)) dailyMap.set(date, { views: 0, visitors: new Set(), sessions: new Set() });
      const day = dailyMap.get(date)!;
      day.views++;
      day.visitors.add(pv.visitor_id);
      day.sessions.add(pv.session_id);
    });

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        views: data.views,
        uniqueVisitors: data.visitors.size,
        sessions: data.sessions.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [pageViews]);

  // Hourly heatmap data
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, views: 0, label: `${i.toString().padStart(2, "0")}:00` }));
    pageViews.forEach(pv => {
      const hour = new Date(pv.created_at).getHours();
      hours[hour].views++;
    });
    return hours;
  }, [pageViews]);

  // Page stats
  const pageStats = useMemo(() => {
    const pageMap = new Map<string, { views: number; visitors: Set<string>; totalTime: number; entrances: number }>();

    pageViews.forEach(pv => {
      if (!pageMap.has(pv.page_path)) {
        pageMap.set(pv.page_path, { views: 0, visitors: new Set(), totalTime: 0, entrances: 0 });
      }
      const page = pageMap.get(pv.page_path)!;
      page.views++;
      page.visitors.add(pv.visitor_id);
      if (pv.time_on_page && pv.time_on_page > 0) page.totalTime += pv.time_on_page;
    });

    return Array.from(pageMap.entries())
      .map(([page, data]) => ({
        page,
        views: data.views,
        uniqueVisitors: data.visitors.size,
        avgTimeOnPage: data.views > 0 ? Math.round(data.totalTime / data.views) : 0,
        sharePercent: pageViews.length > 0 ? ((data.views / pageViews.length) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }, [pageViews]);

  // Location stats
  const locationStats = useMemo(() => {
    const locationMap = new Map<string, { city: string; region: string; country: string; views: number; visitors: Set<string> }>();

    pageViews.forEach(pv => {
      if (!pv.city) return;
      const key = `${pv.city}-${pv.country}`;
      if (!locationMap.has(key)) {
        locationMap.set(key, { city: pv.city, region: pv.region || "", country: pv.country || "", views: 0, visitors: new Set() });
      }
      const loc = locationMap.get(key)!;
      loc.views++;
      loc.visitors.add(pv.visitor_id);
    });

    return Array.from(locationMap.entries())
      .map(([, data]) => ({
        city: data.city,
        region: data.region,
        country: data.country,
        views: data.views,
        visitors: data.visitors.size,
      }))
      .sort((a, b) => b.views - a.views);
  }, [pageViews]);

  // Country stats
  const countryStats = useMemo(() => {
    const countryMap = new Map<string, { views: number; visitors: Set<string> }>();
    pageViews.forEach(pv => {
      const country = pv.country || "Unknown";
      if (!countryMap.has(country)) countryMap.set(country, { views: 0, visitors: new Set() });
      const c = countryMap.get(country)!;
      c.views++;
      c.visitors.add(pv.visitor_id);
    });
    return Array.from(countryMap.entries())
      .map(([country, data]) => ({ country, views: data.views, visitors: data.visitors.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }, [pageViews]);

  // Referrer breakdown
  const referrerStats = useMemo(() => {
    const refMap = new Map<string, { views: number; visitors: Set<string> }>();
    pageViews.forEach(pv => {
      const source = getReferrerDomain(pv.referrer);
      if (!refMap.has(source)) refMap.set(source, { views: 0, visitors: new Set() });
      const r = refMap.get(source)!;
      r.views++;
      r.visitors.add(pv.visitor_id);
    });
    return Array.from(refMap.entries())
      .map(([source, data]) => ({ source, views: data.views, visitors: data.visitors.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }, [pageViews]);

  // Traffic channel breakdown for pie chart
  const channelStats = useMemo(() => {
    const channelMap = new Map<string, number>();
    pageViews.forEach(pv => {
      const channel = getReferrerCategory(pv.referrer);
      channelMap.set(channel, (channelMap.get(channel) || 0) + 1);
    });
    return Array.from(channelMap.entries())
      .map(([channel, views]) => ({ name: channel, value: views }))
      .sort((a, b) => b.value - a.value);
  }, [pageViews]);

  // Device data for pie chart
  const deviceData = useMemo(
    () =>
      [
        { name: "Desktop", value: stats.deviceCounts.desktop },
        { name: "Mobile", value: stats.deviceCounts.mobile },
        { name: "Tablet", value: stats.deviceCounts.tablet },
      ].filter(d => d.value > 0),
    [stats.deviceCounts]
  );

  const handleExport = () => {
    exportToCsv(
      pageViews.map(pv => ({
        date: new Date(pv.created_at).toLocaleString(),
        page: pv.page_path,
        visitor_id: pv.visitor_id,
        session_id: pv.session_id,
        device: pv.device_type,
        referrer: pv.referrer || "Direct",
        city: pv.city,
        region: pv.region,
        country: pv.country,
        time_on_page: pv.time_on_page,
      })),
      "page_views_analytics",
      [
        { key: "date", label: "Date" },
        { key: "page", label: "Page" },
        { key: "visitor_id", label: "Visitor ID" },
        { key: "session_id", label: "Session ID" },
        { key: "device", label: "Device" },
        { key: "referrer", label: "Referrer" },
        { key: "city", label: "City" },
        { key: "region", label: "Region" },
        { key: "country", label: "Country" },
        { key: "time_on_page", label: "Time on Page (s)" },
      ]
    );
    toast.success("Export started");
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-secondary" />
        <p className="text-muted-foreground mt-2">Loading visitor analytics...</p>
      </div>
    );
  }

  if (pageViews.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Page View Data Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Page view tracking is now active. Data will appear here as visitors browse your site. 
            Try visiting your site in a different browser to generate test data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Summary Row */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Eye className="h-4 w-4" />
              <span className="text-xs font-medium">Page Views</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Unique Visitors</span>
            </div>
            <p className="text-2xl font-bold">{stats.uniqueVisitors.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-xs font-medium">Sessions</span>
            </div>
            <p className="text-2xl font-bold">{stats.uniqueSessions.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileText className="h-4 w-4" />
              <span className="text-xs font-medium">Pages/Session</span>
            </div>
            <p className="text-2xl font-bold">{stats.pagesPerSession}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Avg Time</span>
            </div>
            <p className="text-2xl font-bold">{formatDuration(stats.avgTimeOnPage)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingDown className="h-4 w-4" />
              <span className="text-xs font-medium">Bounce Rate</span>
            </div>
            <p className="text-2xl font-bold">{stats.bounceRate}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <UserPlus className="h-4 w-4" />
              <span className="text-xs font-medium">New Visitors</span>
            </div>
            <p className="text-2xl font-bold">{stats.newVisitors.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <UserCheck className="h-4 w-4" />
              <span className="text-xs font-medium">Returning</span>
            </div>
            <p className="text-2xl font-bold">{stats.returningVisitors.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend + Export */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-secondary" />
                Traffic Over Time
              </CardTitle>
              <CardDescription>Page views, unique visitors, and sessions by day</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyStats}>
              <defs>
                <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Area type="monotone" dataKey="views" stroke="hsl(var(--secondary))" fill="url(#fillViews)" strokeWidth={2} name="Page Views" />
              <Area type="monotone" dataKey="uniqueVisitors" stroke="hsl(142, 76%, 36%)" fill="url(#fillVisitors)" strokeWidth={2} name="Unique Visitors" />
              <Line type="monotone" dataKey="sessions" stroke="hsl(200, 80%, 50%)" strokeWidth={1.5} strokeDasharray="5 5" name="Sessions" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Row: Traffic Sources + Device Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Traffic Channels Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-secondary" />
              Traffic Channels
            </CardTitle>
            <CardDescription>How visitors find your site</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="45%" height={200}>
                <PieChart>
                  <Pie data={channelStats} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={4} dataKey="value">
                    {channelStats.map((_, index) => (
                      <Cell key={`ch-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 flex-1">
                {channelStats.map((ch, i) => (
                  <div key={ch.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm">{ch.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">{ch.value}</span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({pageViews.length > 0 ? ((ch.value / pageViews.length) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Device Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-secondary" />
              Device Breakdown
            </CardTitle>
            <CardDescription>Desktop, mobile, and tablet visitors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="45%" height={200}>
                <PieChart>
                  <Pie data={deviceData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={4} dataKey="value">
                    {deviceData.map((_, index) => (
                      <Cell key={`dev-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3">
                  <Monitor className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <p className="text-sm font-medium">Desktop</p>
                      <p className="text-sm font-bold">{stats.deviceCounts.desktop}</p>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div
                        className="bg-secondary h-1.5 rounded-full"
                        style={{ width: `${stats.totalViews > 0 ? (stats.deviceCounts.desktop / stats.totalViews) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <p className="text-sm font-medium">Mobile</p>
                      <p className="text-sm font-bold">{stats.deviceCounts.mobile}</p>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          backgroundColor: "hsl(142, 76%, 36%)",
                          width: `${stats.totalViews > 0 ? (stats.deviceCounts.mobile / stats.totalViews) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Tablet className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <p className="text-sm font-medium">Tablet</p>
                      <p className="text-sm font-bold">{stats.deviceCounts.tablet}</p>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          backgroundColor: "hsl(200, 80%, 50%)",
                          width: `${stats.totalViews > 0 ? (stats.deviceCounts.tablet / stats.totalViews) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row: Top Referrers + Hourly Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Referrers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-secondary" />
              Top Referrers
            </CardTitle>
            <CardDescription>Traffic sources by domain</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Visitors</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrerStats.map(ref => (
                  <TableRow key={ref.source}>
                    <TableCell className="font-medium">{ref.source}</TableCell>
                    <TableCell className="text-right">{ref.views}</TableCell>
                    <TableCell className="text-right">{ref.visitors}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">
                        {pageViews.length > 0 ? ((ref.views / pageViews.length) * 100).toFixed(0) : 0}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Hourly Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-secondary" />
              Hourly Activity
            </CardTitle>
            <CardDescription>When visitors are most active (UTC)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" interval={2} />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="views" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} name="Page Views" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row: Top Pages + Top Locations */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Pages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-secondary" />
              Top Pages
            </CardTitle>
            <CardDescription>Most visited pages</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Visitors</TableHead>
                  <TableHead className="text-right">Avg Time</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageStats.map(page => (
                  <TableRow key={page.page}>
                    <TableCell className="font-medium">
                      <span className="truncate block max-w-[180px]" title={page.page}>
                        {getPageName(page.page)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{page.views}</TableCell>
                    <TableCell className="text-right">{page.uniqueVisitors}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatDuration(page.avgTimeOnPage)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{page.sharePercent}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top Locations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-secondary" />
              Visitors by Location
            </CardTitle>
            <CardDescription>Top cities and countries</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Countries */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Globe2 className="h-4 w-4" /> Countries
              </h4>
              <div className="space-y-2">
                {countryStats.slice(0, 5).map((c, i) => (
                  <div key={c.country} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                      <span className="text-sm font-medium">{c.country}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-muted rounded-full h-1.5">
                        <div
                          className="bg-secondary h-1.5 rounded-full"
                          style={{ width: `${countryStats[0]?.views > 0 ? (c.views / countryStats[0].views) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{c.views}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cities */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Cities
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>City</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Visitors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locationStats.slice(0, 8).map(loc => (
                    <TableRow key={`${loc.city}-${loc.country}`}>
                      <TableCell className="font-medium">{loc.city}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{loc.region}</TableCell>
                      <TableCell className="text-right">{loc.views}</TableCell>
                      <TableCell className="text-right">{loc.visitors}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Page Views */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-secondary" />
            Recent Page Views
          </CardTitle>
          <CardDescription>Latest {Math.min(25, pageViews.length)} visitor page views</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Page</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Time on Page</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageViews.slice(0, 25).map(pv => (
                <TableRow key={pv.id}>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(pv.created_at).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="truncate block max-w-[160px]" title={pv.page_path}>
                      {getPageName(pv.page_path)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">
                      {pv.device_type === "desktop" && <Monitor className="h-3 w-3 mr-1" />}
                      {pv.device_type === "mobile" && <Smartphone className="h-3 w-3 mr-1" />}
                      {pv.device_type === "tablet" && <Tablet className="h-3 w-3 mr-1" />}
                      {pv.device_type || "?"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{getReferrerDomain(pv.referrer)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{pv.city ? `${pv.city}, ${pv.country}` : "Unknown"}</TableCell>
                  <TableCell className="text-right">{pv.time_on_page ? formatDuration(pv.time_on_page) : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
