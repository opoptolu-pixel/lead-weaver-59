import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdSpendData {
  id: string;
  platform: string;
  date: string;
  spend_amount: number;
  impressions: number;
  clicks: number;
  conversions: number;
  currency: string;
  synced_at: string;
}

interface AdPlatformSettings {
  platform: string;
  is_enabled: boolean;
  last_sync_at: string | null;
  sync_status: string | null;
  error_message: string | null;
}

interface AdSpendMetrics {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  costPerLead: number;
  costPerClick: number;
  ctr: number; // Click-through rate
}

export type AdPlatform = "google_ads" | "facebook_ads" | "all";

export function useAdSpend(startDate?: Date, endDate?: Date, platform: AdPlatform = "all") {
  const [adSpendData, setAdSpendData] = useState<AdSpendData[]>([]);
  const [platformSettings, setPlatformSettings] = useState<AdPlatformSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  // Memoize date strings to prevent infinite re-renders
  const startDateStr = startDate?.toISOString().split("T")[0];
  const endDateStr = endDate?.toISOString().split("T")[0];

  const fetchAdSpend = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("ad_spend")
        .select("*")
        .order("date", { ascending: false });

      // Filter by platform if not "all"
      if (platform !== "all") {
        query = query.eq("platform", platform);
      }

      if (startDateStr) {
        query = query.gte("date", startDateStr);
      }
      if (endDateStr) {
        query = query.lte("date", endDateStr);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching ad spend:", error);
      } else {
        setAdSpendData(data || []);
      }

      // Fetch platform settings for all platforms
      const { data: settings } = await supabase
        .from("ad_platform_settings")
        .select("*");

      setPlatformSettings(settings || []);
    } catch (err) {
      console.error("Error in fetchAdSpend:", err);
    } finally {
      setLoading(false);
    }
  }, [startDateStr, endDateStr, platform]);

  useEffect(() => {
    fetchAdSpend();
  }, [fetchAdSpend]);

  const syncGoogleAds = useCallback(async (customStartDate?: string, customEndDate?: string) => {
    setSyncing(prev => ({ ...prev, google_ads: true }));
    try {
      const body: Record<string, string> = {};
      if (customStartDate) body.startDate = customStartDate;
      if (customEndDate) body.endDate = customEndDate;

      const { data, error } = await supabase.functions.invoke("sync-google-ads", {
        body: Object.keys(body).length > 0 ? body : undefined,
      });

      if (error) {
        toast.error("Google Ads sync failed", { description: error.message });
        return false;
      }

      if (data?.success) {
        toast.success("Google Ads synced", {
          description: `${data.recordsProcessed || data.synced || 0} records updated`,
        });
        await fetchAdSpend();
        return true;
      } else {
        toast.error("Google Ads sync failed", { description: data?.error || "Unknown error" });
        return false;
      }
    } catch (err: any) {
      toast.error("Google Ads sync failed", { description: err.message });
      return false;
    } finally {
      setSyncing(prev => ({ ...prev, google_ads: false }));
    }
  }, [fetchAdSpend]);

  const syncFacebookAds = useCallback(async (customStartDate?: string, customEndDate?: string) => {
    setSyncing(prev => ({ ...prev, facebook_ads: true }));
    try {
      const body: Record<string, string> = {};
      if (customStartDate) body.startDate = customStartDate;
      if (customEndDate) body.endDate = customEndDate;

      const { data, error } = await supabase.functions.invoke("sync-facebook-ads", {
        body: Object.keys(body).length > 0 ? body : undefined,
      });

      if (error) {
        toast.error("Facebook Ads sync failed", { description: error.message });
        return false;
      }

      if (data?.success) {
        toast.success("Facebook Ads synced", {
          description: `${data.recordsProcessed || 0} records updated`,
        });
        await fetchAdSpend();
        return true;
      } else {
        toast.error("Facebook Ads sync failed", { description: data?.error || "Unknown error" });
        return false;
      }
    } catch (err: any) {
      toast.error("Facebook Ads sync failed", { description: err.message });
      return false;
    } finally {
      setSyncing(prev => ({ ...prev, facebook_ads: false }));
    }
  }, [fetchAdSpend]);

  const syncAllPlatforms = useCallback(async (customStartDate?: string, customEndDate?: string) => {
    const results = await Promise.all([
      syncGoogleAds(customStartDate, customEndDate),
      syncFacebookAds(customStartDate, customEndDate),
    ]);
    return results.every(r => r);
  }, [syncGoogleAds, syncFacebookAds]);

  // Get settings for a specific platform
  const getPlatformSettings = useCallback((platformName: string): AdPlatformSettings | null => {
    return platformSettings.find(s => s.platform === platformName) || null;
  }, [platformSettings]);

  // Calculate metrics from the data (combined or per-platform)
  const metrics: AdSpendMetrics = {
    totalSpend: adSpendData.reduce((sum, d) => sum + Number(d.spend_amount), 0),
    totalImpressions: adSpendData.reduce((sum, d) => sum + (d.impressions || 0), 0),
    totalClicks: adSpendData.reduce((sum, d) => sum + (d.clicks || 0), 0),
    totalConversions: adSpendData.reduce((sum, d) => sum + (d.conversions || 0), 0),
    costPerLead: 0,
    costPerClick: 0,
    ctr: 0,
  };

  // Calculate derived metrics
  if (metrics.totalConversions > 0) {
    metrics.costPerLead = metrics.totalSpend / metrics.totalConversions;
  }
  if (metrics.totalClicks > 0) {
    metrics.costPerClick = metrics.totalSpend / metrics.totalClicks;
  }
  if (metrics.totalImpressions > 0) {
    metrics.ctr = (metrics.totalClicks / metrics.totalImpressions) * 100;
  }

  // Calculate metrics per platform
  const googleAdsMetrics: AdSpendMetrics = (() => {
    const googleData = adSpendData.filter(d => d.platform === "google_ads");
    const m: AdSpendMetrics = {
      totalSpend: googleData.reduce((sum, d) => sum + Number(d.spend_amount), 0),
      totalImpressions: googleData.reduce((sum, d) => sum + (d.impressions || 0), 0),
      totalClicks: googleData.reduce((sum, d) => sum + (d.clicks || 0), 0),
      totalConversions: googleData.reduce((sum, d) => sum + (d.conversions || 0), 0),
      costPerLead: 0,
      costPerClick: 0,
      ctr: 0,
    };
    if (m.totalConversions > 0) m.costPerLead = m.totalSpend / m.totalConversions;
    if (m.totalClicks > 0) m.costPerClick = m.totalSpend / m.totalClicks;
    if (m.totalImpressions > 0) m.ctr = (m.totalClicks / m.totalImpressions) * 100;
    return m;
  })();

  const facebookAdsMetrics: AdSpendMetrics = (() => {
    const fbData = adSpendData.filter(d => d.platform === "facebook_ads");
    const m: AdSpendMetrics = {
      totalSpend: fbData.reduce((sum, d) => sum + Number(d.spend_amount), 0),
      totalImpressions: fbData.reduce((sum, d) => sum + (d.impressions || 0), 0),
      totalClicks: fbData.reduce((sum, d) => sum + (d.clicks || 0), 0),
      totalConversions: fbData.reduce((sum, d) => sum + (d.conversions || 0), 0),
      costPerLead: 0,
      costPerClick: 0,
      ctr: 0,
    };
    if (m.totalConversions > 0) m.costPerLead = m.totalSpend / m.totalConversions;
    if (m.totalClicks > 0) m.costPerClick = m.totalSpend / m.totalClicks;
    if (m.totalImpressions > 0) m.ctr = (m.totalClicks / m.totalImpressions) * 100;
    return m;
  })();

  return {
    adSpendData,
    platformSettings,
    getPlatformSettings,
    metrics,
    googleAdsMetrics,
    facebookAdsMetrics,
    loading,
    syncing,
    syncGoogleAds,
    syncFacebookAds,
    syncAllPlatforms,
    refetch: fetchAdSpend,
  };
}
