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
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div key={index} className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
