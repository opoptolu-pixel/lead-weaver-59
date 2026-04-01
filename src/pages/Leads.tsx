import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trackInitiateCheckout } from "@/lib/analytics";
import { Lock, MapPin, Calendar, PoundSterling, Loader2, Coins, User, Search, X, Briefcase, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { format, parseISO, isAfter, isBefore, isEqual } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { LeadsSkeleton } from "@/components/skeletons/LeadsSkeleton";
import { useRateLimit, RATE_LIMIT_PRESETS } from "@/hooks/useRateLimit";
import { LeadFilters, LeadFilter } from "@/components/LeadFilters";
import { useLeadReservations } from "@/hooks/useLeadReservations";
import { CheckoutCountdown } from "@/components/CheckoutCountdown";
import { ReservedCountdown } from "@/components/ReservedCountdown";
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
}

interface UKLocation {
  postcode: string;
  area: string;
  type: 'postcode' | 'place' | 'city';
}

const LEADS_PER_PAGE = 10;

// Leads scroll container with auto-scroll on interaction pause
interface LeadReservationInfo {
  expiresAt: string;
  reservedByMe: boolean;
}

interface LeadsScrollContainerProps {
  leads: Lead[];
  userCredits: number;
  unlockingLeadId: string | null;
  usingCreditLeadId: string | null;
  onUnlock: (leadId: string) => void;
  onUseCredit: (leadId: string) => void;
  formatDate: (dateString: string) => string;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement>;
  isSearchActive?: boolean;
  getLeadReservation: (leadId: string) => LeadReservationInfo | null;
  onReservationExpired?: () => void;
  isSuspended?: boolean;
  isReverificationRequired?: boolean;
  isProfileIncomplete?: boolean;
  isAuthenticated?: boolean;
}

const INITIAL_VISIBLE_COUNT = 10;

const LeadsScrollContainer = ({
  leads,
  userCredits,
  unlockingLeadId,
  usingCreditLeadId,
  onUnlock,
  onUseCredit,
  formatDate,
  hasMore,
  loadingMore,
  loadMoreRef,
  isSearchActive = false,
  getLeadReservation,
  onReservationExpired,
  isSuspended = false,
  isReverificationRequired = false,
  isProfileIncomplete = false,
  isAuthenticated = false,
}: LeadsScrollContainerProps) => {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  
  // Reset visible count when leads change (new search)
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  }, [leads.length, isSearchActive]);

  // Auto-scroll for desktop (slower speed for leads page)
  const desktopScroll = useAutoScroll({ speed: 20, pauseOnHover: true, pauseOnTouch: true });
  // Auto-scroll for mobile  
  const mobileScroll = useAutoScroll({ speed: 20, pauseOnHover: true, pauseOnTouch: true });

  // Only enable auto-scroll if we have enough leads AND no active search
  const enableAutoScroll = leads.length >= 6 && !isSearchActive;

  // For search results, limit displayed leads; for auto-scroll, duplicate for seamless effect
  const displayLeads = enableAutoScroll 
    ? [...leads, ...leads] 
    : leads.slice(0, visibleCount);
  
  const hasMoreToShow = isSearchActive && visibleCount < leads.length;

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + INITIAL_VISIBLE_COUNT);
  };

  return (
    <>
      {/* Desktop table view */}
      <div className="hidden md:block max-w-5xl mx-auto">
        <div className="bg-card rounded-2xl shadow-elevated overflow-hidden border border-border">
          {/* Table header - fixed */}
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

          {/* Scrolling container */}
          <div 
            {...(enableAutoScroll ? desktopScroll.containerProps : {})}
            ref={enableAutoScroll ? desktopScroll.containerRef : undefined}
            className={enableAutoScroll ? "max-h-[500px] overflow-hidden" : ""}
            style={enableAutoScroll ? { scrollBehavior: 'auto' } : undefined}
          >
            {displayLeads.map((lead, index) => (
              <div
                key={enableAutoScroll ? `${lead.id}-${index}` : lead.id}
                className={`grid grid-cols-5 gap-4 px-6 py-5 items-center transition-colors hover:bg-muted/50 ${
                  index !== displayLeads.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="font-semibold text-foreground bg-muted rounded-lg px-3 py-1 inline-block w-fit">
                  {lead.postcode}
                </div>
                <div className="text-foreground font-medium">{lead.job_type}</div>
                <div className="text-secondary font-bold text-lg">{lead.display_value}</div>
                <div className="text-muted-foreground">{formatDate(lead.date)}</div>
                <div className="text-center flex flex-col gap-2 justify-center items-center min-w-[140px]">
                  {(() => {
                    const reservation = getLeadReservation(lead.id);
                    if (reservation) {
                      return (
                        <ReservedCountdown 
                          expiresAt={reservation.expiresAt} 
                          onExpired={onReservationExpired}
                        />
                      );
                    }
                    if (isSuspended) {
                      return (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2 cursor-not-allowed opacity-50"
                          disabled
                        >
                          <AlertCircle className="w-4 h-4" />
                          Suspended
                        </Button>
                      );
                    }
                    if (isReverificationRequired) {
                      return (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2 cursor-not-allowed opacity-50 text-amber-500 border-amber-500/30"
                          disabled
                        >
                          <AlertCircle className="w-4 h-4" />
                          Re-verification Required
                        </Button>
                      );
                    }
                    if (isProfileIncomplete) {
                      return (
                        <Link to="/settings">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                          >
                            <AlertCircle className="w-4 h-4" />
                            Complete Profile
                          </Button>
                        </Link>
                      );
                    }
                    if (!isAuthenticated) {
                      return (
                        <Link to="/auth">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2"
                          >
                            <Lock className="w-4 h-4" />
                            Sign In to Unlock
                          </Button>
                        </Link>
                      );
                    }
                    return userCredits > 0 ? (
                      <Button 
                        variant="cta" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => onUseCredit(lead.id)}
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
                        onClick={() => onUnlock(lead.id)}
                        disabled={unlockingLeadId === lead.id}
                      >
                        {unlockingLeadId === lead.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                        Unlock £12
                      </Button>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Pause indicator */}
        {enableAutoScroll && desktopScroll.isPaused && (
          <p className="text-center text-sm text-muted-foreground mt-3">
            Scrolling paused • Move away to resume
          </p>
        )}
      </div>

      {/* Mobile card view */}
      <div className="md:hidden max-w-md mx-auto">
        <div 
          {...(enableAutoScroll ? mobileScroll.containerProps : {})}
          ref={enableAutoScroll ? mobileScroll.containerRef : undefined}
          className={enableAutoScroll ? "max-h-[550px] overflow-hidden space-y-4" : "space-y-4"}
          style={enableAutoScroll ? { scrollBehavior: 'auto' } : undefined}
        >
          {displayLeads.map((lead, index) => (
            <div
              key={enableAutoScroll ? `mobile-${lead.id}-${index}` : lead.id}
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
              {(() => {
                const reservation = getLeadReservation(lead.id);
                if (reservation) {
                  return (
                    <ReservedCountdown 
                      expiresAt={reservation.expiresAt} 
                      onExpired={onReservationExpired}
                    />
                  );
                }
                if (isSuspended) {
                  return (
                    <Button 
                      variant="outline" 
                      className="w-full gap-2 cursor-not-allowed opacity-50"
                      disabled
                    >
                      <AlertCircle className="w-4 h-4" />
                      Account Suspended
                    </Button>
                  );
                }
                if (isReverificationRequired) {
                  return (
                    <Button 
                      variant="outline" 
                      className="w-full gap-2 cursor-not-allowed opacity-50 text-amber-500 border-amber-500/30"
                      disabled
                    >
                      <AlertCircle className="w-4 h-4" />
                      Re-verification Required
                    </Button>
                  );
                }
                if (isProfileIncomplete) {
                  return (
                    <Link to="/settings">
                      <Button 
                        variant="outline" 
                        className="w-full gap-2 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                      >
                        <AlertCircle className="w-4 h-4" />
                        Complete Profile
                      </Button>
                    </Link>
                  );
                }
                if (!isAuthenticated) {
                  return (
                    <Link to="/auth">
                      <Button 
                        variant="outline" 
                        className="w-full gap-2"
                      >
                        <Lock className="w-4 h-4" />
                        Sign In to Unlock
                      </Button>
                    </Link>
                  );
                }
                return userCredits > 0 ? (
                  <Button 
                    variant="cta" 
                    className="w-full gap-2"
                    onClick={() => onUseCredit(lead.id)}
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
                    onClick={() => onUnlock(lead.id)}
                    disabled={unlockingLeadId === lead.id}
                  >
                    {unlockingLeadId === lead.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    Unlock for £12
                  </Button>
                );
              })()}
            </div>
          ))}
        </div>
        
        {/* Pause indicator for mobile */}
        {enableAutoScroll && mobileScroll.isPaused && (
          <p className="text-center text-sm text-muted-foreground mt-3">
            Tap outside to resume scrolling
          </p>
        )}
      </div>

      {/* Load more section */}
      <div ref={loadMoreRef} className="py-8 flex flex-col items-center gap-4">
        {/* Load More button for search results */}
        {hasMoreToShow && (
          <Button 
            variant="outline" 
            onClick={handleLoadMore}
            className="gap-2"
          >
            Load More ({leads.length - visibleCount} remaining)
          </Button>
        )}
        
        {/* Infinite scroll loading indicator (when not in search mode) */}
        {!isSearchActive && loadingMore && (
          <Loader2 className="w-6 h-6 animate-spin text-secondary" />
        )}
        
        {/* End of results message */}
        {!hasMoreToShow && !hasMore && leads.length > 0 && (
          <p className="text-muted-foreground text-sm">You've seen all available leads</p>
        )}
      </div>
    </>
  );
};
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
  const [advancedFilter, setAdvancedFilter] = useState<LeadFilter>({
    jobType: "",
    postcodeArea: "",
    dateFrom: "",
    dateTo: "",
  });
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Database-backed lead reservation tracking
  const { reserveLead, releaseLead, isLeadReserved, checkLeadReservation, visitorId, myActiveCheckout, reservedLeads, fetchReservations } = useLeadReservations(user?.id);

  // Gate: redirect to onboarding if profile is incomplete
  useEffect(() => {
    if (!user) {
      navigate("/auth");
    } else if (profile) {
      const isProfileComplete =
        profile.contact_name &&
        profile.business_name &&
        profile.phone &&
        profile.postcode;
      if (!isProfileComplete) {
        navigate("/onboarding");
      }
    }
  }, [user, profile, navigate]);

  const jobTypes = useMemo(() => {
    const types = new Set(leads.map(l => l.job_type));
    return Array.from(types).sort();
  }, [leads]);

  // Fetch leads with pagination and optional search filter
  const fetchLeads = useCallback(async (pageNum: number, append: boolean = false, filter: string = "", prefixes: string[] = []) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const from = pageNum * LEADS_PER_PAGE;
      const to = from + LEADS_PER_PAGE - 1;

      // Use secure function that only exposes non-sensitive lead data
      const { data: allLeads, error } = await supabase.rpc("get_available_leads");

      if (error) throw error;

      let filteredLeads = allLeads || [];
      
      // Apply filter based on prefixes (for city search) or direct postcode search
      if (prefixes.length > 0) {
        filteredLeads = filteredLeads.filter((lead: Lead) => {
          const postcode = lead.postcode.toUpperCase();
          return prefixes.some(prefix => {
            if (prefix.length === 1) {
              return /^[A-Z]\d/.test(postcode) && postcode.startsWith(prefix.toUpperCase());
            }
            return postcode.startsWith(prefix.toUpperCase());
          });
        });
      } else if (filter.trim()) {
        const filterUpper = filter.trim().toUpperCase();
        filteredLeads = filteredLeads.filter((lead: Lead) => 
          lead.postcode.toUpperCase().includes(filterUpper)
        );
      }

      // Apply pagination
      const data = filteredLeads.slice(from, to + 1);

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

        // Use secure function for dropdown preview
        const { data: allLeads } = await supabase.rpc("get_available_leads");
        
        let filteredLeads = allLeads || [];
        
        if (prefixes.length > 0) {
          filteredLeads = filteredLeads.filter((lead: SearchLead) => {
            const postcode = lead.postcode.toUpperCase();
            const jobType = lead.job_type.toLowerCase();
            
            const matchesPrefix = prefixes.some(prefix => {
              if (prefix.length === 1) {
                return /^[A-Z]\d/.test(postcode) && postcode.startsWith(prefix.toUpperCase());
              }
              return postcode.startsWith(prefix.toUpperCase());
            });
            
            const matchesSearch = postcode.includes(searchTerm.toUpperCase()) || 
                                 jobType.includes(searchTerm.toLowerCase());
            
            return matchesPrefix || matchesSearch;
          });
        } else {
          filteredLeads = filteredLeads.filter((lead: SearchLead) => 
            lead.postcode.toUpperCase().includes(searchTerm.toUpperCase()) || 
            lead.job_type.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        
        setSearchLeadResults(filteredLeads.slice(0, 15));
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

  // Rate limiting for unlock actions
  const { executeWithRateLimit: executeUnlock } = useRateLimit("unlock_lead", RATE_LIMIT_PRESETS.unlockLead);
  const { executeWithRateLimit: executeUseCredit } = useRateLimit("use_credit", RATE_LIMIT_PRESETS.unlockLead);

  const handleUnlock = async (leadId: string) => {
    // Get lead details for the countdown
    const lead = leads.find(l => l.id === leadId);
    
    // Frontend validation: Check profile completion and phone verification
    if (profile) {
      const missingFields = [];
      if (!profile.business_name) missingFields.push("business name");
      if (!profile.phone) missingFields.push("phone number");
      if (!profile.contact_name) missingFields.push("contact name");
      if (!profile.postcode) missingFields.push("postcode");

      if (missingFields.length > 0) {
        toast.error(
          <div>
            <strong>Complete Your Profile</strong>
            <p className="text-sm mt-1">Please complete your profile before purchasing leads. Missing: {missingFields.join(", ")}</p>
          </div>,
          { duration: 6000 }
        );
        navigate("/settings");
        return;
      }

      if (!profile.phone_verified) {
        toast.error(
          <div>
            <strong>Phone Verification Required</strong>
            <p className="text-sm mt-1">Please verify your phone number before purchasing leads.</p>
          </div>,
          { duration: 6000 }
        );
        navigate("/settings");
        return;
      }

      if (!profile.is_verified && profile.leads_purchased >= 3) {
        toast.error(
          <div>
            <strong>Verification Required</strong>
            <p className="text-sm mt-1">You've reached the maximum of 3 leads for unverified businesses. Please complete verification to continue.</p>
          </div>,
          { duration: 6000 }
        );
        navigate("/settings/verification");
        return;
      }
    }
    
    setUnlockingLeadId(leadId);
    
    // First check if the lead is reserved by someone else
    const reservationStatus = await checkLeadReservation(leadId);
    if (reservationStatus.isReserved && !reservationStatus.reservedByMe) {
      toast.error("This lead is currently being checked out by another user. Please try again in a few minutes.");
      setUnlockingLeadId(null);
      return;
    }
    
    // Reserve the lead before proceeding (pass lead info for countdown)
    const reserveResult = await reserveLead(leadId, lead?.postcode, lead?.job_type);
    if (!reserveResult.success) {
      toast.error(reserveResult.message || "Unable to reserve this lead. Please try again.");
      setUnlockingLeadId(null);
      return;
    }
    
    const result = await executeUnlock(async () => {
      const { data, error } = await supabase.functions.invoke("unlock-lead", {
        body: { leadId, visitorId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    });

    if (!result.success) {
      // Show user-friendly error message
      const errorMessage = result.error || "Failed to start checkout";
      if (errorMessage.toLowerCase().includes("suspend")) {
        toast.error("Your account has been suspended. Please contact support for assistance.", {
          duration: 6000,
        });
      } else if (errorMessage.toLowerCase().includes("verification") || errorMessage.toLowerCase().includes("verified")) {
        toast.error(errorMessage, { duration: 6000 });
      } else if (errorMessage.toLowerCase().includes("being checked out")) {
        toast.error(errorMessage, { duration: 5000 });
      } else {
        toast.error(errorMessage);
      }
      setUnlockingLeadId(null);
      return;
    }

    // Redirect to Stripe Checkout - reservation stays active for 5 minutes
    if (result.data?.url) {
      trackInitiateCheckout({ contentName: 'lead_unlock', contentCategory: 'lead', value: 20 });
      if (window.fbq) {
        window.fbq('track', 'InitiateCheckout', {
          content_name: 'lead_unlock',
          content_category: 'lead',
          value: 20,
          currency: 'GBP',
        });
      }
      window.location.href = result.data.url;
    }
    setUnlockingLeadId(null);
  };

  const handleUseCredit = async (leadId: string) => {
    if (!user) {
      toast.error("Please sign in to use credits");
      navigate("/auth");
      return;
    }

    // Frontend validation: Check profile completion and phone verification
    if (profile) {
      const missingFields = [];
      if (!profile.business_name) missingFields.push("business name");
      if (!profile.phone) missingFields.push("phone number");
      if (!profile.contact_name) missingFields.push("contact name");
      if (!profile.postcode) missingFields.push("postcode");

      if (missingFields.length > 0) {
        toast.error(
          <div>
            <strong>Complete Your Profile</strong>
            <p className="text-sm mt-1">Please complete your profile before purchasing leads. Missing: {missingFields.join(", ")}</p>
          </div>,
          { duration: 6000 }
        );
        navigate("/settings");
        return;
      }

      if (!profile.phone_verified) {
        toast.error(
          <div>
            <strong>Phone Verification Required</strong>
            <p className="text-sm mt-1">Please verify your phone number before purchasing leads.</p>
          </div>,
          { duration: 6000 }
        );
        navigate("/settings");
        return;
      }

      if (!profile.is_verified && profile.leads_purchased >= 3) {
        toast.error(
          <div>
            <strong>Verification Required</strong>
            <p className="text-sm mt-1">You've reached the maximum of 3 leads for unverified businesses. Please complete verification to continue.</p>
          </div>,
          { duration: 6000 }
        );
        navigate("/settings/verification");
        return;
      }

      if (profile.verification_status === 'reverification_required') {
        toast.error(
          <div>
            <strong>Re-verification Required</strong>
            <p className="text-sm mt-1">Your account requires re-verification. Please re-upload the requested documents before purchasing leads.</p>
          </div>,
          { duration: 6000 }
        );
        navigate("/verification");
        return;
      }
    }

    // Get lead details for the countdown
    const lead = leads.find(l => l.id === leadId);
    
    setUsingCreditLeadId(leadId);
    
    // First check if the lead is reserved by someone else
    const reservationStatus = await checkLeadReservation(leadId);
    if (reservationStatus.isReserved && !reservationStatus.reservedByMe) {
      toast.error("This lead is currently being checked out by another user. Please try again in a few minutes.");
      setUsingCreditLeadId(null);
      return;
    }
    
    // Reserve the lead before proceeding (pass lead info for countdown)
    const reserveResult = await reserveLead(leadId, lead?.postcode, lead?.job_type);
    if (!reserveResult.success) {
      toast.error(reserveResult.message || "Unable to reserve this lead. Please try again.");
      setUsingCreditLeadId(null);
      return;
    }
    
    const result = await executeUseCredit(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Please sign in to use credits");
      }

      const response = await supabase.functions.invoke("use-credit", {
        body: { leadId, visitorId },
      });

      // Handle error responses (including 403 for suspended accounts)
      if (response.error) {
        // Try to parse error details from the response
        const errorBody = response.error.message || response.error;
        
        // Check if this is a FunctionsHttpError with context
        if (response.error.context?.body) {
          try {
            const parsedBody = JSON.parse(response.error.context.body);
            if (parsedBody.suspended) {
              return { suspended: true, error: parsedBody.error };
            }
          } catch {
            // Ignore parse errors
          }
        }
        
        throw new Error(String(errorBody));
      }
      
      if (response.data?.error) {
        if (response.data.suspended) {
          return { suspended: true, error: response.data.error };
        }
        throw new Error(response.data.error);
      }

      return response.data;
    });

    if (!result.success) {
      // Clear checkout countdown on any error
      releaseLead();
      
      // Show user-friendly error message
      const errorMessage = result.error || "Failed to unlock lead";
      const isSuspended = result.data?.suspended || errorMessage.toLowerCase().includes("suspend");
      
      if (isSuspended) {
        toast.error(
          <div>
            <strong>Account Suspended</strong>
            <p className="text-sm mt-1">Your account has been suspended. You cannot purchase leads until this is resolved. Please contact support at hello@cleanda.co.uk for assistance.</p>
          </div>,
          { duration: 8000 }
        );
      } else if (errorMessage.toLowerCase().includes("verification") || errorMessage.toLowerCase().includes("verified")) {
        toast.error(errorMessage, { duration: 6000 });
      } else if (errorMessage.toLowerCase().includes("credit")) {
        toast.error(errorMessage, { duration: 5000 });
      } else if (errorMessage.toLowerCase().includes("being checked out")) {
        toast.error(errorMessage, { duration: 5000 });
      } else {
        toast.error(errorMessage);
      }
      setUsingCreditLeadId(null);
      return;
    }
    
    // Check if the result indicates suspension (returned from the edge function)
    if (result.data?.suspended) {
      releaseLead();
      toast.error(
        <div>
          <strong>Account Suspended</strong>
          <p className="text-sm mt-1">Your account has been suspended. Please contact support at hello@cleanda.co.uk for assistance.</p>
        </div>,
        { duration: 8000 }
      );
      setUsingCreditLeadId(null);
      return;
    }
    
    // Remove the lead from the list (it's now purchased)
    setLeads(prev => prev.filter(l => l.id !== leadId));
    await refreshProfile();
    
    toast.success("Lead unlocked! Check your dashboard for details.");
    setUsingCreditLeadId(null);
    navigate("/dashboard");
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

  // Apply advanced filters to leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Job type filter
      if (advancedFilter.jobType && lead.job_type !== advancedFilter.jobType) {
        return false;
      }
      // Postcode area filter
      if (advancedFilter.postcodeArea && !lead.postcode.toUpperCase().startsWith(advancedFilter.postcodeArea.toUpperCase())) {
        return false;
      }
      // Date range filter
      if (advancedFilter.dateFrom) {
        const leadDate = parseISO(lead.date);
        const fromDate = parseISO(advancedFilter.dateFrom);
        if (isBefore(leadDate, fromDate)) return false;
      }
      if (advancedFilter.dateTo) {
        const leadDate = parseISO(lead.date);
        const toDate = parseISO(advancedFilter.dateTo);
        if (isAfter(leadDate, toDate)) return false;
      }
      return true;
    });
  }, [leads, advancedFilter]);

  const userCredits = profile?.credits || 0;
  const isProfileIncomplete = profile ? (
    !profile.business_name || !profile.contact_name || 
    !profile.phone || !profile.postcode
  ) : false;

  // Refresh profile on mount to catch admin-side changes
  useEffect(() => {
    if (user) {
      refreshProfile();
    }
  }, [user]);
  if (loading && leads.length === 0) {
    return <LeadsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-primary border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Logo size="md" variant="white" linkTo={user ? null : "/"} />
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
        {/* Suspension Banner */}
        {profile?.is_suspended && (
          <div className="mb-8 bg-destructive/10 border border-destructive rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive">Account Suspended</h3>
                <p className="text-sm text-destructive/80 mt-1">
                  Your account has been suspended{profile.suspension_reason ? ` for: ${profile.suspension_reason}` : ''}. 
                  You cannot purchase leads until this is resolved. Please contact support at{' '}
                  <a href="mailto:hello@cleanda.co.uk" className="underline font-medium">hello@cleanda.co.uk</a>
                </p>
              </div>
            </div>
          </div>
        )}

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
                  <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-xl z-50 overflow-hidden">
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
          
          {/* Advanced Filters */}
          <div className="mt-4 flex justify-center">
            <LeadFilters onFilterChange={setAdvancedFilter} jobTypes={jobTypes} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg mb-4">
              {activeFilter || Object.values(advancedFilter).some(v => v)
                ? "No leads match your filters. Try adjusting your search."
                : "No leads available at the moment. Check back soon!"}
            </p>
            {(activeFilter || Object.values(advancedFilter).some(v => v)) && (
              <Button variant="outline" onClick={handleClearFilter}>
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <LeadsScrollContainer 
            leads={filteredLeads}
            userCredits={userCredits}
            unlockingLeadId={unlockingLeadId}
            usingCreditLeadId={usingCreditLeadId}
            onUnlock={handleUnlock}
            onUseCredit={handleUseCredit}
            formatDate={formatDate}
            hasMore={hasMore}
            loadingMore={loadingMore}
            loadMoreRef={loadMoreRef}
            isSearchActive={!!activeFilter || activePrefixes.length > 0}
            getLeadReservation={(leadId) => {
              const reservation = reservedLeads.get(leadId);
              return reservation ? { expiresAt: reservation.expiresAt, reservedByMe: reservation.reservedByMe } : null;
            }}
            onReservationExpired={() => fetchReservations(leads.map(l => l.id))}
            isSuspended={profile?.is_suspended || false}
            isReverificationRequired={profile?.verification_status === 'reverification_required'}
            isProfileIncomplete={isProfileIncomplete}
            isAuthenticated={!!user}
          />
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
      
      {/* Checkout countdown timer */}
      {myActiveCheckout && (
        <CheckoutCountdown
          expiresAt={myActiveCheckout.expiresAt}
          leadId={myActiveCheckout.leadId}
          postcode={myActiveCheckout.postcode}
          jobType={myActiveCheckout.jobType}
          onCancel={() => {
            releaseLead();
            toast.info("Checkout cancelled");
          }}
          onExpired={() => {
            releaseLead();
            toast.error("Your checkout session has expired. Please try again.");
          }}
        />
      )}
      
      <Footer variant="cleaner" hideCta />
    </div>
  );
}
