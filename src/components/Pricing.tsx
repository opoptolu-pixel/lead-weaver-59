import { useState } from "react";
import { Check, Zap, Package, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { trackCTAClick, trackInitiateCheckout } from "@/lib/analytics";

const pricingTiers = [
  {
    name: "Pay As You Go",
    icon: Zap,
    description: "Perfect for getting started",
    price: "£12",
    priceLabel: "per lead",
    priceId: "price_1THCAEHaP2wEKuykuJrsMvtC",
    features: [
      "No upfront commitment",
      "Pay only for leads you want",
      "Full customer contact details",
      "WhatsApp delivery",
    ],
    cta: "Start Now",
    popular: false,
  },
  {
    name: "5 Lead Bundle",
    icon: Package,
    description: "Best value for regular cleaners",
    price: "£50",
    priceLabel: "for 5 leads",
    priceId: "price_1THCDaHaP2wEKuykfK8DIdJD",
    saveLabel: "Save £10",
    features: [
      "5 lead credits",
      "Only £10 per lead",
      "Priority lead access",
      "Credits never expire",
      "WhatsApp + Email delivery",
    ],
    cta: "Buy 5 Leads",
    popular: true,
  },
  {
    name: "10 Lead Bundle",
    icon: Crown,
    description: "For growing cleaning businesses",
    price: "£90",
    priceLabel: "for 10 leads",
    priceId: "price_1THCDsHaP2wEKuyk10drGMnB",
    saveLabel: "Save £30",
    features: [
      "10 lead credits",
      "Only £9 per lead",
      "First access to new leads",
      "Credits never expire",
      "All delivery channels",
      "Priority support",
    ],
    cta: "Buy 10 Leads",
    popular: false,
  },
];

export const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handlePurchase = async (tier: typeof pricingTiers[0]) => {
    // If user is not logged in, redirect to auth with return URL
    if (!user) {
      navigate(`/auth?redirect=/billing&tier=${tier.name}`);
      return;
    }

    setLoadingTier(tier.name);

    try {
      const { data, error } = await supabase.functions.invoke("buy-credits", {
        body: { priceId: tier.priceId },
      });

      if (error) throw error;

      if (data?.url) {
        trackCTAClick(tier.cta, "pricing_section");
        trackInitiateCheckout({ contentName: tier.name, contentCategory: 'credits', value: parseFloat(tier.price.replace('£', '')) });
        if (window.fbq) {
          window.fbq('track', 'InitiateCheckout', {
            content_name: tier.name,
            content_category: 'credits',
            value: parseFloat(tier.price.replace('£', '')),
            currency: 'GBP',
          });
        }
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      toast({
        title: "Payment Error",
        description: "Failed to initiate payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <section id="pricing" className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-4">
            Simple Pricing
          </span>
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Pricing & Lead Credits
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            All leads are a flat £12 — no hidden fees. Save more with bundles.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingTiers.map((tier, index) => (
            <div
              key={index}
              className={`relative rounded-2xl p-8 transition-all duration-300 ${
                tier.popular
                  ? "bg-primary text-primary-foreground shadow-elevated scale-105 border-2 border-secondary"
                  : "bg-card text-card-foreground shadow-card border border-border hover:border-secondary/30 hover:shadow-elevated"
              }`}
            >
              {/* Popular badge */}
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-secondary text-secondary-foreground text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Header */}
              <div className="text-center mb-8">
                <div className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4 ${
                  tier.popular ? "bg-secondary/20" : "bg-green-light"
                }`}>
                  <tier.icon className={`w-7 h-7 ${tier.popular ? "text-secondary" : "text-secondary"}`} />
                </div>
                <h3 className="font-heading text-xl font-bold mb-2">{tier.name}</h3>
                <p className={`text-sm ${tier.popular ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {tier.description}
                </p>
              </div>

              {/* Price */}
              <div className="text-center mb-8">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="font-heading text-4xl font-bold">{tier.price}</span>
                </div>
                <span className={`text-sm ${tier.popular ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {tier.priceLabel}
                </span>
                {tier.saveLabel && (
                  <div className="mt-2">
                    <span className="bg-secondary/20 text-secondary text-xs font-bold px-3 py-1 rounded-full">
                      {tier.saveLabel}
                    </span>
                  </div>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, fIndex) => (
                  <li key={fIndex} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      tier.popular ? "bg-secondary/20" : "bg-green-light"
                    }`}>
                      <Check className="w-3 h-3 text-secondary" />
                    </div>
                    <span className={`text-sm ${tier.popular ? "text-primary-foreground/90" : "text-foreground"}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                variant={tier.popular ? "hero" : "cta"}
                className="w-full"
                size="lg"
                onClick={() => handlePurchase(tier)}
                disabled={loadingTier === tier.name}
              >
                {loadingTier === tier.name ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  tier.cta
                )}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};