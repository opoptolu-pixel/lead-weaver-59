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
  Download,
  Loader2,
  FileText,
  Users
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
  "hsl(340, 70%, 55%)"
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

interface PageStats {
  page: string;
  views: number;
  uniqueVisitors: number;
  avgTimeOnPage: number;
}

interface DailyStats {
  date: string;
  views: number;
  uniqueVisitors: number;
  sessions: number;
}

interface LocationStats {
  location: string;
  city: string;
  region: string;
  country: string;
  views: number;
  visitors: number;
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

export function HistoricalVisitorAnalytics() {
  const { getDateFilter } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [pageViews, setPageViews] = useState<PageViewData[]>([]);

  const { start, end } = getDateFilter();

  useEffect(() => {
    fetchPageViews();
  }, [start, end]);

  const fetchPageViews = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("page_views")
        .select("*")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPageViews(data || []);
    } catch (error) {
      console.error("Error fetching page views:", error);
      toast.error("Failed to load historical visitor data");
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary statistics
  const stats = useMemo(() => {
    const uniqueVisitors = new Set(pageViews.map(pv => pv.visitor_id)).size;
    const uniqueSessions = new Set(pageViews.map(pv => pv.session_id)).size;
    const totalViews = pageViews.length;
    
    const avgTimeOnPage = pageViews.reduce((sum, pv) => sum + (pv.time_on_page || 0), 0) / (totalViews || 1);
    
    // Device breakdown
    const deviceCounts = { desktop: 0, mobile: 0, tablet: 0 };
    pageViews.forEach(pv => {
      if (pv.device_type === "desktop") deviceCounts.desktop++;
      else if (pv.device_type === "mobile") deviceCounts.mobile++;
      else if (pv.device_type === "tablet") deviceCounts.tablet++;
    });
    
    return {
      uniqueVisitors,
      uniqueSessions,
      totalViews,
      avgTimeOnPage: Math.round(avgTimeOnPage),
      pagesPerSession: uniqueSessions > 0 ? (totalViews / uniqueSessions).toFixed(1) : "0",
      deviceCounts
    };
  }, [pageViews]);

  // Daily stats for chart
  const dailyStats = useMemo((): DailyStats[] => {
    const dailyMap = new Map<string, { views: number; visitors: Set<string>; sessions: Set<string> }>();
    
    pageViews.forEach(pv => {
      const date = new Date(pv.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { views: 0, visitors: new Set(), sessions: new Set() });
      }
      
      const day = dailyMap.get(date)!;
      day.views++;
      day.visitors.add(pv.visitor_id);
      day.sessions.add(pv.session_id);
    });
    
    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        views: data.views,
        uniqueVisitors: data.visitors.size,
        sessions: data.sessions.size
      }))
      .reverse();
  }, [pageViews]);

  // Page stats
  const pageStats = useMemo((): PageStats[] => {
    const pageMap = new Map<string, { views: number; visitors: Set<string>; totalTime: number }>();
    
    pageViews.forEach(pv => {
      if (!pageMap.has(pv.page_path)) {
        pageMap.set(pv.page_path, { views: 0, visitors: new Set(), totalTime: 0 });
      }
      
      const page = pageMap.get(pv.page_path)!;
      page.views++;
      page.visitors.add(pv.visitor_id);
      page.totalTime += pv.time_on_page || 0;
    });
    
    return Array.from(pageMap.entries())
      .map(([page, data]) => ({
        page,
        views: data.views,
        uniqueVisitors: data.visitors.size,
        avgTimeOnPage: Math.round(data.totalTime / data.views)
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }, [pageViews]);

  // Location stats
  const locationStats = useMemo((): LocationStats[] => {
    const locationMap = new Map<string, { city: string; region: string; country: string; views: number; visitors: Set<string> }>();
    
    pageViews.forEach(pv => {
      if (!pv.city) return;
      
      const key = `${pv.city}-${pv.country}`;
      
      if (!locationMap.has(key)) {
        locationMap.set(key, { 
          city: pv.city, 
          region: pv.region || "", 
          country: pv.country || "", 
          views: 0, 
          visitors: new Set() 
        });
      }
      
      const loc = locationMap.get(key)!;
      loc.views++;
      loc.visitors.add(pv.visitor_id);
    });
    
    return Array.from(locationMap.entries())
      .map(([location, data]) => ({
        location,
        city: data.city,
        region: data.region,
        country: data.country,
        views: data.views,
        visitors: data.visitors.size
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }, [pageViews]);

  // Device data for pie chart
  const deviceData = useMemo(() => [
    { name: "Desktop", value: stats.deviceCounts.desktop },
    { name: "Mobile", value: stats.deviceCounts.mobile },
    { name: "Tablet", value: stats.deviceCounts.tablet },
  ].filter(d => d.value > 0), [stats.deviceCounts]);

  const handleExport = () => {
    exportToCsv(pageViews.map(pv => ({
      date: new Date(pv.created_at).toLocaleString(),
      page: pv.page_path,
      visitor_id: pv.visitor_id,
      device: pv.device_type,
      city: pv.city,
      region: pv.region,
      country: pv.country,
      time_on_page: pv.time_on_page
    })), "historical_page_views", [
      { key: "date", label: "Date" },
      { key: "page", label: "Page" },
      { key: "visitor_id", label: "Visitor ID" },
      { key: "device", label: "Device" },
      { key: "city", label: "City" },
      { key: "region", label: "Region" },
      { key: "country", label: "Country" },
      { key: "time_on_page", label: "Time on Page (s)" },
    ]);
    toast.success("Export started");
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-secondary" />
        <p className="text-muted-foreground mt-2">Loading historical visitor data...</p>
      </div>
    );
  }

  if (pageViews.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Historical Data Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Historical visitor tracking has been enabled. Page views will be recorded as visitors browse your site.
            Check back later to see visitor analytics.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Page Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalViews.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Unique Visitors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.uniqueVisitors.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.uniqueSessions.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Pages/Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.pagesPerSession}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg Time on Page
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatDuration(stats.avgTimeOnPage)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-secondary" />
                Daily Page Views
              </CardTitle>
              <CardDescription>Page views and unique visitors over time</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="views" 
                stroke="hsl(var(--secondary))" 
                strokeWidth={2}
                name="Page Views"
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="uniqueVisitors" 
                stroke="hsl(142, 76%, 36%)" 
                strokeWidth={2}
                name="Unique Visitors"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Pages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-secondary" />
              Top Pages
            </CardTitle>
            <CardDescription>Most visited pages in the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Visitors</TableHead>
                  <TableHead className="text-right">Avg Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageStats.map((page) => (
                  <TableRow key={page.page}>
                    <TableCell className="font-medium">
                      <span className="truncate block max-w-[200px]" title={page.page}>
                        {getPageName(page.page)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{page.views}</TableCell>
                    <TableCell className="text-right">{page.uniqueVisitors}</TableCell>
                    <TableCell className="text-right">{formatDuration(page.avgTimeOnPage)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Device Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-secondary" />
              Device Breakdown
            </CardTitle>
            <CardDescription>Visitor devices distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={deviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {deviceData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Monitor className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">{stats.deviceCounts.desktop}</p>
                    <p className="text-sm text-muted-foreground">Desktop</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">{stats.deviceCounts.mobile}</p>
                    <p className="text-sm text-muted-foreground">Mobile</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Tablet className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">{stats.deviceCounts.tablet}</p>
                    <p className="text-sm text-muted-foreground">Tablet</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Location Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-secondary" />
            Top Locations
          </CardTitle>
          <CardDescription>Where your visitors are coming from</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
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
                {locationStats.slice(0, 5).map((loc) => (
                  <TableRow key={loc.location}>
                    <TableCell className="font-medium">{loc.city}</TableCell>
                    <TableCell className="text-muted-foreground">{loc.region}</TableCell>
                    <TableCell className="text-right">{loc.views}</TableCell>
                    <TableCell className="text-right">{loc.visitors}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={locationStats.slice(0, 5)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="city" type="category" className="text-xs" width={100} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="views" fill="hsl(var(--secondary))" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Page Views */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-secondary" />
            Recent Page Views
          </CardTitle>
          <CardDescription>Latest visitor activity</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Page</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Time on Page</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageViews.slice(0, 20).map((pv) => (
                <TableRow key={pv.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(pv.created_at).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="truncate block max-w-[200px]" title={pv.page_path}>
                      {getPageName(pv.page_path)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {pv.device_type === "desktop" && <Monitor className="h-3 w-3 mr-1" />}
                      {pv.device_type === "mobile" && <Smartphone className="h-3 w-3 mr-1" />}
                      {pv.device_type === "tablet" && <Tablet className="h-3 w-3 mr-1" />}
                      {pv.device_type || "Unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {pv.city ? `${pv.city}, ${pv.country}` : "Unknown"}
                  </TableCell>
                  <TableCell className="text-right">
                    {pv.time_on_page ? formatDuration(pv.time_on_page) : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
