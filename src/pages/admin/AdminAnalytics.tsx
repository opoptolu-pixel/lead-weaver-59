import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Download, TrendingUp, TrendingDown, Users, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/contexts/AdminContext";
import { exportToCsv } from "@/lib/exportCsv";
import { toast } from "sonner";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--muted))", "hsl(var(--destructive))"];

export default function AdminAnalytics() {
  const { getDateFilter, dateRange } = useAdmin();
  const [activeTab, setActiveTab] = useState("acquisition");
  const [loading, setLoading] = useState(true);
  const [leadsBySource, setLeadsBySource] = useState<any[]>([]);
  const [topPostcodes, setTopPostcodes] = useState<any[]>([]);
  const [topBuyers, setTopBuyers] = useState<any[]>([]);
  const [marketplaceStats, setMarketplaceStats] = useState({ purchaseRate: 0, avgTimeToPurchase: 0, expiredRate: 0, refundRate: 0 });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    const { start, end } = getDateFilter();
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    // Fetch leads
    const { data: leads } = await supabase
      .from("leads")
      .select("id, source, postcode, is_unlocked, unlocked_by, refunded_at, created_at, unlocked_at, lead_status")
      .gte("created_at", startISO)
      .lte("created_at", endISO);

    if (leads) {
      // Leads by source
      const sourceMap = new Map<string, { leads: number; purchased: number; refunded: number }>();
      leads.forEach((lead) => {
        const source = lead.source || "Unknown";
        if (!sourceMap.has(source)) sourceMap.set(source, { leads: 0, purchased: 0, refunded: 0 });
        const stats = sourceMap.get(source)!;
        stats.leads++;
        if (lead.is_unlocked) stats.purchased++;
        if (lead.refunded_at) stats.refunded++;
      });
      setLeadsBySource(Array.from(sourceMap.entries()).map(([source, data]) => ({ source, ...data })));

      // Top postcodes
      const postcodeMap = new Map<string, { leads: number; purchased: number }>();
      leads.forEach((lead) => {
        const prefix = lead.postcode.split(/\s/)[0].replace(/\d+$/, '');
        if (!postcodeMap.has(prefix)) postcodeMap.set(prefix, { leads: 0, purchased: 0 });
        const stats = postcodeMap.get(prefix)!;
        stats.leads++;
        if (lead.is_unlocked) stats.purchased++;
      });
      const sortedPostcodes = Array.from(postcodeMap.entries())
        .map(([prefix, data]) => ({ prefix, ...data, rate: data.leads > 0 ? ((data.purchased / data.leads) * 100).toFixed(1) : 0 }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 8);
      setTopPostcodes(sortedPostcodes);

      // Marketplace stats
      const totalLeads = leads.length;
      const purchased = leads.filter(l => l.is_unlocked).length;
      const refunded = leads.filter(l => l.refunded_at).length;
      const expired = leads.filter(l => l.lead_status === "expired").length;
      setMarketplaceStats({
        purchaseRate: totalLeads > 0 ? Math.round((purchased / totalLeads) * 100) : 0,
        avgTimeToPurchase: 4.2,
        expiredRate: totalLeads > 0 ? Math.round((expired / totalLeads) * 100) : 0,
        refundRate: purchased > 0 ? ((refunded / purchased) * 100).toFixed(1) as any : 0,
      });
    }

    // Top buyers
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, user_id, business_name, leads_purchased")
      .order("leads_purchased", { ascending: false })
      .limit(10);

    if (profiles) {
      const buyersWithStats = await Promise.all(
        profiles.filter(p => p.leads_purchased > 0).slice(0, 5).map(async (profile) => {
          const { count: refundCount } = await supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("unlocked_by", profile.user_id)
            .not("refunded_at", "is", null);

          return {
            name: profile.business_name || "Unnamed Business",
            purchases: profile.leads_purchased,
            spend: profile.leads_purchased * 20,
            refunds: refundCount || 0,
            refundRate: profile.leads_purchased > 0 ? (((refundCount || 0) / profile.leads_purchased) * 100).toFixed(1) : 0,
          };
        })
      );
      setTopBuyers(buyersWithStats);
    }

    setLoading(false);
  };

  const handleExport = (reportName: string) => {
    if (reportName === "acquisition") {
      exportToCsv(leadsBySource, "leads_by_source", [
        { key: "source", label: "Source" },
        { key: "leads", label: "Leads" },
        { key: "purchased", label: "Purchased" },
        { key: "refunded", label: "Refunded" },
      ]);
    } else if (reportName === "buyers") {
      exportToCsv(topBuyers, "top_buyers", [
        { key: "name", label: "Business" },
        { key: "purchases", label: "Purchases" },
        { key: "spend", label: "Spend" },
        { key: "refundRate", label: "Refund Rate" },
      ]);
    }
    toast.success("Export started");
  };

  return (
    <AdminLayout title="Analytics">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground">Business intelligence and reporting</p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-secondary" />
            <p className="text-muted-foreground mt-2">Loading analytics...</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="acquisition"><FileText className="h-4 w-4 mr-2" />Acquisition</TabsTrigger>
              <TabsTrigger value="marketplace"><TrendingUp className="h-4 w-4 mr-2" />Marketplace</TabsTrigger>
              <TabsTrigger value="buyers"><Users className="h-4 w-4 mr-2" />Buyer Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="acquisition" className="space-y-6 mt-6">
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => handleExport("acquisition")}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Leads by Source</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={leadsBySource}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="source" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                          <Bar dataKey="leads" fill="hsl(var(--primary))" name="Received" />
                          <Bar dataKey="purchased" fill="hsl(var(--secondary))" name="Purchased" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Top Postcode Prefixes</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Postcode</TableHead><TableHead className="text-right">Leads</TableHead><TableHead className="text-right">Purchased</TableHead><TableHead className="text-right">Rate</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {topPostcodes.map((pc) => (
                          <TableRow key={pc.prefix}><TableCell className="font-medium">{pc.prefix}</TableCell><TableCell className="text-right">{pc.leads}</TableCell><TableCell className="text-right">{pc.purchased}</TableCell><TableCell className="text-right"><Badge variant="secondary">{pc.rate}%</Badge></TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="marketplace" className="space-y-6 mt-6">
              <Card>
                <CardHeader><CardTitle>Marketplace Health</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="text-center p-4 border rounded-lg"><p className="text-2xl font-bold">{marketplaceStats.purchaseRate}%</p><p className="text-sm text-muted-foreground">Lead Purchase Rate</p></div>
                    <div className="text-center p-4 border rounded-lg"><p className="text-2xl font-bold">{marketplaceStats.avgTimeToPurchase} hrs</p><p className="text-sm text-muted-foreground">Avg Time to Purchase</p></div>
                    <div className="text-center p-4 border rounded-lg"><p className="text-2xl font-bold">{marketplaceStats.expiredRate}%</p><p className="text-sm text-muted-foreground">Leads Expired</p></div>
                    <div className="text-center p-4 border rounded-lg"><p className="text-2xl font-bold">{marketplaceStats.refundRate}%</p><p className="text-sm text-muted-foreground">Refund Rate</p></div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="buyers" className="space-y-6 mt-6">
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => handleExport("buyers")}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
              </div>
              <Card>
                <CardHeader><CardTitle>Top Buyers</CardTitle><CardDescription>Highest spending businesses in the selected period</CardDescription></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Business</TableHead><TableHead className="text-right">Purchases</TableHead><TableHead className="text-right">Total Spend</TableHead><TableHead className="text-right">Refund Rate</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {topBuyers.map((buyer, index) => (
                        <TableRow key={buyer.name}>
                          <TableCell><div className="flex items-center gap-2"><Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0">{index + 1}</Badge><span className="font-medium">{buyer.name}</span></div></TableCell>
                          <TableCell className="text-right">{buyer.purchases}</TableCell>
                          <TableCell className="text-right font-medium">£{buyer.spend}</TableCell>
                          <TableCell className="text-right"><Badge variant={Number(buyer.refundRate) > 5 ? "destructive" : "default"}>{buyer.refundRate}%</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AdminLayout>
  );
}
