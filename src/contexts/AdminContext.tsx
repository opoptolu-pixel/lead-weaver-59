import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";

type DateRange = "today" | "7d" | "30d" | "custom";

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
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      console.log("AdminContext: checking admin status, user:", user?.id);
      
      if (!user) {
        console.log("AdminContext: no user, setting isAdmin to false");
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        console.log("AdminContext: user_roles query result:", { data, error });

        if (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
        } else if (data && data.length > 0) {
          const hasAdminRole = data.some(
            (r) => r.role === "admin" || r.role === "super_admin"
          );
          console.log("AdminContext: hasAdminRole:", hasAdminRole);
          setIsAdmin(hasAdminRole);
        } else {
          console.log("AdminContext: no roles found");
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Error checking admin status:", err);
        setIsAdmin(false);
      }
      setIsLoading(false);
    };

    checkAdminStatus();
  }, [user]);

  const setCustomDates = (start: Date | null, end: Date | null) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
  };

  const getDateFilter = () => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    let start: Date;

    switch (dateRange) {
      case "today":
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case "7d":
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case "30d":
        start = new Date(now);
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        break;
      case "custom":
        start = customStartDate || new Date(now.setDate(now.getDate() - 30));
        return {
          start,
          end: customEndDate || end,
        };
      default:
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
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