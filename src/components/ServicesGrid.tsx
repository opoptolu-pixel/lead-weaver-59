import { 
  Sparkles, 
  Home,
  Truck,
  Droplets,
  Sofa,
  BedDouble,
  Building2,
  Layers
} from "lucide-react";
import { cn } from "@/lib/utils";

// Phase 1 + Phase 2 Job Types - Bundled jobs that exceed £100
const serviceCategories = [
  // Phase 1 - Core Services (£100+)
  { id: "carpet-2-3-rooms", label: "Carpet Cleaning (2–3 Rooms)", icon: Layers, color: "bg-amber-100 text-amber-600", value: "from £100", phase: 1 },
  { id: "sofa-carpet", label: "Sofa + Carpet Cleaning", icon: Sofa, color: "bg-violet-100 text-violet-600", value: "from £120", phase: 1 },
  { id: "sofa-mattress", label: "Sofa + Mattress Cleaning", icon: BedDouble, color: "bg-rose-100 text-rose-600", value: "from £100", phase: 1 },
  { id: "carpet-mattress", label: "Carpet + Mattress Cleaning", icon: Droplets, color: "bg-sky-100 text-sky-600", value: "from £110", phase: 1 },
  { id: "3-rooms-deep-clean", label: "Deep Clean (3+ Rooms)", icon: Sparkles, color: "bg-emerald-100 text-emerald-600", value: "from £140", phase: 1 },
  { id: "end-of-tenancy", label: "End of Tenancy Clean", icon: Home, color: "bg-indigo-100 text-indigo-600", value: "from £150", phase: 1 },
  { id: "airbnb-refresh", label: "Airbnb / Short-Let Refresh", icon: Building2, color: "bg-teal-100 text-teal-600", value: "from £130", phase: 1 },
  { id: "move-in-out", label: "Move-In / Move-Out Clean", icon: Truck, color: "bg-orange-100 text-orange-600", value: "from £140", phase: 1 },
  { id: "post-tenancy-upholstery", label: "Post-Tenancy Carpet & Upholstery", icon: Layers, color: "bg-pink-100 text-pink-600", value: "from £120", phase: 1 },
  { id: "one-off-deep", label: "One-Off Deep Clean", icon: Sparkles, color: "bg-cyan-100 text-cyan-600", value: "from £100", phase: 1 },
  // Phase 2 - Commercial & Specialist (£120+)
  { id: "office-carpet-upholstery", label: "Office Carpet + Upholstery Clean", icon: Building2, color: "bg-blue-100 text-blue-600", value: "from £150", phase: 2 },
  { id: "post-construction", label: "Post-Construction Deep Clean", icon: Truck, color: "bg-slate-100 text-slate-600", value: "from £200", phase: 2 },
  { id: "large-window-interior", label: "Large Property Window + Interior", icon: Home, color: "bg-sky-100 text-sky-600", value: "from £180", phase: 2 },
  { id: "multi-room-upholstery", label: "Multi-Room + Upholstery Deep Clean", icon: Sofa, color: "bg-purple-100 text-purple-600", value: "from £160", phase: 2 },
];

export const ServicesGrid = () => {
  return (
    <section className="py-16 lg:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Job Categories
          </span>
          <h2 className="font-heading text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Types of Jobs You'll Receive
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            All leads are high-value cleaning jobs worth £100+. Here's what our homeowners are looking for:
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {serviceCategories.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.id}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl bg-background border border-border/50",
                  "hover:border-primary/30 hover:shadow-md transition-all duration-200"
                )}
              >
                <div className={cn("p-2.5 rounded-lg shrink-0", service.color)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm leading-tight truncate">
                    {service.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {service.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Note */}
        <p className="text-center text-muted-foreground text-sm mt-8">
          All jobs are pre-qualified and verified before being listed. Each lead costs just £20 to unlock.
        </p>
      </div>
    </section>
  );
};
