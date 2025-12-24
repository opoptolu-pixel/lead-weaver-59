import { useState, useEffect } from "react";
import { Menu, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";

export const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const isForCleanersPage = location.pathname === "/for-cleaners";

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const navLinks = [
    { label: "Get Quotes", id: "/request-cleaning", type: "link" },
    { label: "Services", id: "services", type: "scroll" },
    { label: "How It Works", id: "how-it-works", type: "scroll" },
    { label: "FAQ", id: "faq", type: "scroll" },
    isForCleanersPage 
      ? { label: "Browse Leads", id: "/leads", type: "link" }
      : { label: "For Cleaners", id: "/for-cleaners", type: "link" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-background/95 backdrop-blur-md shadow-card border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Logo size="lg" />

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              link.type === "link" ? (
                <Link
                  key={link.id}
                  to={link.id}
                  className={`text-sm font-medium transition-colors hover:text-secondary ${
                    isScrolled ? "text-foreground" : "text-primary-foreground/90"
                  }`}
                >
                  {link.label}
                </Link>
              ) : (
                <button
                  key={link.id}
                  onClick={() => scrollToSection(link.id)}
                  className={`text-sm font-medium transition-colors hover:text-secondary ${
                    isScrolled ? "text-foreground" : "text-primary-foreground/90"
                  }`}
                >
                  {link.label}
                </button>
              )
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Link to="/dashboard">
                <Button 
                  variant={isScrolled ? "cta" : "hero"} 
                  size="default"
                  className="gap-2"
                >
                  <User className="w-4 h-4" />
                  Dashboard
                </Button>
              </Link>
            ) : isForCleanersPage ? (
              <>
                <Link to="/auth">
                  <Button 
                    variant={isScrolled ? "ghost" : "outlineHero"} 
                    size="default"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth?mode=signup">
                  <Button 
                    variant={isScrolled ? "cta" : "hero"} 
                    size="default"
                  >
                    Join Now
                  </Button>
                </Link>
              </>
            ) : null}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className={`w-6 h-6 ${isScrolled ? "text-foreground" : "text-primary-foreground"}`} />
            ) : (
              <Menu className={`w-6 h-6 ${isScrolled ? "text-foreground" : "text-primary-foreground"}`} />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-background border-t border-border py-6 px-4 animate-fade-in">
            <nav className="flex flex-col gap-4">
              {navLinks.map((link) => (
                link.type === "link" ? (
                  <Link
                    key={link.id}
                    to={link.id}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-foreground text-base font-medium py-2 text-left hover:text-secondary transition-colors"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <button
                    key={link.id}
                    onClick={() => scrollToSection(link.id)}
                    className="text-foreground text-base font-medium py-2 text-left hover:text-secondary transition-colors"
                  >
                    {link.label}
                  </button>
                )
              ))}
              {user ? (
                <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button variant="cta" size="lg" className="w-full mt-4 gap-2">
                    <User className="w-4 h-4" />
                    Dashboard
                  </Button>
                </Link>
              ) : isForCleanersPage ? (
                <div className="flex flex-col gap-3 mt-4">
                  <Link to="/auth" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="outline" size="lg" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/auth?mode=signup" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="cta" size="lg" className="w-full">
                      Join Now
                    </Button>
                  </Link>
                </div>
              ) : null}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};
