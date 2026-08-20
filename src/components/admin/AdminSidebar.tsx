import { useLocation, useNavigate } from "react-router-dom";
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
  Headphones,
  X,
  BriefcaseBusiness,
  CalendarDays,
  UserCheck,
  ClipboardCheck,
  Mail,
  History,
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
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard },
  { title: "Cleaning Requests", url: "/admin/cleaning-requests", icon: FileText },
  { title: "Jobs & Schedule", url: "/admin/jobs", icon: CalendarDays },
  { title: "Cleaners", url: "/admin/cleaners", icon: Users },
  { title: "Onboarding & Checks", url: "/admin/onboarding", icon: UserCheck },
  { title: "Customers", url: "/admin/customers", icon: BriefcaseBusiness },
  { title: "Payments & Payouts", url: "/admin/payments", icon: CreditCard },
  { title: "Quality & Issues", url: "/admin/quality", icon: ClipboardCheck },
  { title: "Messages", url: "/admin/messages", icon: Headphones },
  { title: "Communications", url: "/admin/email-templates", icon: Mail },
  { title: "Reports", url: "/admin/reports", icon: BarChart3 },
  { title: "Audit Trail", url: "/admin/audit-trail", icon: History },
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
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const [expiringVerificationsCount, setExpiringVerificationsCount] = useState(0);

  // Fetch unread support messages count (user messages not read by admin)
  useEffect(() => {
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("support_messages")
        .select("*", { count: "exact", head: true })
        .eq("sender_type", "user")
        .eq("is_read", false);
      setUnreadSupportCount(count || 0);
    };
    fetchUnread();

    const channel = supabase
      .channel("admin-support-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, () => {
        fetchUnread();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Fetch expiring/expired insurance certificates count
  useEffect(() => {
    const fetchExpiring = async () => {
      const threeMonthsFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("verification_documents")
        .select("id, expiry_date")
        .eq("document_type", "insurance")
        .eq("status", "approved")
        .not("expiry_date", "is", null)
        .lte("expiry_date", threeMonthsFromNow);
      setExpiringVerificationsCount(data?.length || 0);
    };
    fetchExpiring();

    const channel = supabase
      .channel("admin-verification-expiring")
      .on("postgres_changes", { event: "*", schema: "public", table: "verification_documents" }, () => {
        fetchExpiring();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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
    const showBadge = item.url === "/admin/messages" && unreadSupportCount > 0;
    const showVerificationBadge = item.url === "/admin/onboarding" && expiringVerificationsCount > 0;
    const badgeCount = showBadge ? unreadSupportCount : showVerificationBadge ? expiringVerificationsCount : 0;
    const hasBadge = showBadge || showVerificationBadge;
    const badgeColor = showVerificationBadge ? "bg-amber-500 text-white" : "bg-destructive text-destructive-foreground";
    const linkContent = (
      <button
        onClick={() => handleNavClick(item.url)}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[0.8125rem] font-medium transition-all duration-200 w-full text-left group relative",
          active
            ? "bg-secondary/10 text-secondary font-semibold"
            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
          collapsed && "justify-center px-2"
        )}
      >
        <span className="relative">
          <item.icon className={cn(
            "w-[18px] h-[18px] flex-shrink-0 transition-all duration-200",
            active ? "text-secondary" : "text-muted-foreground group-hover:text-foreground"
          )} />
          {hasBadge && collapsed && (
            <span className={cn("absolute -top-1.5 -right-1.5 min-w-[16px] h-4 text-[10px] font-bold rounded-full flex items-center justify-center px-1", badgeColor)}>
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </span>
        {!collapsed && (
          <>
            <span className="tracking-[-0.01em] leading-tight flex-1">{item.title}</span>
            {hasBadge && (
              <span className={cn("min-w-[20px] h-5 text-[11px] font-bold rounded-full flex items-center justify-center px-1.5", badgeColor)}>
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
          </>
        )}
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
          "bg-card border-r border-border/30 h-screen flex flex-col transition-all duration-300 flex-shrink-0",
          collapsed ? "w-16" : "w-[17rem]"
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
