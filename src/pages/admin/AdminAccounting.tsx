import { useState, useEffect, useMemo } from "react";
import { format, subDays, startOfDay, endOfDay, startOfWeek, startOfMonth, parseISO, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  PoundSterling, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight,
  CalendarIcon,
  Download,
  Search,
  FileText,
  RefreshCw,
  Building2,
  Percent,
  Receipt
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from "recharts";
import { exportToCsv } from "@/lib/exportCsv";
import { DateRange } from "react-day-picker";
import { useToast } from "@/hooks/use-toast";

const LEAD_PRICE = 20; // £20 per lead

interface Transaction {
  id: string;
  date: string;
  leadId: string;
  businessName: string | null;
  amount: number;
  status: "paid" | "refunded";
  refundReason?: string | null;
  refundedAt?: string | null;
}

interface BusinessPerformance {
  businessId: string;
  businessName: string;
  revenue: number;
  leadsPurchased: number;
  refunds: number;
  refundRate: number;
  netContribution: number;
}

type DateRangePreset = "today" | "7days" | "30days" | "custom";

export default function AdminAccounting() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("30days");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "refunded">("all");
  const [activeTab, setActiveTab] = useState("overview");

  // Calculate date range based on preset
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (datePreset) {
      case "today":
        return { from: startOfDay(now), to: endOfDay(now) };
      case "7days":
        return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
      case "30days":
        return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
      case "custom":
        return customRange ? { from: customRange.from, to: customRange.to } : { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
      default:
        return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
    }
  }, [datePreset, customRange]);

  // Fetch transactions data
  useEffect(() => {
    fetchTransactions();
  }, [dateRange]);

  const fetchTransactions = async () => {
    if (!dateRange.from || !dateRange.to) return;
    
    setLoading(true);
    try {
      // Fetch all purchased leads (unlocked leads are considered sold)
      const { data: leads, error } = await supabase
        .from("leads")
        .select(`
          id,
          unlocked_at,
          unlocked_by,
          value,
          refunded_at,
          refund_reason,
          lead_status
        `)
        .eq("is_unlocked", true)
        .gte("unlocked_at", dateRange.from.toISOString())
        .lte("unlocked_at", dateRange.to.toISOString())
        .order("unlocked_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles to get business names
      const userIds = [...new Set((leads || []).map(l => l.unlocked_by).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, business_name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.business_name]) || []);

      // Transform to transactions
      const txns: Transaction[] = (leads || []).map(lead => ({
        id: lead.id,
        date: lead.unlocked_at || "",
        leadId: lead.id,
        businessName: profileMap.get(lead.unlocked_by!) || "Unknown Business",
        amount: LEAD_PRICE,
        status: lead.refunded_at ? "refunded" : "paid",
        refundReason: lead.refund_reason,
        refundedAt: lead.refunded_at,
      }));

      setTransactions(txns);
    } catch (error: any) {
      toast({
        title: "Error loading transactions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate KPIs
  const kpis = useMemo(() => {
    const grossRevenue = transactions.length * LEAD_PRICE;
    const refundedTxns = transactions.filter(t => t.status === "refunded");
    const refundsIssued = refundedTxns.length * LEAD_PRICE;
    const netRevenue = grossRevenue - refundsIssued;
    const refundRate = transactions.length > 0 ? (refundedTxns.length / transactions.length) * 100 : 0;
    
    // Calculate days in range
    const days = dateRange.from && dateRange.to 
      ? Math.max(1, Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)))
      : 1;
    const avgRevenuePerDay = netRevenue / days;

    return {
      grossRevenue,
      totalLeadsSold: transactions.length,
      avgRevenuePerDay,
      refundsIssued,
      netRevenue,
      refundRate,
      refundCount: refundedTxns.length,
    };
  }, [transactions, dateRange]);

  // Revenue by day chart data
  const dailyRevenueData = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return [];
    
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    
    return days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const dayTxns = transactions.filter(t => {
        const txDate = parseISO(t.date);
        return txDate >= dayStart && txDate <= dayEnd;
      });
      
      const gross = dayTxns.length * LEAD_PRICE;
      const refunds = dayTxns.filter(t => t.status === "refunded").length * LEAD_PRICE;
      
      return {
        date: format(day, "MMM dd"),
        gross,
        refunds,
        net: gross - refunds,
        leads: dayTxns.length,
      };
    });
  }, [transactions, dateRange]);

  // Cumulative revenue data
  const cumulativeRevenueData = useMemo(() => {
    let cumulative = 0;
    return dailyRevenueData.map(d => {
      cumulative += d.net;
      return { ...d, cumulative };
    });
  }, [dailyRevenueData]);

  // Revenue by week
  const weeklyRevenueData = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return [];
    
    const weeks = eachWeekOfInterval({ start: dateRange.from, end: dateRange.to });
    
    return weeks.map((weekStart, idx) => {
      const weekEnd = weeks[idx + 1] || dateRange.to;
      const weekTxns = transactions.filter(t => {
        const txDate = parseISO(t.date);
        return txDate >= weekStart && txDate < (weekEnd || dateRange.to!);
      });
      
      const gross = weekTxns.length * LEAD_PRICE;
      const refunds = weekTxns.filter(t => t.status === "refunded").length * LEAD_PRICE;
      
      return {
        week: format(weekStart, "MMM dd"),
        gross,
        refunds,
        net: gross - refunds,
        leads: weekTxns.length,
      };
    });
  }, [transactions, dateRange]);

  // Revenue by month
  const monthlyRevenueData = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return [];
    
    const months = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
    
    return months.map((monthStart, idx) => {
      const monthEnd = months[idx + 1] || dateRange.to;
      const monthTxns = transactions.filter(t => {
        const txDate = parseISO(t.date);
        return txDate >= monthStart && txDate < (monthEnd || dateRange.to!);
      });
      
      const gross = monthTxns.length * LEAD_PRICE;
      const refunds = monthTxns.filter(t => t.status === "refunded").length * LEAD_PRICE;
      
      return {
        month: format(monthStart, "MMM yyyy"),
        gross,
        refunds,
        net: gross - refunds,
        leads: monthTxns.length,
      };
    });
  }, [transactions, dateRange]);

  // Revenue by postcode prefix
  const revenueByLocation = useMemo(() => {
    const locationMap = new Map<string, { gross: number; refunds: number; leads: number }>();
    
    transactions.forEach(t => {
      // We'd need to join with leads to get postcode - for now use placeholder
      const prefix = "UK"; // Placeholder - would need lead data
      const existing = locationMap.get(prefix) || { gross: 0, refunds: 0, leads: 0 };
      existing.gross += LEAD_PRICE;
      if (t.status === "refunded") existing.refunds += LEAD_PRICE;
      existing.leads += 1;
      locationMap.set(prefix, existing);
    });
    
    return Array.from(locationMap.entries()).map(([location, data]) => ({
      location,
      ...data,
      net: data.gross - data.refunds,
    }));
  }, [transactions]);

  // Business performance data
  const businessPerformance = useMemo(() => {
    const businessMap = new Map<string, BusinessPerformance>();
    
    transactions.forEach(t => {
      const name = t.businessName || "Unknown";
      const existing = businessMap.get(name) || {
        businessId: name,
        businessName: name,
        revenue: 0,
        leadsPurchased: 0,
        refunds: 0,
        refundRate: 0,
        netContribution: 0,
      };
      
      existing.revenue += LEAD_PRICE;
      existing.leadsPurchased += 1;
      if (t.status === "refunded") {
        existing.refunds += LEAD_PRICE;
      }
      
      businessMap.set(name, existing);
    });
    
    // Calculate rates and net
    return Array.from(businessMap.values()).map(b => ({
      ...b,
      refundRate: b.leadsPurchased > 0 ? (b.refunds / b.revenue) * 100 : 0,
      netContribution: b.revenue - b.refunds,
    })).sort((a, b) => b.netContribution - a.netContribution);
  }, [transactions]);

  // Filtered transactions for ledger
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = searchQuery === "" || 
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.businessName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchQuery, statusFilter]);

  // Refund-only transactions
  const refundTransactions = useMemo(() => {
    return transactions.filter(t => t.status === "refunded");
  }, [transactions]);

  // Refunds by business
  const refundsByBusiness = useMemo(() => {
    const businessMap = new Map<string, { count: number; amount: number }>();
    
    refundTransactions.forEach(t => {
      const name = t.businessName || "Unknown";
      const existing = businessMap.get(name) || { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += LEAD_PRICE;
      businessMap.set(name, existing);
    });
    
    return Array.from(businessMap.entries())
      .map(([name, data]) => ({ businessName: name, ...data }))
      .sort((a, b) => b.amount - a.amount);
  }, [refundTransactions]);

  // Refunds by reason
  const refundsByReason = useMemo(() => {
    const reasonMap = new Map<string, { count: number; amount: number }>();
    
    refundTransactions.forEach(t => {
      const reason = t.refundReason || "Unspecified";
      const existing = reasonMap.get(reason) || { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += LEAD_PRICE;
      reasonMap.set(reason, existing);
    });
    
    return Array.from(reasonMap.entries())
      .map(([reason, data]) => ({ reason, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [refundTransactions]);

  const handleExportTransactions = () => {
    exportToCsv(filteredTransactions.map(t => ({
      "Transaction ID": t.id,
      "Date": format(parseISO(t.date), "yyyy-MM-dd HH:mm"),
      "Lead ID": t.leadId,
      "Business": t.businessName || "N/A",
      "Amount (£)": t.amount,
      "Status": t.status,
      "Refund Reason": t.refundReason || "",
      "Refunded At": t.refundedAt ? format(parseISO(t.refundedAt), "yyyy-MM-dd HH:mm") : "",
    })), `transactions_${format(new Date(), "yyyy-MM-dd")}`);
    
    toast({ title: "Exported", description: "Transactions exported to CSV" });
  };

  const handleExportRefunds = () => {
    exportToCsv(refundTransactions.map(t => ({
      "Refund ID": t.id,
      "Original Transaction ID": t.id,
      "Lead ID": t.leadId,
      "Business": t.businessName || "N/A",
      "Amount (£)": t.amount,
      "Reason": t.refundReason || "Unspecified",
      "Refunded At": t.refundedAt ? format(parseISO(t.refundedAt), "yyyy-MM-dd HH:mm") : "",
    })), `refunds_${format(new Date(), "yyyy-MM-dd")}`);
    
    toast({ title: "Exported", description: "Refunds exported to CSV" });
  };

  return (
    <AdminLayout title="Accounting">
      <div className="space-y-6">
        {/* Date Range Selector */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DateRangePreset)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {datePreset === "custom" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {customRange?.from ? (
                        customRange.to ? (
                          <>
                            {format(customRange.from, "MMM dd")} - {format(customRange.to, "MMM dd")}
                          </>
                        ) : (
                          format(customRange.from, "MMM dd, yyyy")
                        )
                      ) : (
                        "Pick dates"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={customRange}
                      onSelect={setCustomRange}
                      numberOfMonths={2}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              )}

              <Button variant="outline" size="icon" onClick={fetchTransactions} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>

              <div className="ml-auto text-sm text-muted-foreground">
                {dateRange.from && dateRange.to && (
                  <>Showing: {format(dateRange.from, "MMM dd, yyyy")} - {format(dateRange.to, "MMM dd, yyyy")}</>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="ledger">Transactions</TabsTrigger>
            <TabsTrigger value="refunds">Refunds</TabsTrigger>
            <TabsTrigger value="businesses">Businesses</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
                  <PoundSterling className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold">£{kpis.grossRevenue.toLocaleString()}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Leads Sold</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <div className="text-2xl font-bold">{kpis.totalLeadsSold}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg/Day</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="text-2xl font-bold">£{kpis.avgRevenuePerDay.toFixed(0)}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Refunds</CardTitle>
                  <TrendingDown className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="text-2xl font-bold text-destructive">£{kpis.refundsIssued.toLocaleString()}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Revenue</CardTitle>
                  <PoundSterling className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold text-primary">£{kpis.netRevenue.toLocaleString()}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Refund Rate</CardTitle>
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <div className={cn(
                      "text-2xl font-bold",
                      kpis.refundRate > 10 ? "text-destructive" : kpis.refundRate > 5 ? "text-amber-500" : "text-green-500"
                    )}>
                      {kpis.refundRate.toFixed(1)}%
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Revenue Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Daily revenue over the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {loading ? (
                    <Skeleton className="h-full w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyRevenueData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" tickFormatter={(v) => `£${v}`} />
                        <Tooltip 
                          formatter={(value: number) => [`£${value}`, ""]}
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px"
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="net" 
                          stroke="hsl(var(--primary))" 
                          fill="hsl(var(--primary) / 0.2)" 
                          name="Net Revenue"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Net Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Net Performance</CardTitle>
                <CardDescription>Financial summary for the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">Gross Revenue</span>
                    <span className="font-medium">£{kpis.grossRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">Less: Refunds ({kpis.refundCount})</span>
                    <span className="font-medium text-destructive">-£{kpis.refundsIssued.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 text-lg font-bold">
                    <span>Net Revenue</span>
                    <span className="text-primary">£{kpis.netRevenue.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REVENUE TAB */}
          <TabsContent value="revenue" className="space-y-6">
            {/* Daily/Weekly/Monthly Tables */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Daily Revenue */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Day</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">Gross</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyRevenueData.slice().reverse().map((day) => (
                          <TableRow key={day.date}>
                            <TableCell>{day.date}</TableCell>
                            <TableCell className="text-right">{day.leads}</TableCell>
                            <TableCell className="text-right">£{day.gross}</TableCell>
                            <TableCell className="text-right font-medium">£{day.net}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Weekly Revenue */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Week</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Week Starting</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">Gross</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weeklyRevenueData.map((week) => (
                          <TableRow key={week.week}>
                            <TableCell>{week.week}</TableCell>
                            <TableCell className="text-right">{week.leads}</TableCell>
                            <TableCell className="text-right">£{week.gross}</TableCell>
                            <TableCell className="text-right font-medium">£{week.net}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Monthly Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `£${v}`} />
                      <Tooltip 
                        formatter={(value: number) => [`£${value}`, ""]}
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                      />
                      <Bar dataKey="gross" fill="hsl(var(--muted-foreground) / 0.3)" name="Gross" />
                      <Bar dataKey="net" fill="hsl(var(--primary))" name="Net" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Cumulative Revenue */}
            <Card>
              <CardHeader>
                <CardTitle>Cumulative Revenue</CardTitle>
                <CardDescription>Running total over the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cumulativeRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `£${v}`} />
                      <Tooltip 
                        formatter={(value: number) => [`£${value}`, ""]}
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="cumulative" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={false}
                        name="Cumulative Revenue"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TRANSACTIONS LEDGER TAB */}
          <TabsContent value="ledger" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <CardTitle>Transactions Ledger</CardTitle>
                    <CardDescription>All financial transactions for the selected period</CardDescription>
                  </div>
                  <Button variant="outline" onClick={handleExportTransactions}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-wrap gap-4 mb-4">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by ID or business..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Table */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Lead ID</TableHead>
                        <TableHead>Business</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Refund Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 7 }).map((_, j) => (
                              <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : filteredTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No transactions found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTransactions.map((txn) => (
                          <TableRow key={txn.id}>
                            <TableCell className="font-mono text-xs">{txn.id.slice(0, 8)}...</TableCell>
                            <TableCell>{format(parseISO(txn.date), "MMM dd, yyyy HH:mm")}</TableCell>
                            <TableCell className="font-mono text-xs">{txn.leadId.slice(0, 8)}...</TableCell>
                            <TableCell>{txn.businessName}</TableCell>
                            <TableCell className="text-right font-medium">£{txn.amount}</TableCell>
                            <TableCell>
                              <Badge variant={txn.status === "paid" ? "default" : "destructive"}>
                                {txn.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {txn.refundedAt ? (
                                <span className="text-xs text-muted-foreground">
                                  {format(parseISO(txn.refundedAt), "MMM dd")}
                                </span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Showing {filteredTransactions.length} of {transactions.length} transactions
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REFUNDS TAB */}
          <TabsContent value="refunds" className="space-y-6">
            {/* Refund KPIs */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Refunds</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">£{kpis.refundsIssued.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Refund Count</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis.refundCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Refund Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    "text-2xl font-bold",
                    kpis.refundRate > 10 ? "text-destructive" : kpis.refundRate > 5 ? "text-amber-500" : "text-green-500"
                  )}>
                    {kpis.refundRate.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Avg Refund</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">£{LEAD_PRICE}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Refunds by Business */}
              <Card>
                <CardHeader>
                  <CardTitle>Refunds by Business</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {refundsByBusiness.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                            No refunds in period
                          </TableCell>
                        </TableRow>
                      ) : (
                        refundsByBusiness.map((b) => (
                          <TableRow key={b.businessName}>
                            <TableCell>{b.businessName}</TableCell>
                            <TableCell className="text-right">{b.count}</TableCell>
                            <TableCell className="text-right text-destructive">£{b.amount}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Refunds by Reason */}
              <Card>
                <CardHeader>
                  <CardTitle>Refunds by Reason</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {refundsByReason.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                            No refunds in period
                          </TableCell>
                        </TableRow>
                      ) : (
                        refundsByReason.map((r) => (
                          <TableRow key={r.reason}>
                            <TableCell>{r.reason}</TableCell>
                            <TableCell className="text-right">{r.count}</TableCell>
                            <TableCell className="text-right text-destructive">£{r.amount}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Refunds Detailed Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Refund Details</CardTitle>
                  <Button variant="outline" onClick={handleExportRefunds}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Refund ID</TableHead>
                      <TableHead>Lead ID</TableHead>
                      <TableHead>Business</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refundTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No refunds in selected period
                        </TableCell>
                      </TableRow>
                    ) : (
                      refundTransactions.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell className="font-mono text-xs">{txn.id.slice(0, 8)}...</TableCell>
                          <TableCell className="font-mono text-xs">{txn.leadId.slice(0, 8)}...</TableCell>
                          <TableCell>{txn.businessName}</TableCell>
                          <TableCell className="text-right text-destructive">£{txn.amount}</TableCell>
                          <TableCell>{txn.refundReason || "Unspecified"}</TableCell>
                          <TableCell>
                            {txn.refundedAt ? format(parseISO(txn.refundedAt), "MMM dd, yyyy") : "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BUSINESSES TAB */}
          <TabsContent value="businesses" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Business Financial Performance</CardTitle>
                <CardDescription>Revenue and refund metrics per cleaning business</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead className="text-right">Leads Purchased</TableHead>
                      <TableHead className="text-right">Gross Revenue</TableHead>
                      <TableHead className="text-right">Refunds</TableHead>
                      <TableHead className="text-right">Refund Rate</TableHead>
                      <TableHead className="text-right">Net Contribution</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {businessPerformance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No business data in selected period
                        </TableCell>
                      </TableRow>
                    ) : (
                      businessPerformance.map((b) => (
                        <TableRow key={b.businessId}>
                          <TableCell className="font-medium">{b.businessName}</TableCell>
                          <TableCell className="text-right">{b.leadsPurchased}</TableCell>
                          <TableCell className="text-right">£{b.revenue}</TableCell>
                          <TableCell className="text-right text-destructive">
                            {b.refunds > 0 ? `£${b.refunds}` : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              b.refundRate > 15 ? "text-destructive" : 
                              b.refundRate > 5 ? "text-amber-500" : "text-green-500"
                            )}>
                              {b.refundRate.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            £{b.netContribution}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Business Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Top Businesses by Net Contribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={businessPerformance.slice(0, 10)} 
                      layout="vertical"
                      margin={{ left: 100 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tickFormatter={(v) => `£${v}`} />
                      <YAxis type="category" dataKey="businessName" width={100} className="text-xs" />
                      <Tooltip 
                        formatter={(value: number) => [`£${value}`, ""]}
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                      />
                      <Bar dataKey="netContribution" fill="hsl(var(--primary))" name="Net Contribution" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}