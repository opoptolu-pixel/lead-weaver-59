import { forwardRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { BriefcaseBusiness, UserRound, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

const navItems: NavItem[] = [
  { label: "Jobs", icon: BriefcaseBusiness, href: "/dashboard?tab=jobs" },
  { label: "Profile", icon: UserRound, href: "/dashboard?tab=profile" },
  { label: "Support", icon: Headphones, href: "/dashboard?tab=support" },
];

export const MobileBottomNav = forwardRef<HTMLElement>((_, ref) => {
  const location = useLocation();

  const shouldShow = location.pathname === "/dashboard";

  if (!shouldShow) return null;

  return (
    <nav ref={ref} className="cleaner-bottom-nav fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const selectedTab = new URLSearchParams(location.search).get("tab") || "dashboard";
          const itemTab = new URLSearchParams(item.href.split("?")[1]).get("tab");
          const isActive = selectedTab === itemTab;
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
