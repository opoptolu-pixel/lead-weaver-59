import { useState, useRef, useEffect } from "react";
import { Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

const POPULAR_SEARCHES = [
  "London", "Manchester", "Birmingham", "Leeds", "Liverpool",
  "Bristol", "Sheffield", "Edinburgh", "Glasgow", "Cardiff",
  "SW1", "E1", "M1", "B1", "LS1", "L1", "BS1", "S1", "EH1", "G1"
];

export const HeroSection = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const filteredSuggestions = searchQuery.trim()
    ? POPULAR_SEARCHES.filter(s => 
        s.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : POPULAR_SEARCHES.slice(0, 6);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (searchQuery.trim()) {
      navigate(`/leads?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/leads");
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    navigate(`/leads?search=${encodeURIComponent(suggestion)}`);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
              <div className="relative flex-1" ref={searchInputRef}>
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground z-10" />
                <Input
                  type="text"
                  placeholder="Enter postcode or city (e.g. SW1, Manchester)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  className="pl-14 h-16 text-lg bg-background border-2 border-border rounded-xl shadow-xl focus:border-secondary"
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-2 text-xs text-muted-foreground font-medium border-b border-border">
                      Popular searches
                    </div>
                    {filteredSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full px-4 py-3 text-left text-foreground hover:bg-muted transition-colors flex items-center gap-3"
                      >
                        <Search className="w-4 h-4 text-muted-foreground" />
                        {suggestion}
                      </button>
                    ))}
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
