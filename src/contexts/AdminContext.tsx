import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, subDays, subMonths, startOfMonth } from "date-fns";

export type DateRangePreset = "today" | "yesterday" | "3d" | "7d" | "14d" | "30d" | "thismonth" | "lastmonth" | "alltime" | "custom";

interface AdminContextType {
  isAdmin: boolean;
  isLoading: boolean;
  dateRange: DateRangePreset;
  setDateRange: (range: DateRangePreset) => void;
  customStartDate: Date | null;
  customEndDate: Date | null;
  setCustomDates: (start: Date | null, end: Date | null) => void;
  getDateFilter: () => { start: Date; end: Date };
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangePreset>("30d");
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  useEffect(() => {
    // Don't check admin status until auth is done loading
    if (authLoading) {
      return;
    }

    // If no user, immediately set not admin and stop loading
    if (!user) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    
    const checkAdminStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (!isMounted) return;

        if (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
        } else if (data && data.length > 0) {
          const hasAdminRole = data.some(
            (r) => r.role === "admin" || r.role === "super_admin"
          );
          setIsAdmin(hasAdminRole);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Error checking admin status:", err);
        if (isMounted) setIsAdmin(false);
      }
      if (isMounted) setIsLoading(false);
    };

    checkAdminStatus();
    
    return () => {
      isMounted = false;
    };
  }, [user?.id, authLoading]);

  const setCustomDates = (start: Date | null, end: Date | null) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
  };

  const getDateFilter = useMemo(() => {
    return () => {
      const now = new Date();
      let start: Date;
      let end: Date = endOfDay(now);

      switch (dateRange) {
        case "today":
          start = startOfDay(now);
          break;
        case "yesterday":
          const yesterday = subDays(now, 1);
          start = startOfDay(yesterday);
          end = endOfDay(yesterday);
          break;
        case "3d":
          start = startOfDay(subDays(now, 3));
          break;
        case "7d":
          start = startOfDay(subDays(now, 7));
          break;
        case "14d":
          start = startOfDay(subDays(now, 14));
          break;
        case "30d":
          start = startOfDay(subDays(now, 30));
          break;
        case "thismonth":
          start = startOfMonth(now);
          break;
        case "lastmonth":
          const lastMonth = subMonths(now, 1);
          start = startOfMonth(lastMonth);
          end = endOfDay(subDays(startOfMonth(now), 1));
          break;
        case "alltime":
          start = new Date(2020, 0, 1);
          break;
        case "custom":
          start = customStartDate ? startOfDay(customStartDate) : startOfDay(subDays(now, 30));
          end = customEndDate ? endOfDay(customEndDate) : endOfDay(now);
          break;
        default:
          start = startOfDay(subDays(now, 30));
      }

      return { start, end };
    };
  }, [dateRange, customStartDate, customEndDate]);

  return (
    <AdminContext.Provider
      value={{
        isAdmin,
        isLoading,
        dateRange,
        setDateRange,
        customStartDate,
        customEndDate,
        setCustomDates,
        getDateFilter,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextType {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}