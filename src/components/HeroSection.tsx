import { MapPin, Sparkles, Banknote, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Sparkles,
    text: "Exclusive deep cleaning leads",
  },
  {
    icon: MapPin,
    text: "Postcode-targeted jobs",
  },
  {
    icon: Banknote,
    text: "Only pay for what you unlock",
  },
  {
    icon: Clock,
    text: "No monthly fees — pay-per-lead only",
  },
];

export const HeroSection = () => {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-[90vh] bg-hero-gradient overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-10 w-72 h-72 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative container mx-auto px-4 py-20 lg:py-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-secondary/20 backdrop-blur-sm border border-secondary/30 rounded-full px-4 py-2 mb-8 animate-slide-up">
            <Sparkles className="w-4 h-4 text-secondary" />
            <span className="text-secondary-foreground text-sm font-medium">
              UK's #1 Cleaning Lead Platform
            </span>
          </div>

          {/* Main headline */}
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6 leading-tight animate-slide-up stagger-1">
            Want More Cleaning Jobs{" "}
            <span className="text-secondary">in Your Area?</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-primary-foreground/80 mb-10 max-w-2xl mx-auto animate-slide-up stagger-2">
            Join Deep Clean UK and access exclusive deep cleaning job requests from real homeowners. 
            Get leads delivered straight to your phone.
          </p>

          {/* Feature bullets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto mb-10 animate-slide-up stagger-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-3 text-left bg-primary-foreground/5 backdrop-blur-sm rounded-lg px-4 py-3 border border-primary-foreground/10"
              >
                <feature.icon className="w-5 h-5 text-secondary flex-shrink-0" />
                <span className="text-primary-foreground text-sm font-medium">
                  {feature.text}
                </span>
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up stagger-4">
            <Button 
              variant="hero" 
              size="xl"
              onClick={() => scrollToSection("registration")}
            >
              Join Now – Start Receiving Leads
            </Button>
            <Button 
              variant="outlineHero" 
              size="xl"
              onClick={() => scrollToSection("job-board")}
            >
              See Sample Leads
            </Button>
          </div>

          {/* Trust indicator */}
          <p className="mt-8 text-primary-foreground/60 text-sm animate-fade-in stagger-4">
            ✓ No signup fees &nbsp;&nbsp; ✓ Cancel anytime &nbsp;&nbsp; ✓ Exclusive leads only
          </p>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" className="w-full h-auto">
          <path
            d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            fill="hsl(var(--background))"
          />
        </svg>
      </div>
    </section>
  );
};
