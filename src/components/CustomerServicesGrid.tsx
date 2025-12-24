import { Link } from "react-router-dom";
import {
  Sparkles,
  Home,
  Truck,
  Sofa,
  BedDouble,
  Building2,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  {
    icon: Sparkles,
    title: "Deep Cleaning",
    description: "Thorough cleaning of your entire home, including hard-to-reach areas.",
    color: "bg-emerald-100 text-emerald-600",
    id: "deep-clean",
  },
  {
    icon: Home,
    title: "End of Tenancy",
    description: "Professional cleaning to help you get your deposit back.",
    color: "bg-indigo-100 text-indigo-600",
    id: "end-of-tenancy",
  },
  {
    icon: Layers,
    title: "Carpet Cleaning",
    description: "Deep carpet cleaning to remove stains and refresh your floors.",
    color: "bg-amber-100 text-amber-600",
    id: "carpet-cleaning",
  },
  {
    icon: Sofa,
    title: "Sofa & Upholstery",
    description: "Revive your furniture with professional upholstery cleaning.",
    color: "bg-violet-100 text-violet-600",
    id: "sofa-cleaning",
  },
  {
    icon: Truck,
    title: "Move-In / Move-Out",
    description: "Start fresh in your new home with a complete clean.",
    color: "bg-orange-100 text-orange-600",
    id: "move-in-out",
  },
  {
    icon: Building2,
    title: "Commercial Cleaning",
    description: "Keep your office or business premises spotless.",
    color: "bg-teal-100 text-teal-600",
    id: "office-cleaning",
  },
];

export const CustomerServicesGrid = () => {
  return (
    <section id="services" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            Our Cleaning Services
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Whatever cleaning you need, we have trusted professionals ready to help.
          </p>
        </div>

        {/* Services grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <Link
                key={index}
                to={`/request-cleaning?type=${service.id}`}
                className="group p-6 bg-card rounded-2xl border border-border hover:border-secondary hover:shadow-lg transition-all duration-300"
              >
                <div className={`w-14 h-14 rounded-xl ${service.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="font-heading font-semibold text-lg text-foreground mb-2 group-hover:text-secondary transition-colors">
                  {service.title}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {service.description}
                </p>
                <span className="inline-flex items-center text-sm font-medium text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                  Get Quotes <ArrowRight className="w-4 h-4 ml-1" />
                </span>
              </Link>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Link to="/request-cleaning">
            <Button variant="cta" size="lg">
              Get a Free Quote
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};
