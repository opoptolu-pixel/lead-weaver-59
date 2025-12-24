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
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import KPICard from "@/components/admin/KPICard";
import QueueWidget from "@/components/admin/QueueWidget";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/contexts/AdminContext";
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

const VALUE_BAND_COLORS = {
  "£100–£140": "hsl(var(--muted-foreground))",
  "£150–£200": "hsl(var(--secondary))",
  "£200+": "hsl(142, 76%, 36%)",
};

export default function AdminOverview() {
  const { getDateFilter, dateRange } = useAdmin();
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

  const { start, end } = getDateFilter();

  useEffect(() => {
    fetchStats();
    fetchChartData();
  }, [dateRange]);

  const fetchChartData = async () => {
    const { start, end } = getDateFilter();
    
    // Fetch leads for chart data
    const { data: leads } = await supabase
      .from("leads")
      .select("created_at, unlocked_at, is_unlocked, value, postcode, job_type, refunded_at")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (leads) {
      // Generate daily revenue/leads data for the date range
      const dailyMap = new Map<string, { revenue: number; leads: number }>();
      
      // Calculate number of days in range
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
          if (lead.is_unlocked) {
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

      // Generate postcode data
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

      // Job Value Bands Analytics - values are in pence
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

      // Job Type Analytics (purchase rate, refund rate)
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

    const { data: leads } = await supabase
      .from("leads")
      .select("id, is_unlocked, lead_status, created_at, refunded_at, value")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, leads_purchased");

    const { data: disputes } = await supabase
      .from("disputes")
      .select("id, status");

    const { data: fraudFlags } = await supabase
      .from("fraud_flags")
      .select("id, status");

    const { data: verifications } = await supabase
      .from("verification_documents")
      .select("id, status");

    const leadsReceived = leads?.length || 0;
    const leadsPublished = leads?.filter(l => l.lead_status === "published").length || 0;
    const leadsPurchased = leads?.filter(l => l.is_unlocked).length || 0;
    const revenue = leadsPurchased * 20;
    const activeBuyers = profiles?.filter(p => (p.leads_purchased || 0) > 0).length || 0;
    const refundsIssued = leads?.filter(l => l.refunded_at !== null).length || 0;
    const disputesOpen = disputes?.filter(d => d.status === "open").length || 0;
    const pendingFraud = fraudFlags?.filter(f => f.status === "pending").length || 0;
    
    // Phase 2: Calculate average job value and conversion rate
    // All values are now stored in pence - convert to pounds for display
    const totalValuePence = leads?.reduce((sum, l) => sum + (l.value || 0), 0) || 0;
    const avgJobValue = leadsReceived > 0 ? Math.round(totalValuePence / leadsReceived / 100) : 0;
    const conversionRate = leadsReceived > 0 ? Math.round((leadsPurchased / leadsReceived) * 100) : 0;
    
    // Total job revenue from purchased leads (in pounds)
    const purchasedLeadsValuePence = leads?.filter(l => l.is_unlocked).reduce((sum, l) => sum + (l.value || 0), 0) || 0;
    const totalJobRevenue = Math.round(purchasedLeadsValuePence / 100);

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

  return (
    <AdminLayout title="Overview">
      {/* KPI Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          title="Leads Received"
          value={stats.leadsReceived}
          icon={<FileText className="w-5 h-5 text-secondary" />}
          href="/admin/leads"
        />
        <KPICard
          title="Leads Purchased"
          value={stats.leadsPurchased}
          icon={<ShoppingCart className="w-5 h-5 text-secondary" />}
          href="/admin/leads?status=purchased"
        />
        <KPICard
          title="Revenue"
          value={`£${stats.revenue.toLocaleString()}`}
          icon={<CreditCard className="w-5 h-5 text-secondary" />}
          href="/admin/payments"
        />
        <KPICard
          title="Conversion Rate"
          value={`${stats.conversionRate}%`}
          icon={<Target className="w-5 h-5 text-secondary" />}
          href="/admin/analytics"
        />
      </div>

      {/* KPI Cards - Row 2 (Phase 2 Metrics) */}
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

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue Chart */}
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

        {/* Phase 2: Job Value Bands */}
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

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Postcodes */}
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

        {/* Phase 2: Job Type Performance */}
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
                      <span className={stat.purchaseRate >= 50 ? "text-green-600" : "text-amber-600"}>
                        {stat.purchaseRate}%
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span className={stat.refundRate <= 10 ? "text-green-600" : "text-red-600"}>
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
      <div className="bg-card rounded-xl border border-border p-6">
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
            title="Verification Pending"
            count={queues.verificationPending}
            href="/admin/verifications"
            color="warning"
          />
          <QueueWidget
            title="Fraud Queue"
            count={queues.fraudQueue}
            href="/admin/payments?tab=fraud"
            color="danger"
          />
          <QueueWidget
            title="Disputes Awaiting"
            count={queues.disputesAwaiting}
            href="/admin/disputes"
            color="warning"
          />
        </div>
      </div>
    </AdminLayout>
  );
}
