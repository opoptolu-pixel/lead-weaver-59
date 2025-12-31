import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/contexts/AdminContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface SourceData {
  source: string;
  displayName: string;
  total: number;
  purchased: number;
  conversionRate: number;
  color: string;
}

const SOURCE_CONFIG: Record<string, { displayName: string; color: string }> = {
  google: { displayName: "Google Ads", color: "hsl(217, 91%, 60%)" },
  google_organic: { displayName: "Google Organic", color: "hsl(217, 70%, 45%)" },
  facebook: { displayName: "Facebook", color: "hsl(221, 44%, 41%)" },
  facebook_organic: { displayName: "FB Organic", color: "hsl(221, 40%, 55%)" },
  tiktok: { displayName: "TikTok", color: "hsl(340, 82%, 52%)" },
  organic: { displayName: "Organic", color: "hsl(142, 76%, 36%)" },
  direct: { displayName: "Direct", color: "hsl(45, 93%, 47%)" },
  referral: { displayName: "Referral", color: "hsl(280, 65%, 60%)" },
  website: { displayName: "Website", color: "hsl(220, 14%, 50%)" },
};

export default function SourceBreakdownChart() {
  const { getDateFilter } = useAdmin();
  const [sourceData, setSourceData] = useState<SourceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSourceData();
  }, [getDateFilter]);

  const fetchSourceData = async () => {
    setLoading(true);
    const { start, end } = getDateFilter();

    const { data: leads, error } = await supabase
      .from("leads")
      .select("source, is_unlocked")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (error) {
      console.error("Error fetching source data:", error);
      setLoading(false);
      return;
    }

    // Group by source
    const sourceMap = new Map<string, { total: number; purchased: number }>();

    leads?.forEach((lead) => {
      const source = lead.source || "website";
      if (!sourceMap.has(source)) {
        sourceMap.set(source, { total: 0, purchased: 0 });
      }
      const stats = sourceMap.get(source)!;
      stats.total++;
      if (lead.is_unlocked) stats.purchased++;
    });

    // Convert to array with config
    const data: SourceData[] = Array.from(sourceMap.entries())
      .map(([source, stats]) => {
        const config = SOURCE_CONFIG[source] || SOURCE_CONFIG.website;
        return {
          source,
          displayName: config.displayName,
          total: stats.total,
          purchased: stats.purchased,
          conversionRate: stats.total > 0 ? Math.round((stats.purchased / stats.total) * 100) : 0,
          color: config.color,
        };
      })
      .sort((a, b) => b.total - a.total);

    setSourceData(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-heading font-semibold text-foreground mb-4">
          Leads by Source
        </h3>
        <div className="flex items-center justify-center h-[300px]">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (sourceData.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-heading font-semibold text-foreground mb-4">
          Leads by Source
        </h3>
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          No source data available
        </div>
      </div>
    );
  }

  const totalLeads = sourceData.reduce((sum, s) => sum + s.total, 0);
  const totalPurchased = sourceData.reduce((sum, s) => sum + s.purchased, 0);
  const overallConversion = totalLeads > 0 ? Math.round((totalPurchased / totalLeads) * 100) : 0;

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-foreground">
          Leads by Source
        </h3>
        <div className="text-sm text-muted-foreground">
          Overall: <span className="font-medium text-foreground">{overallConversion}%</span> conversion
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {sourceData.slice(0, 4).map((source) => (
          <div 
            key={source.source} 
            className="p-3 rounded-lg border border-border bg-muted/30"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }} />
              <span className="text-sm font-medium truncate">{source.displayName}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold">{source.total}</span>
              <span className="text-sm text-muted-foreground">{source.conversionRate}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={sourceData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <YAxis 
            type="category" 
            dataKey="displayName" 
            stroke="hsl(var(--muted-foreground))" 
            fontSize={12}
            width={100}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            formatter={(value: number, name: string) => {
              if (name === "total") return [value, "Total Leads"];
              if (name === "purchased") return [value, "Purchased"];
              return [value, name];
            }}
            labelFormatter={(label) => label}
          />
          <Bar dataKey="total" name="total" radius={[0, 4, 4, 0]}>
            {sourceData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} opacity={0.3} />
            ))}
          </Bar>
          <Bar dataKey="purchased" name="purchased" radius={[0, 4, 4, 0]}>
            {sourceData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Conversion rates table */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {sourceData.map((source) => (
            <div key={source.source} className="text-center p-2">
              <div className="text-xs text-muted-foreground truncate">{source.displayName}</div>
              <div className="text-lg font-semibold" style={{ color: source.color }}>
                {source.conversionRate}%
              </div>
              <div className="text-xs text-muted-foreground">
                {source.purchased}/{source.total}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
