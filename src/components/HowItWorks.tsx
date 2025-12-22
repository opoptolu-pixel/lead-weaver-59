import { Eye, CreditCard, Phone } from "lucide-react";

const steps = [
  {
    icon: Eye,
    number: "01",
    title: "View Job Details",
    description: "See job type, estimated value & postcode area before committing.",
  },
  {
    icon: CreditCard,
    number: "02",
    title: "Pay to Unlock",
    description: "Pay a small fee to access full customer contact details.",
  },
  {
    icon: Phone,
    number: "03",
    title: "Win the Job",
    description: "Contact the customer directly and complete the work.",
  },
];

export const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-4">
            Simple Process
          </span>
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            How It Works
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Get more cleaning jobs in three simple steps. No complicated contracts, 
            no monthly fees — just pay for the leads you want.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div key={index} className="relative group">
              {/* Connection line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-[60%] w-full h-[2px] bg-gradient-to-r from-secondary/50 to-secondary/10" />
              )}
              
              <div className="relative bg-card rounded-2xl p-8 shadow-card hover:shadow-elevated transition-all duration-300 border border-border hover:border-secondary/30">
                {/* Step number */}
                <span className="absolute -top-4 -right-4 w-12 h-12 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center font-heading font-bold text-lg shadow-lg">
                  {step.number}
                </span>

                {/* Icon */}
                <div className="w-16 h-16 bg-green-light rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <step.icon className="w-8 h-8 text-secondary" />
                </div>

                <h3 className="font-heading text-xl font-bold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Guarantee badge */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-3 bg-green-light border border-secondary/20 rounded-full px-6 py-3">
            <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-secondary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-foreground font-semibold">
              All leads are <span className="text-secondary">exclusive</span> — once unlocked, it's yours only
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
