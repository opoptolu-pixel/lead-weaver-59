import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CityStats {
  city: string;
  region: string;
  leads: number;
  purchased: number;
  purchaseRate: number;
  revenue: number;
}

interface LeadData {
  id: string;
  postcode: string;
  created_at: string;
  is_unlocked: boolean;
  refunded_at?: string;
}

interface TrendComparisonChartProps {
  leads: LeadData[];
  extractCityFromPostcode: (postcode: string) => { city: string; region: string };
  dateRange: { from: Date; to: Date } | string | null;
}

interface WeeklyData {
  week: string;
  weekStart: Date;
  weekEnd: Date;
  leads: number;
  purchased: number;
  revenue: number;
  purchaseRate: number;
}

interface CityTrend {
  city: string;
  region: string;
  currentWeek: WeeklyData;
  previousWeek: WeeklyData;
  leadsChange: number;
  purchaseChange: number;
  revenueChange: number;
  rateChange: number;
  trend: 'up' | 'down' | 'stable';
}

export function TrendComparisonChart({ leads, extractCityFromPostcode, dateRange }: TrendComparisonChartProps) {
  const weeklyTrends = useMemo(() => {
    if (!leads.length) return [];

    // Group leads by week and city
    const weekCityMap = new Map<string, Map<string, WeeklyData>>();
    
    leads.forEach(lead => {
      const date = new Date(lead.created_at);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      const weekKey = weekStart.toISOString().split('T')[0];
      const { city, region } = extractCityFromPostcode(lead.postcode);
      const cityKey = `${city}-${region}`;
      
      if (!weekCityMap.has(weekKey)) {
        weekCityMap.set(weekKey, new Map());
      }
      
      const cityMap = weekCityMap.get(weekKey)!;
      if (!cityMap.has(cityKey)) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        cityMap.set(cityKey, {
          week: weekKey,
          weekStart,
          weekEnd,
          leads: 0,
          purchased: 0,
          revenue: 0,
          purchaseRate: 0
        });
      }
      
      const stats = cityMap.get(cityKey)!;
      stats.leads++;
      if (lead.is_unlocked) {
        stats.purchased++;
        stats.revenue += 20;
      }
      stats.purchaseRate = stats.leads > 0 ? Math.round((stats.purchased / stats.leads) * 100) : 0;
    });

    // Sort weeks
    const sortedWeeks = Array.from(weekCityMap.keys()).sort().reverse();
    if (sortedWeeks.length < 2) return [];

    const currentWeekKey = sortedWeeks[0];
    const previousWeekKey = sortedWeeks[1];
    const currentWeekData = weekCityMap.get(currentWeekKey)!;
    const previousWeekData = weekCityMap.get(previousWeekKey)!;

    // Calculate trends for each city
    const allCities = new Set([...currentWeekData.keys(), ...previousWeekData.keys()]);
    const trends: CityTrend[] = [];

    allCities.forEach(cityKey => {
      const [city, region] = cityKey.split('-');
      const current = currentWeekData.get(cityKey) || {
        week: currentWeekKey,
        weekStart: new Date(currentWeekKey),
        weekEnd: new Date(currentWeekKey),
        leads: 0,
        purchased: 0,
        revenue: 0,
        purchaseRate: 0
      };
      const previous = previousWeekData.get(cityKey) || {
        week: previousWeekKey,
        weekStart: new Date(previousWeekKey),
        weekEnd: new Date(previousWeekKey),
        leads: 0,
        purchased: 0,
        revenue: 0,
        purchaseRate: 0
      };

      const leadsChange = previous.leads > 0 
        ? Math.round(((current.leads - previous.leads) / previous.leads) * 100)
        : current.leads > 0 ? 100 : 0;
      
      const purchaseChange = previous.purchased > 0
        ? Math.round(((current.purchased - previous.purchased) / previous.purchased) * 100)
        : current.purchased > 0 ? 100 : 0;
      
      const revenueChange = previous.revenue > 0
        ? Math.round(((current.revenue - previous.revenue) / previous.revenue) * 100)
        : current.revenue > 0 ? 100 : 0;
      
      const rateChange = current.purchaseRate - previous.purchaseRate;

      trends.push({
        city,
        region,
        currentWeek: current,
        previousWeek: previous,
        leadsChange,
        purchaseChange,
        revenueChange,
        rateChange,
        trend: leadsChange > 5 ? 'up' : leadsChange < -5 ? 'down' : 'stable'
      });
    });

    return trends
      .filter(t => t.currentWeek.leads > 0 || t.previousWeek.leads > 0)
      .sort((a, b) => b.currentWeek.leads - a.currentWeek.leads);
  }, [leads, extractCityFromPostcode]);

  // Prepare chart data for top 5 cities
  const chartData = useMemo(() => {
    if (!leads.length) return [];

    const weekMap = new Map<string, Record<string, number>>();
    const topCities = weeklyTrends.slice(0, 5).map(t => t.city);

    leads.forEach(lead => {
      const date = new Date(lead.created_at);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      
      const { city } = extractCityFromPostcode(lead.postcode);
      
      if (!topCities.includes(city)) return;
      
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {});
      }
      
      const weekData = weekMap.get(weekKey)!;
      weekData[city] = (weekData[city] || 0) + 1;
    });

    return Array.from(weekMap.entries())
      .map(([week, cities]) => ({ week, ...cities }))
      .slice(-8);
  }, [leads, weeklyTrends, extractCityFromPostcode]);

  const colors = [
    "hsl(var(--secondary))",
    "hsl(142, 76%, 36%)",
    "hsl(200, 80%, 50%)",
    "hsl(280, 65%, 60%)",
    "hsl(30, 80%, 55%)"
  ];

  const TrendIcon = ({ value }: { value: number }) => {
    if (value > 5) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (value < -5) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const ChangeIndicator = ({ value, suffix = '%' }: { value: number; suffix?: string }) => (
    <span className={cn(
      "flex items-center gap-1 text-sm font-medium",
      value > 0 ? "text-green-600" : value < 0 ? "text-red-600" : "text-muted-foreground"
    )}>
      {value > 0 ? <ArrowUpRight className="w-3 h-3" /> : value < 0 ? <ArrowDownRight className="w-3 h-3" /> : null}
      {value > 0 ? '+' : ''}{value}{suffix}
    </span>
  );

  if (weeklyTrends.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-secondary" />
            Week-over-Week Trends
          </CardTitle>
          <CardDescription>Need at least 2 weeks of data to show trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Not enough data to calculate trends</p>
            <p className="text-sm">Trends will appear after 2 weeks of activity</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-secondary" />
            City Performance Trends
          </CardTitle>
          <CardDescription>Weekly lead volume for top 5 cities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="week" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))" 
                  }} 
                />
                <Legend />
                {weeklyTrends.slice(0, 5).map((trend, idx) => (
                  <Line
                    key={trend.city}
                    type="monotone"
                    dataKey={trend.city}
                    stroke={colors[idx]}
                    strokeWidth={2}
                    dot={{ fill: colors[idx], strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Week-over-Week Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Week-over-Week Comparison</CardTitle>
          <CardDescription>How each city is performing compared to last week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium">City</th>
                  <th className="text-right py-3 px-2 font-medium">This Week</th>
                  <th className="text-right py-3 px-2 font-medium">Last Week</th>
                  <th className="text-right py-3 px-2 font-medium">Leads Δ</th>
                  <th className="text-right py-3 px-2 font-medium">Revenue Δ</th>
                  <th className="text-right py-3 px-2 font-medium">Rate Δ</th>
                  <th className="text-center py-3 px-2 font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {weeklyTrends.slice(0, 10).map((trend) => (
                  <tr key={trend.city} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2">
                      <div>
                        <p className="font-medium">{trend.city}</p>
                        <p className="text-xs text-muted-foreground">{trend.region}</p>
                      </div>
                    </td>
                    <td className="text-right py-3 px-2">
                      <div>
                        <p className="font-medium">{trend.currentWeek.leads} leads</p>
                        <p className="text-xs text-muted-foreground">£{trend.currentWeek.revenue}</p>
                      </div>
                    </td>
                    <td className="text-right py-3 px-2">
                      <div>
                        <p className="font-medium">{trend.previousWeek.leads} leads</p>
                        <p className="text-xs text-muted-foreground">£{trend.previousWeek.revenue}</p>
                      </div>
                    </td>
                    <td className="text-right py-3 px-2">
                      <ChangeIndicator value={trend.leadsChange} />
                    </td>
                    <td className="text-right py-3 px-2">
                      <ChangeIndicator value={trend.revenueChange} />
                    </td>
                    <td className="text-right py-3 px-2">
                      <ChangeIndicator value={trend.rateChange} suffix="pts" />
                    </td>
                    <td className="text-center py-3 px-2">
                      <div className="flex justify-center">
                        <Badge 
                          variant={trend.trend === 'up' ? 'default' : trend.trend === 'down' ? 'destructive' : 'secondary'}
                          className={cn(
                            trend.trend === 'up' && "bg-green-500",
                            "flex items-center gap-1"
                          )}
                        >
                          <TrendIcon value={trend.leadsChange} />
                          {trend.trend === 'up' ? 'Growing' : trend.trend === 'down' ? 'Declining' : 'Stable'}
                        </Badge>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
