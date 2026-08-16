import { forwardRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, UserRound, Headphones, Search, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { getProviderAccountType } from "@/lib/accountType";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

const cleanerNavItems: NavItem[] = [
  { label: "Jobs", icon: Home, href: "/cleaner/dashboard" },
  { label: "Application", icon: UserRound, href: "/cleaner/settings" },
  { label: "Support", icon: Headphones, href: "/support" },
];

const businessNavItems: NavItem[] = [
  { label: "Dashboard", icon: Home, href: "/business/dashboard" },
  { label: "Leads", icon: Search, href: "/leads" },
  { label: "Billing", icon: CreditCard, href: "/billing" },
  { label: "Settings", icon: UserRound, href: "/business/settings" },
];

export const MobileBottomNav = forwardRef<HTMLElement>((_, ref) => {
  const location = useLocation();
  const { user, profile } = useAuth();

  const businessRoutes = ["/business/", "/leads", "/billing", "/performance", "/settings/verification"];
  const cleanerRoutes = ["/cleaner/", "/support"];
  const isBusiness = businessRoutes.some((route) => location.pathname.startsWith(route)) || (location.pathname.startsWith("/support") && getProviderAccountType(user, profile?.account_type) === "business");
  const shouldShow = isBusiness || cleanerRoutes.some((route) => location.pathname.startsWith(route));
  const navItems = isBusiness ? businessNavItems : cleanerNavItems;

  if (!shouldShow) return null;

  return (
    <nav ref={ref} className="cleaner-bottom-nav fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "nav-item flex flex-col items-center justify-center w-full h-full gap-0.5 text-[0.6875rem] transition-colors duration-200",
                isActive
                  ? "text-secondary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("nav-icon", isActive && "fill-secondary/20")} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
});

MobileBottomNav.displayName = "MobileBottomNav";
