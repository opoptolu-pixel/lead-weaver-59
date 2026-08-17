import { Link, useLocation } from "react-router-dom";
import { CalendarDays, CreditCard, FileText, LayoutDashboard, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Overview", icon: LayoutDashboard, href: "/admin" },
  { label: "Requests", icon: FileText, href: "/admin/cleaning-requests" },
  { label: "Jobs", icon: CalendarDays, href: "/admin/jobs" },
  { label: "Cleaners", icon: Users, href: "/admin/cleaners" },
  { label: "Payments", icon: CreditCard, href: "/admin/payments" },
];

export default function AdminMobileNav() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/40 md:hidden pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1 px-1 text-[0.6875rem] transition-colors",
                active
                  ? "bg-secondary/10 text-secondary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "fill-secondary/15")} />
              <span className="max-w-full truncate font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
