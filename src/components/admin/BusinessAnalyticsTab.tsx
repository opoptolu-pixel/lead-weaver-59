import { useState, useEffect, useMemo } from "react";
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
  ShieldAlert,
  MapPin,
  TrendingUp,
  Clock,
  Ban,
  Download,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  UserCheck,
  UserX,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToCsv } from "@/lib/exportCsv";
import { toast } from "sonner";
import { format, differenceInDays, subDays } from "date-fns";

const COLORS = [
  "hsl(var(--secondary))",
  "hsl(142, 76%, 36%)",
  "hsl(200, 80%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(30, 80%, 55%)",
  "hsl(340, 70%, 55%)",
  "hsl(180, 60%, 45%)",
  "hsl(50, 80%, 50%)",
];

interface BusinessProfile {
  user_id: string;
  business_name: string | null;
  contact_name: string | null;
  postcode: string | null;
  phone: string | null;
  is_verified: boolean;
  verification_status: string | null;
  credits: number;
  granted_credits: number;
  leads_purchased: number;
  is_suspended: boolean | null;
  phone_verified: boolean;
  address_verified: boolean;
  risk_score: number | null;
  created_at: string;
  last_login: string | null;
  whatsapp_optin: boolean | null;
}

interface BusinessStats {
  total: number;
  active: number;
  verified: number;
  pendingVerification: number;
  reverificationRequired: number;
  suspended: number;
  withCredits: number;
  withPurchases: number;
  neverPurchased: number;
  phoneVerified: number;
  avgCredits: number;
  avgLeadsPurchased: number;
  totalCreditsInCirculation: number;
  totalGrantedCredits: number;
  totalLeadsPurchased: number;
  newThisPeriod: number;
  activeIn7Days: number;
  activeIn30Days: number;
  dormant: number;
  highRisk: number;
  whatsappOptedIn: number;
}

interface LocationStats {
  city: string;
  region: string;
  total: number;
  active: number;
  verified: number;
  avgPurchases: number;
  totalPurchases: number;
  totalCredits: number;
}

interface SignupTrendItem {
  date: string;
  signups: number;
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

interface BusinessAnalyticsTabProps {
  startDate: Date;
  endDate: Date;
}

export function BusinessAnalyticsTab({ startDate, endDate }: BusinessAnalyticsTabProps) {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [allProfiles, setAllProfiles] = useState<BusinessProfile[]>([]);
  const [stats, setStats] = useState<BusinessStats | null>(null);
  const [locationStats, setLocationStats] = useState<LocationStats[]>([]);
  const [signupTrend, setSignupTrend] = useState<SignupTrendItem[]>([]);
  const [verificationStatusData, setVerificationStatusData] = useState<{ name: string; value: number }[]>([]);
  const [activitySegments, setActivitySegments] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    fetchBusinessAnalytics();
  }, [startDate, endDate]);

  const fetchBusinessAnalytics = async () => {
    setLoading(true);

    // Fetch ALL profiles (not date-filtered) for overall stats
    const { data: allProfilesData } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    // Fetch profiles created in date range for period-specific stats
    const { data: periodProfiles } = await supabase
      .from("profiles")
      .select("*")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: false });

    const all = (allProfilesData || []) as BusinessProfile[];
    const period = (periodProfiles || []) as BusinessProfile[];
    setAllProfiles(all);
    setProfiles(period);

    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);
    const thirtyDaysAgo = subDays(now, 30);
    const ninetyDaysAgo = subDays(now, 90);

    // Compute stats from ALL profiles
    const activeIn7 = all.filter(p => p.last_login && new Date(p.last_login) >= sevenDaysAgo).length;
    const activeIn30 = all.filter(p => p.last_login && new Date(p.last_login) >= thirtyDaysAgo).length;
    const dormant = all.filter(p => !p.last_login || new Date(p.last_login) < ninetyDaysAgo).length;

    const computedStats: BusinessStats = {
      total: all.length,
      active: activeIn30,
      verified: all.filter(p => p.is_verified).length,
      pendingVerification: all.filter(p => p.verification_status === 'pending' || p.verification_status === 'submitted').length,
      reverificationRequired: all.filter(p => p.verification_status === 'reverification_required').length,
      suspended: all.filter(p => p.is_suspended).length,
      withCredits: all.filter(p => p.credits > 0).length,
      withPurchases: all.filter(p => p.leads_purchased > 0).length,
      neverPurchased: all.filter(p => p.leads_purchased === 0).length,
      phoneVerified: all.filter(p => p.phone_verified).length,
      avgCredits: all.length > 0 ? Math.round(all.reduce((sum, p) => sum + p.credits, 0) / all.length * 10) / 10 : 0,
      avgLeadsPurchased: all.length > 0 ? Math.round(all.reduce((sum, p) => sum + p.leads_purchased, 0) / all.length * 10) / 10 : 0,
      totalCreditsInCirculation: all.reduce((sum, p) => sum + p.credits, 0),
      totalGrantedCredits: all.reduce((sum, p) => sum + p.granted_credits, 0),
      totalLeadsPurchased: all.reduce((sum, p) => sum + p.leads_purchased, 0),
      newThisPeriod: period.length,
      activeIn7Days: activeIn7,
      activeIn30Days: activeIn30,
      dormant,
      highRisk: all.filter(p => (p.risk_score || 0) >= 50).length,
      whatsappOptedIn: all.filter(p => p.whatsapp_optin).length,
    };
    setStats(computedStats);

    // Verification status breakdown
    const verStatusMap = new Map<string, number>();
    all.forEach(p => {
      const status = p.verification_status || 'pending';
      verStatusMap.set(status, (verStatusMap.get(status) || 0) + 1);
    });
    const verStatusLabels: Record<string, string> = {
      approved: 'Approved',
      pending: 'Pending',
      submitted: 'Submitted',
      rejected: 'Rejected',
      reverification_required: 'Re-verification Required',
    };
    setVerificationStatusData(
      Array.from(verStatusMap.entries()).map(([key, value]) => ({
        name: verStatusLabels[key] || key,
        value,
      }))
    );

    // Activity segments
    setActivitySegments([
      { name: 'Active (7d)', value: activeIn7 },
      { name: 'Active (30d)', value: activeIn30 - activeIn7 },
      { name: 'Dormant (90d+)', value: dormant },
      { name: 'Other', value: Math.max(0, all.length - activeIn30 - dormant) },
    ].filter(s => s.value > 0));

    // Location stats
    const locMap = new Map<string, LocationStats>();
    all.forEach(p => {
      if (!p.postcode) return;
      const { city, region } = extractCityFromPostcode(p.postcode);
      const key = `${city}-${region}`;
      if (!locMap.has(key)) {
        locMap.set(key, { city, region, total: 0, active: 0, verified: 0, avgPurchases: 0, totalPurchases: 0, totalCredits: 0 });
      }
      const s = locMap.get(key)!;
      s.total++;
      if (p.last_login && new Date(p.last_login) >= thirtyDaysAgo) s.active++;
      if (p.is_verified) s.verified++;
      s.totalPurchases += p.leads_purchased;
      s.totalCredits += p.credits;
    });
    const locationData = Array.from(locMap.values())
      .map(s => ({ ...s, avgPurchases: s.total > 0 ? Math.round(s.totalPurchases / s.total * 10) / 10 : 0 }))
      .sort((a, b) => b.total - a.total);
    setLocationStats(locationData);

    // Signup trend (daily within period)
    const daysDiff = differenceInDays(endDate, startDate);
    const trendMap = new Map<string, number>();
    
    if (daysDiff <= 60) {
      // Daily granularity
      period.forEach(p => {
        const day = format(new Date(p.created_at), 'dd MMM');
        trendMap.set(day, (trendMap.get(day) || 0) + 1);
      });
    } else {
      // Weekly granularity
      period.forEach(p => {
        const week = format(new Date(p.created_at), "'W'w yyyy");
        trendMap.set(week, (trendMap.get(week) || 0) + 1);
      });
    }
    setSignupTrend(Array.from(trendMap.entries()).map(([date, signups]) => ({ date, signups })));

    setLoading(false);
  };

  const handleExport = () => {
    exportToCsv(locationStats, "business_locations", [
      { key: "city", label: "City" },
      { key: "region", label: "Region" },
      { key: "total", label: "Total Businesses" },
      { key: "active", label: "Active (30d)" },
      { key: "verified", label: "Verified" },
      { key: "totalPurchases", label: "Total Purchases" },
      { key: "avgPurchases", label: "Avg Purchases" },
      { key: "totalCredits", label: "Credits Held" },
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

  if (!stats) return null;

  const topBuyerLocations = locationStats.filter(l => l.totalPurchases > 0).sort((a, b) => b.totalPurchases - a.totalPurchases).slice(0, 10);

  return (
    <div className="space-y-6">
      {/* KPI Cards Row 1 - Core Counts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Total Businesses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">
              +{stats.newThisPeriod} in selected period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-500" /> Active (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{stats.activeIn30Days}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? Math.round((stats.activeIn30Days / stats.total) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-500" /> Verified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{stats.verified}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? Math.round((stats.verified / stats.total) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Ban className="h-4 w-4 text-red-500" /> Suspended
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{stats.suspended}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.highRisk} flagged high risk
            </p>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards Row 2 - Verification & Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" /> Pending Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{stats.pendingVerification}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-orange-500" /> Re-verification Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{stats.reverificationRequired}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserX className="h-4 w-4 text-muted-foreground" /> Dormant (90d+)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.dormant}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? Math.round((stats.dormant / stats.total) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-secondary" /> Active (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-secondary">{stats.activeIn7Days}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? Math.round((stats.activeIn7Days / stats.total) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards Row 3 - Purchasing & Credits */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Total Leads Purchased
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalLeadsPurchased}</p>
            <p className="text-xs text-muted-foreground">Avg {stats.avgLeadsPurchased} per business</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Ever Purchased
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.withPurchases}</p>
            <p className="text-xs text-muted-foreground">{stats.neverPurchased} never purchased</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Credits in Circulation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalCreditsInCirculation}</p>
            <p className="text-xs text-muted-foreground">{stats.withCredits} businesses hold credits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Granted Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalGrantedCredits}</p>
            <p className="text-xs text-muted-foreground">Avg {stats.avgCredits} credits/business</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Phone Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.phoneVerified}</p>
            <p className="text-xs text-muted-foreground">
              {stats.whatsappOptedIn} WhatsApp opted in
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Verification Status Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-secondary" />
              Verification Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={verificationStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {verificationStatusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Activity Segments Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-secondary" />
              Activity Segments
            </CardTitle>
            <CardDescription>Business activity based on last login</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activitySegments}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {activitySegments.map((_, index) => (
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

      {/* Signup Trend */}
      {signupTrend.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-secondary" />
              New Signups Trend
            </CardTitle>
            <CardDescription>Business registrations over selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={signupTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="signups" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} name="Signups" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Location Table - Top Buyer Locations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-secondary" />
                Most Active Buyer Locations
              </CardTitle>
              <CardDescription>Where your most active buyers are located</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" /> Export
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
                  <TableHead className="text-right">Businesses</TableHead>
                  <TableHead className="text-right">Active (30d)</TableHead>
                  <TableHead className="text-right">Verified</TableHead>
                  <TableHead className="text-right">Total Purchases</TableHead>
                  <TableHead className="text-right">Avg Purchases</TableHead>
                  <TableHead className="text-right">Credits Held</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topBuyerLocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No buyer location data available
                    </TableCell>
                  </TableRow>
                ) : (
                  topBuyerLocations.map((loc, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{loc.city}</TableCell>
                      <TableCell className="text-muted-foreground">{loc.region}</TableCell>
                      <TableCell className="text-right">{loc.total}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={loc.active > 0 ? "default" : "secondary"} className="text-xs">
                          {loc.active}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{loc.verified}</TableCell>
                      <TableCell className="text-right font-medium">{loc.totalPurchases}</TableCell>
                      <TableCell className="text-right">{loc.avgPurchases}</TableCell>
                      <TableCell className="text-right">{loc.totalCredits}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* All Locations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-secondary" />
            All Business Locations
          </CardTitle>
          <CardDescription>Complete breakdown by city</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>City</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">Businesses</TableHead>
                  <TableHead className="text-right">Active (30d)</TableHead>
                  <TableHead className="text-right">Verified</TableHead>
                  <TableHead className="text-right">Total Purchases</TableHead>
                  <TableHead className="text-right">Avg Purchases</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locationStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No location data available
                    </TableCell>
                  </TableRow>
                ) : (
                  locationStats.map((loc, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{loc.city}</TableCell>
                      <TableCell className="text-muted-foreground">{loc.region}</TableCell>
                      <TableCell className="text-right">{loc.total}</TableCell>
                      <TableCell className="text-right">{loc.active}</TableCell>
                      <TableCell className="text-right">{loc.verified}</TableCell>
                      <TableCell className="text-right">{loc.totalPurchases}</TableCell>
                      <TableCell className="text-right">{loc.avgPurchases}</TableCell>
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
