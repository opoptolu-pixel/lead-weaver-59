import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Building2,
  Users,
  ShieldCheck,
  MapPin,
  TrendingUp,
  Clock,
  Ban,
  Download,
  CreditCard,
  Loader2,
  UserCheck,
  UserX,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToCsv } from "@/lib/exportCsv";
import { toast } from "sonner";
import { subDays } from "date-fns";

const PIE_COLORS = [
  "hsl(217, 91%, 60%)",   // blue
  "hsl(45, 93%, 47%)",    // amber/gold
  "hsl(280, 65%, 60%)",   // purple
  "hsl(340, 70%, 55%)",   // rose
  "hsl(30, 80%, 55%)",    // orange
  "hsl(172, 66%, 50%)",   // teal
];

interface BusinessProfile {
  user_id: string;
  postcode: string | null;
  is_verified: boolean;
  verification_status: string | null;
  credits: number;
  leads_purchased: number;
  is_suspended: boolean | null;
  phone_verified: boolean;
  last_login: string | null;
  created_at: string;
}

const extractCityFromPostcode = (postcode: string): { city: string; region: string } => {
  const postcodeMap: Record<string, { city: string; region: string }> = {
    'B': { city: 'Birmingham', region: 'West Midlands' },
    'BA': { city: 'Bath', region: 'Somerset' },
    'BB': { city: 'Blackburn', region: 'Lancashire' },
    'BD': { city: 'Bradford', region: 'West Yorkshire' },
    'BH': { city: 'Bournemouth', region: 'Dorset' },
    'BL': { city: 'Bolton', region: 'Greater Manchester' },
    'BN': { city: 'Brighton', region: 'East Sussex' },
    'BR': { city: 'Bromley', region: 'Greater London' },
    'BS': { city: 'Bristol', region: 'Bristol' },
    'CA': { city: 'Carlisle', region: 'Cumbria' },
    'CB': { city: 'Cambridge', region: 'Cambridgeshire' },
    'CF': { city: 'Cardiff', region: 'South Wales' },
    'CH': { city: 'Chester', region: 'Cheshire' },
    'CM': { city: 'Chelmsford', region: 'Essex' },
    'CO': { city: 'Colchester', region: 'Essex' },
    'CR': { city: 'Croydon', region: 'Greater London' },
    'CT': { city: 'Canterbury', region: 'Kent' },
    'CV': { city: 'Coventry', region: 'West Midlands' },
    'DA': { city: 'Dartford', region: 'Kent' },
    'DE': { city: 'Derby', region: 'Derbyshire' },
    'DN': { city: 'Doncaster', region: 'South Yorkshire' },
    'DY': { city: 'Dudley', region: 'West Midlands' },
    'E': { city: 'East London', region: 'Greater London' },
    'EC': { city: 'City of London', region: 'Greater London' },
    'EH': { city: 'Edinburgh', region: 'Scotland' },
    'EN': { city: 'Enfield', region: 'Greater London' },
    'EX': { city: 'Exeter', region: 'Devon' },
    'G': { city: 'Glasgow', region: 'Scotland' },
    'GL': { city: 'Gloucester', region: 'Gloucestershire' },
    'GU': { city: 'Guildford', region: 'Surrey' },
    'HA': { city: 'Harrow', region: 'Greater London' },
    'HD': { city: 'Huddersfield', region: 'West Yorkshire' },
    'HP': { city: 'Hemel Hempstead', region: 'Hertfordshire' },
    'HU': { city: 'Hull', region: 'East Yorkshire' },
    'IG': { city: 'Ilford', region: 'Greater London' },
    'IP': { city: 'Ipswich', region: 'Suffolk' },
    'KT': { city: 'Kingston', region: 'Greater London' },
    'L': { city: 'Liverpool', region: 'Merseyside' },
    'LE': { city: 'Leicester', region: 'Leicestershire' },
    'LS': { city: 'Leeds', region: 'West Yorkshire' },
    'LU': { city: 'Luton', region: 'Bedfordshire' },
    'M': { city: 'Manchester', region: 'Greater Manchester' },
    'ME': { city: 'Maidstone', region: 'Kent' },
    'MK': { city: 'Milton Keynes', region: 'Buckinghamshire' },
    'N': { city: 'North London', region: 'Greater London' },
    'NE': { city: 'Newcastle', region: 'Tyne and Wear' },
    'NG': { city: 'Nottingham', region: 'Nottinghamshire' },
    'NN': { city: 'Northampton', region: 'Northamptonshire' },
    'NR': { city: 'Norwich', region: 'Norfolk' },
    'NW': { city: 'North West London', region: 'Greater London' },
    'OL': { city: 'Oldham', region: 'Greater Manchester' },
    'OX': { city: 'Oxford', region: 'Oxfordshire' },
    'PE': { city: 'Peterborough', region: 'Cambridgeshire' },
    'PL': { city: 'Plymouth', region: 'Devon' },
    'PO': { city: 'Portsmouth', region: 'Hampshire' },
    'PR': { city: 'Preston', region: 'Lancashire' },
    'RG': { city: 'Reading', region: 'Berkshire' },
    'RH': { city: 'Redhill', region: 'Surrey' },
    'RM': { city: 'Romford', region: 'Greater London' },
    'S': { city: 'Sheffield', region: 'South Yorkshire' },
    'SE': { city: 'South East London', region: 'Greater London' },
    'SG': { city: 'Stevenage', region: 'Hertfordshire' },
    'SK': { city: 'Stockport', region: 'Greater Manchester' },
    'SL': { city: 'Slough', region: 'Berkshire' },
    'SM': { city: 'Sutton', region: 'Greater London' },
    'SN': { city: 'Swindon', region: 'Wiltshire' },
    'SO': { city: 'Southampton', region: 'Hampshire' },
    'SR': { city: 'Sunderland', region: 'Tyne and Wear' },
    'SS': { city: 'Southend', region: 'Essex' },
    'ST': { city: 'Stoke-on-Trent', region: 'Staffordshire' },
    'SW': { city: 'South West London', region: 'Greater London' },
    'TN': { city: 'Tunbridge Wells', region: 'Kent' },
    'TS': { city: 'Teesside', region: 'North Yorkshire' },
    'TW': { city: 'Twickenham', region: 'Greater London' },
    'UB': { city: 'Uxbridge', region: 'Greater London' },
    'W': { city: 'West London', region: 'Greater London' },
    'WA': { city: 'Warrington', region: 'Cheshire' },
    'WC': { city: 'West Central London', region: 'Greater London' },
    'WD': { city: 'Watford', region: 'Hertfordshire' },
    'WF': { city: 'Wakefield', region: 'West Yorkshire' },
    'WN': { city: 'Wigan', region: 'Greater Manchester' },
    'WS': { city: 'Walsall', region: 'West Midlands' },
    'WV': { city: 'Wolverhampton', region: 'West Midlands' },
    'YO': { city: 'York', region: 'North Yorkshire' },
  };

  const areaMatch = postcode.match(/^([A-Z]{1,2})/i);
  if (areaMatch) {
    const area = areaMatch[1].toUpperCase();
    if (postcodeMap[area]) return postcodeMap[area];
    if (postcodeMap[area[0]]) return postcodeMap[area[0]];
  }
  return { city: 'Other', region: 'UK' };
};

interface CityBreakdown {
  city: string;
  region: string;
  signedUp: number;
  active: number;
  pending: number;
  reverification: number;
  verified: number;
  suspended: number;
  buyers: number;
  totalPurchases: number;
}

interface BusinessAnalyticsTabProps {
  startDate: Date;
  endDate: Date;
}

export function BusinessAnalyticsTab({ startDate, endDate }: BusinessAnalyticsTabProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total: 0, active: 0, verified: 0, pending: 0, reverification: 0,
    suspended: 0, dormant: 0, activeIn7d: 0, buyers: 0, neverPurchased: 0,
    totalPurchases: 0, totalCredits: 0, phoneVerified: 0, newInPeriod: 0,
  });
  const [cityData, setCityData] = useState<CityBreakdown[]>([]);
  const [verificationPie, setVerificationPie] = useState<{ name: string; value: number }[]>([]);
  const [topBuyerCities, setTopBuyerCities] = useState<CityBreakdown[]>([]);

  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  useEffect(() => {
    fetchData();
  }, [startIso, endIso]);

  const fetchData = async () => {
    setLoading(true);

    const [{ data: allData }, { data: periodData }] = await Promise.all([
      supabase.from("profiles").select("user_id, postcode, is_verified, verification_status, credits, leads_purchased, is_suspended, phone_verified, last_login, created_at"),
      supabase.from("profiles").select("user_id").gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
    ]);

    const all = (allData || []) as BusinessProfile[];
    const now = new Date();
    const d7 = subDays(now, 7);
    const d30 = subDays(now, 30);
    const d90 = subDays(now, 90);

    const activeIn30 = all.filter(p => p.last_login && new Date(p.last_login) >= d30);
    const activeIn7 = all.filter(p => p.last_login && new Date(p.last_login) >= d7);
    const dormant = all.filter(p => !p.last_login || new Date(p.last_login) < d90);
    const buyers = all.filter(p => p.leads_purchased > 0);

    setSummary({
      total: all.length,
      active: activeIn30.length,
      verified: all.filter(p => p.is_verified).length,
      pending: all.filter(p => p.verification_status === 'pending' || p.verification_status === 'submitted').length,
      reverification: all.filter(p => p.verification_status === 'reverification_required').length,
      suspended: all.filter(p => p.is_suspended).length,
      dormant: dormant.length,
      activeIn7d: activeIn7.length,
      buyers: buyers.length,
      neverPurchased: all.filter(p => p.leads_purchased === 0).length,
      totalPurchases: all.reduce((s, p) => s + p.leads_purchased, 0),
      totalCredits: all.reduce((s, p) => s + p.credits, 0),
      phoneVerified: all.filter(p => p.phone_verified).length,
      newInPeriod: (periodData || []).length,
    });

    // Verification pie
    const vMap = new Map<string, number>();
    all.forEach(p => {
      const s = p.verification_status || 'pending';
      vMap.set(s, (vMap.get(s) || 0) + 1);
    });
    const labels: Record<string, string> = {
      approved: 'Verified', pending: 'Pending', submitted: 'Under Review',
      rejected: 'Rejected', reverification_required: 'Re-verification',
    };
    setVerificationPie(Array.from(vMap.entries()).map(([k, v]) => ({ name: labels[k] || k, value: v })));

    // City breakdown
    const cMap = new Map<string, CityBreakdown>();
    all.forEach(p => {
      if (!p.postcode) return;
      const { city, region } = extractCityFromPostcode(p.postcode);
      const key = `${city}-${region}`;
      if (!cMap.has(key)) {
        cMap.set(key, { city, region, signedUp: 0, active: 0, pending: 0, reverification: 0, verified: 0, suspended: 0, buyers: 0, totalPurchases: 0 });
      }
      const c = cMap.get(key)!;
      c.signedUp++;
      if (p.last_login && new Date(p.last_login) >= d30) c.active++;
      if (p.verification_status === 'pending' || p.verification_status === 'submitted') c.pending++;
      if (p.verification_status === 'reverification_required') c.reverification++;
      if (p.is_verified) c.verified++;
      if (p.is_suspended) c.suspended++;
      if (p.leads_purchased > 0) { c.buyers++; c.totalPurchases += p.leads_purchased; }
    });

    const sorted = Array.from(cMap.values()).sort((a, b) => b.signedUp - a.signedUp);
    setCityData(sorted);
    setTopBuyerCities([...sorted].sort((a, b) => b.totalPurchases - a.totalPurchases).filter(c => c.totalPurchases > 0).slice(0, 10));

    setLoading(false);
  };

  const handleExport = () => {
    exportToCsv(cityData, "business_by_city", [
      { key: "city", label: "City" }, { key: "region", label: "Region" },
      { key: "signedUp", label: "Signed Up" }, { key: "active", label: "Active (30d)" },
      { key: "verified", label: "Verified" }, { key: "pending", label: "Pending" },
      { key: "reverification", label: "Re-verification" }, { key: "suspended", label: "Suspended" },
      { key: "buyers", label: "Buyers" }, { key: "totalPurchases", label: "Total Purchases" },
    ]);
    toast.success("Export started");
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-secondary" />
        <p className="text-muted-foreground mt-2">Loading business analytics...</p>
      </div>
    );
  }

  const pct = (n: number) => summary.total > 0 ? Math.round((n / summary.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Total Signed Up
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.total.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">+{summary.newInPeriod} in period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4" /> Active (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.active.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{pct(summary.active)}% · {summary.activeIn7d} active this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Verified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.verified.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{pct(summary.verified)}% of all businesses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Pending Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.pending.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{pct(summary.pending)}% awaiting review</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Re-verification Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.reverification.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Blocked from purchasing</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Ban className="h-4 w-4" /> Suspended
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.suspended.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserX className="h-4 w-4" /> Dormant (90d+)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.dormant.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{pct(summary.dormant)}% inactive</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Active Buyers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.buyers.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{summary.neverPurchased} never purchased</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads Purchased</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalPurchases.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Avg {summary.buyers > 0 ? (summary.totalPurchases / summary.buyers).toFixed(1) : 0} per buyer</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Credits in Circulation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalCredits.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Phone Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.phoneVerified.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{pct(summary.phoneVerified)}% of businesses</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-secondary" /> Verification Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={verificationPie} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" isAnimationActive={false}
                    label={({ name, value }) => `${name}: ${value}`}>
                    {verificationPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-secondary" /> Most Active Buyer Cities
            </CardTitle>
            <CardDescription>Top 10 cities by total lead purchases</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topBuyerCities} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="city" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={75} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(value: number, name: string) => [value.toLocaleString(), name === 'totalPurchases' ? 'Purchases' : name === 'buyers' ? 'Buyers' : name]}
                  />
                  <Bar dataKey="totalPurchases" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} name="Purchases" />
                  <Bar dataKey="buyers" fill="hsl(280, 65%, 60%)" radius={[0, 4, 4, 0]} name="Buyers" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* City Breakdown Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-5 w-5 text-secondary" /> Breakdown by City
              </CardTitle>
              <CardDescription>All business metrics aggregated by location</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>City</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">Signed Up</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Verified</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Re-verify</TableHead>
                  <TableHead className="text-right">Suspended</TableHead>
                  <TableHead className="text-right">Buyers</TableHead>
                  <TableHead className="text-right">Purchases</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cityData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">No data available</TableCell>
                  </TableRow>
                ) : (
                  cityData.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.city}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{c.region}</TableCell>
                      <TableCell className="text-right font-medium">{c.signedUp}</TableCell>
                      <TableCell className="text-right">
                        {c.active > 0 ? (
                          <Badge variant="default" className="text-xs">{c.active}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{c.verified}</TableCell>
                      <TableCell className="text-right">
                        {c.pending > 0 ? (
                          <span className="text-amber-600 font-medium">{c.pending}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.reverification > 0 ? (
                          <span className="text-orange-600 font-medium">{c.reverification}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.suspended > 0 ? (
                          <span className="text-destructive font-medium">{c.suspended}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{c.buyers}</TableCell>
                      <TableCell className="text-right font-medium">{c.totalPurchases}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
