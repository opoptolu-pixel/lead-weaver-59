import { Link } from "react-router-dom";
import {
  Sparkles,
  Home,
  Truck,
  Sofa,
  Layers,
  Building2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  {
    icon: Sparkles,
    title: "Deep Cleaning",
    description: "Thorough cleaning of your entire home, including hard-to-reach areas.",
    gradient: "from-emerald-500 to-teal-600",
    bgLight: "bg-emerald-50 dark:bg-emerald-950/30",
    id: "deep-clean",
  },
  {
    icon: Home,
    title: "End of Tenancy",
    description: "Professional cleaning to help you get your deposit back.",
    gradient: "from-indigo-500 to-blue-600",
    bgLight: "bg-indigo-50 dark:bg-indigo-950/30",
    id: "end-of-tenancy",
  },
  {
    icon: Layers,
    title: "Carpet Cleaning",
    description: "Deep carpet cleaning to remove stains and refresh your floors.",
    gradient: "from-amber-500 to-orange-600",
    bgLight: "bg-amber-50 dark:bg-amber-950/30",
    id: "carpet-cleaning",
  },
  {
    icon: Sofa,
    title: "Sofa & Upholstery",
    description: "Revive your furniture with professional upholstery cleaning.",
    gradient: "from-violet-500 to-purple-600",
    bgLight: "bg-violet-50 dark:bg-violet-950/30",
    id: "sofa-cleaning",
  },
  {
    icon: Truck,
    title: "Move-In / Move-Out",
    description: "Start fresh in your new home with a complete clean.",
    gradient: "from-rose-500 to-pink-600",
    bgLight: "bg-rose-50 dark:bg-rose-950/30",
    id: "move-in-out",
  },
  {
    icon: Building2,
    title: "Commercial Cleaning",
    description: "Keep your office or business premises spotless.",
    gradient: "from-cyan-500 to-blue-600",
    bgLight: "bg-cyan-50 dark:bg-cyan-950/30",
    id: "office-cleaning",
  },
];

export const CustomerServicesGrid = () => {
  return (
    <section id="services" className="py-24 bg-muted/30 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-50">
        <div className="absolute top-20 -left-20 w-72 h-72 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block text-sm font-semibold text-secondary uppercase tracking-wider mb-3">
            What We Offer
          </span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-foreground mb-4">
            Our Cleaning Services
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Whatever cleaning you need, we have trusted professionals ready to help
          </p>
        </div>

        {/* Services grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <Link
                key={index}
                to={`/request-cleaning?type=${service.id}`}
                className="group relative"
              >
                {/* Card */}
                <div className={`relative h-full ${service.bgLight} rounded-3xl p-8 border border-transparent transition-all duration-500 group-hover:border-secondary/20 group-hover:shadow-2xl group-hover:-translate-y-2`}>
                  {/* Gradient accent line */}
                  <div className={`absolute top-0 left-8 right-8 h-1 bg-gradient-to-r ${service.gradient} rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  
                  {/* Icon */}
                  <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${service.gradient} flex items-center justify-center mb-6 shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                    <Icon className="w-8 h-8 text-white" />
                    {/* Icon glow */}
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${service.gradient} blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-500`} />
                  </div>
                  
                  {/* Content */}
                  <h3 className="font-heading font-bold text-xl text-foreground mb-3 transition-colors duration-300 group-hover:text-secondary">
                    {service.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {service.description}
                  </p>
                  
                  {/* CTA */}
                  <div className="flex items-center gap-2 text-secondary font-medium">
                    <span className="relative">
                      Get a Quote
                      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-secondary transition-all duration-300 group-hover:w-full" />
                    </span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-muted-foreground mb-6">
            Not sure which service you need?
          </p>
          <Link to="/request-cleaning">
            <Button variant="cta" size="lg" className="shadow-lg hover:shadow-xl transition-shadow">
              Get a Free Quote
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};
