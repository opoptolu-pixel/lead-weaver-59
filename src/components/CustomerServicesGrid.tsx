import { Link } from "react-router-dom";
import {
  Sparkles,
  Home,
  Truck,
  Sofa,
  Layers,
  Building2,
  BedDouble,
  Droplets,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Services matching request cleaning page bundles
const services = [
  {
    icon: Layers,
    title: "Carpet Cleaning (2-3 Rooms)",
    description: "Professional deep carpet cleaning for multiple rooms.",
    id: "carpet-2-3-rooms",
  },
  {
    icon: Sofa,
    title: "Sofa + Carpet Cleaning",
    description: "Complete upholstery and carpet cleaning bundle.",
    id: "sofa-carpet",
  },
  {
    icon: BedDouble,
    title: "Sofa + Mattress Cleaning",
    description: "Refresh your living room and bedroom essentials.",
    id: "sofa-mattress",
  },
  {
    icon: Droplets,
    title: "Carpet + Mattress Cleaning",
    description: "Deep clean your floors and sleeping surfaces.",
    id: "carpet-mattress",
  },
  {
    icon: Sparkles,
    title: "Deep Clean (3+ Rooms)",
    description: "Thorough cleaning of your entire home.",
    id: "3-rooms-deep-clean",
  },
  {
    icon: Home,
    title: "End of Tenancy Clean",
    description: "Professional cleaning to help you get your deposit back.",
    id: "end-of-tenancy",
  },
  {
    icon: Building2,
    title: "Airbnb / Short-Let Refresh",
    description: "Quick turnaround cleaning for rental properties.",
    id: "airbnb-refresh",
  },
  {
    icon: Truck,
    title: "Move-In / Move-Out Clean",
    description: "Start fresh in your new home with a complete clean.",
    id: "move-in-out",
  },
  {
    icon: Layers,
    title: "Post-Tenancy Carpet & Upholstery",
    description: "Restore carpets and furniture after tenancy.",
    id: "post-tenancy-upholstery",
  },
  {
    icon: Sparkles,
    title: "One-Off Deep Clean",
    description: "A single comprehensive clean for your home.",
    id: "one-off-deep",
  },
  {
    icon: Building2,
    title: "Office Carpet + Upholstery",
    description: "Professional cleaning for commercial spaces.",
    id: "office-carpet-upholstery",
  },
  {
    icon: Truck,
    title: "Post-Construction Deep Clean",
    description: "Remove dust and debris after renovation work.",
    id: "post-construction",
  },
  {
    icon: Home,
    title: "Large Property Window + Interior",
    description: "Complete cleaning for larger homes.",
    id: "large-window-interior",
  },
  {
    icon: Sofa,
    title: "Multi-Room + Upholstery Deep Clean",
    description: "Comprehensive cleaning for multiple rooms and furniture.",
    id: "multi-room-upholstery",
  },
];

export const CustomerServicesGrid = () => {
  return (
    <section id="services" className="py-28 bg-background relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl translate-y-1/2" />
      </div>

      <div className="container mx-auto px-4 relative">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block text-sm font-semibold text-secondary uppercase tracking-wider mb-3">
            What We Offer
          </span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Our Cleaning Services
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Whatever cleaning you need, we have trusted professionals ready to help
          </p>
        </div>

        {/* Services grid - Premium card design with navy icons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 max-w-7xl mx-auto">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <Link
                key={index}
                to={`/request-cleaning?type=${service.id}`}
                className="group"
              >
                <div className="relative h-full bg-card rounded-2xl p-6 border border-border shadow-card transition-all duration-300 group-hover:shadow-elevated group-hover:border-secondary/40 group-hover:-translate-y-1 overflow-hidden">
                  {/* Hover gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  <div className="relative">
                    {/* Icon - Navy/Primary color from hero */}
                    <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 shadow-lg">
                      <Icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                    
                    {/* Content */}
                    <h3 className="font-heading font-bold text-base text-foreground mb-2 group-hover:text-secondary transition-colors duration-300">
                      {service.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                      {service.description}
                    </p>
                    
                    {/* CTA */}
                    <div className="flex items-center gap-1.5 text-secondary text-sm font-semibold">
                      <span>Get Quote</span>
                      <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
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
            <Button variant="cta" size="lg" className="shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
              Get a Free Quote
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};
