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
    <section className="py-20 bg-primary relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-secondary/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        {/* Section header */}
        <div className="text-center mb-14">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-primary-foreground">
            Why Choose Us
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div 
                key={index} 
                className="group text-center"
              >
                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-5 transition-all duration-300 group-hover:bg-secondary group-hover:border-secondary group-hover:scale-110">
                  <Icon className="w-8 h-8 text-secondary transition-colors duration-300 group-hover:text-secondary-foreground" />
                </div>
                
                {/* Content */}
                <h3 className="font-heading font-bold text-lg text-primary-foreground mb-2">
                  {benefit.title}
                </h3>
                <p className="text-primary-foreground/70 text-sm leading-relaxed max-w-[200px] mx-auto">
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
