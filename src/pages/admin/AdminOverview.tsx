import { useState, useEffect } from "react";
import {
  FileText,
  Users,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Flag,
  ShoppingCart,
  Layers,
  Target,
  PoundSterling,
  Download,
  ArrowUp,
  ArrowDown,
  Calculator,
  Zap,
  Megaphone,
  RefreshCw,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import KPICard from "@/components/admin/KPICard";
import QueueWidget from "@/components/admin/QueueWidget";
import LiveCheckoutsPanel from "@/components/admin/LiveCheckoutsPanel";
import SourceBreakdownChart from "@/components/admin/SourceBreakdownChart";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/contexts/AdminContext";
import { exportToCsv } from "@/lib/exportCsv";
import { toast } from "sonner";
import { useCheckoutActivity } from "@/hooks/useCheckoutActivity";
import { useAdSpend } from "@/hooks/useAdSpend";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format, subDays } from "date-fns";

interface DailyData {
  date: string;
  revenue: number;
  leads: number;
}

interface PostcodeData {
  postcode: string;
  purchases: number;
}

interface ValueBandData {
  name: string;
  value: number;
  color: string;
}

interface JobTypeStats {
  jobType: string;
  total: number;
  purchased: number;
  refunded: number;
  purchaseRate: number;
  refundRate: number;
}

interface PeriodComparison {
  leadsReceived: number;
  leadsPurchased: number;
  revenue: number;
  activeBuyers: number;
}

const VALUE_BAND_COLORS = {
  "£100–£140": "hsl(var(--muted-foreground))",
  "£150–£200": "hsl(var(--secondary))",
  "£200+": "hsl(142, 76%, 36%)",
};

export default function AdminOverview() {
  const { getDateFilter, dateRange } = useAdmin();
  const { checkoutCount, activeCheckouts } = useCheckoutActivity();
  const { start, end } = getDateFilter();
  const { metrics: adMetrics, googleAdsMetrics, facebookAdsMetrics, syncing, syncGoogleAds, syncFacebookAds, syncAllPlatforms, getPlatformSettings } = useAdSpend(start, end);
  const googleAdsSettings = getPlatformSettings("google_ads");
  const facebookAdsSettings = getPlatformSettings("facebook_ads");
  const isSyncingGoogle = syncing.google_ads || false;
  const isSyncingFacebook = syncing.facebook_ads || false;
  const isSyncingAny = isSyncingGoogle || isSyncingFacebook;
  const [stats, setStats] = useState({
    leadsReceived: 0,
    leadsPublished: 0,
    leadsPurchased: 0,
    revenue: 0,
    activeBuyers: 0,
    refundsIssued: 0,
    disputesOpen: 0,
    fraudFlags: 0,
    avgJobValue: 0,
    conversionRate: 0,
    totalJobRevenue: 0,
  });
  const [previousStats, setPreviousStats] = useState<PeriodComparison | null>(null);
  const [queues, setQueues] = useState({
    leadsAwaiting: 0,
    verificationPending: 0,
    fraudQueue: 0,
    disputesAwaiting: 0,
  });
  const [revenueData, setRevenueData] = useState<DailyData[]>([]);
  const [postcodeData, setPostcodeData] = useState<PostcodeData[]>([]);
  const [valueBandData, setValueBandData] = useState<ValueBandData[]>([]);
  const [jobTypeStats, setJobTypeStats] = useState<JobTypeStats[]>([]);
  const [todayAccounting, setTodayAccounting] = useState({
    netRevenue: 0,
    refundRate: 0,
    yesterdayNet: 0,
    mtdRevenue: 0,
    pendingDisputeValue: 0,
    outstandingCredits: 0,
  });

  // Calculate net profit (revenue - refunds - ad spend)
  const netProfit = stats.revenue - (stats.refundsIssued * 20) - adMetrics.totalSpend;
  const costPerLead = stats.leadsPurchased > 0 ? adMetrics.totalSpend / stats.leadsPurchased : 0;

  useEffect(() => {
    fetchStats();
    fetchChartData();
    fetchPreviousPeriodStats();
    fetchTodayAccounting();
  }, [dateRange]);

  const fetchTodayAccounting = async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Yesterday's dates
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    // Month to date
    const mtdStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    // Fetch today's purchases (only purchased credits, not granted)
    const { data: todayPurchases } = await supabase
      .from("leads")
      .select("id, credit_type")
      .gte("unlocked_at", todayStart.toISOString())
      .lte("unlocked_at", todayEnd.toISOString())
      .not("unlocked_by", "is", null);

    // Filter to only purchased credits for revenue calculations
    const todayPaidPurchases = todayPurchases?.filter(p => p.credit_type !== 'granted') || [];

    // Fetch today's refunds
    const { data: todayRefunds } = await supabase
      .from("leads")
      .select("id")
      .gte("refunded_at", todayStart.toISOString())
      .lte("refunded_at", todayEnd.toISOString());

    // Fetch yesterday's data for comparison (only purchased credits)
    const { data: yesterdayPurchases } = await supabase
      .from("leads")
      .select("id, credit_type")
      .gte("unlocked_at", yesterdayStart.toISOString())
      .lte("unlocked_at", yesterdayEnd.toISOString())
      .not("unlocked_by", "is", null);

    const yesterdayPaidPurchases = yesterdayPurchases?.filter(p => p.credit_type !== 'granted') || [];

    const { data: yesterdayRefunds } = await supabase
      .from("leads")
      .select("id")
      .gte("refunded_at", yesterdayStart.toISOString())
      .lte("refunded_at", yesterdayEnd.toISOString());

    // Fetch MTD purchases and refunds (only purchased credits)
    const { data: mtdPurchases } = await supabase
      .from("leads")
      .select("id, credit_type")
      .gte("unlocked_at", mtdStart.toISOString())
      .lte("unlocked_at", todayEnd.toISOString())
      .not("unlocked_by", "is", null);

    const mtdPaidPurchases = mtdPurchases?.filter(p => p.credit_type !== 'granted') || [];

    const { data: mtdRefunds } = await supabase
      .from("leads")
      .select("id")
      .gte("refunded_at", mtdStart.toISOString())
      .lte("refunded_at", todayEnd.toISOString());

    // Fetch pending disputes value
    const { data: pendingDisputes } = await supabase
      .from("disputes")
      .select("id")
      .eq("status", "open");

    // Fetch total outstanding credits across all users
    const { data: profiles } = await supabase
      .from("profiles")
      .select("credits");

    const todayPurchaseCount = todayPaidPurchases.length;
    const todayRefundCount = todayRefunds?.length || 0;
    const todayRevenue = todayPurchaseCount * 20;
    const todayRefundAmount = todayRefundCount * 20;
    const netRevenue = todayRevenue - todayRefundAmount;
    const refundRate = todayPurchaseCount > 0 ? Math.round((todayRefundCount / todayPurchaseCount) * 100) : 0;

    const yesterdayPurchaseCount = yesterdayPaidPurchases.length;
    const yesterdayRefundCount = yesterdayRefunds?.length || 0;
    const yesterdayNet = (yesterdayPurchaseCount * 20) - (yesterdayRefundCount * 20);

    const mtdPurchaseCount = mtdPaidPurchases.length;
    const mtdRefundCount = mtdRefunds?.length || 0;
    const mtdRevenue = (mtdPurchaseCount * 20) - (mtdRefundCount * 20);

    const pendingDisputeValue = (pendingDisputes?.length || 0) * 20;
    const outstandingCredits = profiles?.reduce((sum, p) => sum + (p.credits || 0), 0) || 0;

    setTodayAccounting({
      netRevenue,
      refundRate,
      yesterdayNet,
      mtdRevenue,
      pendingDisputeValue,
      outstandingCredits,
    });
  };

  // Real-time subscriptions for auto-refresh
  useEffect(() => {
    const channel = supabase
      .channel('admin-overview-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          console.log('Leads updated - refreshing stats');
          fetchStats();
          fetchChartData();
          toast.info('Dashboard updated', { 
            description: payload.eventType === 'INSERT' ? 'New lead received' : 'Lead data changed',
            duration: 3000 
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'disputes' },
        (payload) => {
          console.log('Disputes updated - refreshing stats');
          fetchStats();
          toast.info('Dashboard updated', { 
            description: payload.eventType === 'INSERT' ? 'New dispute opened' : 'Dispute status changed',
            duration: 3000 
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fraud_flags' },
        () => {
          console.log('Fraud flags updated - refreshing stats');
          fetchStats();
          toast.info('Dashboard updated', { description: 'Fraud detection updated', duration: 3000 });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'verification_documents' },
        () => {
          console.log('Verifications updated - refreshing stats');
          fetchStats();
          toast.info('Dashboard updated', { description: 'Verification queue updated', duration: 3000 });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          console.log('Profiles updated - refreshing stats');
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange]);

  // Calculate percentage change
  const getPercentageChange = (current: number, previous: number): { value: number; isPositive: boolean } | null => {
    if (previous === 0) return current > 0 ? { value: 100, isPositive: true } : null;
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(Math.round(change)), isPositive: change >= 0 };
  };

  const fetchPreviousPeriodStats = async () => {
    const { start, end } = getDateFilter();
    const periodLength = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodLength);

    const { data: prevLeads } = await supabase
      .from("leads")
      .select("id, is_unlocked, unlocked_by")
      .gte("created_at", prevStart.toISOString())
      .lte("created_at", prevEnd.toISOString());

    const { data: prevUnlocked } = await supabase
      .from("leads")
      .select("id, unlocked_by, credit_type")
      .gte("unlocked_at", prevStart.toISOString())
      .lte("unlocked_at", prevEnd.toISOString())
      .not("unlocked_by", "is", null);

    // Filter to only paid credits for revenue
    const prevPaidUnlocked = prevUnlocked?.filter(l => l.credit_type !== 'granted') || [];

    const prevLeadsReceived = prevLeads?.length || 0;
    const prevLeadsPurchased = prevUnlocked?.length || 0;
    const prevRevenue = prevPaidUnlocked.length * 20;
    const prevBuyers = new Set(prevUnlocked?.map(l => l.unlocked_by) || []);

    setPreviousStats({
      leadsReceived: prevLeadsReceived,
      leadsPurchased: prevLeadsPurchased,
      revenue: prevRevenue,
      activeBuyers: prevBuyers.size,
    });
  };

  const fetchChartData = async () => {
    const { start, end } = getDateFilter();
    
    const { data: leads } = await supabase
      .from("leads")
      .select("created_at, unlocked_at, is_unlocked, value, postcode, job_type, refunded_at, credit_type")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (leads) {
      const dailyMap = new Map<string, { revenue: number; leads: number }>();
      
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const daysToShow = Math.min(daysDiff, 7);
      
      for (let i = daysToShow - 1; i >= 0; i--) {
        const date = format(subDays(end, i), "EEE");
        dailyMap.set(date, { revenue: 0, leads: 0 });
      }

      leads.forEach((lead) => {
        const dayKey = format(new Date(lead.created_at), "EEE");
        if (dailyMap.has(dayKey)) {
          const current = dailyMap.get(dayKey)!;
          current.leads += 1;
          // Only count revenue from paid leads (not granted)
          if (lead.is_unlocked && lead.credit_type !== 'granted') {
            current.revenue += 20;
          }
        }
      });

      const chartData = Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        revenue: data.revenue,
        leads: data.leads,
      }));

      setRevenueData(chartData);

      const postcodeMap = new Map<string, number>();
      leads.filter(l => l.is_unlocked).forEach((lead) => {
        const prefix = lead.postcode.split(/\s/)[0].replace(/\d.*$/, '') + 
                       lead.postcode.match(/\d+/)?.[0] || lead.postcode.split(/\s/)[0];
        postcodeMap.set(prefix, (postcodeMap.get(prefix) || 0) + 1);
      });

      const sortedPostcodes = Array.from(postcodeMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([postcode, purchases]) => ({ postcode, purchases }));

      setPostcodeData(sortedPostcodes);

      const valueBands = {
        "£100–£149": 0,
        "£150–£199": 0,
        "£200+": 0,
      };

      leads.forEach((lead) => {
        const valueInPounds = lead.value / 100;
        if (valueInPounds >= 200) {
          valueBands["£200+"]++;
        } else if (valueInPounds >= 150) {
          valueBands["£150–£199"]++;
        } else {
          valueBands["£100–£149"]++;
        }
      });

      setValueBandData([
        { name: "£100–£149", value: valueBands["£100–£149"], color: "hsl(var(--muted-foreground))" },
        { name: "£150–£199", value: valueBands["£150–£199"], color: "hsl(var(--secondary))" },
        { name: "£200+", value: valueBands["£200+"], color: "hsl(142, 76%, 36%)" },
      ]);

      const jobTypeMap = new Map<string, { total: number; purchased: number; refunded: number }>();

      leads.forEach((lead) => {
        if (!jobTypeMap.has(lead.job_type)) {
          jobTypeMap.set(lead.job_type, { total: 0, purchased: 0, refunded: 0 });
        }
        const stats = jobTypeMap.get(lead.job_type)!;
        stats.total++;
        if (lead.is_unlocked) stats.purchased++;
        if (lead.refunded_at) stats.refunded++;
      });

      const jobStats = Array.from(jobTypeMap.entries())
        .map(([jobType, data]) => ({
          jobType: jobType.length > 20 ? jobType.substring(0, 20) + "..." : jobType,
          total: data.total,
          purchased: data.purchased,
          refunded: data.refunded,
          purchaseRate: data.total > 0 ? Math.round((data.purchased / data.total) * 100) : 0,
          refundRate: data.purchased > 0 ? Math.round((data.refunded / data.purchased) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);

      setJobTypeStats(jobStats);
    }
  };

  const fetchStats = async () => {
    const { start, end } = getDateFilter();
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    const { data: leads } = await supabase
      .from("leads")
      .select("id, is_unlocked, lead_status, created_at, refunded_at, value, display_value, unlocked_by")
      .gte("created_at", startISO)
      .lte("created_at", endISO);

    const { data: unlockedLeadsInRange } = await supabase
      .from("leads")
      .select("id, unlocked_by, value, display_value, refunded_at, credit_type")
      .gte("unlocked_at", startISO)
      .lte("unlocked_at", endISO)
      .not("unlocked_by", "is", null);

    // Filter to only purchased credits for revenue calculations
    const paidLeadsInRange = unlockedLeadsInRange?.filter(l => l.credit_type !== 'granted') || [];

    const { data: disputes } = await supabase
      .from("disputes")
      .select("id, status, created_at")
      .gte("created_at", startISO)
      .lte("created_at", endISO);

    const { data: fraudFlags } = await supabase
      .from("fraud_flags")
      .select("id, status, created_at")
      .gte("created_at", startISO)
      .lte("created_at", endISO);

    const { data: verifications } = await supabase
      .from("verification_documents")
      .select("id, status, created_at")
      .gte("created_at", startISO)
      .lte("created_at", endISO);

    const leadsReceived = leads?.length || 0;
    const leadsPublished = leads?.filter(l => l.lead_status === "published").length || 0;
    
    // Total leads purchased (includes both paid and granted)
    const leadsPurchased = unlockedLeadsInRange?.length || 0;
    // Revenue only from paid credits (excludes granted)
    const paidLeadsPurchased = paidLeadsInRange.length;
    const revenue = paidLeadsPurchased * 20;
    
    const uniqueBuyers = new Set(unlockedLeadsInRange?.map(l => l.unlocked_by) || []);
    const activeBuyers = uniqueBuyers.size;
    
    // Refunds from paid leads only
    const refundsIssued = paidLeadsInRange.filter(l => l.refunded_at !== null).length;
    
    const disputesOpen = disputes?.filter(d => d.status === "open").length || 0;
    const pendingFraud = fraudFlags?.filter(f => f.status === "pending").length || 0;
    
    // Helper to extract the "from" value from display_value like "from £150" or "£100-150"
    const extractJobValue = (lead: { value: number; display_value?: string }): number => {
      // First try to parse display_value for "from £X" format
      if (lead.display_value) {
        const fromMatch = lead.display_value.match(/from\s*£(\d+)/i);
        if (fromMatch) {
          return parseInt(fromMatch[1], 10);
        }
        // Try to match first number in formats like "£100-150" or "£150-200"
        const rangeMatch = lead.display_value.match(/£(\d+)/);
        if (rangeMatch) {
          return parseInt(rangeMatch[1], 10);
        }
      }
      // Fallback: if value > 1000, assume pence; otherwise assume pounds
      if (lead.value > 1000) {
        return Math.round(lead.value / 100);
      }
      return lead.value || 0;
    };

    const totalValuePounds = leads?.reduce((sum, l) => sum + extractJobValue(l), 0) || 0;
    const avgJobValue = leadsReceived > 0 ? Math.round(totalValuePounds / leadsReceived) : 0;
    
    const conversionRate = leadsReceived > 0 ? Math.round((leadsPurchased / leadsReceived) * 100) : 0;
    
    // Calculate total job revenue from purchased leads using the extracted "from" values
    const totalJobRevenue = unlockedLeadsInRange?.reduce((sum, l) => {
      return sum + extractJobValue(l as { value: number; display_value?: string });
    }, 0) || 0;

    setStats({
      leadsReceived,
      leadsPublished,
      leadsPurchased,
      revenue,
      activeBuyers,
      refundsIssued,
      disputesOpen,
      fraudFlags: pendingFraud,
      avgJobValue,
      conversionRate,
      totalJobRevenue,
    });

    const leadsAwaiting = leads?.filter(l => l.lead_status === "new").length || 0;
    const verificationPending = verifications?.filter(v => v.status === "pending").length || 0;

    setQueues({
      leadsAwaiting,
      verificationPending,
      fraudQueue: pendingFraud,
      disputesAwaiting: disputesOpen,
    });
  };

  const handleExportCSV = () => {
    const exportData = [{
      period: `${format(start, "d MMM yyyy")} - ${format(end, "d MMM yyyy")}`,
      leads_received: stats.leadsReceived,
      leads_published: stats.leadsPublished,
      leads_purchased: stats.leadsPurchased,
      revenue: `£${stats.revenue}`,
      active_buyers: stats.activeBuyers,
      refunds_issued: stats.refundsIssued,
      disputes_open: stats.disputesOpen,
      fraud_flags: stats.fraudFlags,
      avg_job_value: `£${stats.avgJobValue}`,
      conversion_rate: `${stats.conversionRate}%`,
      total_job_revenue: `£${stats.totalJobRevenue}`,
    }];

    exportToCsv(exportData, "overview_stats", [
      { key: "period", label: "Period" },
      { key: "leads_received", label: "Leads Received" },
      { key: "leads_published", label: "Leads Published" },
      { key: "leads_purchased", label: "Leads Purchased" },
      { key: "revenue", label: "Revenue" },
      { key: "active_buyers", label: "Active Buyers" },
      { key: "refunds_issued", label: "Refunds Issued" },
      { key: "disputes_open", label: "Disputes Open" },
      { key: "fraud_flags", label: "Fraud Flags" },
      { key: "avg_job_value", label: "Avg Job Value" },
      { key: "conversion_rate", label: "Conversion Rate" },
      { key: "total_job_revenue", label: "Total Job Revenue" },
    ]);
    toast.success("Export started");
  };

  // Render comparison badge
  const renderComparison = (current: number, previous: number | undefined) => {
    if (previous === undefined) return null;
    const change = getPercentageChange(current, previous);
    if (!change) return null;
    
    return (
      <span className={`flex items-center gap-0.5 text-xs ${change.isPositive ? "text-green-500" : "text-red-500"}`}>
        {change.isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
        {change.value}%
      </span>
    );
  };

  return (
    <AdminLayout title="Overview">
      {/* Export Button */}
      <div className="flex justify-end mb-4">
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* KPI Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          title="Leads Received"
          value={stats.leadsReceived}
          icon={<FileText className="w-5 h-5 text-secondary" />}
          href="/admin/leads"
          trend={renderComparison(stats.leadsReceived, previousStats?.leadsReceived)}
        />
        <KPICard
          title="Leads Purchased"
          value={stats.leadsPurchased}
          icon={<ShoppingCart className="w-5 h-5 text-secondary" />}
          href="/admin/leads?status=purchased"
          trend={renderComparison(stats.leadsPurchased, previousStats?.leadsPurchased)}
        />
        <KPICard
          title="Revenue"
          value={`£${stats.revenue.toLocaleString()}`}
          icon={<CreditCard className="w-5 h-5 text-secondary" />}
          href="/admin/payments"
          trend={renderComparison(stats.revenue, previousStats?.revenue)}
        />
        <KPICard
          title="Conversion Rate"
          value={`${stats.conversionRate}%`}
          icon={<Target className="w-5 h-5 text-secondary" />}
          href="/admin/analytics"
        />
      </div>

      {/* Today's Accounting Summary Widget */}
      <div className="bg-card rounded-xl border border-border p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-secondary" />
            <h3 className="font-heading font-semibold text-foreground">Today's Accounting</h3>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => syncAllPlatforms()}
            disabled={isSyncingAny}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncingAny ? "animate-spin" : ""}`} />
            {isSyncingAny ? "Syncing..." : "Sync All Ads"}
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className={`text-2xl font-bold ${todayAccounting.netRevenue >= 0 ? "text-green-500" : "text-red-500"}`}>
              £{todayAccounting.netRevenue}
            </p>
            <p className="text-xs text-muted-foreground">Net Revenue</p>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className={`text-2xl font-bold ${todayAccounting.refundRate <= 10 ? "text-green-500" : "text-amber-500"}`}>
              {todayAccounting.refundRate}%
            </p>
            <p className="text-xs text-muted-foreground">Refund Rate</p>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className={`text-2xl font-bold ${todayAccounting.yesterdayNet >= 0 ? "text-foreground" : "text-red-500"}`}>
              £{todayAccounting.yesterdayNet}
            </p>
            <p className="text-xs text-muted-foreground">Yesterday Net</p>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className={`text-2xl font-bold ${todayAccounting.mtdRevenue >= 0 ? "text-green-500" : "text-red-500"}`}>
              £{todayAccounting.mtdRevenue.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">MTD Revenue</p>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold text-amber-500">£{adMetrics.totalSpend.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Ad Spend</p>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold text-secondary">£{costPerLead.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Cost/Lead</p>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
              £{netProfit.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Net Profit</p>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg relative overflow-hidden">
            {checkoutCount > 0 && (
              <div className="absolute top-1 right-1">
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              </div>
            )}
            <div className="flex items-center justify-center gap-1.5">
              <Zap className={`w-5 h-5 ${checkoutCount > 0 ? "text-green-500" : "text-muted-foreground"}`} />
              <p className={`text-2xl font-bold ${checkoutCount > 0 ? "text-green-500" : "text-muted-foreground"}`}>
                {checkoutCount}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Live Checkouts</p>
          </div>
        </div>
      </div>

      {/* Combined Ad Performance Widget */}
      <div className="bg-card rounded-xl border border-border p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-secondary" />
            <h3 className="font-heading font-semibold text-foreground">Combined Ad Performance</h3>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => syncAllPlatforms()}
            disabled={isSyncingAny}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncingAny ? "animate-spin" : ""}`} />
            {isSyncingAny ? "Syncing..." : "Sync All"}
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold text-foreground">{adMetrics.totalImpressions.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Impressions</p>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold text-foreground">{adMetrics.totalClicks.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Clicks</p>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold text-foreground">{adMetrics.ctr.toFixed(2)}%</p>
            <p className="text-xs text-muted-foreground">CTR</p>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold text-foreground">{adMetrics.totalConversions}</p>
            <p className="text-xs text-muted-foreground">Conversions</p>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold text-secondary">£{adMetrics.costPerClick.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Cost/Click</p>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold text-secondary">£{adMetrics.costPerLead.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Cost/Conversion</p>
          </div>
        </div>
        
        {/* Platform Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Google Ads */}
          <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-blue-600">Google Ads</span>
              {googleAdsSettings?.last_sync_at && (
                <span className="text-xs text-muted-foreground">
                  {new Date(googleAdsSettings.last_sync_at).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-foreground">£{googleAdsMetrics.totalSpend.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Spend</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{googleAdsMetrics.totalClicks}</p>
                <p className="text-xs text-muted-foreground">Clicks</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{googleAdsMetrics.totalConversions}</p>
                <p className="text-xs text-muted-foreground">Conversions</p>
              </div>
            </div>
          </div>
          
          {/* Facebook Ads */}
          <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-indigo-600">Facebook Ads</span>
              {facebookAdsSettings?.last_sync_at && (
                <span className="text-xs text-muted-foreground">
                  {new Date(facebookAdsSettings.last_sync_at).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-foreground">£{facebookAdsMetrics.totalSpend.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Spend</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{facebookAdsMetrics.totalClicks}</p>
                <p className="text-xs text-muted-foreground">Clicks</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{facebookAdsMetrics.totalConversions}</p>
                <p className="text-xs text-muted-foreground">Conversions</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <KPICard
          title="Avg Job Value"
          value={`£${stats.avgJobValue.toLocaleString()}`}
          icon={<Layers className="w-5 h-5 text-secondary" />}
          href="/admin/leads"
        />
        <KPICard
          title="Total Job Revenue"
          value={`£${stats.totalJobRevenue.toLocaleString()}`}
          icon={<PoundSterling className="w-5 h-5 text-secondary" />}
          href="/admin/leads?status=purchased"
        />
        <KPICard
          title="Active Buyers"
          value={stats.activeBuyers}
          icon={<Users className="w-5 h-5 text-secondary" />}
          href="/admin/businesses"
          trend={renderComparison(stats.activeBuyers, previousStats?.activeBuyers)}
        />
        <KPICard
          title="Refunds Issued"
          value={stats.refundsIssued}
          icon={<RotateCcw className="w-5 h-5 text-muted-foreground" />}
          href="/admin/leads?status=refunded"
        />
        <KPICard
          title="Disputes Open"
          value={stats.disputesOpen}
          icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
          href="/admin/disputes"
        />
      </div>

      {/* Live Checkouts Panel */}
      <div className="mb-8">
        <LiveCheckoutsPanel activeCheckouts={activeCheckouts} checkoutCount={checkoutCount} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-heading font-semibold text-foreground mb-4">
            Revenue & Leads (Last 7 Days)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Revenue (£)"
                stroke="hsl(var(--secondary))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="leads"
                name="Leads"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-heading font-semibold text-foreground mb-4">
            Lead Value Bands
          </h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={valueBandData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {valueBandData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-4">
            {valueBandData.map((band) => (
              <div key={band.name} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: band.color }} />
                <span className="text-muted-foreground">{band.name}: {band.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Source Breakdown Chart */}
      <div className="mb-8">
        <SourceBreakdownChart />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-heading font-semibold text-foreground mb-4">
            Top Postcodes by Purchases
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={postcodeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis dataKey="postcode" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={50} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="purchases" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-heading font-semibold text-foreground mb-4">
            Job Type Performance
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Job Type</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Total</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Purchase %</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Refund %</th>
                </tr>
              </thead>
              <tbody>
                {jobTypeStats.map((stat) => (
                  <tr key={stat.jobType} className="border-b border-border/50">
                    <td className="py-2 text-foreground">{stat.jobType}</td>
                    <td className="py-2 text-right text-foreground">{stat.total}</td>
                    <td className="py-2 text-right">
                      <span className={stat.purchaseRate >= 50 ? "text-green-500" : "text-amber-500"}>
                        {stat.purchaseRate}%
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span className={stat.refundRate <= 10 ? "text-green-500" : "text-red-500"}>
                        {stat.refundRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Queue Widgets */}
      <h3 className="font-heading font-semibold text-foreground mb-4">
        Action Queues
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QueueWidget
          title="Leads Awaiting Review"
          count={queues.leadsAwaiting}
          href="/admin/leads?status=new"
        />
        <QueueWidget
          title="Verification Queue"
          count={queues.verificationPending}
          href="/admin/verifications"
          color="warning"
        />
        <QueueWidget
          title="Fraud Queue"
          count={queues.fraudQueue}
          href="/admin/fraud"
          color="danger"
        />
        <QueueWidget
          title="Disputes Awaiting"
          count={queues.disputesAwaiting}
          href="/admin/disputes"
          color="warning"
        />
      </div>
    </AdminLayout>
  );
}
