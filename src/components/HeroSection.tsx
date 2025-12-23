import { useState, useRef, useEffect } from "react";
import { Search, Sparkles, MapPin, Briefcase, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface LeadResult {
  id: string;
  postcode: string;
  job_type: string;
  display_value: string;
  customer_address: string;
}

export const HeroSection = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [leadResults, setLeadResults] = useState<LeadResult[]>([]);
  const [uniqueLocations, setUniqueLocations] = useState<string[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Fetch leads based on search query
  useEffect(() => {
    const fetchLeads = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setLeadResults([]);
        setUniqueLocations([]);
        return;
      }

      setIsLoading(true);
      try {
        const searchTerm = searchQuery.trim().toUpperCase();
        
        // Search leads by postcode, address, or job type
        const { data, error } = await supabase
          .from("leads")
          .select("id, postcode, job_type, display_value, customer_address")
          .eq("is_unlocked", false)
          .or(`postcode.ilike.%${searchTerm}%,customer_address.ilike.%${searchQuery}%,job_type.ilike.%${searchQuery}%`)
          .limit(10);

        if (error) {
          console.error("Search error:", error);
          return;
        }

        setLeadResults(data || []);

        // Extract unique postcodes/locations for quick navigation
        const locations = [...new Set((data || []).map(lead => lead.postcode))];
        setUniqueLocations(locations.slice(0, 5));
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchLeads, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (searchQuery.trim()) {
      navigate(`/leads?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/leads");
    }
  };

  const handleLocationClick = (location: string) => {
    setSearchQuery(location);
    setShowSuggestions(false);
    navigate(`/leads?search=${encodeURIComponent(location)}`);
  };

  const handleLeadClick = (leadId: string, postcode: string) => {
    setShowSuggestions(false);
    navigate(`/leads?search=${encodeURIComponent(postcode)}`);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasResults = leadResults.length > 0 || uniqueLocations.length > 0;
  const showDropdown = showSuggestions && (hasResults || isLoading || searchQuery.length >= 2);

  return (
    <section className="relative min-h-[60vh] bg-hero-gradient overflow-hidden flex items-center pt-20">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-10 w-72 h-72 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-secondary/20 backdrop-blur-sm border border-secondary/30 rounded-full px-4 py-2 mb-8 animate-slide-up">
            <Sparkles className="w-4 h-4 text-secondary" />
            <span className="text-secondary-foreground text-sm font-medium">
              UK's #1 Cleaning Lead Platform
            </span>
          </div>

          {/* Main headline */}
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6 leading-tight animate-slide-up stagger-1">
            Find Cleaning Jobs{" "}
            <span className="text-secondary">Near You</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-primary-foreground/80 mb-10 max-w-xl mx-auto animate-slide-up stagger-2">
            Search by postcode or city to find exclusive cleaning leads in your area
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="animate-slide-up stagger-3">
            <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
              <div className="relative flex-1" ref={searchContainerRef}>
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground z-10" />
                <Input
                  type="text"
                  placeholder="Enter postcode or city (e.g. SW1, Manchester)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  className="pl-14 h-16 text-lg bg-background border-2 border-border rounded-xl shadow-xl focus:border-secondary"
                />
                
                {/* Search Results Dropdown */}
                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
                    {isLoading ? (
                      <div className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Searching...
                      </div>
                    ) : hasResults ? (
                      <>
                        {/* Matching Locations */}
                        {uniqueLocations.length > 0 && (
                          <>
                            <div className="p-2 text-xs text-muted-foreground font-medium border-b border-border bg-muted/50">
                              <MapPin className="w-3 h-3 inline mr-1" />
                              Locations
                            </div>
                            {uniqueLocations.map((location) => (
                              <button
                                key={location}
                                type="button"
                                onClick={() => handleLocationClick(location)}
                                className="w-full px-4 py-3 text-left text-foreground hover:bg-muted transition-colors flex items-center gap-3"
                              >
                                <MapPin className="w-4 h-4 text-secondary" />
                                <span className="font-medium">{location}</span>
                                <span className="text-sm text-muted-foreground ml-auto">
                                  {leadResults.filter(l => l.postcode === location).length} job(s)
                                </span>
                              </button>
                            ))}
                          </>
                        )}

                        {/* Matching Jobs */}
                        {leadResults.length > 0 && (
                          <>
                            <div className="p-2 text-xs text-muted-foreground font-medium border-b border-border bg-muted/50">
                              <Briefcase className="w-3 h-3 inline mr-1" />
                              Available Jobs
                            </div>
                            {leadResults.slice(0, 5).map((lead) => (
                              <button
                                key={lead.id}
                                type="button"
                                onClick={() => handleLeadClick(lead.id, lead.postcode)}
                                className="w-full px-4 py-3 text-left hover:bg-muted transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="font-medium text-foreground">{lead.job_type}</span>
                                    <span className="text-sm text-muted-foreground ml-2">in {lead.postcode}</span>
                                  </div>
                                  <span className="text-secondary font-semibold">{lead.display_value}</span>
                                </div>
                              </button>
                            ))}
                          </>
                        )}

                        {/* View All Results */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowSuggestions(false);
                            navigate(`/leads?search=${encodeURIComponent(searchQuery)}`);
                          }}
                          className="w-full px-4 py-3 text-center text-secondary font-medium hover:bg-muted transition-colors border-t border-border"
                        >
                          View all results for "{searchQuery}"
                        </button>
                      </>
                    ) : searchQuery.length >= 2 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        No jobs found for "{searchQuery}"
                        <button
                          type="button"
                          onClick={() => navigate("/leads")}
                          className="block w-full mt-2 text-secondary hover:underline"
                        >
                          Browse all available leads
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              <Button 
                type="submit"
                variant="hero" 
                size="xl"
                className="h-16 px-10 text-lg font-semibold shadow-xl"
              >
                Search Leads
              </Button>
            </div>
          </form>

          {/* Trust indicator */}
          <p className="mt-4 text-primary-foreground/60 text-sm animate-fade-in stagger-4">
            ✓ No signup fees &nbsp;&nbsp; ✓ Pay only £20 per lead &nbsp;&nbsp; ✓ Exclusive leads
          </p>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 -mb-px pointer-events-none">
        <svg viewBox="0 0 1440 80" fill="none" className="w-full h-auto block">
          <path
            d="M0 80L60 70C120 60 240 40 360 30C480 20 600 20 720 25C840 30 960 40 1080 45C1200 50 1320 50 1380 50L1440 50V80H1380C1320 80 1200 80 1080 80C960 80 840 80 720 80C600 80 480 80 360 80C240 80 120 80 60 80H0Z"
            fill="hsl(var(--background))"
          />
        </svg>
      </div>
    </section>
  );
};
