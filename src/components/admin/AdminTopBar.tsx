import { useAdmin, DateRangePreset } from "@/contexts/AdminContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarIcon, LogOut, User, WifiOff, Menu, Filter } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface AdminTopBarProps {
  title: string;
  onMenuClick?: () => void;
}

export default function AdminTopBar({ title, onMenuClick }: AdminTopBarProps) {
  const { dateRange, setDateRange, customStartDate, customEndDate, setCustomDates } = useAdmin();
  const { user, signOut } = useAuth();
  const [showCalendar, setShowCalendar] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Track realtime connection status
  useEffect(() => {
    const channel = supabase
      .channel('connection-status')
      .on('presence', { event: 'sync' }, () => {
        setIsRealtimeConnected(true);
      })
      .subscribe((status) => {
        console.log('Realtime connection status:', status);
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <header className="h-14 md:h-16 bg-card/80 backdrop-blur-md border-b border-border/60 px-3 md:px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9 flex-shrink-0"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <h1 className="font-heading text-base md:text-xl font-bold text-foreground truncate tracking-tight">{title}</h1>
        
        {/* Live Connection Indicator - smaller on mobile */}
        <Badge 
          variant={isRealtimeConnected ? "default" : "secondary"}
          className={cn(
            "flex items-center gap-1 md:gap-1.5 text-[10px] md:text-xs font-medium transition-all flex-shrink-0",
            isRealtimeConnected 
              ? "bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/30" 
              : "bg-muted text-muted-foreground"
          )}
        >
          {isRealtimeConnected ? (
            <>
              <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-green-500"></span>
              </span>
              <span className="hidden sm:inline">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="w-2.5 h-2.5 md:w-3 md:h-3" />
              <span className="hidden sm:inline">Offline</span>
            </>
          )}
        </Badge>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Mobile filter button */}
        <Popover open={showMobileFilters} onOpenChange={setShowMobileFilters}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="md:hidden h-9 w-9">
              <Filter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="end">
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Date Range</p>
              <Select
                value={dateRange}
                onValueChange={(value: DateRangePreset) => {
                  setDateRange(value);
                  if (value !== "custom") setShowMobileFilters(false);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="3d">Last 3 days</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="14d">Last 14 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="lastmonth">Last Month</SelectItem>
                  <SelectItem value="alltime">All time</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              
              {dateRange === "custom" && (
                <Calendar
                  mode="range"
                  selected={{
                    from: customStartDate || undefined,
                    to: customEndDate || undefined,
                  }}
                  onSelect={(range) => {
                    setCustomDates(range?.from || null, range?.to || null);
                    if (range?.from && range?.to) {
                      setShowMobileFilters(false);
                    }
                  }}
                  numberOfMonths={1}
                  className="pointer-events-auto rounded-md border"
                />
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Desktop Date Range Filter */}
        <div className="hidden md:flex items-center gap-2">
          <Select
            value={dateRange}
            onValueChange={(value: DateRangePreset) => setDateRange(value)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="3d">Last 3 days</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="14d">Last 14 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="lastmonth">Last Month</SelectItem>
              <SelectItem value="alltime">All time</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          {dateRange === "custom" && (
            <Popover open={showCalendar} onOpenChange={setShowCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !customStartDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customStartDate && customEndDate ? (
                    <>
                      {format(customStartDate, "LLL dd")} -{" "}
                      {format(customEndDate, "LLL dd")}
                    </>
                  ) : (
                    <span>Pick dates</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{
                    from: customStartDate || undefined,
                    to: customEndDate || undefined,
                  }}
                  onSelect={(range) => {
                    setCustomDates(range?.from || null, range?.to || null);
                    if (range?.from && range?.to) {
                      setShowCalendar(false);
                    }
                  }}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Menu - Desktop */}
        <div className="hidden md:flex items-center gap-2 pl-4 border-l border-border">
          <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
            <User className="w-4 h-4 text-secondary" />
          </div>
          <span className="text-sm text-muted-foreground hidden lg:block">
            {user?.email}
          </span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>

        {/* User Menu - Mobile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
              <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
                <User className="w-4 h-4 text-secondary" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
