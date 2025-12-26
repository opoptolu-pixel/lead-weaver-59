import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Lightbulb, 
  Target, 
  TrendingUp, 
  TrendingDown, 
  MapPin, 
  AlertTriangle,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Building2,
  Rocket
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CityStats {
  city: string;
  region: string;
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

interface MarketingRecommendationsProps {
  cityLeadStats: CityStats[];
  buyerCityStats: BuyerCityStats[];
  marketplaceStats: {
    purchaseRate: number;
    avgTimeToPurchase: number;
    expiredRate: number;
    refundRate: number;
  };
}

interface Recommendation {
  id: string;
  type: 'opportunity' | 'warning' | 'success' | 'action';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  metric?: string;
  action: string;
  cities?: string[];
}

export function MarketingRecommendations({ 
  cityLeadStats, 
  buyerCityStats, 
  marketplaceStats 
}: MarketingRecommendationsProps) {
  const recommendations = useMemo(() => {
    const recs: Recommendation[] = [];

    // Analyze high-performing cities (high purchase rate, good volume)
    const highPerformers = cityLeadStats
      .filter(c => c.leads >= 5 && c.purchaseRate >= 40)
      .sort((a, b) => b.purchaseRate - a.purchaseRate);
    
    if (highPerformers.length > 0) {
      recs.push({
        id: 'high-performers',
        type: 'success',
        priority: 'high',
        title: 'Scale Marketing in High-Converting Cities',
        description: `These cities have exceptional purchase rates (40%+). Double down on marketing spend here for maximum ROI.`,
        metric: `${highPerformers[0].purchaseRate}% avg conversion`,
        action: 'Increase ad spend and SEO efforts',
        cities: highPerformers.slice(0, 3).map(c => c.city)
      });
    }

    // Analyze under-served markets (few buyers but demand exists)
    const underserved = cityLeadStats
      .filter(c => c.leads >= 10 && c.purchaseRate < 20)
      .sort((a, b) => b.leads - a.leads);
    
    if (underserved.length > 0) {
      recs.push({
        id: 'underserved',
        type: 'opportunity',
        priority: 'high',
        title: 'Recruit Cleaners in Underserved Markets',
        description: `High lead volume but low purchase rates suggest cleaner shortage. Focus B2B recruitment here.`,
        metric: `${underserved.reduce((sum, c) => sum + c.leads - c.purchased, 0)} unpurchased leads`,
        action: 'Run cleaner recruitment campaigns',
        cities: underserved.slice(0, 3).map(c => c.city)
      });
    }

    // Cities with high refund rates
    const highRefund = cityLeadStats
      .filter(c => c.purchased >= 5 && c.refundRate > 15)
      .sort((a, b) => b.refundRate - a.refundRate);
    
    if (highRefund.length > 0) {
      recs.push({
        id: 'high-refund',
        type: 'warning',
        priority: 'high',
        title: 'Investigate Quality Issues',
        description: `These cities have abnormally high refund rates. Review lead quality and customer expectations.`,
        metric: `${highRefund[0].refundRate}% avg refund rate`,
        action: 'Audit lead sources and qualification process',
        cities: highRefund.slice(0, 3).map(c => c.city)
      });
    }

    // Growing markets with active buyers
    const activeBuyerCities = buyerCityStats
      .filter(b => b.buyers >= 3 && b.avgPurchases >= 5)
      .sort((a, b) => b.totalSpend - a.totalSpend);
    
    if (activeBuyerCities.length > 0) {
      recs.push({
        id: 'active-buyers',
        type: 'success',
        priority: 'medium',
        title: 'Nurture Power Buyer Regions',
        description: `These cities have multiple high-volume buyers. Create loyalty programs to retain them.`,
        metric: `${activeBuyerCities[0].avgPurchases} avg purchases per buyer`,
        action: 'Launch buyer retention program',
        cities: activeBuyerCities.slice(0, 3).map(c => c.city)
      });
    }

    // Cities with good leads but no buyers
    const buyerCityNames = new Set(buyerCityStats.map(b => b.city));
    const noBuyers = cityLeadStats
      .filter(c => c.leads >= 5 && !buyerCityNames.has(c.city))
      .sort((a, b) => b.leads - a.leads);
    
    if (noBuyers.length > 0) {
      recs.push({
        id: 'no-buyers',
        type: 'opportunity',
        priority: 'high',
        title: 'Expand into New Markets',
        description: `These cities have demand but no registered cleaners. Prime opportunity for expansion.`,
        metric: `${noBuyers.reduce((sum, c) => sum + c.leads, 0)} untapped leads`,
        action: 'Launch cleaner onboarding campaign',
        cities: noBuyers.slice(0, 3).map(c => c.city)
      });
    }

    // Marketplace health recommendations
    if (marketplaceStats.expiredRate > 20) {
      recs.push({
        id: 'high-expiry',
        type: 'warning',
        priority: 'medium',
        title: 'Too Many Leads Expiring',
        description: `${marketplaceStats.expiredRate}% of leads expire before purchase. Need more active cleaners.`,
        metric: `${marketplaceStats.expiredRate}% expiry rate`,
        action: 'Increase cleaner marketing and reduce lead pricing'
      });
    }

    if (marketplaceStats.avgTimeToPurchase > 24) {
      recs.push({
        id: 'slow-purchase',
        type: 'action',
        priority: 'medium',
        title: 'Speed Up Lead Purchases',
        description: `Leads take ${marketplaceStats.avgTimeToPurchase} hours to sell. Consider email/push notifications.`,
        metric: `${marketplaceStats.avgTimeToPurchase}hr avg`,
        action: 'Implement instant lead alerts'
      });
    }

    if (marketplaceStats.purchaseRate < 25) {
      recs.push({
        id: 'low-purchase-rate',
        type: 'warning',
        priority: 'high',
        title: 'Overall Purchase Rate Too Low',
        description: `Only ${marketplaceStats.purchaseRate}% of leads get purchased. Balance supply and demand.`,
        metric: `${marketplaceStats.purchaseRate}% purchase rate`,
        action: 'Reduce lead generation or recruit more cleaners'
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [cityLeadStats, buyerCityStats, marketplaceStats]);

  const getIcon = (type: Recommendation['type']) => {
    switch (type) {
      case 'opportunity': return <Rocket className="w-5 h-5 text-blue-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'success': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'action': return <Target className="w-5 h-5 text-purple-500" />;
    }
  };

  const getPriorityBadge = (priority: Recommendation['priority']) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive">High Priority</Badge>;
      case 'medium': return <Badge variant="secondary">Medium</Badge>;
      case 'low': return <Badge variant="outline">Low</Badge>;
    }
  };

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Marketing Recommendations
          </CardTitle>
          <CardDescription>AI-powered suggestions based on your analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Not enough data for recommendations</p>
            <p className="text-sm">Recommendations will appear as more data is collected</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          Marketing Recommendations
        </CardTitle>
        <CardDescription>
          {recommendations.length} actionable insights based on your analytics data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendations.map((rec) => (
          <div 
            key={rec.id}
            className={cn(
              "p-4 rounded-lg border transition-colors hover:bg-muted/50",
              rec.type === 'warning' && "border-amber-500/30 bg-amber-500/5",
              rec.type === 'success' && "border-green-500/30 bg-green-500/5",
              rec.type === 'opportunity' && "border-blue-500/30 bg-blue-500/5",
              rec.type === 'action' && "border-purple-500/30 bg-purple-500/5"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{getIcon(rec.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="font-semibold">{rec.title}</h4>
                  {getPriorityBadge(rec.priority)}
                </div>
                <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                
                {rec.metric && (
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {rec.metric}
                    </Badge>
                  </div>
                )}
                
                {rec.cities && rec.cities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {rec.cities.map(city => (
                      <Badge key={city} variant="secondary" className="text-xs">
                        <MapPin className="w-3 h-3 mr-1" />
                        {city}
                      </Badge>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-sm font-medium text-secondary">
                  <ArrowRight className="w-4 h-4" />
                  {rec.action}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Quick Stats Summary */}
        <div className="mt-6 pt-4 border-t">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Market Health Summary
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-lg font-bold">{cityLeadStats.length}</p>
              <p className="text-xs text-muted-foreground">Active Cities</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-lg font-bold">
                {cityLeadStats.filter(c => c.purchaseRate >= 30).length}
              </p>
              <p className="text-xs text-muted-foreground">High-Converting</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-lg font-bold">
                {cityLeadStats.filter(c => c.leads >= 5 && c.purchaseRate < 20).length}
              </p>
              <p className="text-xs text-muted-foreground">Need Cleaners</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-lg font-bold">
                {cityLeadStats.filter(c => c.refundRate > 15).length}
              </p>
              <p className="text-xs text-muted-foreground">Quality Issues</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
