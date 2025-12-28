import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Send,
  CheckCircle,
  Eye,
  MousePointerClick,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

interface EmailMetrics {
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

interface DailyStats {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  bounced: number;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"];

export function EmailDeliverabilityDashboard() {
  const [metrics, setMetrics] = useState<EmailMetrics | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // Fetch overall metrics for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: logs, error } = await supabase
        .from("email_logs")
        .select("*")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .eq("is_test", false);

      if (error) throw error;

      const totalSent = logs?.length || 0;
      const delivered = logs?.filter((l) => l.delivered_at).length || 0;
      const opened = logs?.filter((l) => l.opened_at).length || 0;
      const clicked = logs?.filter((l) => l.clicked_at).length || 0;
      const bounced = logs?.filter((l) => l.bounced_at).length || 0;

      setMetrics({
        totalSent,
        delivered,
        opened,
        clicked,
        bounced,
        deliveryRate: totalSent > 0 ? (delivered / totalSent) * 100 : 0,
        openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
        clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
        bounceRate: totalSent > 0 ? (bounced / totalSent) * 100 : 0,
      });

      // Calculate daily stats for last 7 days
      const dailyMap = new Map<string, DailyStats>();
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        last7Days.push(dateStr);
        dailyMap.set(dateStr, { date: dateStr, sent: 0, delivered: 0, opened: 0, bounced: 0 });
      }

      logs?.forEach((log) => {
        const dateStr = log.created_at.split("T")[0];
        const stats = dailyMap.get(dateStr);
        if (stats) {
          stats.sent++;
          if (log.delivered_at) stats.delivered++;
          if (log.opened_at) stats.opened++;
          if (log.bounced_at) stats.bounced++;
        }
      });

      setDailyStats(last7Days.map((d) => dailyMap.get(d)!));
    } catch (error) {
      console.error("Error fetching email metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
  };

  const getTrendIcon = (value: number, threshold: number, inverse = false) => {
    if (inverse) {
      if (value < threshold) return <TrendingUp className="w-4 h-4 text-green-500" />;
      if (value > threshold) return <TrendingDown className="w-4 h-4 text-red-500" />;
    } else {
      if (value > threshold) return <TrendingUp className="w-4 h-4 text-green-500" />;
      if (value < threshold) return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const pieData = [
    { name: "Delivered", value: metrics.delivered - metrics.opened },
    { name: "Opened", value: metrics.opened - metrics.clicked },
    { name: "Clicked", value: metrics.clicked },
    { name: "Bounced", value: metrics.bounced },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sent</p>
                <p className="text-2xl font-bold">{metrics.totalSent}</p>
                <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-secondary/20 flex items-center justify-center">
                <Send className="h-6 w-6 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Delivery Rate</p>
                <p className="text-2xl font-bold">{metrics.deliveryRate.toFixed(1)}%</p>
                <div className="flex items-center gap-1 mt-1">
                  {getTrendIcon(metrics.deliveryRate, 95)}
                  <span className="text-xs text-muted-foreground">{metrics.delivered} delivered</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Rate</p>
                <p className="text-2xl font-bold">{metrics.openRate.toFixed(1)}%</p>
                <div className="flex items-center gap-1 mt-1">
                  {getTrendIcon(metrics.openRate, 20)}
                  <span className="text-xs text-muted-foreground">{metrics.opened} opened</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Eye className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Click Rate</p>
                <p className="text-2xl font-bold">{metrics.clickRate.toFixed(1)}%</p>
                <div className="flex items-center gap-1 mt-1">
                  {getTrendIcon(metrics.clickRate, 5)}
                  <span className="text-xs text-muted-foreground">{metrics.clicked} clicked</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                <MousePointerClick className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bounce Rate</p>
                <p className="text-2xl font-bold">{metrics.bounceRate.toFixed(1)}%</p>
                <div className="flex items-center gap-1 mt-1">
                  {getTrendIcon(metrics.bounceRate, 2, true)}
                  <span className="text-xs text-muted-foreground">{metrics.bounced} bounced</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Daily Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email Activity (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyStats.some((d) => d.sent > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip
                    labelFormatter={formatDate}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="sent" name="Sent" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delivered" name="Delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="opened" name="Opened" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No email activity in the last 7 days
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No email data to display
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Benchmarks Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Industry Benchmarks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground">Delivery Rate</p>
              <p className="font-medium">Target: 95%+</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your rate:{" "}
                <span className={metrics.deliveryRate >= 95 ? "text-green-500" : "text-amber-500"}>
                  {metrics.deliveryRate.toFixed(1)}%
                </span>
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground">Open Rate</p>
              <p className="font-medium">Target: 15-25%</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your rate:{" "}
                <span className={metrics.openRate >= 15 ? "text-green-500" : "text-amber-500"}>
                  {metrics.openRate.toFixed(1)}%
                </span>
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground">Click Rate</p>
              <p className="font-medium">Target: 2-5%</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your rate:{" "}
                <span className={metrics.clickRate >= 2 ? "text-green-500" : "text-amber-500"}>
                  {metrics.clickRate.toFixed(1)}%
                </span>
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground">Bounce Rate</p>
              <p className="font-medium">Target: {"<"}2%</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your rate:{" "}
                <span className={metrics.bounceRate < 2 ? "text-green-500" : "text-red-500"}>
                  {metrics.bounceRate.toFixed(1)}%
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
