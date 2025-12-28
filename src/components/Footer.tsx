import { forwardRef } from "react";
import { Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

interface FooterProps {
  hideCta?: boolean;
  variant?: 'customer' | 'cleaner';
}

export const Footer = forwardRef<HTMLElement, FooterProps>(({ hideCta = false, variant = 'customer' }, ref) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer ref={ref} className="bg-primary text-primary-foreground relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-3xl translate-y-1/2" />
      </div>

      {/* CTA Section - only show on customer-facing pages */}
      {!hideCta && (
        <div className="relative border-b border-white/10">
          <div className="container mx-auto px-4 py-16">
            <div className="max-w-4xl mx-auto text-center">
              {variant === 'cleaner' ? (
                <>
                  <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                    Ready to Grow Your Business?
                  </h2>
                  <p className="text-primary-foreground/70 text-lg mb-8 max-w-xl mx-auto">
                    Join Cleanda today and start receiving quality leads in your area. No upfront fees—pay only for the leads you want.
                  </p>
                  <Link to="/auth">
                    <Button variant="cta" size="lg" className="shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5">
                      Register Your Business
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                    Ready for a Sparkling Clean Home?
                  </h2>
                  <p className="text-primary-foreground/70 text-lg mb-8 max-w-xl mx-auto">
                    Get matched with a verified local cleaner today. It's free, fast, and hassle-free.
                  </p>
                  <Link to="/request-cleaning">
                    <Button variant="cta" size="lg" className="shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5">
                      Get Your Free Quote
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Footer */}
      <div className="container mx-auto px-4 py-16 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <Logo size="md" variant="white" linkTo="/" />
            </div>
            <p className="text-primary-foreground/70 text-sm mb-4 max-w-sm leading-relaxed">
              Cleanda is a platform that connects customers with independent cleaning businesses. We do not provide cleaning services directly.
            </p>
            <p className="text-primary-foreground/70 text-sm mb-6 max-w-sm leading-relaxed">
              Get free quotes from verified local cleaning partners across the UK.
            </p>
            <div className="space-y-3 mb-6">
              <a href="mailto:hello@cleanda.co.uk" className="flex items-center gap-3 text-sm text-primary-foreground/70 hover:text-secondary transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center transition-colors group-hover:bg-secondary">
                  <Mail className="w-5 h-5" />
                </div>
                <span>hello@cleanda.co.uk</span>
              </a>
              <a href="tel:07757188197" className="flex items-center gap-3 text-sm text-primary-foreground/70 hover:text-secondary transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center transition-colors group-hover:bg-secondary">
                  <Phone className="w-5 h-5" />
                </div>
                <span>07757 188 197</span>
              </a>
              <div className="flex items-center gap-3 text-sm text-primary-foreground/70">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <span>128 City Road, London, EC1V 2NX</span>
              </div>
            </div>
            <div className="text-xs text-primary-foreground/50 space-y-1">
              <p>Orbit Shade Ltd · Company No. 15337705</p>
              <p>Registered in England and Wales</p>
            </div>
          </div>

          {/* For Customers */}
          <div>
            <h4 className="font-heading font-bold text-sm uppercase tracking-wider mb-6 text-primary-foreground">
              Get Cleaning
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/request-cleaning" className="text-primary-foreground/70 hover:text-secondary transition-colors">
                  Get Free Quotes
                </Link>
              </li>
              <li>
                <Link to="/#services" className="text-primary-foreground/70 hover:text-secondary transition-colors">
                  Our Services
                </Link>
              </li>
              <li>
                <Link to="/#how-it-works" className="text-primary-foreground/70 hover:text-secondary transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link to="/#faq" className="text-primary-foreground/70 hover:text-secondary transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* For Cleaners */}
          <div>
            <h4 className="font-heading font-bold text-sm uppercase tracking-wider mb-6 text-primary-foreground">
              For Cleaners
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/for-cleaners" className="text-primary-foreground/70 hover:text-secondary transition-colors">
                  Join Our Network
                </Link>
              </li>
              <li>
                <Link to="/leads" className="text-primary-foreground/70 hover:text-secondary transition-colors">
                  Browse Leads
                </Link>
              </li>
              <li>
                <Link to="/auth" className="text-primary-foreground/70 hover:text-secondary transition-colors">
                  Cleaner Login
                </Link>
              </li>
              <li>
                <Link to="/for-cleaners#pricing" className="text-primary-foreground/70 hover:text-secondary transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-heading font-bold text-sm uppercase tracking-wider mb-6 text-primary-foreground">
              Legal & Support
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/contact" className="text-primary-foreground/70 hover:text-secondary transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="text-primary-foreground/70 hover:text-secondary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms-of-use" className="text-primary-foreground/70 hover:text-secondary transition-colors">
                  Terms of Use
                </Link>
              </li>
              <li>
                <Link to="/refund-policy" className="text-primary-foreground/70 hover:text-secondary transition-colors">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link to="/gdpr" className="text-primary-foreground/70 hover:text-secondary transition-colors">
                  GDPR Compliance
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10 relative">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-center md:text-left">
              <p className="text-sm text-primary-foreground/50">
                © {currentYear} Cleanda. All rights reserved.
              </p>
              <p className="text-xs text-primary-foreground/40 mt-1">
                Cleanda is a trading name of Orbit Shade Ltd.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://x.com/cleandauk" target="_blank" rel="noopener noreferrer" aria-label="Follow us on X (Twitter)" className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-primary-foreground/70 hover:bg-secondary hover:text-secondary-foreground transition-all duration-300">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://facebook.com/cleandauk" target="_blank" rel="noopener noreferrer" aria-label="Follow us on Facebook" className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-primary-foreground/70 hover:bg-secondary hover:text-secondary-foreground transition-all duration-300">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg>
              </a>
              <a href="https://instagram.com/cleandauk" target="_blank" rel="noopener noreferrer" aria-label="Follow us on Instagram" className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-primary-foreground/70 hover:bg-secondary hover:text-secondary-foreground transition-all duration-300">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
            </div>
          </div>
          
          {/* Disclaimers */}
          <div className="mt-6 pt-4 border-t border-white/5">
            <p className="text-xs text-primary-foreground/40 text-center leading-relaxed">
              This site is not a part of the Facebook website or Facebook Inc. Additionally, this site is not endorsed by Facebook in any way. 
              Facebook is a trademark of Facebook, Inc. This site is not a part of Google or Google LLC. Additionally, this site is not endorsed by Google in any way. 
              Google is a trademark of Google LLC.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";