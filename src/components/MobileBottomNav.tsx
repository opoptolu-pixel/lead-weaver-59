import { forwardRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Search, BarChart3, Settings, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: Home, href: "/dashboard" },
  { label: "Leads", icon: Search, href: "/leads" },
  { label: "Performance", icon: BarChart3, href: "/performance" },
  { label: "Billing", icon: CreditCard, href: "/billing" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export const MobileBottomNav = forwardRef<HTMLElement>((_, ref) => {
  const location = useLocation();

  // Only show on business dashboard routes
  const businessRoutes = ["/dashboard", "/leads", "/performance", "/billing", "/settings", "/disputes"];
  const shouldShow = businessRoutes.some((route) => location.pathname.startsWith(route));

  if (!shouldShow) return null;

  return (
    <nav ref={ref} className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1 text-xs transition-colors",
                isActive
                  ? "text-secondary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "fill-secondary/20")} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
});

MobileBottomNav.displayName = "MobileBottomNav";
