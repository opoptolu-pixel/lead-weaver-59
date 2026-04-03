import { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  LineChart,
  Line,
} from "recharts";
import { 
  Download, 
  TrendingUp, 
  Users, 
  FileText, 
  Loader2, 
  MapPin, 
  Building2, 
  Eye,
  ChevronRight,
  Globe2,
  Target,
  Sparkles,
  ArrowUpRight,
  Crown,
  Lightbulb,
  RefreshCw,
  Megaphone,
  PoundSterling,
  History,
  Calendar,
  Search,
  Phone,
  Mail,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ListFilter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/contexts/AdminContext";
import { useVisitorData, Visitor, GeoLocation } from "@/hooks/useVisitorData";
import { useAdSpend } from "@/hooks/useAdSpend";
import { exportToCsv } from "@/lib/exportCsv";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TrendComparisonChart } from "@/components/admin/TrendComparisonChart";
import { MarketingRecommendations } from "@/components/admin/MarketingRecommendations";
import { HistoricalVisitorAnalytics } from "@/components/admin/HistoricalVisitorAnalytics";
import { BusinessAnalyticsTab } from "@/components/admin/BusinessAnalyticsTab";

const COLORS = [
  "hsl(var(--secondary))", 
  "hsl(142, 76%, 36%)", 
  "hsl(200, 80%, 50%)", 
  "hsl(280, 65%, 60%)", 
  "hsl(30, 80%, 55%)",
  "hsl(340, 70%, 55%)"
];

interface CityStats {
  city: string;
  region: string;
  country: string;
  leads: number;
  purchased: number;
  purchaseRate: number;
  revenue: number;
  refunds: number;
  refundRate: number;
}

interface BuyerCityStats {
  city: string;
  region: string;
  buyers: number;
  totalPurchases: number;
  totalSpend: number;
  avgPurchases: number;
}

interface LeadDetail {
  id: string;
  postcode: string;
  job_type: string;
  display_value: string;
  created_at: string;
  is_unlocked: boolean;
  unlocked_at?: string;
  refunded_at?: string;
  credit_type?: string | null;
  amount_paid?: number | null;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  job_status?: string;
  booked_date?: string;
  lost_reason?: string;
  source?: string;
  utm_data?: any;
}

interface UtmCampaignRow {
  campaign: string;
  source: string;
  medium: string;
  leads: number;
  purchased: number;
  purchaseRate: number;
  refunded: number;
}

interface UtmSourceMediumRow {
  label: string;
  leads: number;
}

interface ReferrerRow {
  domain: string;
  leads: number;
}

interface BuyerDetail {
  name: string;
  postcode: string;
  purchases: number;
  spend: number;
  refundRate: number;
  conversionRate: number;
  avgResponseTime: number;
  jobCompletionRate: number;
  bookedJobs: number;
  completedJobs: number;
}

const getStoredLeadAmount = (amountPaid: number | null | undefined) => amountPaid ?? 20;

export default function AdminAnalytics() {
  const { getDateFilter, dateRange } = useAdmin();
  const visitors = useVisitorData();
  const { start, end } = useMemo(() => getDateFilter(), [getDateFilter]);
  const { 
    adSpendData, 
    metrics: adMetrics,
    googleAdsMetrics,
    facebookAdsMetrics,
    syncing, 
    syncGoogleAds,
    syncFacebookAds,
    syncAllPlatforms,
    getPlatformSettings,
    loading: adLoading 
  } = useAdSpend(start, end);
  
  const googleAdsSettings = getPlatformSettings("google_ads");
  const facebookAdsSettings = getPlatformSettings("facebook_ads");
  const isSyncingGoogle = syncing.google_ads || false;
  const isSyncingFacebook = syncing.facebook_ads || false;
  const isSyncingAny = isSyncingGoogle || isSyncingFacebook;
  
  const [activeTab, setActiveTab] = useState("geographic");
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [leadsBySource, setLeadsBySource] = useState<any[]>([]);
  const [topPostcodes, setTopPostcodes] = useState<any[]>([]);
  const [topBuyers, setTopBuyers] = useState<any[]>([]);
  const [marketplaceStats, setMarketplaceStats] = useState({ 
    purchaseRate: 0, 
    avgTimeToPurchase: 0, 
    expiredRate: 0, 
    refundRate: 0,
    jobsCompleted: 0,
    jobsContacted: 0,
    jobsBooked: 0,
    jobsLost: 0,
    jobsNoResponse: 0,
    jobsPending: 0,
    totalPurchased: 0,
  });
  const [cityLeadStats, setCityLeadStats] = useState<CityStats[]>([]);
  const [buyerCityStats, setBuyerCityStats] = useState<BuyerCityStats[]>([]);
  const [allLeads, setAllLeads] = useState<LeadDetail[]>([]);
  const [allBuyers, setAllBuyers] = useState<BuyerDetail[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  const [utmCampaigns, setUtmCampaigns] = useState<UtmCampaignRow[]>([]);
  const [utmSourceMediums, setUtmSourceMediums] = useState<UtmSourceMediumRow[]>([]);
  const [utmReferrers, setUtmReferrers] = useState<ReferrerRow[]>([]);
  
  // Dialog states
  const [selectedCity, setSelectedCity] = useState<CityStats | null>(null);
  const [selectedBuyerCity, setSelectedBuyerCity] = useState<BuyerCityStats | null>(null);
  const [showAllLeads, setShowAllLeads] = useState(false);
  const [showAllBuyers, setShowAllBuyers] = useState(false);
  const [cityLeadsDetail, setCityLeadsDetail] = useState<LeadDetail[]>([]);
  const [cityBuyersDetail, setCityBuyersDetail] = useState<BuyerDetail[]>([]);
  const [marketplaceSearch, setMarketplaceSearch] = useState("");
  const [bookingSearch, setBookingSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const paidLeadRevenue = useMemo(
    () => allLeads.reduce((sum, lead) => {
      if (!lead.is_unlocked || lead.credit_type === "granted") return sum;
      return sum + getStoredLeadAmount(lead.amount_paid);
    }, 0),
    [allLeads]
  );

  // Live visitor location stats
  const liveVisitorLocations = useMemo(() => {
    const locationMap = new Map<string, { city: string; region: string; country: string; visitors: number }>();
    
    visitors.forEach((visitor) => {
      if (visitor.geolocation) {
        const geo = visitor.geolocation as GeoLocation;
        const key = `${geo.city}-${geo.countryCode}`;
        
        if (locationMap.has(key)) {
          locationMap.get(key)!.visitors++;
        } else {
          locationMap.set(key, {
            city: geo.city,
            region: geo.region,
            country: geo.country,
            visitors: 1
          });
        }
      }
    });
    
    return Array.from(locationMap.values())
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 10);
  }, [visitors]);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, getDateFilter]);

  const extractCityFromPostcode = (postcode: string): { city: string; region: string } => {
    // UK postcode area to city mapping
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
      'CW': { city: 'Crewe', region: 'Cheshire' },
      'DA': { city: 'Dartford', region: 'Kent' },
      'DE': { city: 'Derby', region: 'Derbyshire' },
      'DN': { city: 'Doncaster', region: 'South Yorkshire' },
      'DT': { city: 'Dorchester', region: 'Dorset' },
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
      'HG': { city: 'Harrogate', region: 'North Yorkshire' },
      'HP': { city: 'Hemel Hempstead', region: 'Hertfordshire' },
      'HU': { city: 'Hull', region: 'East Yorkshire' },
      'HX': { city: 'Halifax', region: 'West Yorkshire' },
      'IG': { city: 'Ilford', region: 'Greater London' },
      'IP': { city: 'Ipswich', region: 'Suffolk' },
      'KT': { city: 'Kingston', region: 'Greater London' },
      'L': { city: 'Liverpool', region: 'Merseyside' },
      'LA': { city: 'Lancaster', region: 'Lancashire' },
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
      'NP': { city: 'Newport', region: 'South Wales' },
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
      'SA': { city: 'Swansea', region: 'South Wales' },
      'SE': { city: 'South East London', region: 'Greater London' },
      'SG': { city: 'Stevenage', region: 'Hertfordshire' },
      'SK': { city: 'Stockport', region: 'Greater Manchester' },
      'SL': { city: 'Slough', region: 'Berkshire' },
      'SM': { city: 'Sutton', region: 'Greater London' },
      'SN': { city: 'Swindon', region: 'Wiltshire' },
      'SO': { city: 'Southampton', region: 'Hampshire' },
      'SP': { city: 'Salisbury', region: 'Wiltshire' },
      'SR': { city: 'Sunderland', region: 'Tyne and Wear' },
      'SS': { city: 'Southend', region: 'Essex' },
      'ST': { city: 'Stoke-on-Trent', region: 'Staffordshire' },
      'SW': { city: 'South West London', region: 'Greater London' },
      'TN': { city: 'Tunbridge Wells', region: 'Kent' },
      'TQ': { city: 'Torquay', region: 'Devon' },
      'TS': { city: 'Teesside', region: 'North Yorkshire' },
      'TW': { city: 'Twickenham', region: 'Greater London' },
      'UB': { city: 'Uxbridge', region: 'Greater London' },
      'W': { city: 'West London', region: 'Greater London' },
      'WA': { city: 'Warrington', region: 'Cheshire' },
      'WC': { city: 'West Central London', region: 'Greater London' },
      'WD': { city: 'Watford', region: 'Hertfordshire' },
      'WF': { city: 'Wakefield', region: 'West Yorkshire' },
      'WN': { city: 'Wigan', region: 'Greater Manchester' },
      'WR': { city: 'Worcester', region: 'Worcestershire' },
      'WS': { city: 'Walsall', region: 'West Midlands' },
      'WV': { city: 'Wolverhampton', region: 'West Midlands' },
      'YO': { city: 'York', region: 'North Yorkshire' },
    };
    
    // Extract area code from postcode
    const areaMatch = postcode.match(/^([A-Z]{1,2})/i);
    if (areaMatch) {
      const area = areaMatch[1].toUpperCase();
      
      // Try 2-letter match first, then 1-letter
      if (postcodeMap[area]) {
        return postcodeMap[area];
      }
      if (postcodeMap[area[0]]) {
        return postcodeMap[area[0]];
      }
    }
    
    return { city: 'Other', region: 'UK' };
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    const { start, end } = getDateFilter();
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    // Fetch leads with more details
    const { data: leads } = await supabase
      .from("leads")
      .select("id, source, postcode, is_unlocked, unlocked_by, refunded_at, created_at, unlocked_at, lead_status, job_type, display_value, credit_type, amount_paid, job_status, customer_name, customer_phone, customer_email, booked_date, lost_reason, utm_data")
      .gte("created_at", startISO)
      .lte("created_at", endISO);

    if (leads) {
      setAllLeads(leads as LeadDetail[]);
      
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

      // UTM Campaign breakdown
      const campaignMap = new Map<string, { source: string; medium: string; leads: number; purchased: number; refunded: number }>();
      const sourceMediumMap = new Map<string, number>();
      const referrerMap = new Map<string, number>();

      leads.forEach((lead) => {
        const utm = lead.utm_data as any;
        if (utm && typeof utm === 'object') {
          // Campaign breakdown
          const campaign = utm.utm_campaign || '(no campaign)';
          const utmSource = utm.utm_source || utm.detected_source || lead.source || '(direct)';
          const utmMedium = utm.utm_medium || '(none)';
          const key = `${campaign}||${utmSource}||${utmMedium}`;
          
          if (!campaignMap.has(key)) {
            campaignMap.set(key, { source: utmSource, medium: utmMedium, leads: 0, purchased: 0, refunded: 0 });
          }
          const cs = campaignMap.get(key)!;
          cs.leads++;
          if (lead.is_unlocked) cs.purchased++;
          if (lead.refunded_at) cs.refunded++;

          // Source/Medium combo
          const smLabel = `${utmSource} / ${utmMedium}`;
          sourceMediumMap.set(smLabel, (sourceMediumMap.get(smLabel) || 0) + 1);

          // Referrer domain
          if (utm.referrer) {
            try {
              const domain = new URL(utm.referrer).hostname.replace('www.', '');
              referrerMap.set(domain, (referrerMap.get(domain) || 0) + 1);
            } catch {}
          }
        }
      });

      setUtmCampaigns(
        Array.from(campaignMap.entries())
          .map(([key, data]) => ({
            campaign: key.split('||')[0],
            source: data.source,
            medium: data.medium,
            leads: data.leads,
            purchased: data.purchased,
            purchaseRate: data.leads > 0 ? Math.round((data.purchased / data.leads) * 100) : 0,
            refunded: data.refunded,
          }))
          .sort((a, b) => b.leads - a.leads)
      );

      setUtmSourceMediums(
        Array.from(sourceMediumMap.entries())
          .map(([label, leads]) => ({ label, leads }))
          .sort((a, b) => b.leads - a.leads)
          .slice(0, 15)
      );

      setUtmReferrers(
        Array.from(referrerMap.entries())
          .map(([domain, leads]) => ({ domain, leads }))
          .sort((a, b) => b.leads - a.leads)
          .slice(0, 10)
      );

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

      // City-based lead stats
      const cityMap = new Map<string, CityStats>();
      leads.forEach((lead) => {
        const { city, region } = extractCityFromPostcode(lead.postcode);
        const key = `${city}-${region}`;
        
        if (!cityMap.has(key)) {
          cityMap.set(key, {
            city,
            region,
            country: 'UK',
            leads: 0,
            purchased: 0,
            purchaseRate: 0,
            revenue: 0,
            refunds: 0,
            refundRate: 0
          });
        }
        
        const stats = cityMap.get(key)!;
        stats.leads++;
        if (lead.is_unlocked) {
          stats.purchased++;
          // Only count revenue from paid leads, not granted
          if ((lead as any).credit_type !== 'granted') {
            stats.revenue += getStoredLeadAmount((lead as any).amount_paid);
          }
        }
        if (lead.refunded_at) {
          stats.refunds++;
        }
      });
      
      // Calculate rates
      const cityStats = Array.from(cityMap.values())
        .map(stat => ({
          ...stat,
          purchaseRate: stat.leads > 0 ? Math.round((stat.purchased / stat.leads) * 100) : 0,
          refundRate: stat.purchased > 0 ? Math.round((stat.refunds / stat.purchased) * 100) : 0
        }))
        .sort((a, b) => b.leads - a.leads);
      
      setCityLeadStats(cityStats);

      // Marketplace stats
      const totalLeads = leads.length;
      const purchased = leads.filter(l => l.is_unlocked).length;
      const refunded = leads.filter(l => l.refunded_at).length;
      const expired = leads.filter(l => l.lead_status === "expired").length;
      
      // Calculate average time to purchase
      const purchasedLeads = leads.filter(l => l.is_unlocked && l.unlocked_at);
      let avgTimeHours = 0;
      if (purchasedLeads.length > 0) {
        const totalTimeMs = purchasedLeads.reduce((sum, lead) => {
          const createdAt = new Date(lead.created_at).getTime();
          const unlockedAt = new Date(lead.unlocked_at!).getTime();
          return sum + (unlockedAt - createdAt);
        }, 0);
        avgTimeHours = Math.round((totalTimeMs / purchasedLeads.length) / (1000 * 60 * 60) * 10) / 10;
      }
      
      // Job outcome stats
      const purchasedList = leads.filter(l => l.is_unlocked);
      const jobsCompleted = purchasedList.filter(l => (l as any).job_status === 'completed').length;
      const jobsContacted = purchasedList.filter(l => (l as any).job_status === 'contacted').length;
      const jobsBooked = purchasedList.filter(l => (l as any).job_status === 'booked').length;
      const jobsLost = purchasedList.filter(l => (l as any).job_status === 'lost').length;
      const jobsNoResponse = purchasedList.filter(l => (l as any).job_status === 'no_response').length;
      const jobsPending = purchasedList.filter(l => !(l as any).job_status || (l as any).job_status === 'pending').length;

      setMarketplaceStats({
        purchaseRate: totalLeads > 0 ? Math.round((purchased / totalLeads) * 100) : 0,
        avgTimeToPurchase: avgTimeHours,
        expiredRate: totalLeads > 0 ? Math.round((expired / totalLeads) * 100) : 0,
        refundRate: purchased > 0 ? Math.round((refunded / purchased) * 100) : 0,
        jobsCompleted,
        jobsContacted,
        jobsBooked,
        jobsLost,
        jobsNoResponse,
        jobsPending,
        totalPurchased: purchased,
      });
    }

    // Top buyers - count actual purchases from leads table with date filtering
    // Include job_status for conversion metrics
    const { data: purchasedLeadsData } = await supabase
      .from("leads")
      .select("unlocked_by, refunded_at, credit_type, amount_paid, job_status, created_at, unlocked_at")
      .eq("is_unlocked", true)
      .gte("unlocked_at", startISO)
      .lte("unlocked_at", endISO);

    if (purchasedLeadsData) {
      // Aggregate purchases by user with enhanced metrics
      const buyerPurchaseMap = new Map<string, { 
        purchases: number; 
        spend: number;
        refunds: number; 
        booked: number;
        completed: number;
        totalResponseTime: number;
        responseCount: number;
      }>();
      
      purchasedLeadsData.forEach(lead => {
        if (!lead.unlocked_by) return;
        if (!buyerPurchaseMap.has(lead.unlocked_by)) {
          buyerPurchaseMap.set(lead.unlocked_by, { 
            purchases: 0, 
            spend: 0,
            refunds: 0,
            booked: 0,
            completed: 0,
            totalResponseTime: 0,
            responseCount: 0
          });
        }
        const stats = buyerPurchaseMap.get(lead.unlocked_by)!;
        stats.purchases++;
        if (lead.credit_type !== 'granted') {
          stats.spend += getStoredLeadAmount(lead.amount_paid);
        }
        if (lead.refunded_at) stats.refunds++;
        if (lead.job_status === 'booked' || lead.job_status === 'completed') stats.booked++;
        if (lead.job_status === 'completed') stats.completed++;
        
        // Calculate response time (time from lead creation to purchase)
        if (lead.created_at && lead.unlocked_at) {
          const createdAt = new Date(lead.created_at).getTime();
          const unlockedAt = new Date(lead.unlocked_at).getTime();
          const responseTimeHours = (unlockedAt - createdAt) / (1000 * 60 * 60);
          stats.totalResponseTime += responseTimeHours;
          stats.responseCount++;
        }
      });

      // Get buyer profiles for those with purchases in period
      const buyerUserIds = Array.from(buyerPurchaseMap.keys());
      
      if (buyerUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, user_id, business_name, postcode")
          .in("user_id", buyerUserIds);

        if (profiles) {
          // City-based buyer stats
          const buyerCityMap = new Map<string, BuyerCityStats>();
          
          const buyersWithStats: BuyerDetail[] = profiles.map(profile => {
            const purchaseData = buyerPurchaseMap.get(profile.user_id) || { 
              purchases: 0, 
              spend: 0,
              refunds: 0,
              booked: 0,
              completed: 0,
              totalResponseTime: 0,
              responseCount: 0
            };
            
            const netPurchases = purchaseData.purchases - purchaseData.refunds;
            const conversionRate = netPurchases > 0 ? Math.round((purchaseData.booked / netPurchases) * 100) : 0;
            const jobCompletionRate = purchaseData.booked > 0 ? Math.round((purchaseData.completed / purchaseData.booked) * 100) : 0;
            const avgResponseTime = purchaseData.responseCount > 0 
              ? Math.round((purchaseData.totalResponseTime / purchaseData.responseCount) * 10) / 10 
              : 0;
            
            const buyerData: BuyerDetail = {
              name: profile.business_name || "Unnamed Business",
              postcode: profile.postcode || "Unknown",
              purchases: purchaseData.purchases,
              spend: purchaseData.spend,
              refundRate: purchaseData.purchases > 0 ? Math.round((purchaseData.refunds / purchaseData.purchases) * 100) : 0,
              conversionRate,
              avgResponseTime,
              jobCompletionRate,
              bookedJobs: purchaseData.booked,
              completedJobs: purchaseData.completed,
            };
            
            // Add to city map
            if (profile.postcode) {
              const { city, region } = extractCityFromPostcode(profile.postcode);
              const key = `${city}-${region}`;
              
              if (!buyerCityMap.has(key)) {
                buyerCityMap.set(key, {
                  city,
                  region,
                  buyers: 0,
                  totalPurchases: 0,
                  totalSpend: 0,
                  avgPurchases: 0
                });
              }
              
              const stats = buyerCityMap.get(key)!;
              stats.buyers++;
              stats.totalPurchases += purchaseData.purchases;
              stats.totalSpend += purchaseData.spend;
            }
            
            return buyerData;
          }).sort((a, b) => b.purchases - a.purchases);
          
          setAllBuyers(buyersWithStats);
          setTopBuyers(buyersWithStats.slice(0, 10));
          
          // Calculate averages and sort
          const buyerCityData = Array.from(buyerCityMap.values())
            .map(stat => ({
              ...stat,
              avgPurchases: stat.buyers > 0 ? Math.round(stat.totalPurchases / stat.buyers) : 0
            }))
            .sort((a, b) => b.totalPurchases - a.totalPurchases);
          
          setBuyerCityStats(buyerCityData);
        }
      } else {
        setAllBuyers([]);
        setTopBuyers([]);
        setBuyerCityStats([]);
      }
    }

    // Fetch upcoming bookings (all booked leads with future booked_date)
    const todayStr = new Date().toISOString().split("T")[0];
    const { data: bookings } = await supabase
      .from("leads")
      .select("id, customer_name, job_type, postcode, booked_date, job_status, unlocked_by, display_value")
      .eq("job_status", "booked")
      .not("booked_date", "is", null)
      .gte("booked_date", todayStr)
      .order("booked_date", { ascending: true });

    if (bookings && bookings.length > 0) {
      // Get cleaner names for these bookings
      const ownerIds = [...new Set(bookings.map(b => b.unlocked_by).filter(Boolean))];
      const { data: ownerProfiles } = await supabase
        .from("profiles")
        .select("user_id, business_name")
        .in("user_id", ownerIds);
      
      const ownerMap = new Map((ownerProfiles || []).map(p => [p.user_id, p.business_name]));
      
      setUpcomingBookings(bookings.map(b => ({
        ...b,
        cleaner_name: ownerMap.get(b.unlocked_by || "") || "Unknown",
        days_until: Math.ceil((new Date(b.booked_date + "T00:00:00").getTime() - new Date(todayStr + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24)),
      })));
    } else {
      setUpcomingBookings([]);
    }

    setLoading(false);
  };

  const handleCityClick = (city: CityStats) => {
    setSelectedCity(city);
    // Filter leads for this city
    const cityLeads = allLeads.filter(lead => {
      const { city: leadCity } = extractCityFromPostcode(lead.postcode);
      return leadCity === city.city;
    });
    setCityLeadsDetail(cityLeads);
  };

  const handleBuyerCityClick = (city: BuyerCityStats) => {
    setSelectedBuyerCity(city);
    // Filter buyers for this city
    const cityBuyers = allBuyers.filter(buyer => {
      const { city: buyerCity } = extractCityFromPostcode(buyer.postcode);
      return buyerCity === city.city;
    });
    setCityBuyersDetail(cityBuyers);
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
    } else if (reportName === "cities") {
      exportToCsv(cityLeadStats, "leads_by_city", [
        { key: "city", label: "City" },
        { key: "region", label: "Region" },
        { key: "leads", label: "Leads" },
        { key: "purchased", label: "Purchased" },
        { key: "purchaseRate", label: "Purchase Rate %" },
        { key: "revenue", label: "Revenue" },
        { key: "refundRate", label: "Refund Rate %" },
      ]);
    } else if (reportName === "buyerCities") {
      exportToCsv(buyerCityStats, "buyers_by_city", [
        { key: "city", label: "City" },
        { key: "region", label: "Region" },
        { key: "buyers", label: "Buyers" },
        { key: "totalPurchases", label: "Total Purchases" },
        { key: "totalSpend", label: "Total Spend" },
        { key: "avgPurchases", label: "Avg Purchases" },
      ]);
    }
    toast.success("Export started");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  return (
    <AdminLayout title="Analytics">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground">Business intelligence and marketing insights</p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-secondary" />
            <p className="text-muted-foreground mt-2">Loading analytics...</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="ads"><Megaphone className="h-4 w-4 mr-2" />Ad Performance</TabsTrigger>
              <TabsTrigger value="geographic"><MapPin className="h-4 w-4 mr-2" />Geographic</TabsTrigger>
              <TabsTrigger value="trends"><TrendingUp className="h-4 w-4 mr-2" />Trends</TabsTrigger>
              <TabsTrigger value="recommendations"><Lightbulb className="h-4 w-4 mr-2" />Recommendations</TabsTrigger>
              <TabsTrigger value="historical"><History className="h-4 w-4 mr-2" />Page Views</TabsTrigger>
              <TabsTrigger value="live"><Globe2 className="h-4 w-4 mr-2" />Live Visitors</TabsTrigger>
              <TabsTrigger value="acquisition"><FileText className="h-4 w-4 mr-2" />Acquisition</TabsTrigger>
              <TabsTrigger value="marketplace"><Target className="h-4 w-4 mr-2" />Marketplace</TabsTrigger>
              <TabsTrigger value="buyers"><Users className="h-4 w-4 mr-2" />Buyer Performance</TabsTrigger>
              <TabsTrigger value="businesses"><Building2 className="h-4 w-4 mr-2" />Businesses</TabsTrigger>
            </TabsList>

            {/* ADS TAB */}
            <TabsContent value="ads" className="space-y-6 mt-6">
              {/* Combined Ad Performance Section */}
              <Card className="border-2 border-secondary/30 bg-gradient-to-br from-secondary/5 to-transparent">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Megaphone className="h-5 w-5 text-secondary" />
                        Combined Ad Performance
                      </CardTitle>
                      <CardDescription>Total metrics across all advertising platforms</CardDescription>
                    </div>
                    <Button onClick={() => syncAllPlatforms()} disabled={isSyncingAny}>
                      <RefreshCw className={cn("h-4 w-4 mr-2", isSyncingAny && "animate-spin")} />
                      {isSyncingAny ? "Syncing..." : "Sync All Platforms"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Ad Spend</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-foreground">£{adMetrics.totalSpend.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Impressions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-foreground">{adMetrics.totalImpressions.toLocaleString()}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Clicks</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-foreground">{adMetrics.totalClicks.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">CTR: {adMetrics.ctr.toFixed(2)}%</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Conversions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-foreground">{adMetrics.totalConversions}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Combined Cost Metrics */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-secondary">Avg Cost Per Click</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-secondary">£{adMetrics.costPerClick.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-green-600">Avg Cost Per Conversion</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-green-600">£{adMetrics.costPerLead.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-purple-600">Combined ROAS</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-purple-600">
                          {adMetrics.totalSpend > 0 
                            ? (paidLeadRevenue / adMetrics.totalSpend).toFixed(2) 
                            : "0"}x
                        </p>
                        <p className="text-sm text-muted-foreground">Based on actual paid lead revenue</p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              {/* Google Ads Section */}
              <Card className="border-blue-500/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-blue-600">
                        <Megaphone className="h-5 w-5" />
                        Google Ads
                      </CardTitle>
                      <CardDescription>
                        {googleAdsSettings?.last_sync_at 
                          ? `Last synced: ${new Date(googleAdsSettings.last_sync_at).toLocaleString()}`
                          : "Not synced yet"}
                      </CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => syncGoogleAds()} disabled={isSyncingGoogle}>
                      <RefreshCw className={cn("h-4 w-4 mr-2", isSyncingGoogle && "animate-spin")} />
                      {isSyncingGoogle ? "Syncing..." : "Sync"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="text-center p-4 bg-blue-500/5 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">£{googleAdsMetrics.totalSpend.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Spend</p>
                    </div>
                    <div className="text-center p-4 bg-blue-500/5 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">{googleAdsMetrics.totalImpressions.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Impressions</p>
                    </div>
                    <div className="text-center p-4 bg-blue-500/5 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">{googleAdsMetrics.totalClicks.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Clicks ({googleAdsMetrics.ctr.toFixed(2)}% CTR)</p>
                    </div>
                    <div className="text-center p-4 bg-blue-500/5 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">{googleAdsMetrics.totalConversions}</p>
                      <p className="text-xs text-muted-foreground">Conversions (£{googleAdsMetrics.costPerLead.toFixed(2)}/conv)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Facebook Ads Section */}
              <Card className="border-indigo-500/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-indigo-600">
                        <Megaphone className="h-5 w-5" />
                        Facebook Ads
                      </CardTitle>
                      <CardDescription>
                        {facebookAdsSettings?.last_sync_at 
                          ? `Last synced: ${new Date(facebookAdsSettings.last_sync_at).toLocaleString()}`
                          : "Not synced yet"}
                      </CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => syncFacebookAds()} disabled={isSyncingFacebook}>
                      <RefreshCw className={cn("h-4 w-4 mr-2", isSyncingFacebook && "animate-spin")} />
                      {isSyncingFacebook ? "Syncing..." : "Sync"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="text-center p-4 bg-indigo-500/5 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">£{facebookAdsMetrics.totalSpend.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Spend</p>
                    </div>
                    <div className="text-center p-4 bg-indigo-500/5 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">{facebookAdsMetrics.totalImpressions.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Impressions</p>
                    </div>
                    <div className="text-center p-4 bg-indigo-500/5 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">{facebookAdsMetrics.totalClicks.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Clicks ({facebookAdsMetrics.ctr.toFixed(2)}% CTR)</p>
                    </div>
                    <div className="text-center p-4 bg-indigo-500/5 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">{facebookAdsMetrics.totalConversions}</p>
                      <p className="text-xs text-muted-foreground">Conversions (£{facebookAdsMetrics.costPerLead.toFixed(2)}/conv)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Daily Ad Spend Chart - Combined */}
              {adSpendData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Ad Spend</CardTitle>
                    <CardDescription>Combined spend and conversions over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={adSpendData.slice().reverse()}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis yAxisId="left" className="text-xs" tickFormatter={(v) => `£${v}`} />
                          <YAxis yAxisId="right" orientation="right" className="text-xs" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--card))", 
                              borderColor: "hsl(var(--border))",
                              borderRadius: "8px"
                            }}
                          />
                          <Line 
                            yAxisId="left"
                            type="monotone" 
                            dataKey="spend_amount" 
                            stroke="hsl(var(--secondary))" 
                            strokeWidth={2}
                            name="Spend"
                          />
                          <Line 
                            yAxisId="right"
                            type="monotone" 
                            dataKey="conversions" 
                            stroke="hsl(142, 76%, 36%)" 
                            strokeWidth={2}
                            name="Conversions"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {adSpendData.length === 0 && !adLoading && (
                <Card className="p-8 text-center">
                  <Megaphone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Ad Data Available</h3>
                  <p className="text-muted-foreground mb-4">Click "Sync All Platforms" to pull your advertising data</p>
                  <Button onClick={() => syncAllPlatforms()} disabled={isSyncingAny}>
                    <RefreshCw className={cn("h-4 w-4 mr-2", isSyncingAny && "animate-spin")} />
                    {isSyncingAny ? "Syncing..." : "Sync All Platforms"}
                  </Button>
                </Card>
              )}
            </TabsContent>

            {/* GEOGRAPHIC TAB */}
            <TabsContent value="geographic" className="space-y-6 mt-6">
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleExport("cities")}>
                  <Download className="h-4 w-4 mr-2" />Export Leads by City
                </Button>
                <Button variant="outline" onClick={() => handleExport("buyerCities")}>
                  <Download className="h-4 w-4 mr-2" />Export Buyers by City
                </Button>
              </div>

              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-secondary mb-2">
                      <MapPin className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase">Top Lead City</span>
                    </div>
                    <p className="text-2xl font-bold">{cityLeadStats[0]?.city || '-'}</p>
                    <p className="text-sm text-muted-foreground">{cityLeadStats[0]?.leads || 0} leads</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-green-600 mb-2">
                      <Target className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase">Best Conversion</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {cityLeadStats.filter(c => c.leads >= 5).sort((a, b) => b.purchaseRate - a.purchaseRate)[0]?.city || '-'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {cityLeadStats.filter(c => c.leads >= 5).sort((a, b) => b.purchaseRate - a.purchaseRate)[0]?.purchaseRate || 0}% rate
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-purple-600 mb-2">
                      <Crown className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase">Most Buyers</span>
                    </div>
                    <p className="text-2xl font-bold">{buyerCityStats[0]?.city || '-'}</p>
                    <p className="text-sm text-muted-foreground">{buyerCityStats[0]?.buyers || 0} businesses</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-amber-600 mb-2">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase">Highest Revenue</span>
                    </div>
                    <p className="text-2xl font-bold">{buyerCityStats[0]?.city || '-'}</p>
                    <p className="text-sm text-muted-foreground">£{buyerCityStats[0]?.totalSpend?.toLocaleString() || 0}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Cities with Most Leads */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-secondary" />
                        Cities with Most Leads
                      </CardTitle>
                      <CardDescription>Click to see detailed lead data</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowAllLeads(true)}>
                      View All <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>City</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">Purchased</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cityLeadStats.slice(0, 8).map((city, idx) => (
                          <TableRow 
                            key={city.city} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleCityClick(city)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs">
                                  {idx + 1}
                                </Badge>
                                <div>
                                  <p className="font-medium">{city.city}</p>
                                  <p className="text-xs text-muted-foreground">{city.region}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">{city.leads}</TableCell>
                            <TableCell className="text-right">{city.purchased}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={city.purchaseRate >= 30 ? "default" : "secondary"}>
                                {city.purchaseRate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Best Quality Leads (Highest Purchase Rate) */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-green-500" />
                      Best Quality Lead Cities
                    </CardTitle>
                    <CardDescription>Cities with highest purchase rates (min 5 leads)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>City</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Purchased</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cityLeadStats
                          .filter(c => c.leads >= 5)
                          .sort((a, b) => b.purchaseRate - a.purchaseRate)
                          .slice(0, 8)
                          .map((city, idx) => (
                            <TableRow 
                              key={city.city}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleCityClick(city)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white",
                                    idx === 0 ? "bg-yellow-500" : idx === 1 ? "bg-gray-400" : idx === 2 ? "bg-amber-600" : "bg-muted-foreground"
                                  )}>
                                    {idx + 1}
                                  </div>
                                  <div>
                                    <p className="font-medium">{city.city}</p>
                                    <p className="text-xs text-muted-foreground">{city.leads} leads</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="default" className="bg-green-500">
                                  {city.purchaseRate}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">{city.purchased}</TableCell>
                              <TableCell className="text-right text-green-600 font-medium">£{city.revenue}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Cities with Most Active Buyers */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-purple-500" />
                        Cities with Most Buyers
                      </CardTitle>
                      <CardDescription>Where cleaning businesses are buying leads</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowAllBuyers(true)}>
                      View All <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>City</TableHead>
                          <TableHead className="text-right">Buyers</TableHead>
                          <TableHead className="text-right">Purchases</TableHead>
                          <TableHead className="text-right">Spend</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {buyerCityStats.slice(0, 8).map((city, idx) => (
                          <TableRow 
                            key={city.city}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleBuyerCityClick(city)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs">
                                  {idx + 1}
                                </Badge>
                                <div>
                                  <p className="font-medium">{city.city}</p>
                                  <p className="text-xs text-muted-foreground">{city.region}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">{city.buyers}</TableCell>
                            <TableCell className="text-right">{city.totalPurchases}</TableCell>
                            <TableCell className="text-right text-secondary font-medium">£{city.totalSpend.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Geographic Distribution Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Lead Distribution by City</CardTitle>
                    <CardDescription>Top 6 cities by lead volume</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={cityLeadStats.slice(0, 6)}
                            dataKey="leads"
                            nameKey="city"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ city, leads }) => `${city}: ${leads}`}
                            labelLine={false}
                          >
                            {cityLeadStats.slice(0, 6).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--card))", 
                              border: "1px solid hsl(var(--border))" 
                            }} 
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* TRENDS TAB */}
            <TabsContent value="trends" className="space-y-6 mt-6">
              <TrendComparisonChart 
                leads={allLeads}
                extractCityFromPostcode={extractCityFromPostcode}
                dateRange={dateRange}
              />
            </TabsContent>

            {/* RECOMMENDATIONS TAB */}
            <TabsContent value="recommendations" className="space-y-6 mt-6">
              <MarketingRecommendations
                cityLeadStats={cityLeadStats}
                buyerCityStats={buyerCityStats}
                marketplaceStats={marketplaceStats}
              />
            </TabsContent>

            {/* HISTORICAL PAGE VIEWS TAB */}
            <TabsContent value="historical" className="space-y-6 mt-6">
              <HistoricalVisitorAnalytics />
            </TabsContent>

            {/* LIVE VISITORS TAB */}
            <TabsContent value="live" className="space-y-6 mt-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-green-600 mb-2">
                      <Eye className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase">Live Visitors</span>
                    </div>
                    <p className="text-3xl font-bold">{visitors.length}</p>
                    <p className="text-sm text-muted-foreground">Currently on site</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Globe2 className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase">Tracked Locations</span>
                    </div>
                    <p className="text-3xl font-bold">{liveVisitorLocations.length}</p>
                    <p className="text-sm text-muted-foreground">Unique cities</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Users className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase">Authenticated</span>
                    </div>
                    <p className="text-3xl font-bold">{visitors.filter(v => v.isAuthenticated).length}</p>
                    <p className="text-sm text-muted-foreground">Logged in users</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-secondary" />
                    Live Visitor Locations
                  </CardTitle>
                  <CardDescription>Real-time geographic distribution of current visitors</CardDescription>
                </CardHeader>
                <CardContent>
                  {liveVisitorLocations.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>City</TableHead>
                          <TableHead>Region</TableHead>
                          <TableHead>Country</TableHead>
                          <TableHead className="text-right">Visitors</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {liveVisitorLocations.map((loc, idx) => (
                          <TableRow key={`${loc.city}-${idx}`}>
                            <TableCell className="font-medium">{loc.city}</TableCell>
                            <TableCell>{loc.region}</TableCell>
                            <TableCell>{loc.country}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{loc.visitors}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Globe2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No location data available yet</p>
                      <p className="text-sm">Visitor locations will appear as they browse</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ACQUISITION TAB */}
            <TabsContent value="acquisition" className="space-y-6 mt-6">
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => handleExport("acquisition")}>
                  <Download className="h-4 w-4 mr-2" />Export CSV
                </Button>
              </div>

              {/* Source Breakdown Over Time - Stacked Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-secondary" />
                    Lead Sources Over Time
                  </CardTitle>
                  <CardDescription>Daily breakdown of leads by acquisition channel</CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const dateSourceMap = new Map<string, Record<string, number>>();
                    const allSources = new Set<string>();
                    
                    allLeads.forEach(lead => {
                      const date = new Date(lead.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                      const source = (lead as any).source || 'Unknown';
                      allSources.add(source);
                      
                      if (!dateSourceMap.has(date)) dateSourceMap.set(date, {});
                      const dayData = dateSourceMap.get(date)!;
                      dayData[source] = (dayData[source] || 0) + 1;
                    });
                    
                    const sourceColors: Record<string, string> = {
                      facebook: "hsl(220, 80%, 55%)",
                      facebook_organic: "hsl(280, 65%, 60%)",
                      facebook_ads: "hsl(200, 80%, 50%)",
                      google_organic: "hsl(142, 76%, 36%)",
                      google_ads: "hsl(30, 80%, 55%)",
                      direct: "hsl(var(--muted-foreground))",
                      referral: "hsl(340, 70%, 55%)",
                      tiktok: "hsl(170, 80%, 45%)",
                      organic: "hsl(100, 60%, 45%)",
                    };
                    
                    const chartData = Array.from(dateSourceMap.entries())
                      .map(([date, sources]) => ({ date, ...sources }))
                      .reverse();
                    
                    const sourceList = Array.from(allSources);
                    
                    if (chartData.length === 0) {
                      return <p className="text-center text-muted-foreground py-8">No lead data for this period</p>;
                    }
                    
                    return (
                      <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" className="text-xs" />
                            <YAxis className="text-xs" allowDecimals={false} />
                            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                            {sourceList.map((source, i) => (
                              <Bar 
                                key={source} 
                                dataKey={source} 
                                stackId="a"
                                fill={sourceColors[source] || COLORS[i % COLORS.length]} 
                                name={source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Source Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {leadsBySource
                  .sort((a, b) => b.leads - a.leads)
                  .slice(0, 8)
                  .map((src) => (
                    <Card key={src.source}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium capitalize">
                          {src.source.replace(/_/g, ' ')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{src.leads}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary">{src.purchased} purchased</Badge>
                          {src.refunded > 0 && (
                            <Badge variant="destructive">{src.refunded} refunded</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {src.leads > 0 ? Math.round((src.purchased / src.leads) * 100) : 0}% purchase rate
                        </p>
                      </CardContent>
                    </Card>
                  ))}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Leads by Source</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={leadsBySource}
                            dataKey="leads"
                            nameKey="source"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ source, leads }) => `${source} (${leads})`}
                          >
                            {leadsBySource.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Top Postcode Prefixes</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Postcode</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">Purchased</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
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
              </div>

              {/* UTM Source/Medium Chart */}
              {utmSourceMediums.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe2 className="w-5 h-5 text-secondary" />
                      UTM Source / Medium Breakdown
                    </CardTitle>
                    <CardDescription>Lead volume by source/medium combination from UTM data</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={utmSourceMediums} layout="vertical" margin={{ left: 120 }}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis type="number" allowDecimals={false} />
                          <YAxis type="category" dataKey="label" width={110} className="text-xs" />
                          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                          <Bar dataKey="leads" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} name="Leads" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* UTM Campaign Breakdown Table */}
              {utmCampaigns.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Megaphone className="w-5 h-5 text-secondary" />
                      UTM Campaign Breakdown
                    </CardTitle>
                    <CardDescription>Leads grouped by UTM campaign, source, and medium</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Campaign</TableHead>
                            <TableHead>Source / Medium</TableHead>
                            <TableHead className="text-right">Leads</TableHead>
                            <TableHead className="text-right">Purchased</TableHead>
                            <TableHead className="text-right">Rate</TableHead>
                            <TableHead className="text-right">Refunds</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {utmCampaigns.map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium max-w-[200px] truncate">{row.campaign}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{row.source} / {row.medium}</TableCell>
                              <TableCell className="text-right font-medium">{row.leads}</TableCell>
                              <TableCell className="text-right">{row.purchased}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={row.purchaseRate >= 30 ? "default" : "secondary"}>{row.purchaseRate}%</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {row.refunded > 0 ? <Badge variant="destructive">{row.refunded}</Badge> : <span className="text-muted-foreground">0</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Referrer Breakdown Table */}
              {utmReferrers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowUpRight className="w-5 h-5 text-secondary" />
                      Top Referrer Domains
                    </CardTitle>
                    <CardDescription>Websites driving traffic, extracted from referrer headers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Domain</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {utmReferrers.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{row.domain}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{row.leads}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* MARKETPLACE TAB */}
            <TabsContent value="marketplace" className="space-y-6 mt-6">
              <Card>
                <CardHeader><CardTitle>Marketplace Health</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold">{marketplaceStats.purchaseRate}%</p>
                      <p className="text-sm text-muted-foreground">Lead Purchase Rate</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold">{marketplaceStats.avgTimeToPurchase} hrs</p>
                      <p className="text-sm text-muted-foreground">Avg Time to Purchase</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold">{marketplaceStats.expiredRate}%</p>
                      <p className="text-sm text-muted-foreground">Leads Expired</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold">{marketplaceStats.refundRate}%</p>
                      <p className="text-sm text-muted-foreground">Refund Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Job Outcomes Breakdown */}
              <Card>
                <CardHeader><CardTitle>Job Outcomes (Purchased Leads)</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold text-secondary">{marketplaceStats.jobsPending}</p>
                      <p className="text-sm text-muted-foreground">Pending</p>
                      {marketplaceStats.totalPurchased > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">{Math.round((marketplaceStats.jobsPending / marketplaceStats.totalPurchased) * 100)}%</p>
                      )}
                    </div>
                    <div className="text-center p-4 border border-blue-500/20 bg-blue-500/5 rounded-lg">
                      <p className="text-2xl font-bold text-blue-500">{marketplaceStats.jobsContacted}</p>
                      <p className="text-sm text-muted-foreground">Contacted</p>
                      {marketplaceStats.totalPurchased > 0 && (
                        <p className="text-xs text-blue-600 mt-1">{Math.round((marketplaceStats.jobsContacted / marketplaceStats.totalPurchased) * 100)}%</p>
                      )}
                    </div>
                    <div className="text-center p-4 border border-purple-500/20 bg-purple-500/5 rounded-lg">
                      <p className="text-2xl font-bold text-purple-500">{marketplaceStats.jobsBooked}</p>
                      <p className="text-sm text-muted-foreground">Booked</p>
                      {marketplaceStats.totalPurchased > 0 && (
                        <p className="text-xs text-purple-600 mt-1">{Math.round((marketplaceStats.jobsBooked / marketplaceStats.totalPurchased) * 100)}%</p>
                      )}
                    </div>
                    <div className="text-center p-4 border border-green-500/20 bg-green-500/5 rounded-lg">
                      <p className="text-2xl font-bold text-green-500">{marketplaceStats.jobsCompleted}</p>
                      <p className="text-sm text-muted-foreground">Completed</p>
                      {marketplaceStats.totalPurchased > 0 && (
                        <p className="text-xs text-green-600 mt-1">{Math.round((marketplaceStats.jobsCompleted / marketplaceStats.totalPurchased) * 100)}% close rate</p>
                      )}
                    </div>
                    <div className="text-center p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
                      <p className="text-2xl font-bold text-destructive">{marketplaceStats.jobsLost}</p>
                      <p className="text-sm text-muted-foreground">Lost</p>
                      {marketplaceStats.totalPurchased > 0 && (
                        <p className="text-xs text-destructive/80 mt-1">{Math.round((marketplaceStats.jobsLost / marketplaceStats.totalPurchased) * 100)}%</p>
                      )}
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold text-muted-foreground">{marketplaceStats.jobsNoResponse}</p>
                      <p className="text-sm text-muted-foreground">No Response</p>
                      {marketplaceStats.totalPurchased > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">{Math.round((marketplaceStats.jobsNoResponse / marketplaceStats.totalPurchased) * 100)}%</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Upcoming Bookings */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-cyan-500" />
                        Upcoming Bookings
                      </CardTitle>
                      <CardDescription>Scheduled cleaning jobs with confirmed dates</CardDescription>
                    </div>
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by customer name..."
                        value={bookingSearch}
                        onChange={(e) => setBookingSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const bSearch = bookingSearch.toLowerCase().trim();
                    const filtered = bSearch
                      ? upcomingBookings.filter(b => b.customer_name?.toLowerCase().includes(bSearch))
                      : upcomingBookings;
                    
                    if (filtered.length === 0) {
                      return <p className="text-muted-foreground text-center py-6">{bSearch ? "No matching bookings found" : "No upcoming bookings scheduled"}</p>;
                    }
                    
                    return (
                      <div className="max-h-80 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Countdown</TableHead>
                              <TableHead>Job Type</TableHead>
                              <TableHead>Customer</TableHead>
                              <TableHead>Location</TableHead>
                              <TableHead>Cleaner</TableHead>
                              <TableHead className="text-right">Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filtered.map((booking) => (
                              <TableRow key={booking.id}>
                                <TableCell className="font-medium">
                                  {new Date(booking.booked_date + "T00:00:00").toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </TableCell>
                                <TableCell>
                                  <Badge className={booking.days_until === 0 ? "bg-green-500/20 text-green-600" : booking.days_until <= 2 ? "bg-amber-500/20 text-amber-600" : "bg-cyan-500/10 text-cyan-500"}>
                                    {booking.days_until === 0 ? "Today" : booking.days_until === 1 ? "Tomorrow" : `${booking.days_until} days`}
                                  </Badge>
                                </TableCell>
                                <TableCell>{booking.job_type}</TableCell>
                                <TableCell>{booking.customer_name}</TableCell>
                                <TableCell className="text-muted-foreground">{booking.postcode}</TableCell>
                                <TableCell>{booking.cleaner_name}</TableCell>
                                <TableCell className="text-right font-medium">{booking.display_value}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Purchased Leads - Combined with Status Filter */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle>Purchased Leads</CardTitle>
                      <CardDescription>All purchased leads with status filter</CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-44 h-9">
                          <ListFilter className="w-4 h-4 mr-2 text-muted-foreground" />
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                          <SelectItem value="no_response">No Response</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name..."
                          value={marketplaceSearch}
                          onChange={(e) => setMarketplaceSearch(e.target.value)}
                          className="pl-9 h-9"
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const purchasedLeads = allLeads.filter(l => l.is_unlocked);
                    const search = marketplaceSearch.toLowerCase().trim();
                    
                    // Exclude completed and booked leads (they have their own sections)
                    let filtered = purchasedLeads.filter(l => {
                      const status = l.job_status || "pending";
                      return status !== "completed" && status !== "booked";
                    });
                    
                    // Apply status filter
                    if (statusFilter !== "all") {
                      filtered = filtered.filter(l => {
                        const status = l.job_status || "pending";
                        return status === statusFilter;
                      });
                    }
                    
                    // Apply search
                    if (search) {
                      filtered = filtered.filter(l => l.customer_name?.toLowerCase().includes(search));
                    }

                    const getStatusBadge = (status: string) => {
                      switch (status) {
                        case "contacted": return <Badge className="bg-blue-500/20 text-blue-500 border-0">Contacted</Badge>;
                        case "booked": return <Badge className="bg-purple-500/20 text-purple-500 border-0">Booked</Badge>;
                        case "lost": return <Badge className="bg-destructive/20 text-destructive border-0">Lost</Badge>;
                        case "no_response": return <Badge variant="outline" className="text-muted-foreground">No Response</Badge>;
                        default: return <Badge className="bg-secondary/20 text-secondary border-0">Pending</Badge>;
                      }
                    };

                    if (filtered.length === 0) {
                      return <p className="text-sm text-muted-foreground text-center py-6">{search || statusFilter !== "all" ? "No matching leads found" : "No purchased leads"}</p>;
                    }

                    return (
                      <div className="max-h-96 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Customer</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Job Type</TableHead>
                              <TableHead>Location</TableHead>
                              <TableHead>Purchased</TableHead>
                              <TableHead className="text-right">Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filtered.map(lead => (
                              <TableRow key={lead.id}>
                                <TableCell className="font-medium">{lead.customer_name || "—"}</TableCell>
                                <TableCell>{getStatusBadge(lead.job_status || "pending")}</TableCell>
                                <TableCell>{lead.job_type}</TableCell>
                                <TableCell className="text-muted-foreground">{lead.postcode}</TableCell>
                                <TableCell className="text-muted-foreground">{lead.unlocked_at ? formatDate(lead.unlocked_at) : "—"}</TableCell>
                                <TableCell className="text-right font-medium">{lead.display_value}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Completed Leads - Separate Section */}
              <Card className="border-green-500/20">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <CardTitle className="text-green-500">Completed</CardTitle>
                    <Badge variant="outline">{allLeads.filter(l => l.is_unlocked && l.job_status === "completed").length}</Badge>
                  </div>
                  <CardDescription>Leads that resulted in completed jobs</CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const completedLeads = allLeads.filter(l => l.is_unlocked && l.job_status === "completed");
                    if (completedLeads.length === 0) {
                      return <p className="text-sm text-muted-foreground text-center py-4">No completed leads yet</p>;
                    }
                    return (
                      <div className="max-h-72 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Customer</TableHead>
                              <TableHead>Job Type</TableHead>
                              <TableHead>Location</TableHead>
                              <TableHead>Purchased</TableHead>
                              <TableHead className="text-right">Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {completedLeads.map(lead => (
                              <TableRow key={lead.id}>
                                <TableCell className="font-medium">{lead.customer_name || "—"}</TableCell>
                                <TableCell>{lead.job_type}</TableCell>
                                <TableCell className="text-muted-foreground">{lead.postcode}</TableCell>
                                <TableCell className="text-muted-foreground">{lead.unlocked_at ? formatDate(lead.unlocked_at) : "—"}</TableCell>
                                <TableCell className="text-right font-medium">{lead.display_value}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>

            {/* BUYERS TAB */}
            <TabsContent value="buyers" className="space-y-6 mt-6">
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => handleExport("buyers")}>
                  <Download className="h-4 w-4 mr-2" />Export CSV
                </Button>
              </div>

              {/* Buyer Performance Summary Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-secondary mb-2">
                      <Users className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase">Active Buyers</span>
                    </div>
                    <p className="text-2xl font-bold">{topBuyers.length}</p>
                    <p className="text-sm text-muted-foreground">in selected period</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-green-600 mb-2">
                      <Target className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase">Avg Conversion</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {topBuyers.length > 0 
                        ? Math.round(topBuyers.reduce((sum, b) => sum + b.conversionRate, 0) / topBuyers.length)
                        : 0}%
                    </p>
                    <p className="text-sm text-muted-foreground">leads → booked jobs</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-purple-600 mb-2">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase">Avg Completion</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {topBuyers.filter(b => b.bookedJobs > 0).length > 0 
                        ? Math.round(topBuyers.filter(b => b.bookedJobs > 0).reduce((sum, b) => sum + b.jobCompletionRate, 0) / topBuyers.filter(b => b.bookedJobs > 0).length)
                        : 0}%
                    </p>
                    <p className="text-sm text-muted-foreground">booked → completed</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-amber-600 mb-2">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase">Avg Response</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {topBuyers.filter(b => b.avgResponseTime > 0).length > 0 
                        ? Math.round(topBuyers.filter(b => b.avgResponseTime > 0).reduce((sum, b) => sum + b.avgResponseTime, 0) / topBuyers.filter(b => b.avgResponseTime > 0).length * 10) / 10
                        : 0} hrs
                    </p>
                    <p className="text-sm text-muted-foreground">time to purchase</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Detailed Buyer Performance</CardTitle>
                  <CardDescription>Conversion rates, response times, and job completion metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Purchases</TableHead>
                        <TableHead className="text-right">Conversion</TableHead>
                        <TableHead className="text-right">Completion</TableHead>
                        <TableHead className="text-right">Avg Response</TableHead>
                        <TableHead className="text-right">Refund Rate</TableHead>
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
                              <div>
                                <span className="font-medium">{buyer.name}</span>
                                <p className="text-xs text-muted-foreground">£{buyer.spend} spent</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {extractCityFromPostcode(buyer.postcode).city}
                          </TableCell>
                          <TableCell className="text-right">
                            <div>
                              <span className="font-medium">{buyer.purchases}</span>
                              <p className="text-xs text-muted-foreground">{buyer.bookedJobs} booked</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={buyer.conversionRate >= 50 ? "default" : buyer.conversionRate >= 25 ? "secondary" : "outline"}>
                              {buyer.conversionRate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={buyer.jobCompletionRate >= 80 ? "default" : buyer.jobCompletionRate >= 50 ? "secondary" : "outline"} className={buyer.jobCompletionRate >= 80 ? "bg-green-500" : ""}>
                              {buyer.jobCompletionRate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {buyer.avgResponseTime > 0 ? `${buyer.avgResponseTime}h` : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={buyer.refundRate > 5 ? "destructive" : "default"}>
                              {buyer.refundRate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* BUSINESSES TAB */}
            <TabsContent value="businesses" className="space-y-6 mt-6">
              <BusinessAnalyticsTab startDate={start} endDate={end} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* City Leads Detail Dialog */}
      <Dialog open={!!selectedCity} onOpenChange={() => setSelectedCity(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-secondary" />
              {selectedCity?.city} - Lead Details
            </DialogTitle>
            <DialogDescription>
              {selectedCity?.region} • {selectedCity?.leads} total leads • {selectedCity?.purchaseRate}% purchase rate
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold">{selectedCity?.leads}</p>
              <p className="text-xs text-muted-foreground">Total Leads</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-600">{selectedCity?.purchased}</p>
              <p className="text-xs text-muted-foreground">Purchased</p>
            </div>
            <div className="p-3 bg-secondary/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-secondary">£{selectedCity?.revenue}</p>
              <p className="text-xs text-muted-foreground">Revenue</p>
            </div>
            <div className="p-3 bg-red-500/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-600">{selectedCity?.refundRate}%</p>
              <p className="text-xs text-muted-foreground">Refund Rate</p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Postcode</TableHead>
                <TableHead>Job Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cityLeadsDetail.slice(0, 50).map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.postcode}</TableCell>
                  <TableCell>{lead.job_type}</TableCell>
                  <TableCell>{lead.display_value}</TableCell>
                  <TableCell>{formatDate(lead.created_at)}</TableCell>
                  <TableCell>
                    {lead.refunded_at ? (
                      <Badge variant="destructive">Refunded</Badge>
                    ) : lead.is_unlocked ? (
                      <Badge variant="default">Purchased</Badge>
                    ) : (
                      <Badge variant="secondary">Available</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {cityLeadsDetail.length > 50 && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              Showing 50 of {cityLeadsDetail.length} leads
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Buyer City Detail Dialog */}
      <Dialog open={!!selectedBuyerCity} onOpenChange={() => setSelectedBuyerCity(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-500" />
              {selectedBuyerCity?.city} - Buyer Details
            </DialogTitle>
            <DialogDescription>
              {selectedBuyerCity?.region} • {selectedBuyerCity?.buyers} businesses • £{selectedBuyerCity?.totalSpend.toLocaleString()} total spend
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-3 bg-purple-500/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-purple-600">{selectedBuyerCity?.buyers}</p>
              <p className="text-xs text-muted-foreground">Businesses</p>
            </div>
            <div className="p-3 bg-secondary/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-secondary">{selectedBuyerCity?.totalPurchases}</p>
              <p className="text-xs text-muted-foreground">Total Purchases</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-600">£{selectedBuyerCity?.totalSpend.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Spend</p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Refund Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cityBuyersDetail.map((buyer) => (
                <TableRow key={buyer.name}>
                  <TableCell className="font-medium">{buyer.name}</TableCell>
                  <TableCell className="text-right">{buyer.purchases}</TableCell>
                  <TableCell className="text-right font-medium">£{buyer.spend}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={buyer.refundRate > 5 ? "destructive" : "default"}>
                      {buyer.refundRate}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* All Leads by City Dialog */}
      <Dialog open={showAllLeads} onOpenChange={setShowAllLeads}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All Cities - Lead Statistics</DialogTitle>
            <DialogDescription>Complete breakdown of leads by city</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>City</TableHead>
                <TableHead>Region</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Purchased</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cityLeadStats.map((city) => (
                <TableRow key={city.city} className="cursor-pointer hover:bg-muted/50" onClick={() => { setShowAllLeads(false); handleCityClick(city); }}>
                  <TableCell className="font-medium">{city.city}</TableCell>
                  <TableCell className="text-muted-foreground">{city.region}</TableCell>
                  <TableCell className="text-right">{city.leads}</TableCell>
                  <TableCell className="text-right">{city.purchased}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={city.purchaseRate >= 30 ? "default" : "secondary"}>{city.purchaseRate}%</Badge>
                  </TableCell>
                  <TableCell className="text-right text-secondary font-medium">£{city.revenue}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* All Buyers by City Dialog */}
      <Dialog open={showAllBuyers} onOpenChange={setShowAllBuyers}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All Cities - Buyer Statistics</DialogTitle>
            <DialogDescription>Complete breakdown of buyers by city</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>City</TableHead>
                <TableHead>Region</TableHead>
                <TableHead className="text-right">Buyers</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead className="text-right">Total Spend</TableHead>
                <TableHead className="text-right">Avg/Buyer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buyerCityStats.map((city) => (
                <TableRow key={city.city} className="cursor-pointer hover:bg-muted/50" onClick={() => { setShowAllBuyers(false); handleBuyerCityClick(city); }}>
                  <TableCell className="font-medium">{city.city}</TableCell>
                  <TableCell className="text-muted-foreground">{city.region}</TableCell>
                  <TableCell className="text-right">{city.buyers}</TableCell>
                  <TableCell className="text-right">{city.totalPurchases}</TableCell>
                  <TableCell className="text-right text-secondary font-medium">£{city.totalSpend.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{city.avgPurchases}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
