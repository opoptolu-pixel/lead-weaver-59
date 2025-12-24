import { Search, Users, MessageSquare, Sparkles } from "lucide-react";

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
    <section id="how-it-works" className="py-32 bg-background relative overflow-hidden">
      {/* Minimal background accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="container mx-auto px-4">
        {/* Section header - Apple-style minimal */}
        <div className="text-center mb-20">
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground tracking-tight">
            How It Works
          </h2>
          <p className="text-muted-foreground text-lg md:text-xl mt-6 max-w-md mx-auto font-light">
            Four simple steps to a cleaner home
          </p>
        </div>

        {/* Steps - Clean horizontal timeline */}
        <div className="max-w-6xl mx-auto">
          {/* Desktop: Horizontal layout with connecting line */}
          <div className="hidden lg:block relative">
            {/* Connecting line */}
            <div className="absolute top-12 left-[10%] right-[10%] h-px bg-border" />
            
            <div className="grid grid-cols-4 gap-8">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={index} className="relative text-center group">
                    {/* Number circle on the line */}
                    <div className="relative z-10 mx-auto mb-8">
                      <div className="w-24 h-24 rounded-full bg-background border-2 border-border flex items-center justify-center mx-auto transition-all duration-500 group-hover:border-foreground group-hover:shadow-[0_0_40px_rgba(0,0,0,0.08)]">
                        <Icon className="w-10 h-10 text-muted-foreground transition-colors duration-500 group-hover:text-foreground" />
                      </div>
                      {/* Step number badge */}
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs font-bold px-3 py-1 rounded-full">
                        {step.number}
                      </div>
                    </div>
                    
                    {/* Content */}
                    <h3 className="font-heading font-semibold text-lg text-foreground mb-3 tracking-tight">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed max-w-[200px] mx-auto font-light">
                      {step.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile/Tablet: Vertical layout */}
          <div className="lg:hidden space-y-0">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isLast = index === steps.length - 1;
              return (
                <div key={index} className="flex gap-6">
                  {/* Left side - Icon and line */}
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-background border-2 border-border flex items-center justify-center flex-shrink-0 relative">
                      <Icon className="w-7 h-7 text-foreground" />
                      <div className="absolute -bottom-1 -right-1 bg-foreground text-background text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                        {index + 1}
                      </div>
                    </div>
                    {/* Connecting line */}
                    {!isLast && (
                      <div className="w-px h-full min-h-[60px] bg-border" />
                    )}
                  </div>
                  
                  {/* Right side - Content */}
                  <div className="pb-12">
                    <h3 className="font-heading font-semibold text-lg text-foreground mb-2 tracking-tight">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed font-light">
                      {step.description}
                    </p>
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