import { useState, useEffect, useRef, useCallback } from "react";
import { Lock, MapPin, Calendar, PoundSterling, Loader2, Coins, User, Search, X, Briefcase, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";

interface Lead {
  id: string;
  postcode: string;
  job_type: string;
  display_value: string;
  date: string;
  created_at: string;
}

interface SearchLead {
  id: string;
  postcode: string;
  job_type: string;
  display_value: string;
  customer_address: string;
}

interface UKLocation {
  postcode: string;
  area: string;
  type: 'postcode' | 'place' | 'city';
}

const LEADS_PER_PAGE = 10;

export default function Leads() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const initialPrefixes = searchParams.get("prefixes")?.split(',').filter(Boolean) || [];
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [unlockingLeadId, setUnlockingLeadId] = useState<string | null>(null);
  const [usingCreditLeadId, setUsingCreditLeadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activeFilter, setActiveFilter] = useState(initialSearch);
  const [activePrefixes, setActivePrefixes] = useState<string[]>(initialPrefixes);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchLeadResults, setSearchLeadResults] = useState<SearchLead[]>([]);
  const [ukLocations, setUkLocations] = useState<UKLocation[]>([]);
  const [postcodePrefixes, setPostcodePrefixes] = useState<string[]>([]);
  const [matchedCity, setMatchedCity] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch leads with pagination and optional search filter
  const fetchLeads = useCallback(async (pageNum: number, append: boolean = false, filter: string = "", prefixes: string[] = []) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const from = pageNum * LEADS_PER_PAGE;
      const to = from + LEADS_PER_PAGE - 1;

      let query = supabase
        .from("leads")
        .select("id, postcode, job_type, display_value, date, created_at")
        .eq("is_unlocked", false)
        .order("created_at", { ascending: false });

      // Apply filter based on prefixes (for city search) or direct postcode search
      if (prefixes.length > 0) {
        // For single-letter prefixes, we need to match prefix followed by a digit
        // to avoid matching other areas (e.g., W should match W1, W2 but not WN, WA)
        const expandedConditions: string[] = [];
        
        for (const prefix of prefixes) {
          if (prefix.length === 1) {
            // Single letter prefix - match with digits 1-20 to be safe
            for (let i = 1; i <= 20; i++) {
              expandedConditions.push(`postcode.ilike.${prefix}${i}%`);
            }
          } else {
            // Multi-letter prefix - use as-is
            expandedConditions.push(`postcode.ilike.${prefix}%`);
          }
        }
        
        query = query.or(expandedConditions.join(','));
      } else if (filter.trim()) {
        // Standard postcode search
        query = query.ilike("postcode", `%${filter.trim()}%`);
      }

      const { data, error } = await query.range(from, to);

      if (error) throw error;

      if (data) {
        if (append) {
          setLeads(prev => [...prev, ...data]);
        } else {
          setLeads(data);
        }
        setHasMore(data.length === LEADS_PER_PAGE);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load and reload when filter changes
  useEffect(() => {
    setPage(0);
    fetchLeads(0, false, activeFilter, activePrefixes);
  }, [fetchLeads, activeFilter, activePrefixes]);

  // Handle click outside search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch UK locations and search leads for dropdown
  useEffect(() => {
    const fetchSearchData = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchLeadResults([]);
        setUkLocations([]);
        setPostcodePrefixes([]);
        setMatchedCity(null);
        return;
      }

      setIsSearching(true);
      try {
        const searchTerm = searchQuery.trim();

        // Fetch UK locations from API
        const locationsResponse = await supabase.functions.invoke('search-uk-locations', {
          body: { query: searchTerm }
        });

        let prefixes: string[] = [];
        let city: string | null = null;

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

        // Build leads query for dropdown preview
        let leadsQuery = supabase
          .from("leads")
          .select("id, postcode, job_type, display_value, customer_address")
          .eq("is_unlocked", false);

        if (prefixes.length > 0) {
          const expandedConditions: string[] = [];
          for (const prefix of prefixes) {
            if (prefix.length === 1) {
              for (let i = 1; i <= 20; i++) {
                expandedConditions.push(`postcode.ilike.${prefix}${i}%`);
              }
            } else {
              expandedConditions.push(`postcode.ilike.${prefix}%`);
            }
          }
          const searchConditions = `postcode.ilike.%${searchTerm.toUpperCase()}%,customer_address.ilike.%${searchTerm}%,job_type.ilike.%${searchTerm}%`;
          leadsQuery = leadsQuery.or(`${expandedConditions.join(',')},${searchConditions}`);
        } else {
          leadsQuery = leadsQuery.or(
            `postcode.ilike.%${searchTerm.toUpperCase()}%,customer_address.ilike.%${searchTerm}%,job_type.ilike.%${searchTerm}%`
          );
        }

        const { data: leads } = await leadsQuery.limit(15);
        setSearchLeadResults(leads || []);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(fetchSearchData, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Set up real-time subscription for new leads
  useEffect(() => {
    const channel = supabase
      .channel("leads-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "leads",
        },
        (payload) => {
          console.log("New lead received:", payload);
          const newLead = payload.new as Lead;
          setLeads(prev => [newLead, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    if (loading) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchLeads(nextPage, true, activeFilter, activePrefixes);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading, hasMore, loadingMore, page, fetchLeads]);

  const handleUnlock = async (leadId: string) => {
    setUnlockingLeadId(leadId);
    try {
      const { data, error } = await supabase.functions.invoke("unlock-lead", {
        body: { leadId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Error unlocking lead:", err);
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
    setUnlockingLeadId(null);
    }
  };

  const handleUseCredit = async (leadId: string) => {
    if (!user) {
      toast.error("Please sign in to use credits");
      navigate("/auth");
      return;
    }

    setUsingCreditLeadId(leadId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to use credits");
        return;
      }

      const { data, error } = await supabase.functions.invoke("use-credit", {
        body: { leadId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Remove the lead from the list
      setLeads(prev => prev.filter(l => l.id !== leadId));
      await refreshProfile();
      
      toast.success("Lead unlocked! Check your dashboard for details.");
      navigate("/dashboard");
    } catch (err) {
      console.error("Error using credit:", err);
      toast.error(err instanceof Error ? err.message : "Failed to unlock lead");
    } finally {
      setUsingCreditLeadId(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "d MMM yyyy");
    } catch {
      return dateString;
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const searchTerm = searchQuery.trim();
    
    if (!searchTerm) {
      setActiveFilter("");
      setActivePrefixes([]);
      setSearchParams({});
      return;
    }
    
    // Check if the search term matches a city and get prefixes
    try {
      const { data } = await supabase.functions.invoke('search-uk-locations', {
        body: { query: searchTerm }
      });
      
      if (data?.success && data.postcodePrefixes?.length > 0) {
        setActivePrefixes(data.postcodePrefixes);
        setActiveFilter(searchTerm);
        setSearchParams({ search: searchTerm, prefixes: data.postcodePrefixes.join(',') });
      } else {
        setActivePrefixes([]);
        setActiveFilter(searchTerm);
        setSearchParams({ search: searchTerm });
      }
    } catch (err) {
      // Fallback to direct search
      setActivePrefixes([]);
      setActiveFilter(searchTerm);
      setSearchParams({ search: searchTerm });
    }
  };

  const handleClearFilter = () => {
    setSearchQuery("");
    setActiveFilter("");
    setActivePrefixes([]);
    setSearchParams({});
  };

  const userCredits = profile?.credits || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Logo size="md" />
            <div className="flex items-center gap-4">
              {user ? (
                <Link to="/dashboard">
                  <Button variant="outlineHero" size="sm" className="gap-2">
                    <User className="w-4 h-4" />
                    Dashboard
                    {userCredits > 0 && (
                      <span className="bg-secondary text-secondary-foreground text-xs px-1.5 py-0.5 rounded">
                        {userCredits} credits
                      </span>
                    )}
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth">
                    <Button variant="hero" size="sm">
                      Sign Up
                    </Button>
                  </Link>
                  <Link to="/auth">
                    <Button variant="outlineHero" size="sm">
                      Sign In
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <span className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-4">
            Available Leads
          </span>
          <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            {activeFilter ? `Leads in "${activeFilter}"` : "Browse All Cleaning Jobs"}
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            Real leads from homeowners looking for cleaning services. 
            {userCredits > 0 
              ? ` Use your ${userCredits} credits or pay £20 per lead.`
              : " Unlock for just £20 each or buy credits to save."}
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto mb-8">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1" ref={searchContainerRef}>
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
                <Input
                  type="text"
                  placeholder="Enter postcode or city (e.g. SW1, Manchester)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  className="pl-14 h-14 text-lg border-2 border-border rounded-xl focus:border-secondary"
                />
                
                {/* Search Results Dropdown */}
                {showSuggestions && (isSearching || ukLocations.length > 0 || searchLeadResults.length > 0 || searchQuery.length >= 2) && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-96 overflow-y-auto">
                    {isSearching ? (
                      <div className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Searching UK locations...
                      </div>
                    ) : (ukLocations.length > 0 || searchLeadResults.length > 0) ? (
                      <>
                        {/* UK Locations */}
                        {ukLocations.length > 0 && (
                          <>
                            <div className="p-2 text-xs text-muted-foreground font-medium border-b border-border bg-muted/50">
                              <MapPin className="w-3 h-3 inline mr-1" />
                              UK Locations
                            </div>
                            {ukLocations.map((location, idx) => {
                              const leadCount = location.type === 'city' 
                                ? searchLeadResults.length
                                : searchLeadResults.filter(l => l.postcode.startsWith(location.postcode.split(' ')[0])).length;
                              
                              return (
                                <button
                                  key={`${location.postcode}-${idx}`}
                                  type="button"
                                  onClick={() => {
                                    setShowSuggestions(false);
                                    if (location.type === 'city' && postcodePrefixes.length > 0) {
                                      setActiveFilter(matchedCity || searchQuery);
                                      setActivePrefixes(postcodePrefixes);
                                      setSearchParams({ search: matchedCity || searchQuery, prefixes: postcodePrefixes.join(',') });
                                    } else {
                                      setActiveFilter(location.postcode);
                                      setActivePrefixes([]);
                                      setSearchParams({ search: location.postcode });
                                    }
                                    setSearchQuery(location.type === 'city' ? (matchedCity || searchQuery) : location.postcode);
                                  }}
                                  className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-3"
                                >
                                  <MapPin className={`w-4 h-4 flex-shrink-0 ${location.type === 'city' ? 'text-primary' : 'text-secondary'}`} />
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium text-foreground">
                                      {location.type === 'city' ? (matchedCity ? matchedCity.charAt(0).toUpperCase() + matchedCity.slice(1) : location.postcode) : location.postcode}
                                    </span>
                                    <span className="text-sm text-muted-foreground ml-2">{location.area}</span>
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
                        {searchLeadResults.length > 0 && (
                          <>
                            <div className="p-2 text-xs text-muted-foreground font-medium border-b border-border bg-muted/50">
                              <Briefcase className="w-3 h-3 inline mr-1" />
                              Available Jobs {matchedCity && `in ${matchedCity.charAt(0).toUpperCase() + matchedCity.slice(1)}`}
                            </div>
                            {searchLeadResults.slice(0, 6).map((lead) => (
                              <button
                                key={lead.id}
                                type="button"
                                onClick={() => {
                                  setShowSuggestions(false);
                                  setSearchQuery(lead.postcode);
                                  setActiveFilter(lead.postcode);
                                  setActivePrefixes([]);
                                  setSearchParams({ search: lead.postcode });
                                }}
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
                            if (postcodePrefixes.length > 0) {
                              setActiveFilter(searchQuery);
                              setActivePrefixes(postcodePrefixes);
                              setSearchParams({ search: searchQuery, prefixes: postcodePrefixes.join(',') });
                            } else {
                              setActiveFilter(searchQuery);
                              setActivePrefixes([]);
                              setSearchParams({ search: searchQuery });
                            }
                          }}
                          className="w-full px-4 py-3 text-center text-secondary font-medium hover:bg-muted transition-colors border-t border-border"
                        >
                          View all {searchLeadResults.length > 0 ? `${searchLeadResults.length}+ ` : ''}results for "{searchQuery}"
                        </button>
                      </>
                    ) : searchQuery.length >= 2 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        No locations found for "{searchQuery}"
                        <button
                          type="button"
                          onClick={() => {
                            setShowSuggestions(false);
                            setActiveFilter("");
                            setActivePrefixes([]);
                            setSearchParams({});
                          }}
                          className="block w-full mt-2 text-secondary hover:underline"
                        >
                          Browse all available leads
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              <Button type="submit" variant="default" className="h-14 px-8 text-base font-semibold">
                Search
              </Button>
              {activeFilter && (
                <Button 
                  type="button" 
                  variant="outline" 
                  className="h-14 px-4"
                  onClick={handleClearFilter}
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>
          </form>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg mb-4">
              {activeFilter 
                ? `No leads found for "${activeFilter}". Try a different search.`
                : "No leads available at the moment. Check back soon!"}
            </p>
            {activeFilter && (
              <Button variant="outline" onClick={handleClearFilter}>
                Clear Search
              </Button>
            )}
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
                    <div className="text-center flex gap-2 justify-center">
                      {userCredits > 0 ? (
                        <Button 
                          variant="cta" 
                          size="sm" 
                          className="gap-2"
                          onClick={() => handleUseCredit(lead.id)}
                          disabled={usingCreditLeadId === lead.id}
                        >
                          {usingCreditLeadId === lead.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Coins className="w-4 h-4" />
                          )}
                          Use 1 Credit
                        </Button>
                      ) : (
                        <Button 
                          variant="unlock" 
                          size="sm" 
                          className="gap-2"
                          onClick={() => handleUnlock(lead.id)}
                          disabled={unlockingLeadId === lead.id}
                        >
                          {unlockingLeadId === lead.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Lock className="w-4 h-4" />
                          )}
                          Unlock £20
                        </Button>
                      )}
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
                  {userCredits > 0 ? (
                    <Button 
                      variant="cta" 
                      className="w-full gap-2"
                      onClick={() => handleUseCredit(lead.id)}
                      disabled={usingCreditLeadId === lead.id}
                    >
                      {usingCreditLeadId === lead.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Coins className="w-4 h-4" />
                      )}
                      Use 1 Credit
                    </Button>
                  ) : (
                    <Button 
                      variant="unlock" 
                      className="w-full gap-2"
                      onClick={() => handleUnlock(lead.id)}
                      disabled={unlockingLeadId === lead.id}
                    >
                      {unlockingLeadId === lead.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                      Unlock for £20
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Load more trigger */}
            <div ref={loadMoreRef} className="py-8 flex justify-center">
              {loadingMore && (
                <Loader2 className="w-6 h-6 animate-spin text-secondary" />
              )}
              {!hasMore && leads.length > 0 && (
                <p className="text-muted-foreground text-sm">You've seen all available leads</p>
              )}
            </div>
          </>
        )}

        {/* CTA */}
        {!user && (
          <div className="text-center mt-8">
            <p className="text-muted-foreground mb-4">
              Ready to start getting leads?
            </p>
            <Link to="/auth">
              <Button variant="cta" size="lg">
                Sign Up & Start Today
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
