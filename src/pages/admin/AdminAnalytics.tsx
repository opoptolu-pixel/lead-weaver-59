import { useState } from "react";
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
import { Download, TrendingUp, TrendingDown, Users, FileText, DollarSign } from "lucide-react";

// Mock data
const leadsBySource = [
  { source: "Website", leads: 245, purchased: 180, refunded: 12 },
  { source: "Google Ads", leads: 156, purchased: 120, refunded: 8 },
  { source: "Facebook", leads: 89, purchased: 65, refunded: 5 },
  { source: "Referral", leads: 45, purchased: 40, refunded: 1 },
  { source: "Partner", leads: 32, purchased: 28, refunded: 2 },
];

const supplyVsDemand = [
  { date: "Mon", supply: 45, demand: 52 },
  { date: "Tue", supply: 52, demand: 48 },
  { date: "Wed", supply: 38, demand: 55 },
  { date: "Thu", supply: 61, demand: 50 },
  { date: "Fri", supply: 55, demand: 58 },
  { date: "Sat", supply: 28, demand: 35 },
  { date: "Sun", supply: 22, demand: 30 },
];

const timeToPurchase = [
  { range: "< 1 hour", count: 125 },
  { range: "1-4 hours", count: 89 },
  { range: "4-12 hours", count: 56 },
  { range: "12-24 hours", count: 34 },
  { range: "> 24 hours", count: 18 },
];

const topPostcodes = [
  { prefix: "SW", leads: 156, purchased: 120, rate: 76.9 },
  { prefix: "SE", leads: 134, purchased: 98, rate: 73.1 },
  { prefix: "E", leads: 112, purchased: 89, rate: 79.5 },
  { prefix: "N", leads: 98, purchased: 72, rate: 73.5 },
  { prefix: "W", leads: 87, purchased: 65, rate: 74.7 },
  { prefix: "NW", leads: 76, purchased: 58, rate: 76.3 },
  { prefix: "EC", leads: 54, purchased: 45, rate: 83.3 },
  { prefix: "WC", leads: 42, purchased: 36, rate: 85.7 },
];

const topBuyers = [
  { name: "CleanPro Services", purchases: 45, spend: 900, refunds: 2, refundRate: 4.4, closeRate: 68 },
  { name: "Sparkle Clean Ltd", purchases: 38, spend: 760, refunds: 1, refundRate: 2.6, closeRate: 72 },
  { name: "Fresh & Tidy", purchases: 32, spend: 640, refunds: 3, refundRate: 9.4, closeRate: 55 },
  { name: "Deep Clean Experts", purchases: 28, spend: 560, refunds: 0, refundRate: 0, closeRate: 82 },
  { name: "Premier Cleaning", purchases: 25, spend: 500, refunds: 2, refundRate: 8.0, closeRate: 60 },
];

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--muted))", "hsl(var(--destructive))"];

export default function AdminAnalytics() {
  const [activeTab, setActiveTab] = useState("acquisition");

  const handleExport = (reportName: string) => {
    // In real app, this would trigger CSV download
    console.log(`Exporting ${reportName} report...`);
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="acquisition">
              <FileText className="h-4 w-4 mr-2" />
              Acquisition
            </TabsTrigger>
            <TabsTrigger value="marketplace">
              <TrendingUp className="h-4 w-4 mr-2" />
              Marketplace
            </TabsTrigger>
            <TabsTrigger value="buyers">
              <Users className="h-4 w-4 mr-2" />
              Buyer Performance
            </TabsTrigger>
          </TabsList>

          {/* Acquisition Tab */}
          <TabsContent value="acquisition" className="space-y-6 mt-6">
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => handleExport("acquisition")}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Leads by Source</CardTitle>
                  <CardDescription>Volume and conversion by acquisition channel</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={leadsBySource}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="source" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))"
                          }}
                        />
                        <Bar dataKey="leads" fill="hsl(var(--primary))" name="Received" />
                        <Bar dataKey="purchased" fill="hsl(var(--secondary))" name="Purchased" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Source Performance</CardTitle>
                  <CardDescription>Purchase and refund rates by source</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Purchase Rate</TableHead>
                        <TableHead className="text-right">Refund Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadsBySource.map((source) => {
                        const purchaseRate = ((source.purchased / source.leads) * 100).toFixed(1);
                        const refundRate = ((source.refunded / source.purchased) * 100).toFixed(1);
                        return (
                          <TableRow key={source.source}>
                            <TableCell className="font-medium">{source.source}</TableCell>
                            <TableCell className="text-right">{source.leads}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{purchaseRate}%</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={Number(refundRate) > 5 ? "destructive" : "outline"}>
                                {refundRate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Top Postcodes */}
            <Card>
              <CardHeader>
                <CardTitle>Top Postcode Prefixes</CardTitle>
                <CardDescription>Lead volume and purchase rates by area</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Postcode</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Purchased</TableHead>
                      <TableHead className="text-right">Purchase Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topPostcodes.map((pc) => (
                      <TableRow key={pc.prefix}>
                        <TableCell className="font-medium">{pc.prefix}</TableCell>
                        <TableCell className="text-right">{pc.leads}</TableCell>
                        <TableCell className="text-right">{pc.purchased}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{pc.rate}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Marketplace Tab */}
          <TabsContent value="marketplace" className="space-y-6 mt-6">
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => handleExport("marketplace")}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Supply vs Demand</CardTitle>
                  <CardDescription>Leads received vs active buyers looking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={supplyVsDemand}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))"
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="supply" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          name="Supply (Leads)"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="demand" 
                          stroke="hsl(var(--destructive))" 
                          strokeWidth={2}
                          name="Demand (Buyers)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Time to Purchase</CardTitle>
                  <CardDescription>How quickly leads get purchased after publishing</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={timeToPurchase}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="count"
                          nameKey="range"
                          label={({ range, percent }) => `${range}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {timeToPurchase.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Marketplace Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">73%</p>
                    <p className="text-sm text-muted-foreground">Lead Purchase Rate</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">4.2 hrs</p>
                    <p className="text-sm text-muted-foreground">Avg Time to Purchase</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">12%</p>
                    <p className="text-sm text-muted-foreground">Leads Expired</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">5.2%</p>
                    <p className="text-sm text-muted-foreground">Refund Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Buyer Performance Tab */}
          <TabsContent value="buyers" className="space-y-6 mt-6">
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => handleExport("buyers")}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Top Buyers</CardTitle>
                <CardDescription>Highest spending businesses in the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead className="text-right">Purchases</TableHead>
                      <TableHead className="text-right">Total Spend</TableHead>
                      <TableHead className="text-right">Close Rate</TableHead>
                      <TableHead className="text-right">Refund Rate</TableHead>
                      <TableHead className="text-right">Trend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topBuyers.map((buyer, index) => (
                      <TableRow key={buyer.name}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0">
                              {index + 1}
                            </Badge>
                            <span className="font-medium">{buyer.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{buyer.purchases}</TableCell>
                        <TableCell className="text-right font-medium">£{buyer.spend}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={buyer.closeRate >= 70 ? "bg-green-500/20 text-green-500" : buyer.closeRate >= 50 ? "bg-amber-500/20 text-amber-500" : "bg-destructive/20 text-destructive"}>
                            {buyer.closeRate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={buyer.refundRate > 5 ? "destructive" : "default"}>
                            {buyer.refundRate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {index % 2 === 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-500 inline" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500 inline" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Buyers (7d)</CardDescription>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    127
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Avg Spend per Buyer</CardDescription>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    £84
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Repeat Purchase Rate</CardDescription>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    68%
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
