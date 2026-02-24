import { useState, useRef, useEffect } from "react";
import { Search, Sparkles, ChevronDown, Check, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { trackCTAClick } from "@/lib/analytics";
import { Json } from "@/integrations/supabase/types";

// Cleaning types matching request cleaning page
const fullCleaningTypes = [
  { id: "carpet-2-3-rooms", label: "Carpet Cleaning (2-3 Rooms)" },
  { id: "sofa-carpet", label: "Sofa + Carpet Cleaning" },
  { id: "sofa-mattress", label: "Sofa + Mattress Cleaning" },
  { id: "carpet-mattress", label: "Carpet + Mattress Cleaning" },
  { id: "3-rooms-deep-clean", label: "Deep Clean (3+ Rooms)" },
  { id: "end-of-tenancy", label: "End of Tenancy Clean" },
  { id: "airbnb-refresh", label: "Airbnb / Short-Let Refresh" },
  { id: "move-in-out", label: "Move-In / Move-Out Clean" },
  { id: "post-tenancy-upholstery", label: "Post-Tenancy Carpet & Upholstery" },
  { id: "one-off-deep", label: "One-Off Deep Clean" },
  { id: "office-carpet-upholstery", label: "Office Carpet + Upholstery Clean" },
  { id: "post-construction", label: "Post-Construction Deep Clean" },
  { id: "large-window-interior", label: "Large Property Window + Interior" },
  { id: "multi-room-upholstery", label: "Multi-Room + Upholstery Deep Clean" },
];

const simplifiedCleaningTypes = [
  { id: "end-of-tenancy", label: "End of Tenancy Clean" },
  { id: "move-in-out", label: "Move-In / Move-Out Clean" },
  { id: "one-off-deep", label: "One-Off Deep Clean" },
  { id: "weekly-routine", label: "Weekly Routine Clean" },
  { id: "post-construction", label: "Post-Construction Deep Clean" },
];

interface UKLocation {
  postcode: string;
  area: string;
  type: 'postcode' | 'place' | 'city';
}

export const CustomerHeroSection = () => {
  const [formVariant, setFormVariant] = useState<'full' | 'simplified'>('full');
  const cleaningTypes = formVariant === 'simplified' ? simplifiedCleaningTypes : fullCleaningTypes;

  const [selectedType, setSelectedType] = useState(fullCleaningTypes[0]);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [postcode, setPostcode] = useState("");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [showPostcodeSuggestions, setShowPostcodeSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ukLocations, setUkLocations] = useState<UKLocation[]>([]);
  const [matchedCity, setMatchedCity] = useState<string | null>(null);
  
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const postcodeRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setIsTypeOpen(false);
      }
      if (postcodeRef.current && !postcodeRef.current.contains(e.target as Node)) {
        setShowPostcodeSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch form variant setting
  useEffect(() => {
    const fetchVariant = async () => {
      try {
        const { data } = await supabase
          .from("admin_settings")
          .select("value")
          .eq("key", "request_form_variant")
          .maybeSingle();
        
        if (data?.value && typeof data.value === 'object' && 'variant' in (data.value as Record<string, Json>)) {
          const variant = (data.value as { variant: string }).variant;
          setFormVariant(variant === 'simplified' ? 'simplified' : 'full');
          // Update selected type to first of active list
          const types = variant === 'simplified' ? simplifiedCleaningTypes : fullCleaningTypes;
          setSelectedType(types[0]);
        }
      } catch (err) {
        console.error("Failed to fetch form variant:", err);
      }
    };
    fetchVariant();
  }, []);

  // Fetch UK locations based on postcode search
  useEffect(() => {
    const fetchLocations = async () => {
      if (!postcode.trim() || postcode.length < 2) {
        setUkLocations([]);
        setMatchedCity(null);
        return;
      }

      setIsLoading(true);
      try {
        const response = await supabase.functions.invoke('search-uk-locations', {
          body: { query: postcode.trim() }
        });

        if (response.data?.success) {
          setUkLocations(response.data.locations || []);
          setMatchedCity(response.data.matchedCity || null);
        } else {
          setUkLocations([]);
          setMatchedCity(null);
        }
      } catch (err) {
        console.error("Location search error:", err);
        setUkLocations([]);
        setMatchedCity(null);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchLocations, 300);
    return () => clearTimeout(debounce);
  }, [postcode]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (postcode.trim()) {
      trackCTAClick("Get Quotes", "hero_section");
      
      // If a city was selected (not a full postcode), navigate to step 2 for postcode entry
      // Otherwise navigate with the full postcode to step 3
      navigate('/request-cleaning', {
        state: {
          type: selectedType.id,
          postcode: selectedCity ? "" : postcode.trim().toUpperCase(), // Empty if city, so user enters full postcode
          cityName: selectedCity || null // Pass city name for display
        }
      });
    }
  };

  const handleLocationSelect = (location: UKLocation) => {
    setShowPostcodeSuggestions(false);
    
    if (location.type === 'city') {
      // For cities, show the city name in the input and track it
      const cityName = matchedCity 
        ? matchedCity.charAt(0).toUpperCase() + matchedCity.slice(1)
        : location.area.split('(')[0].trim();
      setPostcode(cityName);
      setSelectedCity(cityName);
      // Don't auto-navigate for cities - user needs to click Get Quotes
    } else {
      // For full postcodes, set the postcode and auto-navigate
      setPostcode(location.postcode);
      setSelectedCity(null);
      trackCTAClick("Postcode Selected", "hero_section");
      navigate('/request-cleaning', {
        state: {
          type: selectedType.id,
          postcode: location.postcode.toUpperCase()
        }
      });
    }
  };

  return (
    <header className="relative min-h-[70vh] bg-hero-gradient flex items-center pt-24 pb-32 z-10" role="banner">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-20 right-10 w-72 h-72 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-secondary/20 backdrop-blur-sm border border-secondary/30 rounded-full px-4 py-2 mb-8">
            <Sparkles className="w-4 h-4 text-secondary" aria-hidden="true" />
            <span className="text-secondary-foreground text-sm font-medium">
              Get Free Quotes in 24 Hours
            </span>
          </div>

          {/* Main headline - Customer focused with strong SEO keywords */}
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6 leading-tight">
            Find Trusted <span className="text-secondary">Cleaning Services</span> Near You
          </h1>

          {/* Subheadline with SEO-friendly copy */}
          <p className="text-lg md:text-xl text-primary-foreground/80 mb-10 max-w-xl mx-auto">
            Connect with verified local cleaners for deep cleaning, end of tenancy, carpet cleaning and more. Fast, free, and no obligation.
          </p>

          {/* Search form - Type + Postcode */}
          <form onSubmit={handleSearch} className="relative z-20">
            <div className="relative max-w-2xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-3 bg-background p-2 rounded-2xl shadow-2xl">
              {/* Cleaning Type Dropdown */}
              <div className="relative flex-1" ref={typeDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsTypeOpen(!isTypeOpen)}
                  className={cn(
                    "w-full h-14 px-4 text-left flex items-center justify-between rounded-xl border-2 transition-all",
                    isTypeOpen ? "border-secondary bg-secondary/5" : "border-transparent hover:border-border"
                  )}
                >
                  <span className="font-medium text-foreground">{selectedType.label}</span>
                  <ChevronDown className={cn(
                    "w-5 h-5 text-muted-foreground transition-transform",
                    isTypeOpen && "rotate-180"
                  )} />
                </button>

                {/* Dropdown menu */}
                {isTypeOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-2xl z-[9999] overflow-hidden max-h-64 overflow-y-auto">
                    {cleaningTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          setSelectedType(type);
                          setIsTypeOpen(false);
                        }}
                        className={cn(
                          "w-full px-4 py-3 text-left hover:bg-muted transition-colors",
                          selectedType.id === type.id && "bg-secondary/10 font-semibold"
                        )}
                      >
                        <span className="text-foreground">{type.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Postcode Input */}
              <div className="relative flex-1 min-w-[200px]" ref={postcodeRef}>
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
                <Input
                  type="text"
                  placeholder="Postcode or city"
                  value={postcode}
                  onChange={(e) => {
                    setPostcode(e.target.value);
                    setSelectedCity(null); // Clear city selection when user types manually
                  }}
                  onFocus={() => setShowPostcodeSuggestions(true)}
                  className="pl-12 pr-4 h-14 text-base bg-transparent border-2 border-transparent rounded-xl focus:border-secondary tracking-wide w-full"
                />

                {/* Postcode suggestions */}
                {showPostcodeSuggestions && (ukLocations.length > 0 || isLoading) && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-2xl z-[9999] overflow-hidden">
                    {isLoading ? (
                      <div className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Searching UK locations...
                      </div>
                    ) : (
                      <>
                        <div className="p-2 text-xs text-muted-foreground font-medium border-b border-border bg-muted/50">
                          <MapPin className="w-3 h-3 inline mr-1" />
                          UK Locations
                        </div>
                        {ukLocations.slice(0, 6).map((location, idx) => (
                          <button
                            key={`${location.postcode}-${idx}`}
                            type="button"
                            onClick={() => handleLocationSelect(location)}
                            className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-3"
                          >
                            <MapPin className={`w-4 h-4 flex-shrink-0 ${location.type === 'city' ? 'text-primary' : 'text-secondary'}`} />
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-foreground">
                                {location.type === 'city' 
                                  ? (matchedCity ? matchedCity.charAt(0).toUpperCase() + matchedCity.slice(1) : location.area.split('(')[0].trim())
                                  : location.postcode}
                              </span>
                              {location.type !== 'city' && (
                                <span className="text-sm text-muted-foreground ml-2">{location.area}</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Search Button */}
              <Button 
                type="submit"
                variant="cta" 
                size="xl"
                className="h-14 px-8 text-base font-semibold shadow-lg"
                disabled={!postcode.trim()}
              >
                <Search className="w-5 h-5 mr-2" />
                Get Quotes
              </Button>
              </div>
            </div>
          </form>

          {!isTypeOpen && !showPostcodeSuggestions && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-primary-foreground/70 text-sm">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-secondary" />
                <span>100% Free</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-secondary" />
                <span>Verified Partners</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-secondary" />
                <span>Quick Response</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-secondary" />
                <span>No Obligation</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom wave - z-index lower than form dropdown */}
      <div className="absolute -bottom-1 left-0 right-0 pointer-events-none z-0" aria-hidden="true">
        <svg viewBox="0 0 1440 80" fill="none" preserveAspectRatio="none" className="w-full h-20 block" aria-hidden="true">
          <path
            d="M0 80L60 70C120 60 240 40 360 30C480 20 600 20 720 25C840 30 960 40 1080 45C1200 50 1320 50 1380 50L1440 50V80H1380C1320 80 1200 80 1080 80C960 80 840 80 720 80C600 80 480 80 360 80C240 80 120 80 60 80H0Z"
            fill="hsl(var(--background))"
          />
        </svg>
      </div>
    </header>
  );
};
