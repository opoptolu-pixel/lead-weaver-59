import { useState, useEffect } from "react";
import { Lock, MapPin, Calendar, PoundSterling, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { ScrollReveal } from "@/components/ScrollReveal";
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
  
  // Auto-scroll for desktop
  const desktopScroll = useAutoScroll({ speed: 25, pauseOnHover: true, pauseOnTouch: true });
  // Auto-scroll for mobile
  const mobileScroll = useAutoScroll({ speed: 25, pauseOnHover: true, pauseOnTouch: true });

  // Fetch initial leads
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        // Use secure function that only exposes non-sensitive lead data
        const { data, error } = await supabase.rpc("get_available_leads");

        if (error) throw error;
        // Take only first 8 leads for scrolling effect
        if (data) setLeads(data.slice(0, 8));
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
          // Add new lead to the top and keep only 8
          setLeads((prev) => [newLead, ...prev].slice(0, 8));
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
    <section id="job-board" className="relative py-20 lg:py-28 bg-primary overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative container mx-auto px-4">
        <ScrollReveal animation="fade-up">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-secondary/20 backdrop-blur-sm border border-secondary/30 rounded-full px-4 py-2 mb-6">
              <Sparkles className="w-4 h-4 text-secondary" />
              <span className="text-secondary text-sm font-medium">
                Live Job Board
              </span>
            </div>
            <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
              Cleaning Jobs Available Now
            </h2>
            <p className="text-primary-foreground/70 text-lg max-w-2xl mx-auto">
              Real cleaning jobs from homeowners across the UK. Join to unlock full details.
            </p>
          </div>
        </ScrollReveal>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-primary-foreground/70">No jobs available at the moment. Check back soon!</p>
          </div>
        ) : (
          <>
            {/* Desktop table view with auto-scroll */}
            <ScrollReveal animation="scale" delay={100}>
              <div className="hidden md:block max-w-5xl mx-auto">
                <div className="bg-background rounded-2xl shadow-elevated overflow-hidden border border-border">
                  {/* Table header - fixed */}
                  <div className="grid grid-cols-5 gap-4 bg-muted px-6 py-4 font-heading font-semibold text-sm text-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-secondary" />
                      Postcode
                    </div>
                    <div>Job Type</div>
                    <div className="flex items-center gap-2">
                      <PoundSterling className="w-4 h-4 text-secondary" />
                      Value
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-secondary" />
                      Date
                    </div>
                    <div className="text-center">Action</div>
                  </div>

                  {/* Scrolling container */}
                  <div 
                    {...desktopScroll.containerProps}
                    className="max-h-[280px] overflow-hidden"
                    style={{ scrollBehavior: 'auto' }}
                  >
                    {/* Duplicate leads for seamless scrolling */}
                    {[...leads, ...leads].map((lead, index) => (
                      <div
                        key={`${lead.id}-${index}`}
                        className={`grid grid-cols-5 gap-4 px-6 py-5 items-center transition-colors hover:bg-muted/50 ${
                          index !== leads.length * 2 - 1 ? "border-b border-border" : ""
                        }`}
                      >
                        <div className="font-semibold text-foreground bg-secondary/10 text-secondary rounded-lg px-3 py-1 inline-block w-fit">
                          {lead.postcode}
                        </div>
                        <div className="text-foreground font-medium">{lead.job_type}</div>
                        <div className="text-secondary font-bold text-lg">{lead.display_value}</div>
                        <div className="text-muted-foreground">{formatDate(lead.date)}</div>
                        <div className="text-center">
                          <Link to="/auth">
                            <Button 
                              variant="cta" 
                              size="sm" 
                              className="gap-2"
                            >
                              <Lock className="w-4 h-4" />
                              Sign In to Unlock
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Pause indicator */}
                {desktopScroll.isPaused && (
                  <p className="text-center text-sm text-primary-foreground/60 mt-3">
                    Scrolling paused • Move away to resume
                  </p>
                )}
              </div>
            </ScrollReveal>

            {/* Mobile card view with auto-scroll */}
            <div className="md:hidden max-w-md mx-auto">
              <div 
                {...mobileScroll.containerProps}
                className="max-h-[400px] overflow-hidden space-y-4"
                style={{ scrollBehavior: 'auto' }}
              >
                {/* Duplicate leads for seamless scrolling */}
                {[...leads, ...leads].map((lead, index) => (
                  <div
                    key={`mobile-${lead.id}-${index}`}
                    className="bg-background rounded-xl p-5 shadow-card border border-border"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="inline-block bg-secondary/10 text-secondary font-semibold rounded-lg px-3 py-1 text-sm mb-2">
                          {lead.postcode}
                        </span>
                        <h3 className="font-semibold text-foreground">{lead.job_type}</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-secondary font-bold text-xl">{lead.display_value}</p>
                        <p className="text-muted-foreground text-sm">{formatDate(lead.date)}</p>
                      </div>
                    </div>
                    <Link to="/auth">
                      <Button 
                        variant="cta" 
                        className="w-full gap-2"
                      >
                        <Lock className="w-4 h-4" />
                        Sign In to Unlock
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
              
              {/* Pause indicator for mobile */}
              {mobileScroll.isPaused && (
                <p className="text-center text-sm text-primary-foreground/60 mt-3">
                  Tap outside to resume scrolling
                </p>
              )}
            </div>
          </>
        )}

        {/* CTA */}
        <ScrollReveal animation="fade-up" delay={200}>
          <div className="text-center mt-12">
            <p className="text-primary-foreground/70 mb-4">
              Want access to more leads in your area?
            </p>
            <Button 
              variant="hero" 
              size="lg"
              className="shadow-glow"
              onClick={() => {
                document.getElementById("registration")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Join Cleanda Today
            </Button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};
