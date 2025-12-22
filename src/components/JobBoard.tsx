import { Lock, MapPin, Calendar, PoundSterling } from "lucide-react";
import { Button } from "@/components/ui/button";

const sampleLeads = [
  {
    postcode: "M14",
    jobType: "Carpet + Sofa",
    value: "£120",
    date: "24 Dec 2025",
    unlockPrice: "£25",
  },
  {
    postcode: "SW9",
    jobType: "End of Tenancy",
    value: "£180",
    date: "26 Dec 2025",
    unlockPrice: "£40",
  },
  {
    postcode: "OL2",
    jobType: "Mattress + 1 Room",
    value: "£90",
    date: "28 Dec 2025",
    unlockPrice: "£20",
  },
  {
    postcode: "M9",
    jobType: "Lounge Carpet Only",
    value: "£55",
    date: "25 Dec 2025",
    unlockPrice: "£15",
  },
];

export const JobBoard = () => {
  return (
    <section id="job-board" className="py-20 lg:py-28 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-4">
            Live Job Board
          </span>
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Sample Leads Available Now
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Here's a preview of the type of leads you'll see. Join to access real leads in your area.
          </p>
        </div>

        {/* Desktop table view */}
        <div className="hidden md:block max-w-5xl mx-auto">
          <div className="bg-card rounded-2xl shadow-elevated overflow-hidden border border-border">
            {/* Table header */}
            <div className="grid grid-cols-5 gap-4 bg-primary text-primary-foreground px-6 py-4 font-heading font-semibold text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Postcode
              </div>
              <div>Job Type</div>
              <div className="flex items-center gap-2">
                <PoundSterling className="w-4 h-4" />
                Value
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Date
              </div>
              <div className="text-center">Action</div>
            </div>

            {/* Table rows */}
            {sampleLeads.map((lead, index) => (
              <div
                key={index}
                className={`grid grid-cols-5 gap-4 px-6 py-5 items-center transition-colors hover:bg-muted/50 ${
                  index !== sampleLeads.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="font-semibold text-foreground bg-muted rounded-lg px-3 py-1 inline-block w-fit">
                  {lead.postcode}
                </div>
                <div className="text-foreground font-medium">{lead.jobType}</div>
                <div className="text-secondary font-bold text-lg">{lead.value}</div>
                <div className="text-muted-foreground">{lead.date}</div>
                <div className="text-center">
                  <Button variant="unlock" size="sm" className="gap-2">
                    <Lock className="w-4 h-4" />
                    Unlock for {lead.unlockPrice}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile card view */}
        <div className="md:hidden space-y-4 max-w-md mx-auto">
          {sampleLeads.map((lead, index) => (
            <div
              key={index}
              className="bg-card rounded-xl p-5 shadow-card border border-border"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="inline-block bg-muted text-foreground font-semibold rounded-lg px-3 py-1 text-sm mb-2">
                    {lead.postcode}
                  </span>
                  <h3 className="font-semibold text-foreground">{lead.jobType}</h3>
                </div>
                <div className="text-right">
                  <p className="text-secondary font-bold text-xl">{lead.value}</p>
                  <p className="text-muted-foreground text-sm">{lead.date}</p>
                </div>
              </div>
              <Button variant="unlock" className="w-full gap-2">
                <Lock className="w-4 h-4" />
                Unlock for {lead.unlockPrice}
              </Button>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            Want access to real leads in your area?
          </p>
          <Button 
            variant="cta" 
            size="lg"
            onClick={() => document.getElementById("registration")?.scrollIntoView({ behavior: "smooth" })}
          >
            Join Deep Clean UK Today
          </Button>
        </div>
      </div>
    </section>
  );
};
