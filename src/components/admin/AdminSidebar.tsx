import { Link, useLocation, useNavigate } from "react-router-dom";
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
  Headphones,
  Mail,
  PoundSterling,
  MessageSquare,
  X,
  Link2,
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
import { ScrollArea } from "@/components/ui/scroll-area";

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
  { title: "UTM Builder", url: "/admin/utm-builder", icon: Link2 },
  { title: "Email Templates", url: "/admin/email-templates", icon: Mail },
  { title: "Support", url: "/admin/support", icon: Headphones },
  { title: "Subscribers", url: "/admin/subscribers", icon: Users },
  { title: "Activity Logs", url: "/admin/activity-logs", icon: Activity },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

const SIDEBAR_COLLAPSED_KEY = "admin-sidebar-collapsed";

interface AdminSidebarProps {
  onNavigate?: () => void;
}

export default function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
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

  const handleNavClick = (url: string) => {
    navigate(url);
    onNavigate?.();
  };

  const NavItem = ({ item }: { item: typeof navItems[0] }) => {
    const active = isActive(item.url);
    
    const linkContent = (
      <button
        onClick={() => handleNavClick(item.url)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 w-full text-left",
          active
            ? "bg-secondary/15 text-secondary font-semibold"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          collapsed && "justify-center px-2"
        )}
      >
        <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
        {!collapsed && <span>{item.title}</span>}
      </button>
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
          "bg-card border-r border-border/60 h-screen flex flex-col transition-all duration-300 flex-shrink-0",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "h-14 md:h-16 flex items-center border-b border-border flex-shrink-0",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}>
          {!collapsed && (
            <Logo size="sm" linkTo="/admin" />
          )}
          
          {/* Desktop collapse button */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(!collapsed)}
                className="h-8 w-8 hidden md:flex"
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

          {/* Mobile close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onNavigate}
            className="h-8 w-8 md:hidden"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-1">
            {navItems.map((item) => (
              <NavItem key={item.url} item={item} />
            ))}
          </nav>
        </ScrollArea>

        {/* Back to main site */}
        <div className="p-2 border-t border-border flex-shrink-0">
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNavClick("/")}
                  className="flex items-center justify-center px-2 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Back to Site</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => handleNavClick("/")}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Back to Site</span>
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
