import { Check, Zap, Package, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

const pricingTiers = [
  {
    name: "Pay As You Go",
    icon: Zap,
    description: "Perfect for getting started",
    price: "£20-£50",
    priceLabel: "per lead",
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
    name: "Credit Bundle",
    icon: Package,
    description: "Best value for regular cleaners",
    price: "£100",
    priceLabel: "for 5 leads",
    saveLabel: "Save 20%",
    features: [
      "5 lead credits",
      "Only £20 per lead",
      "Priority lead access",
      "Credits never expire",
      "WhatsApp + Email delivery",
    ],
    cta: "Buy Credits",
    popular: true,
  },
  {
    name: "Pro Bundle",
    icon: Crown,
    description: "For growing cleaning businesses",
    price: "£175",
    priceLabel: "for 10 leads",
    saveLabel: "Save 30%",
    features: [
      "10 lead credits",
      "Only £17.50 per lead",
      "First access to new leads",
      "Credits never expire",
      "All delivery channels",
      "Priority support",
    ],
    cta: "Go Pro",
    popular: false,
  },
];

export const Pricing = () => {
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
            No monthly subscriptions. No hidden fees. Only pay for the leads you choose to unlock.
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
                onClick={() => document.getElementById("registration")?.scrollIntoView({ behavior: "smooth" })}
              >
                {tier.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
