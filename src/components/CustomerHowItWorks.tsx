import { Search, Users, MessageSquare, Sparkles } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Tell Us What You Need",
    description: "Select your cleaning type and enter your postcode. It takes just 30 seconds.",
    gradient: "from-amber-500 to-orange-500",
    bgGlow: "bg-amber-500/20",
  },
  {
    icon: Users,
    title: "We Match You",
    description: "We connect you with a verified local cleaning partner who specialises in your service.",
    gradient: "from-blue-500 to-indigo-500",
    bgGlow: "bg-blue-500/20",
  },
  {
    icon: MessageSquare,
    title: "Get Your Quote",
    description: "Your cleaning partner will contact you to discuss your needs and provide a quote.",
    gradient: "from-emerald-500 to-teal-500",
    bgGlow: "bg-emerald-500/20",
  },
  {
    icon: Sparkles,
    title: "Enjoy a Sparkling Home",
    description: "Book your clean and sit back while professionals handle everything.",
    gradient: "from-violet-500 to-purple-500",
    bgGlow: "bg-violet-500/20",
  },
];

export const CustomerHowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 bg-background relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        {/* Section header */}
        <div className="text-center mb-20">
          <span className="inline-block text-sm font-semibold text-secondary uppercase tracking-wider mb-3">
            Simple Process
          </span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-foreground mb-4">
            How It Works
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Four simple steps to a cleaner home
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div 
                  key={index} 
                  className="relative group"
                >
                  {/* Connector arrow (desktop only) */}
                  {index < steps.length - 1 && (
                    <div className="hidden lg:flex absolute top-16 -right-2 z-10 text-border">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                  
                  {/* Card */}
                  <div className="relative bg-card border border-border rounded-2xl p-6 h-full transition-all duration-300 hover:shadow-xl hover:border-secondary/30 hover:-translate-y-1">
                    {/* Glow effect on hover */}
                    <div className={`absolute inset-0 ${step.bgGlow} rounded-2xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-300`} />
                    
                    <div className="relative">
                      {/* Step badge */}
                      <div className="flex items-center gap-3 mb-5">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Step {index + 1}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      
                      {/* Icon with gradient background */}
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mb-5 shadow-lg`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      
                      {/* Content */}
                      <h3 className="font-heading font-bold text-lg text-foreground mb-2">
                        {step.title}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
