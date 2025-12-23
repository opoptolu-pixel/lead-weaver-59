import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  AlertTriangle,
  BarChart3,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Logo } from "@/components/Logo";

const navItems = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard },
  { title: "Lead Pipeline", url: "/admin/leads", icon: FileText },
  { title: "Businesses", url: "/admin/businesses", icon: Users },
  { title: "Verifications", url: "/admin/verifications", icon: Shield },
  { title: "Payments", url: "/admin/payments", icon: CreditCard },
  { title: "Disputes", url: "/admin/disputes", icon: AlertTriangle },
  { title: "Fraud & Risk", url: "/admin/fraud", icon: ShieldAlert },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
  { title: "Activity Logs", url: "/admin/activity-logs", icon: Activity },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

export default function AdminSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={cn(
        "bg-card border-r border-border h-screen sticky top-0 flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <Logo size="sm" linkTo="/admin" />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("h-8 w-8", collapsed && "mx-auto")}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.url}
            to={item.url}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive(item.url)
                ? "bg-secondary/20 text-secondary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title={collapsed ? item.title : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </Link>
        ))}
      </nav>

      {/* Back to main site */}
      <div className="p-2 border-t border-border">
        <Link
          to="/"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          )}
        >
          <ChevronLeft className="w-5 h-5" />
          {!collapsed && <span>Back to Site</span>}
        </Link>
      </div>
    </aside>
  );
}