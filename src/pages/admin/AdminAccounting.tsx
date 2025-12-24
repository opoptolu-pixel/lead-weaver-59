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
  Receipt,
  Printer
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
import { exportToCsv } from "@/lib/exportCsv";
import { DateRange } from "react-day-picker";
import { useToast } from "@/hooks/use-toast";

const LEAD_PRICE = 20; // £20 per lead

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(220, 70%, 50%)",
  "hsl(340, 70%, 50%)",
  "hsl(160, 70%, 50%)",
  "hsl(40, 70%, 50%)",
  "hsl(280, 70%, 50%)",
];

interface Transaction {
  id: string;
  date: string;
  leadId: string;
  businessName: string | null;
  amount: number;
  status: "paid" | "refunded";
  refundReason?: string | null;
  refundedAt?: string | null;
  postcode?: string;
  jobType?: string;
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
  const [previousTransactions, setPreviousTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "refunded">("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [showPrintView, setShowPrintView] = useState(false);

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

  // Calculate previous period range for comparison
  const previousDateRange = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return { from: undefined, to: undefined };
    const periodDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
    return {
      from: subDays(dateRange.from, periodDays),
      to: subDays(dateRange.to, periodDays),
    };
  }, [dateRange]);

  // Fetch transactions data
  useEffect(() => {
    fetchTransactions();
  }, [dateRange]);

  const fetchTransactions = async () => {
    if (!dateRange.from || !dateRange.to) return;
    
    setLoading(true);
    try {
      // Fetch current period leads
      const { data: leads, error } = await supabase
        .from("leads")
        .select(`
          id,
          unlocked_at,
          unlocked_by,
          value,
          refunded_at,
          refund_reason,
          lead_status,
          postcode,
          job_type
        `)
        .eq("is_unlocked", true)
        .gte("unlocked_at", dateRange.from.toISOString())
        .lte("unlocked_at", dateRange.to.toISOString())
        .order("unlocked_at", { ascending: false });

      if (error) throw error;

      // Fetch previous period leads for comparison
      let prevLeads: typeof leads = [];
      if (previousDateRange.from && previousDateRange.to) {
        const { data: prevData } = await supabase
          .from("leads")
          .select(`
            id,
            unlocked_at,
            unlocked_by,
            value,
            refunded_at,
            refund_reason,
            lead_status,
            postcode,
            job_type
          `)
          .eq("is_unlocked", true)
          .gte("unlocked_at", previousDateRange.from.toISOString())
          .lte("unlocked_at", previousDateRange.to.toISOString());
        prevLeads = prevData || [];
      }

      // Fetch profiles to get business names
      const allLeads = [...(leads || []), ...prevLeads];
      const userIds = [...new Set(allLeads.map(l => l.unlocked_by).filter(Boolean))];
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
        postcode: lead.postcode,
        jobType: lead.job_type,
      }));

      const prevTxns: Transaction[] = prevLeads.map(lead => ({
        id: lead.id,
        date: lead.unlocked_at || "",
        leadId: lead.id,
        businessName: profileMap.get(lead.unlocked_by!) || "Unknown Business",
        amount: LEAD_PRICE,
        status: lead.refunded_at ? "refunded" : "paid",
        refundReason: lead.refund_reason,
        refundedAt: lead.refunded_at,
        postcode: lead.postcode,
        jobType: lead.job_type,
      }));

      setTransactions(txns);
      setPreviousTransactions(prevTxns);
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

  // Calculate previous period KPIs for comparison
  const previousKpis = useMemo(() => {
    const grossRevenue = previousTransactions.length * LEAD_PRICE;
    const refundedTxns = previousTransactions.filter(t => t.status === "refunded");
    const refundsIssued = refundedTxns.length * LEAD_PRICE;
    const netRevenue = grossRevenue - refundsIssued;
    const refundRate = previousTransactions.length > 0 ? (refundedTxns.length / previousTransactions.length) * 100 : 0;
    
    const days = previousDateRange.from && previousDateRange.to 
      ? Math.max(1, Math.ceil((previousDateRange.to.getTime() - previousDateRange.from.getTime()) / (1000 * 60 * 60 * 24)))
      : 1;
    const avgRevenuePerDay = netRevenue / days;

    return {
      grossRevenue,
      totalLeadsSold: previousTransactions.length,
      avgRevenuePerDay,
      refundsIssued,
      netRevenue,
      refundRate,
      refundCount: refundedTxns.length,
    };
  }, [previousTransactions, previousDateRange]);

  // Calculate trend percentages
  const trends = useMemo(() => {
    const calcTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      grossRevenue: calcTrend(kpis.grossRevenue, previousKpis.grossRevenue),
      totalLeadsSold: calcTrend(kpis.totalLeadsSold, previousKpis.totalLeadsSold),
      avgRevenuePerDay: calcTrend(kpis.avgRevenuePerDay, previousKpis.avgRevenuePerDay),
      refundsIssued: calcTrend(kpis.refundsIssued, previousKpis.refundsIssued),
      netRevenue: calcTrend(kpis.netRevenue, previousKpis.netRevenue),
      refundRate: calcTrend(kpis.refundRate, previousKpis.refundRate),
    };
  }, [kpis, previousKpis]);

  // Trend indicator component
  const TrendIndicator = ({ value, inverted = false }: { value: number; inverted?: boolean }) => {
    const isPositive = inverted ? value < 0 : value > 0;
    const isNegative = inverted ? value > 0 : value < 0;
    
    if (value === 0) return null;
    
    return (
      <div className={cn(
        "flex items-center gap-1 text-xs font-medium",
        isPositive ? "text-green-500" : isNegative ? "text-destructive" : "text-muted-foreground"
      )}>
        {value > 0 ? (
          <ArrowUpRight className="h-3 w-3" />
        ) : (
          <ArrowDownRight className="h-3 w-3" />
        )}
        <span>{Math.abs(value).toFixed(1)}%</span>
      </div>
    );
  };

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

  // Revenue by postcode prefix (outward code)
  const revenueByLocation = useMemo(() => {
    const locationMap = new Map<string, { gross: number; refunds: number; leads: number }>();
    
    transactions.forEach(t => {
      // Extract outward code from postcode
      let prefix = "Unknown";
      if (t.postcode) {
        const pc = t.postcode.trim().toUpperCase();
        if (pc.includes(" ")) {
          prefix = pc.split(" ")[0];
        } else if (pc.length > 3) {
          prefix = pc.slice(0, -3);
        } else {
          prefix = pc;
        }
      }
      const existing = locationMap.get(prefix) || { gross: 0, refunds: 0, leads: 0 };
      existing.gross += LEAD_PRICE;
      if (t.status === "refunded") existing.refunds += LEAD_PRICE;
      existing.leads += 1;
      locationMap.set(prefix, existing);
    });
    
    return Array.from(locationMap.entries())
      .map(([location, data]) => ({
        location,
        ...data,
        net: data.gross - data.refunds,
      }))
      .sort((a, b) => b.net - a.net);
  }, [transactions]);

  // Revenue by job type (service category)
  const revenueByJobType = useMemo(() => {
    const jobTypeMap = new Map<string, { gross: number; refunds: number; leads: number }>();
    
    transactions.forEach(t => {
      const jobType = t.jobType || "Unknown";
      const existing = jobTypeMap.get(jobType) || { gross: 0, refunds: 0, leads: 0 };
      existing.gross += LEAD_PRICE;
      if (t.status === "refunded") existing.refunds += LEAD_PRICE;
      existing.leads += 1;
      jobTypeMap.set(jobType, existing);
    });
    
    return Array.from(jobTypeMap.entries())
      .map(([jobType, data]) => ({
        jobType,
        ...data,
        net: data.gross - data.refunds,
      }))
      .sort((a, b) => b.net - a.net);
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

              <Button variant="outline" onClick={() => setShowPrintView(true)}>
                <Printer className="h-4 w-4 mr-2" />
                Print Report
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
                    <>
                      <div className="text-2xl font-bold">£{kpis.grossRevenue.toLocaleString()}</div>
                      <TrendIndicator value={trends.grossRevenue} />
                    </>
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
                    <>
                      <div className="text-2xl font-bold">{kpis.totalLeadsSold}</div>
                      <TrendIndicator value={trends.totalLeadsSold} />
                    </>
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
                    <>
                      <div className="text-2xl font-bold">£{kpis.avgRevenuePerDay.toFixed(0)}</div>
                      <TrendIndicator value={trends.avgRevenuePerDay} />
                    </>
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
                    <>
                      <div className="text-2xl font-bold text-destructive">£{kpis.refundsIssued.toLocaleString()}</div>
                      <TrendIndicator value={trends.refundsIssued} inverted />
                    </>
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
                    <>
                      <div className="text-2xl font-bold text-primary">£{kpis.netRevenue.toLocaleString()}</div>
                      <TrendIndicator value={trends.netRevenue} />
                    </>
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
                    <>
                      <div className={cn(
                        "text-2xl font-bold",
                        kpis.refundRate > 10 ? "text-destructive" : kpis.refundRate > 5 ? "text-amber-500" : "text-green-500"
                      )}>
                        {kpis.refundRate.toFixed(1)}%
                      </div>
                      <TrendIndicator value={trends.refundRate} inverted />
                    </>
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

            {/* Revenue by Service Category (Job Type) */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Service Category</CardTitle>
                  <CardDescription>Breakdown by job type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueByJobType} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" className="text-xs" tickFormatter={(v) => `£${v}`} />
                        <YAxis type="category" dataKey="jobType" className="text-xs" width={120} />
                        <Tooltip 
                          formatter={(value: number) => [`£${value}`, ""]}
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px"
                          }}
                        />
                        <Bar dataKey="net" fill="hsl(var(--primary))" name="Net Revenue" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Revenue by Postcode/Location */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Location</CardTitle>
                  <CardDescription>Breakdown by postcode area</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueByLocation.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" className="text-xs" tickFormatter={(v) => `£${v}`} />
                        <YAxis type="category" dataKey="location" className="text-xs" width={80} />
                        <Tooltip 
                          formatter={(value: number) => [`£${value}`, ""]}
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px"
                          }}
                        />
                        <Bar dataKey="net" fill="hsl(var(--chart-2))" name="Net Revenue" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Donut Charts for Distribution */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Service Category Distribution</CardTitle>
                  <CardDescription>Revenue share by service type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={revenueByJobType}
                          dataKey="net"
                          nameKey="jobType"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          label={({ jobType, percent }) => `${jobType}: ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {revenueByJobType.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [`£${value}`, "Net Revenue"]}
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px"
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center Total */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-lg font-bold">£{revenueByJobType.reduce((sum, item) => sum + item.net, 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Location Distribution</CardTitle>
                  <CardDescription>Revenue share by postcode area (Top 8)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={revenueByLocation.slice(0, 8)}
                          dataKey="net"
                          nameKey="location"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          label={({ location, percent }) => `${location}: ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {revenueByLocation.slice(0, 8).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [`£${value}`, "Net Revenue"]}
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px"
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center Total */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-lg font-bold">£{revenueByLocation.slice(0, 8).reduce((sum, item) => sum + item.net, 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Tables for Service & Location */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Service Category Details</CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        exportToCsv(revenueByJobType.map(item => ({
                          "Service Type": item.jobType,
                          "Leads": item.leads,
                          "Gross (£)": item.gross,
                          "Refunds (£)": item.refunds,
                          "Net (£)": item.net,
                        })), `revenue_by_service_${format(new Date(), "yyyy-MM-dd")}`);
                        toast({ title: "Exported", description: "Service category data exported to CSV" });
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service Type</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">Gross</TableHead>
                          <TableHead className="text-right">Refunds</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {revenueByJobType.map((item) => (
                          <TableRow key={item.jobType}>
                            <TableCell className="font-medium">{item.jobType}</TableCell>
                            <TableCell className="text-right">{item.leads}</TableCell>
                            <TableCell className="text-right">£{item.gross}</TableCell>
                            <TableCell className="text-right text-destructive">£{item.refunds}</TableCell>
                            <TableCell className="text-right font-medium">£{item.net}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Location Details</CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        exportToCsv(revenueByLocation.map(item => ({
                          "Postcode Area": item.location,
                          "Leads": item.leads,
                          "Gross (£)": item.gross,
                          "Refunds (£)": item.refunds,
                          "Net (£)": item.net,
                        })), `revenue_by_location_${format(new Date(), "yyyy-MM-dd")}`);
                        toast({ title: "Exported", description: "Location data exported to CSV" });
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Postcode Area</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">Gross</TableHead>
                          <TableHead className="text-right">Refunds</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {revenueByLocation.map((item) => (
                          <TableRow key={item.location}>
                            <TableCell className="font-medium">{item.location}</TableCell>
                            <TableCell className="text-right">{item.leads}</TableCell>
                            <TableCell className="text-right">£{item.gross}</TableCell>
                            <TableCell className="text-right text-destructive">£{item.refunds}</TableCell>
                            <TableCell className="text-right font-medium">£{item.net}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
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

        {/* Printable Report Dialog */}
        {showPrintView && (
          <div className="fixed inset-0 z-50 bg-background">
            <div className="container mx-auto p-8 max-w-4xl">
              <div className="flex justify-between items-center mb-8 print:hidden">
                <h2 className="text-2xl font-bold">Financial Report Preview</h2>
                <div className="flex gap-2">
                  <Button onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print / Save PDF
                  </Button>
                  <Button variant="outline" onClick={() => setShowPrintView(false)}>
                    Close
                  </Button>
                </div>
              </div>
              
              {/* Printable Content */}
              <div className="space-y-8 print:space-y-6">
                {/* Header */}
                <div className="text-center border-b pb-6">
                  <h1 className="text-3xl font-bold">Deep Clean UK</h1>
                  <h2 className="text-xl text-muted-foreground mt-2">Financial Report</h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    {dateRange.from && dateRange.to && (
                      <>Period: {format(dateRange.from, "dd MMMM yyyy")} - {format(dateRange.to, "dd MMMM yyyy")}</>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Generated: {format(new Date(), "dd MMMM yyyy 'at' HH:mm")}
                  </p>
                </div>

                {/* Executive Summary */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 border-b pb-2">Executive Summary</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Gross Revenue</p>
                      <p className="text-2xl font-bold">£{kpis.grossRevenue.toLocaleString()}</p>
                      {trends.grossRevenue !== 0 && (
                        <p className={cn("text-sm", trends.grossRevenue > 0 ? "text-green-600" : "text-red-600")}>
                          {trends.grossRevenue > 0 ? "+" : ""}{trends.grossRevenue.toFixed(1)}% vs prev period
                        </p>
                      )}
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Net Revenue</p>
                      <p className="text-2xl font-bold text-primary">£{kpis.netRevenue.toLocaleString()}</p>
                      {trends.netRevenue !== 0 && (
                        <p className={cn("text-sm", trends.netRevenue > 0 ? "text-green-600" : "text-red-600")}>
                          {trends.netRevenue > 0 ? "+" : ""}{trends.netRevenue.toFixed(1)}% vs prev period
                        </p>
                      )}
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Leads Sold</p>
                      <p className="text-2xl font-bold">{kpis.totalLeadsSold}</p>
                      {trends.totalLeadsSold !== 0 && (
                        <p className={cn("text-sm", trends.totalLeadsSold > 0 ? "text-green-600" : "text-red-600")}>
                          {trends.totalLeadsSold > 0 ? "+" : ""}{trends.totalLeadsSold.toFixed(1)}% vs prev period
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 border-b pb-2">Financial Breakdown</h3>
                  <table className="w-full">
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2 text-muted-foreground">Gross Revenue</td>
                        <td className="py-2 text-right font-medium">£{kpis.grossRevenue.toLocaleString()}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 text-muted-foreground">Less: Refunds ({kpis.refundCount})</td>
                        <td className="py-2 text-right font-medium text-destructive">-£{kpis.refundsIssued.toLocaleString()}</td>
                      </tr>
                      <tr className="font-bold text-lg">
                        <td className="py-3">Net Revenue</td>
                        <td className="py-3 text-right text-primary">£{kpis.netRevenue.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Key Metrics */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 border-b pb-2">Key Metrics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Average Revenue per Day</span>
                      <span className="font-medium">£{kpis.avgRevenuePerDay.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Refund Rate</span>
                      <span className={cn("font-medium", kpis.refundRate > 10 ? "text-destructive" : kpis.refundRate > 5 ? "text-amber-600" : "text-green-600")}>
                        {kpis.refundRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Lead Price</span>
                      <span className="font-medium">£{LEAD_PRICE}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Total Refunds Issued</span>
                      <span className="font-medium">{kpis.refundCount}</span>
                    </div>
                  </div>
                </div>

                {/* Revenue by Service */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 border-b pb-2">Revenue by Service Category</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left">Service Type</th>
                        <th className="py-2 text-right">Leads</th>
                        <th className="py-2 text-right">Gross</th>
                        <th className="py-2 text-right">Refunds</th>
                        <th className="py-2 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueByJobType.map((item) => (
                        <tr key={item.jobType} className="border-b">
                          <td className="py-2">{item.jobType}</td>
                          <td className="py-2 text-right">{item.leads}</td>
                          <td className="py-2 text-right">£{item.gross}</td>
                          <td className="py-2 text-right text-destructive">£{item.refunds}</td>
                          <td className="py-2 text-right font-medium">£{item.net}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Revenue by Location */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 border-b pb-2">Revenue by Location (Top 10)</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left">Postcode Area</th>
                        <th className="py-2 text-right">Leads</th>
                        <th className="py-2 text-right">Gross</th>
                        <th className="py-2 text-right">Refunds</th>
                        <th className="py-2 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueByLocation.slice(0, 10).map((item) => (
                        <tr key={item.location} className="border-b">
                          <td className="py-2">{item.location}</td>
                          <td className="py-2 text-right">{item.leads}</td>
                          <td className="py-2 text-right">£{item.gross}</td>
                          <td className="py-2 text-right text-destructive">£{item.refunds}</td>
                          <td className="py-2 text-right font-medium">£{item.net}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Top Businesses */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 border-b pb-2">Top Businesses by Net Contribution</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left">Business</th>
                        <th className="py-2 text-right">Leads</th>
                        <th className="py-2 text-right">Revenue</th>
                        <th className="py-2 text-right">Refunds</th>
                        <th className="py-2 text-right">Refund Rate</th>
                        <th className="py-2 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {businessPerformance.slice(0, 10).map((b) => (
                        <tr key={b.businessId} className="border-b">
                          <td className="py-2">{b.businessName}</td>
                          <td className="py-2 text-right">{b.leadsPurchased}</td>
                          <td className="py-2 text-right">£{b.revenue}</td>
                          <td className="py-2 text-right text-destructive">£{b.refunds}</td>
                          <td className="py-2 text-right">{b.refundRate.toFixed(1)}%</td>
                          <td className="py-2 text-right font-medium">£{b.netContribution}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-muted-foreground border-t pt-4 mt-8">
                  <p>This report was generated automatically by Deep Clean UK Admin System</p>
                  <p>Confidential - For internal use only</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}