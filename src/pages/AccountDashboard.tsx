import { Navigate } from "react-router-dom";
import { PageLoader } from "@/components/PageLoader";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardFor, getProviderAccountType } from "@/lib/accountType";

export default function AccountDashboard() {
  const { user, profile, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <Navigate to={dashboardFor(getProviderAccountType(user, profile?.account_type))} replace />;
}
