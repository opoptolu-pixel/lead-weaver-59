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
  Inbox,
  Mail,
  PoundSterling,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Logo } from "@/components/Logo";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard },
  { title: "Live Data", url: "/admin/live", icon: Activity },
  { title: "Lead Pipeline", url: "/admin/leads", icon: FileText },
  { title: "Business Inquiries", url: "/admin/inquiries", icon: Inbox },
  { title: "Contact Messages", url: "/admin/contact", icon: MessageSquare },
  { title: "Businesses", url: "/admin/businesses", icon: Users },
  { title: "Verifications", url: "/admin/verifications", icon: Shield },
  { title: "Accounting", url: "/admin/accounting", icon: PoundSterling },
  { title: "Payments", url: "/admin/payments", icon: CreditCard },
  { title: "Disputes", url: "/admin/disputes", icon: AlertTriangle },
  { title: "Fraud & Risk", url: "/admin/fraud", icon: ShieldAlert },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
  { title: "Email Templates", url: "/admin/email-templates", icon: Mail },
  { title: "Subscribers", url: "/admin/subscribers", icon: Users },
  { title: "Activity Logs", url: "/admin/activity-logs", icon: Activity },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

const SIDEBAR_COLLAPSED_KEY = "admin-sidebar-collapsed";

export default function AdminSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  const NavItem = ({ item }: { item: typeof navItems[0] }) => {
    const active = isActive(item.url);
    
    const linkContent = (
      <Link
        to={item.url}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          active
            ? "bg-secondary/20 text-secondary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          collapsed && "justify-center px-2"
        )}
      >
        <item.icon className="w-5 h-5 flex-shrink-0" />
        {!collapsed && <span>{item.title}</span>}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {linkContent}
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            <p>{item.title}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "bg-card border-r border-border h-screen flex flex-col transition-all duration-300 flex-shrink-0 overflow-y-auto",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "h-16 flex items-center border-b border-border",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}>
          {!collapsed && (
            <Logo size="sm" linkTo="/admin" />
          )}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(!collapsed)}
                className="h-8 w-8"
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{collapsed ? "Expand sidebar" : "Collapse sidebar"}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem key={item.url} item={item} />
          ))}
        </nav>

        {/* Back to main site */}
        <div className="p-2 border-t border-border">
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  to="/"
                  className="flex items-center justify-center px-2 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Back to Site</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              to="/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Back to Site</span>
            </Link>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}