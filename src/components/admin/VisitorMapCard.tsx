import { useState, useEffect, useMemo } from "react";
import { useVisitorData, Visitor, GeoLocation } from "@/hooks/useVisitorData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Globe2, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocationGroup {
  location: string;
  city: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  count: number;
  percentage: number;
}

export function VisitorMapCard() {
  const visitors = useVisitorData();
  
  // Group visitors by location
  const locationData = useMemo(() => {
    const visitorsWithGeo = visitors.filter(v => v.geolocation);
    
    if (visitorsWithGeo.length === 0) {
      return { groups: [], hasRealData: false };
    }
    
    // Group by city
    const groups = new Map<string, LocationGroup>();
    
    visitorsWithGeo.forEach((visitor) => {
      const geo = visitor.geolocation as GeoLocation;
      const key = `${geo.city}-${geo.countryCode}`;
      
      if (groups.has(key)) {
        const existing = groups.get(key)!;
        existing.count++;
      } else {
        groups.set(key, {
          location: key,
          city: geo.city,
          region: geo.region,
          country: geo.country,
          lat: geo.lat,
          lon: geo.lon,
          count: 1,
          percentage: 0,
        });
      }
    });
    
    // Calculate percentages
    const total = visitorsWithGeo.length;
    const groupArray = Array.from(groups.values())
      .map(g => ({ ...g, percentage: Math.round((g.count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
    
    return { groups: groupArray, hasRealData: true };
  }, [visitors]);

  // Calculate map bounds for positioning dots
  const mapBounds = useMemo(() => {
    if (locationData.groups.length === 0) {
      // Default to UK bounds
      return { minLat: 50, maxLat: 59, minLon: -8, maxLon: 2 };
    }
    
    const lats = locationData.groups.map(g => g.lat);
    const lons = locationData.groups.map(g => g.lon);
    
    const minLat = Math.min(...lats) - 2;
    const maxLat = Math.max(...lats) + 2;
    const minLon = Math.min(...lons) - 2;
    const maxLon = Math.max(...lons) + 2;
    
    return { minLat, maxLat, minLon, maxLon };
  }, [locationData.groups]);

  // Convert lat/lon to SVG coordinates
  const toSvgCoords = (lat: number, lon: number) => {
    const { minLat, maxLat, minLon, maxLon } = mapBounds;
    const x = ((lon - minLon) / (maxLon - minLon)) * 180 + 10;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 180 + 10;
    return { x, y };
  };

  const visitorsWithoutGeo = visitors.filter(v => !v.geolocation).length;

  return (
    <Card className="relative border-0 bg-gradient-to-br from-card via-card to-muted/30 shadow-elevated overflow-hidden">
      {/* Status indicator */}
      <div className="absolute top-4 right-4 z-10">
        {locationData.hasRealData ? (
          <Badge variant="outline" className="text-[10px] bg-secondary/10 text-secondary border-secondary/30 flex items-center gap-1">
            <Wifi className="w-3 h-3" />
            Live
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border flex items-center gap-1">
            <WifiOff className="w-3 h-3" />
            No Data
          </Badge>
        )}
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
        {/* Map visualization */}
        <div className="relative h-48 bg-muted/30 rounded-xl border border-border/50 overflow-hidden">
          <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full p-2">
            {/* Grid lines for context */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
              </pattern>
            </defs>
            <rect width="200" height="200" fill="url(#grid)" />
            
            {/* Location dots */}
            {locationData.groups.map((group, idx) => {
              const { x, y } = toSvgCoords(group.lat, group.lon);
              const radius = Math.min(4 + group.count * 2, 15);
              
              return (
                <g key={group.location}>
                  {/* Pulse animation */}
                  <circle
                    cx={x}
                    cy={y}
                    r={radius + 4}
                    fill="hsl(var(--secondary))"
                    opacity="0.2"
                    className="animate-ping"
                    style={{ animationDelay: `${idx * 0.2}s` }}
                  />
                  {/* Outer glow */}
                  <circle
                    cx={x}
                    cy={y}
                    r={radius + 2}
                    fill="hsl(var(--secondary))"
                    opacity="0.3"
                  />
                  {/* Main dot */}
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill="hsl(var(--secondary))"
                    stroke="hsl(var(--card))"
                    strokeWidth="2"
                  />
                  {/* Count label for larger groups */}
                  {group.count > 1 && (
                    <text
                      x={x}
                      y={y + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="hsl(var(--secondary-foreground))"
                      fontSize="8"
                      fontWeight="bold"
                    >
                      {group.count}
                    </text>
                  )}
                </g>
              );
            })}
            
            {/* No data indicator */}
            {locationData.groups.length === 0 && visitors.length > 0 && (
              <text
                x="100"
                y="100"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="hsl(var(--muted-foreground))"
                fontSize="12"
              >
                Fetching locations...
              </text>
            )}
          </svg>
          
          {/* Legend */}
          <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-xs border border-border/50 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse shrink-0"></span>
            <span className="text-foreground font-medium">{locationData.groups.reduce((sum, g) => sum + g.count, 0)}</span>
            <span className="text-muted-foreground">tracked</span>
            {visitorsWithoutGeo > 0 && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{visitorsWithoutGeo} pending</span>
              </>
            )}
          </div>
        </div>

        {/* Location breakdown */}
        {locationData.groups.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">By Location</span>
            </div>
            <div className="space-y-1.5">
              {locationData.groups.slice(0, 5).map((group) => (
                <div 
                  key={group.location}
                  className="flex items-center gap-3"
                >
                  <div className="flex flex-col w-24">
                    <span className="text-xs text-foreground font-medium truncate">{group.city}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{group.country}</span>
                  </div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-secondary to-secondary/70 rounded-full transition-all duration-500"
                      style={{ width: `${group.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-foreground w-8 text-right">{group.count}</span>
                </div>
              ))}
            </div>
          </div>
        ) : visitors.length > 0 ? (
          <div className="text-center py-4 space-y-2">
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto animate-pulse">
              <Globe2 className="w-5 h-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">Detecting locations...</p>
            <p className="text-xs text-muted-foreground/70">Real-time geolocation in progress</p>
          </div>
        ) : (
          <div className="text-center py-4 space-y-2">
            <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
              <MapPin className="w-5 h-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">No visitors yet</p>
            <p className="text-xs text-muted-foreground/70">Locations will appear in real-time</p>
          </div>
        )}

        {/* Info note */}
        {locationData.hasRealData && (
          <div className="flex items-start gap-2 p-3 bg-secondary/5 rounded-lg border border-secondary/10">
            <Globe2 className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">
              Location data is based on IP geolocation. Accuracy may vary based on network configuration.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
