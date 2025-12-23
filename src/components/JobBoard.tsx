import { useState, useEffect } from "react";
import { Lock, MapPin, Calendar, PoundSterling, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface Lead {
  id: string;
  postcode: string;
  job_type: string;
  display_value: string;
  date: string;
}

export const JobBoard = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial leads
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const { data, error } = await supabase
          .from("leads")
          .select("id, postcode, job_type, display_value, date")
          .eq("is_unlocked", false)
          .order("created_at", { ascending: false })
          .limit(6);

        if (error) throw error;
        if (data) setLeads(data);
      } catch (error) {
        console.error("Error fetching leads:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, []);

  // Set up real-time subscription for new leads
  useEffect(() => {
    const channel = supabase
      .channel("jobboard-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "leads",
        },
        (payload) => {
          const newLead = payload.new as Lead;
          // Add new lead to the top and keep only 6
          setLeads((prev) => [newLead, ...prev].slice(0, 6));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "d MMM yyyy");
    } catch {
      return dateString;
    }
  };

  return (
    <section id="job-board" className="py-20 lg:py-28 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-4">
            Live Job Board
          </span>
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Cleaning Jobs Available Now
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Real cleaning jobs from homeowners across the UK. Join to unlock full details.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No jobs available at the moment. Check back soon!</p>
          </div>
        ) : (
          <>
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
                {leads.map((lead, index) => (
                  <div
                    key={lead.id}
                    className={`grid grid-cols-5 gap-4 px-6 py-5 items-center transition-colors hover:bg-muted/50 ${
                      index !== leads.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <div className="font-semibold text-foreground bg-muted rounded-lg px-3 py-1 inline-block w-fit">
                      {lead.postcode}
                    </div>
                    <div className="text-foreground font-medium">{lead.job_type}</div>
                    <div className="text-secondary font-bold text-lg">{lead.display_value}</div>
                    <div className="text-muted-foreground">{formatDate(lead.date)}</div>
                    <div className="text-center">
                      <Link to="/leads">
                        <Button variant="unlock" size="sm" className="gap-2">
                          <Lock className="w-4 h-4" />
                          Unlock £20
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile card view */}
            <div className="md:hidden space-y-4 max-w-md mx-auto">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="bg-card rounded-xl p-5 shadow-card border border-border"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="inline-block bg-muted text-foreground font-semibold rounded-lg px-3 py-1 text-sm mb-2">
                        {lead.postcode}
                      </span>
                      <h3 className="font-semibold text-foreground">{lead.job_type}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-secondary font-bold text-xl">{lead.display_value}</p>
                      <p className="text-muted-foreground text-sm">{formatDate(lead.date)}</p>
                    </div>
                  </div>
                  <Link to="/leads">
                    <Button variant="unlock" className="w-full gap-2">
                      <Lock className="w-4 h-4" />
                      Unlock £20
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            Want access to more leads in your area?
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
