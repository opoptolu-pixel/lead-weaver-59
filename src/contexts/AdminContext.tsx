import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";

type DateRange = "today" | "yesterday" | "7d" | "30d" | "custom";

interface AdminContextType {
  isAdmin: boolean;
  isLoading: boolean;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
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
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  useEffect(() => {
    // Don't check admin status until auth is done loading
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

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
        setIsAdmin(false);
      }
      setIsLoading(false);
    };

    checkAdminStatus();
  }, [user, authLoading]);

  const setCustomDates = (start: Date | null, end: Date | null) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
  };

  const getDateFilter = () => {
    // Use UTC dates to match Supabase timestamp storage
    const now = new Date();
    
    // Create UTC start/end dates
    const createUTCDate = (date: Date, isEnd: boolean = false) => {
      const d = new Date(Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        isEnd ? 23 : 0,
        isEnd ? 59 : 0,
        isEnd ? 59 : 0,
        isEnd ? 999 : 0
      ));
      return d;
    };

    let start: Date;
    let end: Date;

    switch (dateRange) {
      case "today":
        start = createUTCDate(now);
        end = createUTCDate(now, true);
        break;
      case "yesterday":
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        start = createUTCDate(yesterday);
        end = createUTCDate(yesterday, true);
        break;
      case "7d":
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        start = createUTCDate(sevenDaysAgo);
        end = createUTCDate(now, true);
        break;
      case "30d":
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        start = createUTCDate(thirtyDaysAgo);
        end = createUTCDate(now, true);
        break;
      case "custom":
        start = customStartDate ? createUTCDate(customStartDate) : createUTCDate(new Date(now.setDate(now.getDate() - 30)));
        end = customEndDate ? createUTCDate(customEndDate, true) : createUTCDate(new Date(), true);
        return { start, end };
      default:
        const defaultStart = new Date(now);
        defaultStart.setDate(defaultStart.getDate() - 7);
        start = createUTCDate(defaultStart);
        end = createUTCDate(now, true);
    }

    return { start, end };
  };

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

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}