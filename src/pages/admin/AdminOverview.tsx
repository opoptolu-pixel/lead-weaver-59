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
} from "recharts";

// Placeholder data for charts
const revenueData = [
  { date: "Mon", revenue: 240, leads: 12 },
  { date: "Tue", revenue: 300, leads: 15 },
  { date: "Wed", revenue: 280, leads: 14 },
  { date: "Thu", revenue: 400, leads: 20 },
  { date: "Fri", revenue: 380, leads: 19 },
  { date: "Sat", revenue: 200, leads: 10 },
  { date: "Sun", revenue: 160, leads: 8 },
];

const postcodeData = [
  { postcode: "M1", purchases: 45 },
  { postcode: "M2", purchases: 38 },
  { postcode: "M3", purchases: 32 },
  { postcode: "M4", purchases: 28 },
  { postcode: "M5", purchases: 24 },
];

export default function AdminOverview() {
  const { getDateFilter } = useAdmin();
  const [stats, setStats] = useState({
    leadsReceived: 0,
    leadsPublished: 0,
    leadsPurchased: 0,
    revenue: 0,
    activeBuyers: 0,
    refundsIssued: 0,
    disputesOpen: 0,
    fraudFlags: 0,
  });
  const [queues, setQueues] = useState({
    leadsAwaiting: 0,
    verificationPending: 0,
    fraudQueue: 0,
    disputesAwaiting: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const { start, end } = getDateFilter();

    // Fetch leads stats
    const { data: leads } = await supabase
      .from("leads")
      .select("id, is_unlocked, lead_status, created_at")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    // Fetch profiles for active buyers
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, leads_purchased");

    // Fetch disputes
    const { data: disputes } = await supabase
      .from("disputes")
      .select("id, status");

    // Fetch fraud flags
    const { data: fraudFlags } = await supabase
      .from("fraud_flags")
      .select("id, status");

    // Fetch pending verifications
    const { data: verifications } = await supabase
      .from("verification_documents")
      .select("id, status");

    // Calculate stats
    const leadsReceived = leads?.length || 0;
    const leadsPublished = leads?.filter(l => l.lead_status === "published").length || 0;
    const leadsPurchased = leads?.filter(l => l.is_unlocked).length || 0;
    const revenue = leadsPurchased * 20; // £20 per lead
    const activeBuyers = profiles?.filter(p => (p.leads_purchased || 0) > 0).length || 0;
    const disputesOpen = disputes?.filter(d => d.status === "open").length || 0;
    const pendingFraud = fraudFlags?.filter(f => f.status === "pending").length || 0;

    setStats({
      leadsReceived,
      leadsPublished,
      leadsPurchased,
      revenue,
      activeBuyers,
      refundsIssued: 0,
      disputesOpen,
      fraudFlags: pendingFraud,
    });

    // Queue counts
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
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          title="Leads Received"
          value={stats.leadsReceived}
          icon={<FileText className="w-5 h-5 text-secondary" />}
          change={{ value: 12, positive: true }}
        />
        <KPICard
          title="Leads Published"
          value={stats.leadsPublished}
          icon={<TrendingUp className="w-5 h-5 text-secondary" />}
        />
        <KPICard
          title="Leads Purchased"
          value={stats.leadsPurchased}
          icon={<ShoppingCart className="w-5 h-5 text-secondary" />}
        />
        <KPICard
          title="Revenue"
          value={`£${stats.revenue.toLocaleString()}`}
          icon={<CreditCard className="w-5 h-5 text-secondary" />}
          change={{ value: 8, positive: true }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          title="Active Buyers"
          value={stats.activeBuyers}
          icon={<Users className="w-5 h-5 text-secondary" />}
        />
        <KPICard
          title="Refunds Issued"
          value={stats.refundsIssued}
          icon={<RotateCcw className="w-5 h-5 text-muted-foreground" />}
        />
        <KPICard
          title="Disputes Open"
          value={stats.disputesOpen}
          icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
        />
        <KPICard
          title="Fraud Flags"
          value={stats.fraudFlags}
          icon={<Flag className="w-5 h-5 text-destructive" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue Chart */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-heading font-semibold text-foreground mb-4">
            Revenue & Leads Over Time
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
                stroke="hsl(var(--secondary))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="leads"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Postcodes */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-heading font-semibold text-foreground mb-4">
            Top Postcode Prefixes by Purchases
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={postcodeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis dataKey="postcode" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={40} />
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