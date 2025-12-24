import { useAdmin } from "@/contexts/AdminContext";
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
import { CalendarIcon, LogOut, User, Wifi, WifiOff } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface AdminTopBarProps {
  title: string;
}

export default function AdminTopBar({ title }: AdminTopBarProps) {
  const { dateRange, setDateRange, customStartDate, customEndDate, setCustomDates } = useAdmin();
  const { user, signOut } = useAuth();
  const [showCalendar, setShowCalendar] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

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
    <header className="h-16 bg-card border-b border-border px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-xl font-bold text-foreground">{title}</h1>
        
        {/* Live Connection Indicator */}
        <Badge 
          variant={isRealtimeConnected ? "default" : "secondary"}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium transition-all",
            isRealtimeConnected 
              ? "bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/30" 
              : "bg-muted text-muted-foreground"
          )}
        >
          {isRealtimeConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Live
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              Offline
            </>
          )}
        </Badge>
      </div>

      <div className="flex items-center gap-4">
        {/* Date Range Filter */}
        <div className="flex items-center gap-2">
          <Select
            value={dateRange}
            onValueChange={(value: "today" | "yesterday" | "7d" | "30d" | "custom") => setDateRange(value)}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
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
                />
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-2 pl-4 border-l border-border">
          <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
            <User className="w-4 h-4 text-secondary" />
          </div>
          <span className="text-sm text-muted-foreground hidden md:block">
            {user?.email}
          </span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}