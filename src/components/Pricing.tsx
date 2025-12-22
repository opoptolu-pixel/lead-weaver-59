import { Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  "Every lead is just £20",
  "Full customer contact details",
  "Exclusive leads — no competition",
  "WhatsApp + Email delivery",
  "No monthly subscriptions",
  "No hidden fees",
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
            Flat £20 Per Lead
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            No monthly subscriptions. No hidden fees. Every lead costs just £20 — simple as that.
          </p>
        </div>

        <div className="max-w-lg mx-auto">
          <div className="relative rounded-2xl p-8 bg-primary text-primary-foreground shadow-elevated border-2 border-secondary">
            {/* Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-secondary text-secondary-foreground text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full">
                One Simple Price
              </span>
            </div>

            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4 bg-secondary/20">
                <Zap className="w-7 h-7 text-secondary" />
              </div>
              <h3 className="font-heading text-xl font-bold mb-2">Pay As You Go</h3>
              <p className="text-sm text-primary-foreground/70">
                Only pay for the leads you want
              </p>
            </div>

            {/* Price */}
            <div className="text-center mb-8">
              <div className="flex items-baseline justify-center gap-1">
                <span className="font-heading text-5xl font-bold">£20</span>
              </div>
              <span className="text-sm text-primary-foreground/70">
                per lead — all leads, every time
              </span>
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-8">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-secondary/20">
                    <Check className="w-3 h-3 text-secondary" />
                  </div>
                  <span className="text-sm text-primary-foreground/90">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Button
              variant="hero"
              className="w-full"
              size="lg"
              onClick={() => document.getElementById("registration")?.scrollIntoView({ behavior: "smooth" })}
            >
              Start Receiving Leads
            </Button>
          </div>
        </div>

        {/* Trust message */}
        <p className="text-center text-muted-foreground mt-8 max-w-md mx-auto">
          All leads are <span className="text-secondary font-semibold">£20</span> — no hidden fees, no variable pricing.
        </p>
      </div>
    </section>
  );
};
