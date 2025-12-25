import { Search, Users, MessageSquare, Sparkles } from "lucide-react";
import { ScrollReveal } from "@/components/ScrollReveal";

const steps = [
  {
    icon: Search,
    number: "01",
    title: "Tell Us What You Need",
    description: "Select your cleaning type and enter your postcode. It takes just 30 seconds.",
  },
  {
    icon: Users,
    number: "02",
    title: "We Match You",
    description: "We connect you with a verified local cleaning partner who specialises in your service.",
  },
  {
    icon: MessageSquare,
    number: "03",
    title: "Get Your Quote",
    description: "Your cleaning partner will contact you to discuss your needs and provide a quote.",
  },
  {
    icon: Sparkles,
    number: "04",
    title: "Enjoy a Sparkling Home",
    description: "Book your clean and sit back while professionals handle everything.",
  },
];

export const CustomerHowItWorks = () => {
  return (
    <section id="how-it-works" className="py-28 bg-muted/30 relative overflow-hidden" aria-labelledby="how-it-works-heading">
      {/* Subtle background elements */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        {/* Section header */}
        <ScrollReveal animation="fade-up">
          <div className="text-center mb-20">
            <span className="inline-block text-sm font-semibold text-secondary uppercase tracking-wider mb-3">
              Simple 4-Step Process
            </span>
            <h2 id="how-it-works-heading" className="font-heading text-3xl md:text-5xl font-bold text-foreground tracking-tight">
              How to Find a Cleaner
            </h2>
            <p className="text-muted-foreground text-lg mt-4 max-w-md mx-auto">
              Get matched with verified cleaning professionals in minutes
            </p>
          </div>
        </ScrollReveal>

        {/* Desktop: Horizontal cards with brand styling */}
        <div className="hidden lg:block max-w-6xl mx-auto">
          <div className="grid grid-cols-4 gap-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isLast = index === steps.length - 1;
              return (
                <ScrollReveal key={index} animation="fade-up" delay={index * 100}>
                  <div className="relative group h-full">
                    {/* Arrow connector */}
                    {!isLast && (
                      <div className="absolute top-14 -right-3 z-10">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-secondary">
                          <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                    
                    {/* Card */}
                    <div className="relative bg-background rounded-2xl p-6 border border-border shadow-card transition-all duration-300 group-hover:shadow-elevated group-hover:border-secondary/30 group-hover:-translate-y-1 h-full">
                      {/* Step number badge */}
                      <div className="absolute -top-3 left-6 bg-secondary text-secondary-foreground text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                        Step {step.number}
                      </div>
                      
                      {/* Icon container - Navy/Primary color from hero */}
                      <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mt-4 mb-5 transition-transform duration-300 group-hover:scale-105 shadow-lg">
                        <Icon className="w-7 h-7 text-primary-foreground" />
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
                </ScrollReveal>
              );
            })}
          </div>
        </div>

        {/* Mobile/Tablet: Vertical timeline */}
        <div className="lg:hidden max-w-md mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isLast = index === steps.length - 1;
            return (
              <ScrollReveal key={index} animation="fade-left" delay={index * 100}>
                <div className="flex gap-5">
                  {/* Left: Icon and line */}
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-lg">
                      <Icon className="w-7 h-7 text-primary-foreground" />
                    </div>
                    {!isLast && (
                      <div className="w-0.5 h-full min-h-[40px] bg-secondary/30 my-2" />
                    )}
                  </div>
                  
                  {/* Right: Content */}
                  <div className="pb-10">
                    <span className="inline-block text-xs font-bold text-secondary uppercase tracking-wider mb-1">
                      Step {step.number}
                    </span>
                    <h3 className="font-heading font-bold text-lg text-foreground mb-2">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};
