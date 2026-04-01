import { useState, useEffect, useMemo } from "react";
import { format, subDays, startOfDay, endOfDay, startOfWeek, startOfMonth, parseISO, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, subMonths, subYears, startOfYear, endOfYear } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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
  Download,
  Search,
  FileText,
  RefreshCw,
  Building2,
  Percent,
  Receipt,
  Printer,
  Megaphone,
  Calculator,
  Gift,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
import { exportToCsv } from "@/lib/exportCsv";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/contexts/AdminContext";
import { useAdSpend } from "@/hooks/useAdSpend";

const DEFAULT_LEAD_PRICE = 20; // Fallback for leads without amount_paid

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
  creditType: "purchased" | "granted";
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

interface GrantedCredit {
  id: string;
  createdAt: string;
  creditsAdded: number;
  reason: string;
  businessName: string | null;
  grantedBy: string;
}

interface CreditPurchase {
  id: string;
  date: string;
  creditsAdded: number;
  amountPaid: number;
  businessName: string | null;
  contactName: string | null;
  stripeSessionId: string | null;
}

export default function AdminAccounting() {
  const { toast } = useToast();
  const { getDateFilter, dateRange: dateRangePreset, customStartDate, customEndDate } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [previousTransactions, setPreviousTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "refunded">("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [showPrintView, setShowPrintView] = useState(false);
  const [yoyTransactions, setYoyTransactions] = useState<Transaction[]>([]);
  const [grantedCredits, setGrantedCredits] = useState<GrantedCredit[]>([]);
  const [creditPurchases, setCreditPurchases] = useState<CreditPurchase[]>([]);

  // Get date range from global context
  const dateRange = useMemo(() => {
    const { start, end } = getDateFilter();
    return { from: start, to: end };
  }, [getDateFilter]);

  // Ad spend data
  const { metrics: adMetrics, googleAdsMetrics, facebookAdsMetrics, syncing, syncGoogleAds, syncFacebookAds, syncAllPlatforms, getPlatformSettings, adSpendData } = useAdSpend(
    dateRange.from,
    dateRange.to
  );
  
  const googleAdsSettings = getPlatformSettings("google_ads");
  const facebookAdsSettings = getPlatformSettings("facebook_ads");
  const isSyncingGoogle = syncing.google_ads || false;
  const isSyncingFacebook = syncing.facebook_ads || false;
  const isSyncingAny = isSyncingGoogle || isSyncingFacebook;

  // Calculate previous period range for comparison

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
  }, [dateRange, getDateFilter]);

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
          job_type,
          credit_type,
          amount_paid
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
            job_type,
            credit_type,
            amount_paid
          `)
          .eq("is_unlocked", true)
          .gte("unlocked_at", previousDateRange.from.toISOString())
          .lte("unlocked_at", previousDateRange.to.toISOString());
        prevLeads = prevData || [];
      }

      // Fetch YoY data (same period last year)
      let yoyLeads: typeof leads = [];
      const yoyFrom = subYears(dateRange.from, 1);
      const yoyTo = subYears(dateRange.to, 1);
      const { data: yoyData } = await supabase
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
          job_type,
          credit_type
        `)
        .eq("is_unlocked", true)
        .gte("unlocked_at", yoyFrom.toISOString())
        .lte("unlocked_at", yoyTo.toISOString());
      yoyLeads = yoyData || [];

      // Fetch profiles to get business names
      const allLeads = [...(leads || []), ...prevLeads, ...yoyLeads];
      const userIds = [...new Set(allLeads.map(l => l.unlocked_by).filter(Boolean))];
      const { data: profiles } = userIds.length > 0 
        ? await supabase.from("profiles").select("user_id, business_name").in("user_id", userIds)
        : { data: [] };

      const profileMap = new Map<string, string | null>((profiles || []).map(p => [p.user_id, p.business_name] as [string, string | null]));

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
        creditType: (lead.credit_type as "purchased" | "granted") || "purchased",
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
        creditType: (lead.credit_type as "purchased" | "granted") || "purchased",
      }));

      const yoyTxns: Transaction[] = yoyLeads.map(lead => ({
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
        creditType: (lead.credit_type as "purchased" | "granted") || "purchased",
      }));

      setTransactions(txns);
      setPreviousTransactions(prevTxns);
      setYoyTransactions(yoyTxns);

      // Fetch granted credits from activity_logs
      const { data: grantedData, error: grantedError } = await supabase
        .from("activity_logs")
        .select("id, created_at, details, user_id")
        .eq("action", "credits_granted")
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: false });

      if (grantedError) {
        console.error("Error fetching granted credits:", grantedError);
      } else {
        const grantedCreditsData: GrantedCredit[] = (grantedData || []).map(log => {
          const details = (typeof log.details === 'object' && log.details !== null) 
            ? log.details as Record<string, unknown> 
            : {};
          return {
            id: log.id,
            createdAt: log.created_at,
            creditsAdded: Number(details.credits_added) || Number(details.amount) || 0,
            reason: String(details.reason || "Unspecified"),
            businessName: String(details.business_name || "Unknown Business"),
            grantedBy: String(details.granted_by || "admin"),
          };
        });
        setGrantedCredits(grantedCreditsData);
      }

      // Fetch credit pack purchases from activity_logs
      const { data: creditPurchaseData, error: creditPurchaseError } = await supabase
        .from("activity_logs")
        .select("id, created_at, details, user_id")
        .eq("action", "credits_purchased")
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: false });

      if (creditPurchaseError) {
        console.error("Error fetching credit purchases:", creditPurchaseError);
      } else {
        const creditPurchasesData: CreditPurchase[] = (creditPurchaseData || []).map(log => {
          const details = (typeof log.details === 'object' && log.details !== null) 
            ? log.details as Record<string, unknown> 
            : {};
          return {
            id: log.id,
            date: log.created_at,
            creditsAdded: Number(details.credits_added) || 0,
            amountPaid: Number(details.amount_paid) || (Number(details.credits_added) || 0) * LEAD_PRICE,
            businessName: String(details.business_name || "Unknown Business"),
            contactName: details.contact_name ? String(details.contact_name) : null,
            stripeSessionId: details.stripe_session_id ? String(details.stripe_session_id) : null,
          };
        });
        setCreditPurchases(creditPurchasesData);
      }
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

  // Calculate granted credits metrics
  const grantedCreditsMetrics = useMemo(() => {
    const totalCreditsGranted = grantedCredits.reduce((sum, gc) => sum + gc.creditsAdded, 0);
    const totalValue = totalCreditsGranted * LEAD_PRICE;
    
    // Group by reason
    const byReason = grantedCredits.reduce((acc, gc) => {
      const reason = gc.reason || "Unspecified";
      if (!acc[reason]) {
        acc[reason] = { credits: 0, value: 0, count: 0 };
      }
      acc[reason].credits += gc.creditsAdded;
      acc[reason].value += gc.creditsAdded * LEAD_PRICE;
      acc[reason].count += 1;
      return acc;
    }, {} as Record<string, { credits: number; value: number; count: number }>);

    // Group by business
    const byBusiness = grantedCredits.reduce((acc, gc) => {
      const business = gc.businessName || "Unknown";
      if (!acc[business]) {
        acc[business] = { credits: 0, value: 0 };
      }
      acc[business].credits += gc.creditsAdded;
      acc[business].value += gc.creditsAdded * LEAD_PRICE;
      return acc;
    }, {} as Record<string, { credits: number; value: number }>);

    return {
      totalCreditsGranted,
      totalValue,
      grantCount: grantedCredits.length,
      byReason,
      byBusiness,
    };
  }, [grantedCredits]);

  // Calculate credit purchase metrics
  const creditPurchaseMetrics = useMemo(() => {
    const totalCredits = creditPurchases.reduce((sum, cp) => sum + cp.creditsAdded, 0);
    const totalRevenue = creditPurchases.reduce((sum, cp) => sum + cp.amountPaid, 0);
    
    // Group by business
    const byBusiness = creditPurchases.reduce((acc, cp) => {
      const business = cp.businessName || "Unknown";
      if (!acc[business]) acc[business] = { credits: 0, revenue: 0, count: 0 };
      acc[business].credits += cp.creditsAdded;
      acc[business].revenue += cp.amountPaid;
      acc[business].count += 1;
      return acc;
    }, {} as Record<string, { credits: number; revenue: number; count: number }>);

    return {
      totalCredits,
      totalRevenue,
      purchaseCount: creditPurchases.length,
      byBusiness,
    };
  }, [creditPurchases]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    // Separate purchased vs granted transactions
    const purchasedTxns = transactions.filter(t => t.creditType === "purchased");
    const grantedTxns = transactions.filter(t => t.creditType === "granted");
    
    // Gross revenue = only from purchased credits (actual cash payments)
    const grossRevenue = purchasedTxns.length * LEAD_PRICE;
    const grantedLeadsValue = grantedTxns.length * LEAD_PRICE;
    
    // Refunds - only count refunds from purchased leads for cash calculations
    const refundedTxns = transactions.filter(t => t.status === "refunded");
    const refundedPurchasedTxns = purchasedTxns.filter(t => t.status === "refunded");
    const refundsIssued = refundedPurchasedTxns.length * LEAD_PRICE;
    
    // Net revenue = cash received minus cash refunded
    const netRevenue = grossRevenue - refundsIssued;
    const refundRate = transactions.length > 0 ? (refundedTxns.length / transactions.length) * 100 : 0;
    
    // Calculate days in range
    const days = dateRange.from && dateRange.to 
      ? Math.max(1, Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)))
      : 1;
    const avgRevenuePerDay = netRevenue / days;

    // Net profit = Net Revenue - Ad Spend
    const netProfit = netRevenue - adMetrics.totalSpend;
    const costPerLead = transactions.length > 0 ? adMetrics.totalSpend / transactions.length : 0;

    // Actual cash revenue is now accurately calculated from purchased leads only
    const actualCashRevenue = netRevenue;

    return {
      grossRevenue,
      totalLeadsSold: transactions.length,
      purchasedLeadsSold: purchasedTxns.length,
      grantedLeadsSold: grantedTxns.length,
      avgRevenuePerDay,
      refundsIssued,
      netRevenue,
      refundRate,
      refundCount: refundedTxns.length,
      adSpend: adMetrics.totalSpend,
      netProfit,
      costPerLead,
      actualCashRevenue,
      grantedCreditsValue: grantedLeadsValue,
    };
  }, [transactions, dateRange, adMetrics]);

  // Calculate previous period KPIs for comparison
  const previousKpis = useMemo(() => {
    // Only count purchased credits as revenue
    const purchasedPrevTxns = previousTransactions.filter(t => t.creditType === "purchased");
    const grossRevenue = purchasedPrevTxns.length * LEAD_PRICE;
    const refundedTxns = purchasedPrevTxns.filter(t => t.status === "refunded");
    const refundsIssued = refundedTxns.length * LEAD_PRICE;
    const netRevenue = grossRevenue - refundsIssued;
    const refundRate = previousTransactions.length > 0 ? (previousTransactions.filter(t => t.status === "refunded").length / previousTransactions.length) * 100 : 0;
    
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

  // Calculate YoY KPIs for year-over-year comparison
  const yoyKpis = useMemo(() => {
    // Only count purchased credits as revenue
    const purchasedYoyTxns = yoyTransactions.filter(t => t.creditType === "purchased");
    const grossRevenue = purchasedYoyTxns.length * LEAD_PRICE;
    const refundedTxns = purchasedYoyTxns.filter(t => t.status === "refunded");
    const refundsIssued = refundedTxns.length * LEAD_PRICE;
    const netRevenue = grossRevenue - refundsIssued;
    const refundRate = yoyTransactions.length > 0 ? (yoyTransactions.filter(t => t.status === "refunded").length / yoyTransactions.length) * 100 : 0;
    
    const days = dateRange.from && dateRange.to 
      ? Math.max(1, Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)))
      : 1;
    const avgRevenuePerDay = netRevenue / days;

    return {
      grossRevenue,
      totalLeadsSold: yoyTransactions.length,
      avgRevenuePerDay,
      refundsIssued,
      netRevenue,
      refundRate,
      refundCount: refundedTxns.length,
    };
  }, [yoyTransactions, dateRange]);

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

  // Calculate YoY trends
  const yoyTrends = useMemo(() => {
    const calcTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      grossRevenue: calcTrend(kpis.grossRevenue, yoyKpis.grossRevenue),
      totalLeadsSold: calcTrend(kpis.totalLeadsSold, yoyKpis.totalLeadsSold),
      avgRevenuePerDay: calcTrend(kpis.avgRevenuePerDay, yoyKpis.avgRevenuePerDay),
      refundsIssued: calcTrend(kpis.refundsIssued, yoyKpis.refundsIssued),
      netRevenue: calcTrend(kpis.netRevenue, yoyKpis.netRevenue),
      refundRate: calcTrend(kpis.refundRate, yoyKpis.refundRate),
    };
  }, [kpis, yoyKpis]);

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
      
      // Only count purchased credits as revenue (exclude granted)
      const purchasedDayTxns = dayTxns.filter(t => t.creditType === "purchased");
      const gross = purchasedDayTxns.length * LEAD_PRICE;
      const refunds = purchasedDayTxns.filter(t => t.status === "refunded").length * LEAD_PRICE;
      
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

  // Daily ad spend data for chart
  const dailyAdSpendData = useMemo(() => {
    if (!dateRange.from || !dateRange.to || adSpendData.length === 0) return [];
    
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    
    return days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const adData = adSpendData.find(d => d.date === dayStr);
      
      return {
        date: format(day, "MMM dd"),
        spend: adData ? Number(adData.spend_amount) : 0,
        clicks: adData?.clicks || 0,
        impressions: adData?.impressions || 0,
        conversions: adData?.conversions || 0,
      };
    });
  }, [adSpendData, dateRange]);

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
        {/* Actions Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="yoy">Year-over-Year</TabsTrigger>
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

              {/* Ad Spend Card */}
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ad Spend</CardTitle>
                  <Megaphone className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-amber-500">£{kpis.adSpend.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">
                        {googleAdsSettings?.last_sync_at 
                          ? `Synced ${format(parseISO(googleAdsSettings.last_sync_at), "MMM dd, HH:mm")}`
                          : "Not synced"
                        }
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Cost Per Lead Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cost/Lead</CardTitle>
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">£{kpis.costPerLead.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">Ad spend / leads</div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Net Profit Card */}
              <Card className={cn(
                "border-2",
                kpis.netProfit >= 0 ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"
              )}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                  <TrendingUp className={cn("h-4 w-4", kpis.netProfit >= 0 ? "text-green-500" : "text-destructive")} />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <div className={cn("text-2xl font-bold", kpis.netProfit >= 0 ? "text-green-500" : "text-destructive")}>
                        £{kpis.netProfit.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">Revenue - Refunds - Ads</div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Ad Spend Sync Status */}
            {adMetrics.totalSpend === 0 && (
              <Card className="border-amber-500/50 bg-amber-500/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Megaphone className="h-5 w-5 text-amber-500" />
                      <div>
                        <p className="font-medium">Ad data not synced</p>
                        <p className="text-sm text-muted-foreground">
                          Sync your Google Ads and Facebook Ads data to see accurate cost per lead and net profit calculations.
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => syncAllPlatforms()} 
                      disabled={isSyncingAny}
                      variant="outline"
                      size="sm"
                    >
                      {isSyncingAny ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Sync All Platforms
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ad Platform Breakdown */}
            {adMetrics.totalSpend > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Megaphone className="h-5 w-5 text-secondary" />
                        Ad Spend Breakdown
                      </CardTitle>
                      <CardDescription>Spend by advertising platform</CardDescription>
                    </div>
                    <Button 
                      onClick={() => syncAllPlatforms()} 
                      disabled={isSyncingAny}
                      variant="outline"
                      size="sm"
                    >
                      {isSyncingAny ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Sync All
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-blue-600">Google Ads</span>
                        {googleAdsSettings?.last_sync_at && (
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(googleAdsSettings.last_sync_at), "MMM dd")}
                          </span>
                        )}
                      </div>
                      <p className="text-2xl font-bold">£{googleAdsMetrics.totalSpend.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        {googleAdsMetrics.totalConversions} conversions • £{googleAdsMetrics.costPerLead.toFixed(2)}/lead
                      </p>
                    </div>
                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-indigo-600">Facebook Ads</span>
                        {facebookAdsSettings?.last_sync_at && (
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(facebookAdsSettings.last_sync_at), "MMM dd")}
                          </span>
                        )}
                      </div>
                      <p className="text-2xl font-bold">£{facebookAdsMetrics.totalSpend.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        {facebookAdsMetrics.totalConversions} conversions • £{facebookAdsMetrics.costPerLead.toFixed(2)}/lead
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Granted Credits Summary */}
            <Card className="border-teal-500/30 bg-teal-500/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Gift className="h-5 w-5 text-teal-500" />
                      Granted Credits Summary
                    </CardTitle>
                    <CardDescription>Free credits issued to businesses (not revenue)</CardDescription>
                  </div>
                  <Badge variant="outline" className="border-teal-500/50 text-teal-600">
                    {grantedCreditsMetrics.grantCount} grants
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {grantedCreditsMetrics.totalCreditsGranted === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Gift className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>No credits have been granted in this period</p>
                    <p className="text-xs mt-1">Grant credits from the Businesses page</p>
                  </div>
                ) : (
                  <>
                    {/* Summary Stats */}
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="p-4 bg-teal-500/10 border border-teal-500/20 rounded-lg text-center">
                        <p className="text-3xl font-bold text-teal-600">{grantedCreditsMetrics.totalCreditsGranted}</p>
                        <p className="text-sm text-muted-foreground">Total Credits Granted</p>
                      </div>
                      <div className="p-4 bg-teal-500/10 border border-teal-500/20 rounded-lg text-center">
                        <p className="text-3xl font-bold text-teal-600">£{grantedCreditsMetrics.totalValue.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">Total Value (@ £{LEAD_PRICE}/credit)</p>
                      </div>
                      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                        <p className="text-3xl font-bold text-green-600">£{Math.max(0, kpis.actualCashRevenue).toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">Est. Actual Cash Revenue</p>
                      </div>
                    </div>

                    {/* Breakdown by Reason */}
                    {Object.keys(grantedCreditsMetrics.byReason).length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <Coins className="h-4 w-4 text-muted-foreground" />
                          Breakdown by Reason
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(grantedCreditsMetrics.byReason)
                            .sort((a, b) => b[1].value - a[1].value)
                            .map(([reason, data]) => (
                              <div key={reason} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">{data.count}x</Badge>
                                  <span className="text-sm font-medium">{reason}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-bold">{data.credits} credits</span>
                                  <span className="text-sm text-muted-foreground ml-2">(£{data.value})</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Top Businesses Receiving Grants */}
                    {Object.keys(grantedCreditsMetrics.byBusiness).length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          Top Businesses Receiving Grants
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(grantedCreditsMetrics.byBusiness)
                            .sort((a, b) => b[1].value - a[1].value)
                            .slice(0, 5)
                            .map(([business, data]) => (
                              <div key={business} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                                <span className="text-sm font-medium truncate max-w-[200px]">{business}</span>
                                <div className="text-right">
                                  <span className="text-sm font-bold">{data.credits} credits</span>
                                  <span className="text-sm text-muted-foreground ml-2">(£{data.value})</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Explanation */}
                    <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                      <strong>Note:</strong> Granted credits represent free value given to businesses (goodwill, compensation, promos). 
                      The "Est. Actual Cash Revenue" subtracts this from Net Revenue to approximate real cash received.
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Credit Pack Purchases Summary */}
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Coins className="h-5 w-5 text-blue-500" />
                      Credit Pack Purchases
                    </CardTitle>
                    <CardDescription>Revenue from credit pack purchases (separate from per-lead payments)</CardDescription>
                  </div>
                  <Badge variant="outline" className="border-blue-500/50 text-blue-600">
                    {creditPurchaseMetrics.purchaseCount} purchases
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {creditPurchaseMetrics.purchaseCount === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Coins className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>No credit pack purchases in this period</p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
                        <p className="text-3xl font-bold text-blue-600">{creditPurchaseMetrics.totalCredits}</p>
                        <p className="text-sm text-muted-foreground">Credits Purchased</p>
                      </div>
                      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
                        <p className="text-3xl font-bold text-blue-600">£{creditPurchaseMetrics.totalRevenue.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">Revenue from Packs</p>
                      </div>
                      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                        <p className="text-3xl font-bold text-green-600">£{(kpis.actualCashRevenue + creditPurchaseMetrics.totalRevenue).toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">Total Cash Revenue</p>
                      </div>
                    </div>

                    {/* Top Buyers */}
                    {Object.keys(creditPurchaseMetrics.byBusiness).length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          Top Credit Buyers
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(creditPurchaseMetrics.byBusiness)
                            .sort((a, b) => b[1].revenue - a[1].revenue)
                            .slice(0, 5)
                            .map(([business, data]) => (
                              <div key={business} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">{data.count}x</Badge>
                                  <span className="text-sm font-medium truncate max-w-[200px]">{business}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-bold">{data.credits} credits</span>
                                  <span className="text-sm text-muted-foreground ml-2">(£{data.revenue})</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

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

            {/* Daily Ad Spend Chart */}
            <Card className="border-amber-500/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Megaphone className="h-5 w-5 text-amber-500" />
                      Daily Ad Spend
                    </CardTitle>
                    <CardDescription>Google Ads spend breakdown by day</CardDescription>
                  </div>
                  <Button 
                    onClick={() => syncGoogleAds()} 
                    disabled={isSyncingGoogle}
                    variant="outline"
                    size="sm"
                  >
                    {isSyncingGoogle ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sync
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {loading ? (
                    <Skeleton className="h-full w-full" />
                  ) : dailyAdSpendData.length === 0 || dailyAdSpendData.every(d => d.spend === 0) ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                      <Megaphone className="h-12 w-12 mb-4 opacity-30" />
                      <p className="text-sm">No ad spend data available</p>
                      <p className="text-xs mt-1">Click "Sync" to pull data from Google Ads</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyAdSpendData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" tickFormatter={(v) => `£${v}`} />
                        <Tooltip 
                          formatter={(value: number, name: string) => {
                            if (name === "spend") return [`£${value.toFixed(2)}`, "Ad Spend"];
                            if (name === "clicks") return [value, "Clicks"];
                            if (name === "conversions") return [value, "Conversions"];
                            return [value, name];
                          }}
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px"
                          }}
                        />
                        <Legend />
                        <Bar 
                          dataKey="spend" 
                          fill="hsl(40, 90%, 50%)" 
                          name="Ad Spend"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                {dailyAdSpendData.length > 0 && !dailyAdSpendData.every(d => d.spend === 0) && (
                  <div className="mt-4 grid grid-cols-4 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Total Spend</p>
                      <p className="text-lg font-bold text-amber-500">£{adMetrics.totalSpend.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Impressions</p>
                      <p className="text-lg font-bold">{adMetrics.totalImpressions.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Clicks</p>
                      <p className="text-lg font-bold">{adMetrics.totalClicks.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">CTR</p>
                      <p className="text-lg font-bold">{adMetrics.ctr.toFixed(2)}%</p>
                    </div>
                  </div>
                )}
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
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">Net Revenue</span>
                    <span className="font-medium text-primary">£{kpis.netRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Megaphone className="w-4 h-4" /> Ad Spend (Google Ads)
                    </span>
                    <span className="font-medium text-amber-500">-£{kpis.adSpend.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">Cost Per Lead</span>
                    <span className="font-medium">£{kpis.costPerLead.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 text-lg font-bold bg-muted/30 px-3 rounded-lg">
                    <span className="flex items-center gap-2"><Calculator className="w-5 h-5" /> Net Profit</span>
                    <span className={kpis.netProfit >= 0 ? "text-green-500" : "text-destructive"}>
                      £{kpis.netProfit.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* YEAR-OVER-YEAR TAB */}
          <TabsContent value="yoy" className="space-y-6">
            {/* YoY Comparison Header */}
            <Card>
              <CardHeader>
                <CardTitle>Year-over-Year Comparison</CardTitle>
                <CardDescription>
                  Comparing {dateRange.from && dateRange.to && (
                    <>{format(dateRange.from, "MMM dd, yyyy")} - {format(dateRange.to, "MMM dd, yyyy")}</>
                  )} vs same period last year
                </CardDescription>
              </CardHeader>
            </Card>

            {/* YoY KPI Comparison */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Gross Revenue Comparison */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Current Period</span>
                      <span className="text-lg font-bold">£{kpis.grossRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Last Year</span>
                      <span className="text-lg font-medium text-muted-foreground">£{yoyKpis.grossRevenue.toLocaleString()}</span>
                    </div>
                    <div className={cn(
                      "flex items-center gap-2 pt-2 border-t",
                      yoyTrends.grossRevenue > 0 ? "text-green-500" : yoyTrends.grossRevenue < 0 ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {yoyTrends.grossRevenue > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      <span className="font-medium">{yoyTrends.grossRevenue > 0 ? "+" : ""}{yoyTrends.grossRevenue.toFixed(1)}% YoY</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Net Revenue Comparison */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Net Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Current Period</span>
                      <span className="text-lg font-bold text-primary">£{kpis.netRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Last Year</span>
                      <span className="text-lg font-medium text-muted-foreground">£{yoyKpis.netRevenue.toLocaleString()}</span>
                    </div>
                    <div className={cn(
                      "flex items-center gap-2 pt-2 border-t",
                      yoyTrends.netRevenue > 0 ? "text-green-500" : yoyTrends.netRevenue < 0 ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {yoyTrends.netRevenue > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      <span className="font-medium">{yoyTrends.netRevenue > 0 ? "+" : ""}{yoyTrends.netRevenue.toFixed(1)}% YoY</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Leads Sold Comparison */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Leads Sold</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Current Period</span>
                      <span className="text-lg font-bold">{kpis.totalLeadsSold}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Last Year</span>
                      <span className="text-lg font-medium text-muted-foreground">{yoyKpis.totalLeadsSold}</span>
                    </div>
                    <div className={cn(
                      "flex items-center gap-2 pt-2 border-t",
                      yoyTrends.totalLeadsSold > 0 ? "text-green-500" : yoyTrends.totalLeadsSold < 0 ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {yoyTrends.totalLeadsSold > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      <span className="font-medium">{yoyTrends.totalLeadsSold > 0 ? "+" : ""}{yoyTrends.totalLeadsSold.toFixed(1)}% YoY</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Average Revenue Per Day */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Avg Revenue/Day</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Current Period</span>
                      <span className="text-lg font-bold">£{kpis.avgRevenuePerDay.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Last Year</span>
                      <span className="text-lg font-medium text-muted-foreground">£{yoyKpis.avgRevenuePerDay.toFixed(0)}</span>
                    </div>
                    <div className={cn(
                      "flex items-center gap-2 pt-2 border-t",
                      yoyTrends.avgRevenuePerDay > 0 ? "text-green-500" : yoyTrends.avgRevenuePerDay < 0 ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {yoyTrends.avgRevenuePerDay > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      <span className="font-medium">{yoyTrends.avgRevenuePerDay > 0 ? "+" : ""}{yoyTrends.avgRevenuePerDay.toFixed(1)}% YoY</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Refunds */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Refunds</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Current Period</span>
                      <span className="text-lg font-bold text-destructive">£{kpis.refundsIssued.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Last Year</span>
                      <span className="text-lg font-medium text-muted-foreground">£{yoyKpis.refundsIssued.toLocaleString()}</span>
                    </div>
                    <div className={cn(
                      "flex items-center gap-2 pt-2 border-t",
                      yoyTrends.refundsIssued < 0 ? "text-green-500" : yoyTrends.refundsIssued > 0 ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {yoyTrends.refundsIssued > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      <span className="font-medium">{yoyTrends.refundsIssued > 0 ? "+" : ""}{yoyTrends.refundsIssued.toFixed(1)}% YoY</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Refund Rate */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Refund Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Current Period</span>
                      <span className={cn(
                        "text-lg font-bold",
                        kpis.refundRate > 10 ? "text-destructive" : kpis.refundRate > 5 ? "text-amber-500" : "text-green-500"
                      )}>{kpis.refundRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Last Year</span>
                      <span className="text-lg font-medium text-muted-foreground">{yoyKpis.refundRate.toFixed(1)}%</span>
                    </div>
                    <div className={cn(
                      "flex items-center gap-2 pt-2 border-t",
                      yoyTrends.refundRate < 0 ? "text-green-500" : yoyTrends.refundRate > 0 ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {yoyTrends.refundRate > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      <span className="font-medium">{yoyTrends.refundRate > 0 ? "+" : ""}{yoyTrends.refundRate.toFixed(1)}% YoY</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* YoY Summary Table */}
            <Card>
              <CardHeader>
                <CardTitle>YoY Performance Summary</CardTitle>
                <CardDescription>Detailed comparison of key metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      <TableHead className="text-right">Current Period</TableHead>
                      <TableHead className="text-right">Same Period Last Year</TableHead>
                      <TableHead className="text-right">Change</TableHead>
                      <TableHead className="text-right">% Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Gross Revenue</TableCell>
                      <TableCell className="text-right">£{kpis.grossRevenue.toLocaleString()}</TableCell>
                      <TableCell className="text-right">£{yoyKpis.grossRevenue.toLocaleString()}</TableCell>
                      <TableCell className={cn("text-right", kpis.grossRevenue - yoyKpis.grossRevenue >= 0 ? "text-green-500" : "text-destructive")}>
                        {kpis.grossRevenue - yoyKpis.grossRevenue >= 0 ? "+" : ""}£{(kpis.grossRevenue - yoyKpis.grossRevenue).toLocaleString()}
                      </TableCell>
                      <TableCell className={cn("text-right font-medium", yoyTrends.grossRevenue >= 0 ? "text-green-500" : "text-destructive")}>
                        {yoyTrends.grossRevenue >= 0 ? "+" : ""}{yoyTrends.grossRevenue.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Net Revenue</TableCell>
                      <TableCell className="text-right">£{kpis.netRevenue.toLocaleString()}</TableCell>
                      <TableCell className="text-right">£{yoyKpis.netRevenue.toLocaleString()}</TableCell>
                      <TableCell className={cn("text-right", kpis.netRevenue - yoyKpis.netRevenue >= 0 ? "text-green-500" : "text-destructive")}>
                        {kpis.netRevenue - yoyKpis.netRevenue >= 0 ? "+" : ""}£{(kpis.netRevenue - yoyKpis.netRevenue).toLocaleString()}
                      </TableCell>
                      <TableCell className={cn("text-right font-medium", yoyTrends.netRevenue >= 0 ? "text-green-500" : "text-destructive")}>
                        {yoyTrends.netRevenue >= 0 ? "+" : ""}{yoyTrends.netRevenue.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Leads Sold</TableCell>
                      <TableCell className="text-right">{kpis.totalLeadsSold}</TableCell>
                      <TableCell className="text-right">{yoyKpis.totalLeadsSold}</TableCell>
                      <TableCell className={cn("text-right", kpis.totalLeadsSold - yoyKpis.totalLeadsSold >= 0 ? "text-green-500" : "text-destructive")}>
                        {kpis.totalLeadsSold - yoyKpis.totalLeadsSold >= 0 ? "+" : ""}{kpis.totalLeadsSold - yoyKpis.totalLeadsSold}
                      </TableCell>
                      <TableCell className={cn("text-right font-medium", yoyTrends.totalLeadsSold >= 0 ? "text-green-500" : "text-destructive")}>
                        {yoyTrends.totalLeadsSold >= 0 ? "+" : ""}{yoyTrends.totalLeadsSold.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Avg Revenue/Day</TableCell>
                      <TableCell className="text-right">£{kpis.avgRevenuePerDay.toFixed(0)}</TableCell>
                      <TableCell className="text-right">£{yoyKpis.avgRevenuePerDay.toFixed(0)}</TableCell>
                      <TableCell className={cn("text-right", kpis.avgRevenuePerDay - yoyKpis.avgRevenuePerDay >= 0 ? "text-green-500" : "text-destructive")}>
                        {kpis.avgRevenuePerDay - yoyKpis.avgRevenuePerDay >= 0 ? "+" : ""}£{(kpis.avgRevenuePerDay - yoyKpis.avgRevenuePerDay).toFixed(0)}
                      </TableCell>
                      <TableCell className={cn("text-right font-medium", yoyTrends.avgRevenuePerDay >= 0 ? "text-green-500" : "text-destructive")}>
                        {yoyTrends.avgRevenuePerDay >= 0 ? "+" : ""}{yoyTrends.avgRevenuePerDay.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Refunds</TableCell>
                      <TableCell className="text-right">£{kpis.refundsIssued.toLocaleString()}</TableCell>
                      <TableCell className="text-right">£{yoyKpis.refundsIssued.toLocaleString()}</TableCell>
                      <TableCell className={cn("text-right", kpis.refundsIssued - yoyKpis.refundsIssued <= 0 ? "text-green-500" : "text-destructive")}>
                        {kpis.refundsIssued - yoyKpis.refundsIssued >= 0 ? "+" : ""}£{(kpis.refundsIssued - yoyKpis.refundsIssued).toLocaleString()}
                      </TableCell>
                      <TableCell className={cn("text-right font-medium", yoyTrends.refundsIssued <= 0 ? "text-green-500" : "text-destructive")}>
                        {yoyTrends.refundsIssued >= 0 ? "+" : ""}{yoyTrends.refundsIssued.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Refund Rate</TableCell>
                      <TableCell className="text-right">{kpis.refundRate.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{yoyKpis.refundRate.toFixed(1)}%</TableCell>
                      <TableCell className={cn("text-right", kpis.refundRate - yoyKpis.refundRate <= 0 ? "text-green-500" : "text-destructive")}>
                        {kpis.refundRate - yoyKpis.refundRate >= 0 ? "+" : ""}{(kpis.refundRate - yoyKpis.refundRate).toFixed(1)}%
                      </TableCell>
                      <TableCell className={cn("text-right font-medium", yoyTrends.refundRate <= 0 ? "text-green-500" : "text-destructive")}>
                        {yoyTrends.refundRate >= 0 ? "+" : ""}{yoyTrends.refundRate.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* No Data Message */}
            {yoyKpis.totalLeadsSold === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No data available for the same period last year.</p>
                  <p className="text-sm text-muted-foreground mt-2">Year-over-year comparison requires historical data from the previous year.</p>
                </CardContent>
              </Card>
            )}
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
                        <TableHead>Credit Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Refund Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 8 }).map((_, j) => (
                              <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : filteredTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={txn.creditType === "granted" 
                                  ? "border-teal-500/50 text-teal-600 bg-teal-500/10" 
                                  : "border-primary/50 text-primary bg-primary/10"
                                }
                              >
                                {txn.creditType === "granted" ? "Granted" : "Paid"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              <span className={txn.creditType === "granted" ? "text-muted-foreground" : ""}>
                                £{txn.amount}
                              </span>
                            </TableCell>
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
                  <h1 className="text-3xl font-bold">Cleanda</h1>
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
                  <p>This report was generated automatically by Cleanda Admin System</p>
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