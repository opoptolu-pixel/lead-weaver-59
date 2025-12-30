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

export function useAdSpend(startDate?: Date, endDate?: Date) {
  const [adSpendData, setAdSpendData] = useState<AdSpendData[]>([]);
  const [platformSettings, setPlatformSettings] = useState<AdPlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Memoize date strings to prevent infinite re-renders
  const startDateStr = startDate?.toISOString().split("T")[0];
  const endDateStr = endDate?.toISOString().split("T")[0];

  const fetchAdSpend = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("ad_spend")
        .select("*")
        .eq("platform", "google_ads")
        .order("date", { ascending: false });

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

      // Fetch platform settings
      const { data: settings } = await supabase
        .from("ad_platform_settings")
        .select("*")
        .eq("platform", "google_ads")
        .maybeSingle();

      setPlatformSettings(settings);
    } catch (err) {
      console.error("Error in fetchAdSpend:", err);
    } finally {
      setLoading(false);
    }
  }, [startDateStr, endDateStr]);

  useEffect(() => {
    fetchAdSpend();
  }, [fetchAdSpend]);

  const syncGoogleAds = useCallback(async (customStartDate?: string, customEndDate?: string) => {
    setSyncing(true);
    try {
      const body: Record<string, string> = {};
      if (customStartDate) body.startDate = customStartDate;
      if (customEndDate) body.endDate = customEndDate;

      const { data, error } = await supabase.functions.invoke("sync-google-ads", {
        body: Object.keys(body).length > 0 ? body : undefined,
      });

      if (error) {
        toast.error("Sync failed", { description: error.message });
        return false;
      }

      if (data?.success) {
        toast.success("Google Ads synced", {
          description: `${data.synced} records updated`,
        });
        await fetchAdSpend();
        return true;
      } else {
        toast.error("Sync failed", { description: data?.error || "Unknown error" });
        return false;
      }
    } catch (err: any) {
      toast.error("Sync failed", { description: err.message });
      return false;
    } finally {
      setSyncing(false);
    }
  }, [fetchAdSpend]);

  // Calculate metrics from the data
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

  return {
    adSpendData,
    platformSettings,
    metrics,
    loading,
    syncing,
    syncGoogleAds,
    refetch: fetchAdSpend,
  };
}
