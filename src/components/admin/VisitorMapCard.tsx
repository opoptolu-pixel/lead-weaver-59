import { useState, useEffect } from "react";
import { useVisitorData, Visitor } from "@/hooks/useVisitorData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Globe2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Simulated regions based on visitor count (real implementation would need IP geolocation)
const REGION_DATA = [
  { name: "London", code: "LON", lat: 51.5074, lng: -0.1278 },
  { name: "Manchester", code: "MAN", lat: 53.4808, lng: -2.2426 },
  { name: "Birmingham", code: "BIR", lat: 52.4862, lng: -1.8904 },
  { name: "Leeds", code: "LDS", lat: 53.8008, lng: -1.5491 },
  { name: "Glasgow", code: "GLA", lat: 55.8642, lng: -4.2518 },
  { name: "Liverpool", code: "LIV", lat: 53.4084, lng: -2.9916 },
  { name: "Bristol", code: "BRS", lat: 51.4545, lng: -2.5879 },
  { name: "Edinburgh", code: "EDI", lat: 55.9533, lng: -3.1883 },
];

export function VisitorMapCard() {
  const visitors = useVisitorData();
  const [regionBreakdown, setRegionBreakdown] = useState<{ region: string; count: number; percentage: number }[]>([]);

  useEffect(() => {
    // Simulate region distribution (in production, this would use actual IP geolocation)
    if (visitors.length > 0) {
      const total = visitors.length;
      // Distribute visitors across regions based on UK population distribution
      const weights = [0.35, 0.15, 0.12, 0.10, 0.08, 0.08, 0.06, 0.06];
      let remaining = total;
      const regions = REGION_DATA.map((region, idx) => {
        const count = idx === REGION_DATA.length - 1 
          ? remaining 
          : Math.max(0, Math.round(total * weights[idx] + (Math.random() - 0.5) * 2));
        remaining -= count;
        return {
          region: region.name,
          count: Math.max(0, count),
          percentage: 0
        };
      }).filter(r => r.count > 0);
      
      const totalAssigned = regions.reduce((sum, r) => sum + r.count, 0);
      regions.forEach(r => {
        r.percentage = Math.round((r.count / totalAssigned) * 100);
      });
      
      setRegionBreakdown(regions.sort((a, b) => b.count - a.count));
    } else {
      setRegionBreakdown([]);
    }
  }, [visitors]);

  return (
    <Card className="relative border-0 bg-gradient-to-br from-card via-card to-muted/30 shadow-elevated overflow-hidden">
      {/* Simulated data indicator */}
      <div className="absolute top-4 right-4 z-10">
        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-400/30">
          Simulated
        </Badge>
      </div>

      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2.5 text-lg font-semibold">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Globe2 className="w-5 h-5 text-purple-500" />
          </div>
          <span>Visitor Locations</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Map placeholder - UK outline */}
        <div className="relative h-48 bg-muted/30 rounded-xl border border-border/50 overflow-hidden">
          {/* Simple UK map representation */}
          <svg viewBox="0 0 200 300" className="absolute inset-0 w-full h-full p-4">
            {/* Simplified UK outline */}
            <path
              d="M100,20 C120,25 140,40 145,60 C150,80 155,100 150,120 C145,140 130,160 120,180 C110,200 105,220 100,240 C95,260 90,270 85,280 C80,270 75,260 70,240 C65,220 60,200 50,180 C40,160 30,140 25,120 C20,100 25,80 35,60 C45,40 70,25 100,20Z"
              fill="hsl(var(--muted))"
              stroke="hsl(var(--border))"
              strokeWidth="1"
            />
            
            {/* Animate dots for each region with visitors */}
            {regionBreakdown.slice(0, 5).map((region, idx) => {
              const regionData = REGION_DATA.find(r => r.name === region.region);
              if (!regionData) return null;
              
              // Map lat/lng to SVG coordinates (simplified)
              const x = 100 + (regionData.lng + 5) * 15;
              const y = (60 - regionData.lat) * 5 + 50;
              
              return (
                <g key={region.region}>
                  {/* Pulse animation */}
                  <circle
                    cx={x}
                    cy={y}
                    r={6 + region.count}
                    fill="hsl(var(--secondary))"
                    opacity="0.2"
                    className="animate-ping"
                  />
                  {/* Solid dot */}
                  <circle
                    cx={x}
                    cy={y}
                    r={4 + Math.min(region.count * 0.5, 6)}
                    fill="hsl(var(--secondary))"
                    stroke="hsl(var(--card))"
                    strokeWidth="2"
                  />
                </g>
              );
            })}
          </svg>
          
          {/* Legend */}
          <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-xs border border-border/50 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse shrink-0"></span>
            <span className="text-foreground font-medium">{visitors.length}</span>
            <span className="text-muted-foreground">active</span>
          </div>
        </div>

        {/* Region breakdown */}
        {regionBreakdown.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">By Region</span>
            </div>
            <div className="space-y-1.5">
              {regionBreakdown.slice(0, 5).map((region) => (
                <div 
                  key={region.region}
                  className="flex items-center gap-3"
                >
                  <span className="text-xs text-muted-foreground w-20 truncate">{region.region}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-secondary to-secondary/70 rounded-full transition-all duration-500"
                      style={{ width: `${region.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-foreground w-8 text-right">{region.count}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 space-y-2">
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
              <MapPin className="w-5 h-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">No location data</p>
          </div>
        )}

        {/* Note about IP geolocation */}
        <div className="flex items-start gap-2 p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground">
            For accurate location tracking, add a Mapbox API key in your backend secrets. Currently showing simulated regional distribution.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
