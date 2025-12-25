import { ShieldCheck, Clock, BadgeCheck, Headphones } from "lucide-react";

const benefits = [
  {
    icon: ShieldCheck,
    title: "Verified Cleaners",
    description: "All cleaners are vetted and verified before joining our network.",
  },
  {
    icon: Clock,
    title: "Quick Response",
    description: "Receive quotes within 24 hours from local professionals.",
  },
  {
    icon: BadgeCheck,
    title: "Quality Guaranteed",
    description: "Only experienced professionals with proven track records.",
  },
  {
    icon: Headphones,
    title: "Customer Support",
    description: "Our team is here to help every step of the way.",
  },
];

export const TrustSection = () => {
  return (
    <section className="relative py-20 bg-background border-b border-border z-0">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-14 animate-fade-in">
          <span className="inline-block text-sm font-semibold text-secondary uppercase tracking-wider mb-3">
            Why Choose Us
          </span>
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
            Trusted by Thousands
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 max-w-6xl mx-auto">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div 
                key={index} 
                className="group text-center animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-5 transition-transform duration-300 group-hover:scale-110 shadow-lg">
                  <Icon className="w-8 h-8 text-primary-foreground" />
                </div>
                
                {/* Content */}
                <h3 className="font-heading font-bold text-lg text-foreground mb-2">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-[220px] mx-auto">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
