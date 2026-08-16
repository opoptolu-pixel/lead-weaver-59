import { useState, useRef, useEffect, useTransition } from "react";
import { Search, Sparkles, MapPin, Briefcase, Loader2, AlertCircle, Check, Star, Users, TrendingUp, Lock as LockIcon, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";


interface LeadResult {
  id: string;
  postcode: string;
  job_type: string;
  display_value: string;
}

interface UKLocation {
  postcode: string;
  area: string;
  type: 'postcode' | 'place' | 'city';
}

export const HeroSection = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [leadResults, setLeadResults] = useState<LeadResult[]>([]);
  const [ukLocations, setUkLocations] = useState<UKLocation[]>([]);
  const [postcodePrefixes, setPostcodePrefixes] = useState<string[]>([]);
  const [matchedCity, setMatchedCity] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();

  // Fetch UK locations and leads based on search query
  useEffect(() => {
    const fetchData = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setLeadResults([]);
        setUkLocations([]);
        setPostcodePrefixes([]);
        setMatchedCity(null);
        return;
      }

      setIsLoading(true);
      try {
        const searchTerm = searchQuery.trim();

        // Fetch UK locations from API first
        const locationsResponse = await supabase.functions.invoke('search-uk-locations', {
          body: { query: searchTerm }
        });

        let prefixes: string[] = [];
        let city: string | null = null;

        // Process UK locations
        if (locationsResponse.data?.success) {
          setUkLocations(locationsResponse.data.locations || []);
          prefixes = locationsResponse.data.postcodePrefixes || [];
          city = locationsResponse.data.matchedCity || null;
          setPostcodePrefixes(prefixes);
          setMatchedCity(city);
        } else {
          setUkLocations([]);
          setPostcodePrefixes([]);
          setMatchedCity(null);
        }

        // Use secure function that only exposes non-sensitive lead data
        const { data: allLeads, error } = await supabase.rpc("get_available_leads");

        let leads = allLeads || [];
        
        if (!error && leads.length > 0) {
          // Filter leads based on search criteria
          if (prefixes.length > 0) {
            leads = leads.filter((lead: LeadResult) => {
              const postcode = lead.postcode.toUpperCase();
              const jobType = lead.job_type.toLowerCase();
              const searchLower = searchTerm.toLowerCase();
              
              // Check if postcode matches any prefix pattern
              const matchesPrefix = prefixes.some(prefix => {
                if (prefix.length === 1) {
                  // Single letter - must be followed by a digit
                  return /^[A-Z]\d/.test(postcode) && postcode.startsWith(prefix.toUpperCase());
                }
                return postcode.startsWith(prefix.toUpperCase());
              });
              
              // Also match if postcode or job_type contains search term
              const matchesSearch = postcode.includes(searchTerm.toUpperCase()) || 
                                   jobType.includes(searchLower);
              
              return matchesPrefix || matchesSearch;
            });
          } else {
            // Standard search
            leads = leads.filter((lead: LeadResult) => {
              const postcode = lead.postcode.toUpperCase();
              const jobType = lead.job_type.toLowerCase();
              return postcode.includes(searchTerm.toUpperCase()) || 
                     jobType.includes(searchTerm.toLowerCase());
            });
          }
          
          leads = leads.slice(0, 15);
        }

        if (error) {
          console.error("Leads search error:", error);
          setLeadResults([]);
        } else {
          setLeadResults(leads);
        }

      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchData, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (searchQuery.trim()) {
      // Pass postcode prefixes if we have a city match
      if (postcodePrefixes.length > 0) {
        navigate(`/leads?search=${encodeURIComponent(searchQuery.trim())}&prefixes=${encodeURIComponent(postcodePrefixes.join(','))}`);
      } else {
        navigate(`/leads?search=${encodeURIComponent(searchQuery.trim())}`);
      }
    } else {
      navigate("/leads");
    }
  };

  const handleLocationClick = (location: UKLocation) => {
    setShowSuggestions(false);
    if (location.type === 'city' && postcodePrefixes.length > 0) {
      // For city searches, pass the prefixes
      navigate(`/leads?search=${encodeURIComponent(matchedCity || searchQuery)}&prefixes=${encodeURIComponent(postcodePrefixes.join(','))}`);
    } else {
      navigate(`/leads?search=${encodeURIComponent(location.postcode)}`);
    }
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

  const hasResults = ukLocations.length > 0 || leadResults.length > 0;
  const showDropdown = showSuggestions && (hasResults || isLoading || searchQuery.length >= 2);

  return (
    <section className="relative min-h-[70vh] bg-hero-gradient flex items-center pt-24 pb-32 z-10 overflow-visible">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-secondary/20 backdrop-blur-sm border border-secondary/30 rounded-full px-4 py-2 mb-8">
            <Sparkles className="w-4 h-4 text-secondary" />
            <span className="text-secondary-foreground text-sm font-medium">
              UK's #1 Cleaning Lead Platform
            </span>
          </div>

          {/* Main headline */}
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6 leading-tight">
            Grow Your Cleaning Business{" "}
            <span className="text-secondary">Today</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-primary-foreground/80 mb-10 max-w-xl mx-auto">
            Get exclusive cleaning leads delivered straight to you. No subscriptions, no commitments — just quality jobs.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="relative z-20">
            <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto bg-background p-2 rounded-2xl shadow-2xl">
              <div className="relative flex-1" ref={searchContainerRef}>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
                <Input
                  type="text"
                  placeholder="Enter postcode or city"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  className="pl-12 h-14 text-base bg-transparent border-2 border-transparent rounded-xl focus:border-secondary"
                />
                
                {/* Search Results Dropdown */}
                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-2xl z-[9999] overflow-hidden">
                    {isLoading ? (
                      <div className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Searching UK locations...
                      </div>
                    ) : hasResults ? (
                      <>
                        {/* UK Locations */}
                        {ukLocations.length > 0 && (
                          <>
                            <div className="p-2 text-xs text-muted-foreground font-medium border-b border-border bg-muted/50">
                              <MapPin className="w-3 h-3 inline mr-1" />
                              UK Locations
                            </div>
                            {ukLocations.map((location, idx) => {
                              // For city type, show total leads across all prefixes
                              const leadCount = location.type === 'city' 
                                ? leadResults.length
                                : leadResults.filter(l => l.postcode.startsWith(location.postcode.split(' ')[0])).length;
                              
                              return (
                                <button
                                  key={`${location.postcode}-${idx}`}
                                  type="button"
                                  onClick={() => handleLocationClick(location)}
                                  className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-3"
                                >
                                  <MapPin className={`w-4 h-4 flex-shrink-0 ${location.type === 'city' ? 'text-primary' : 'text-secondary'}`} />
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium text-foreground">
                                      {location.type === 'city' ? (matchedCity ? matchedCity.charAt(0).toUpperCase() + matchedCity.slice(1) : location.area.split('(')[0].trim()) : location.postcode}
                                    </span>
                                    {location.type !== 'city' && (
                                      <span className="text-sm text-muted-foreground ml-2">{location.area}</span>
                                    )}
                                  </div>
                                  {leadCount > 0 ? (
                                    <span className="text-xs bg-secondary/20 text-secondary px-2 py-1 rounded-full font-medium">
                                      {leadCount} lead{leadCount !== 1 ? 's' : ''}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      No leads yet
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </>
                        )}

                        {/* Available Jobs */}
                        {leadResults.length > 0 && (
                          <>
                            <div className="p-2 text-xs text-muted-foreground font-medium border-b border-border bg-muted/50">
                              <Briefcase className="w-3 h-3 inline mr-1" />
                              Available Jobs {matchedCity && `in ${matchedCity.charAt(0).toUpperCase() + matchedCity.slice(1)}`}
                            </div>
                            {leadResults.slice(0, 6).map((lead) => (
                              <button
                                key={lead.id}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowSuggestions(false);
                                  navigate("/leads");
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="w-full px-4 py-3 text-left hover:bg-muted transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="font-medium text-foreground">{lead.job_type}</span>
                                    <span className="text-sm text-muted-foreground ml-2">in {lead.postcode}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-secondary font-semibold">{lead.display_value}</span>
                                    <LockIcon className="w-4 h-4 text-secondary" />
                                  </div>
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
                            if (postcodePrefixes.length > 0) {
                              navigate(`/leads?search=${encodeURIComponent(searchQuery)}&prefixes=${encodeURIComponent(postcodePrefixes.join(','))}`);
                            } else {
                              navigate(`/leads?search=${encodeURIComponent(searchQuery)}`);
                            }
                          }}
                          className="w-full px-4 py-3 text-center text-secondary font-medium hover:bg-muted transition-colors border-t border-border"
                        >
                          View all {leadResults.length > 0 ? `${leadResults.length}+ ` : ''}results for "{searchQuery}"
                        </button>
                      </>
                    ) : searchQuery.length >= 2 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        No locations found for "{searchQuery}"
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
                variant="cta" 
                size="xl"
                className="h-14 px-8 text-base font-semibold shadow-lg"
              >
                <Search className="w-5 h-5 mr-2" />
                Find Leads
              </Button>
            </div>
          </form>

          {/* Mobile-first signup CTA */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="hero"
              size="lg"
              className="w-full sm:w-auto shadow-glow text-base font-semibold px-8"
              onClick={() => navigate("/auth?mode=signup")}
            >
              Sign Up Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <span className="text-primary-foreground/60 text-sm">
              Already have an account?{" "}
              <button onClick={() => navigate("/auth")} className="text-secondary underline underline-offset-2 font-medium">
                Sign In
              </button>
            </span>
          </div>

          {/* Trust indicators - matching customer hero style */}
          {!showDropdown && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-primary-foreground/70 text-sm">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-secondary" />
                <span>£12 Per Lead</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-secondary" />
                <span>No Subscription</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-secondary" />
                <span>Exclusive Leads</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-secondary" />
                <span>Instant Access</span>
              </div>
            </div>
          )}

          {/* Stats section */}
          <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg mx-auto">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="w-5 h-5 text-secondary" />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-primary-foreground">500+</div>
              <div className="text-xs text-primary-foreground/60">Active Cleaners</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="w-5 h-5 text-secondary" />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-primary-foreground">10K+</div>
              <div className="text-xs text-primary-foreground/60">Leads Delivered</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Star className="w-5 h-5 text-secondary" />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-primary-foreground">4.9</div>
              <div className="text-xs text-primary-foreground/60">Average Rating</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 -mb-px pointer-events-none z-0">
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
