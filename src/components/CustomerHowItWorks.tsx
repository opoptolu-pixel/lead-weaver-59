import { Search, Users, Calendar, ThumbsUp } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Tell Us What You Need",
    description: "Select your cleaning type and enter your postcode. It takes just 30 seconds.",
    color: "bg-secondary/20 text-secondary",
  },
  {
    icon: Users,
    title: "We Match You",
    description: "We connect you with a verified local cleaning partner who specialises in your service.",
    color: "bg-primary/20 text-primary",
  },
  {
    icon: Calendar,
    title: "Get Your Quote",
    description: "Your cleaning partner will contact you to discuss your needs and provide a quote.",
    color: "bg-accent/20 text-accent-foreground",
  },
  {
    icon: ThumbsUp,
    title: "Enjoy a Sparkling Home",
    description: "Book your clean and sit back while professionals handle everything.",
    color: "bg-secondary/20 text-secondary",
  },
];

export const CustomerHowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            How It Works
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Getting connected with a trusted cleaning partner has never been easier.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="relative">
                {/* Connector line (hidden on mobile and last item) */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-1/2 w-full h-0.5 bg-border" />
                )}
                
                <div className="relative text-center">
                  {/* Step number */}
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-secondary text-secondary-foreground text-sm font-bold flex items-center justify-center z-10">
                    {index + 1}
                  </div>
                  
                  {/* Icon */}
                  <div className={`w-24 h-24 rounded-2xl ${step.color} flex items-center justify-center mx-auto mb-6`}>
                    <Icon className="w-10 h-10" />
                  </div>
                  
                  {/* Content */}
                  <h3 className="font-heading font-semibold text-lg text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
